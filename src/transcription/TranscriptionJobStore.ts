/**
 * The transcription queue, in Postgres.
 *
 * Shaped after ScanRegistry: injected connection, schema from the migrations,
 * lazy pool resolution, every read scoped by userId.
 *
 * Why Postgres and not Redis/BullMQ, which is what call-intelligence-system
 * used: Whisper takes minutes, so pickup latency is under 0.2% of end-to-end
 * time, and `LISTEN/NOTIFY` gives ~1ms pickup anyway — the same order as a Redis
 * blocking pop. Redis would be a second datastore to run for no measurable gain.
 *
 * Two things make this an actual queue rather than a table workers race over:
 *
 *  - **`FOR UPDATE SKIP LOCKED`** on the claim. Without `SKIP LOCKED` a second
 *    worker blocks on the row the first is claiming; with it, it moves to the
 *    next one. Without `FOR UPDATE` both would claim the same job and transcribe
 *    the same audio twice.
 *  - **Stale-claim reclamation.** A worker killed mid-job (OOM is the common
 *    case with Whisper) leaves the row `running` forever. Nothing else would ever
 *    pick it up, so the work is silently lost — the user sees a job that never
 *    finishes and never errors.
 */

import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';
import type { TranscriptSegment } from './WhisperClient.js';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface TranscriptionJob {
  id: string;
  userId: string;
  audioPath: string;
  originalFilename: string;
  status: JobStatus;
  /** Null while unfinished. `''` is a real result — a silent recording. */
  transcript: string | null;
  segments: TranscriptSegment[];
  language: string | null;
  error: string | null;
  attempts: number;
  segmentsSeen: number;
  callTitle: string | null;
  callDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueInput {
  userId: string;
  audioPath: string;
  originalFilename: string;
  callTitle?: string;
  callDate?: string;
}

interface JobRow {
  id: string;
  user_id: string;
  audio_path: string;
  original_filename: string;
  status: string;
  transcript: string | null;
  segments: string | null;
  language: string | null;
  error: string | null;
  attempts: number;
  segments_seen: number;
  call_title: string | null;
  call_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Attempts before a job is failed for good.
 *
 * Bounded because the most likely failure — Whisper OOMing on a long file — is
 * deterministic: it will happen again. Retrying forever means a 30-minute job
 * blocking the queue indefinitely.
 */
export const MAX_ATTEMPTS = 3;

/**
 * How long a claim can go unrefreshed before another worker may take the job.
 *
 * Comfortably longer than any single Whisper run, because reclaiming a job that
 * is merely slow would transcribe the same audio twice concurrently — on 8 GB,
 * that is how you turn one slow job into two OOM kills.
 */
export const STALE_CLAIM_MS = 45 * 60 * 1000;

/** The channel workers listen on so a new job is picked up without polling. */
export const JOB_CHANNEL = 'transcription_jobs';

function toJob(row: JobRow): TranscriptionJob {
  return {
    id: row.id,
    userId: row.user_id,
    audioPath: row.audio_path,
    originalFilename: row.original_filename,
    status: row.status as JobStatus,
    transcript: row.transcript,
    segments: parseSegments(row.segments),
    language: row.language,
    error: row.error,
    attempts: row.attempts,
    segmentsSeen: row.segments_seen,
    callTitle: row.call_title,
    callDate: row.call_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Segments are stored as JSON text. Corrupt JSON degrades to an empty list
 * rather than throwing: the transcript itself is the load-bearing output, and
 * losing segment timings must not make a finished job unreadable.
 */
function parseSegments(raw: string | null): TranscriptSegment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TranscriptSegment[]) : [];
  } catch {
    return [];
  }
}

export class TranscriptionJobStore {
  private readonly injected?: PostgresHandle;

  constructor(pg?: PostgresHandle) {
    this.injected = pg;
  }

  /** Resolved per query — see ScanRegistry for why this is not in the constructor. */
  private get sql() {
    return (this.injected ?? getPool()).sql;
  }

  async enqueue(input: EnqueueInput): Promise<TranscriptionJob> {
    const id = randomUUID();

    const [row] = await this.sql<JobRow[]>`
      INSERT INTO transcription_jobs
        (id, user_id, audio_path, original_filename, call_title, call_date)
      VALUES (
        ${id}, ${input.userId}, ${input.audioPath}, ${input.originalFilename},
        ${input.callTitle ?? null}, ${input.callDate ?? null}
      )
      RETURNING *
    `;

    // Wakes an idle worker immediately. Fire-and-forget: a lost notification
    // costs one poll interval, never the job — the runner also sweeps on a
    // timer precisely so NOTIFY is an optimisation and not a dependency.
    await this.sql`SELECT pg_notify(${JOB_CHANNEL}, ${id})`;

    return toJob(row!);
  }

  /**
   * Claims the oldest queued job, or null when there is nothing to do.
   *
   * The subquery does the locking; the outer UPDATE does the claim. Doing it in
   * one statement is what makes it atomic — reading then updating separately
   * lets two workers read the same row before either writes.
   */
  async claimNext(): Promise<TranscriptionJob | null> {
    const [row] = await this.sql<JobRow[]>`
      UPDATE transcription_jobs
      SET status = 'running',
          claimed_at = (now() at time zone 'utc')::text,
          attempts = attempts + 1,
          updated_at = (now() at time zone 'utc')::text
      WHERE id = (
        SELECT id FROM transcription_jobs
        WHERE status = 'queued'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *
    `;

    return row ? toJob(row) : null;
  }

  /**
   * Returns jobs abandoned by a dead worker to the queue, or fails them if they
   * are out of attempts.
   *
   * Called on startup and periodically. Without it, a worker that is OOM-killed
   * mid-transcription leaves a row `running` that nothing will ever touch again.
   */
  async reclaimStale(staleMs = STALE_CLAIM_MS): Promise<{ requeued: number; failed: number }> {
    // The cutoff is computed IN Postgres and both sides are cast to `timestamp`.
    //
    // `claimed_at` is `text` (the schema carries SQLite's text timestamps
    // faithfully), so a bare `claimed_at < $cutoff` is a STRING comparison.
    // Stored values look like "2026-08-06 15:30:00" and a JS
    // `toISOString()` cutoff looks like "2026-08-06T14:45:00.000Z" — and since
    // ' ' sorts before 'T', every claim compared as older than every cutoff.
    // Every running job was therefore reclaimable the instant it was claimed,
    // which means two workers transcribing the same audio. A test caught it.
    //
    // Doing the arithmetic in SQL also removes any app-vs-database clock skew.
    const staleSeconds = staleMs / 1000;

    const requeued = await this.sql<{ id: string }[]>`
      UPDATE transcription_jobs
      SET status = 'queued',
          claimed_at = NULL,
          updated_at = (now() at time zone 'utc')::text
      WHERE status = 'running'
        AND claimed_at::timestamp
              < (now() at time zone 'utc') - make_interval(secs => ${staleSeconds})
        AND attempts < ${MAX_ATTEMPTS}
      RETURNING id
    `;

    const failed = await this.sql<{ id: string }[]>`
      UPDATE transcription_jobs
      SET status = 'failed',
          claimed_at = NULL,
          error = ${`Gave up after ${MAX_ATTEMPTS} attempts. The transcription worker stopped responding each time — most often Whisper running out of memory on a long recording.`},
          updated_at = (now() at time zone 'utc')::text
      WHERE status = 'running'
        AND claimed_at::timestamp
              < (now() at time zone 'utc') - make_interval(secs => ${staleSeconds})
        AND attempts >= ${MAX_ATTEMPTS}
      RETURNING id
    `;

    return { requeued: requeued.length, failed: failed.length };
  }

  /**
   * Live progress, and the claim's heartbeat.
   *
   * Refreshing `claimed_at` is the load-bearing part: a two-hour recording can
   * transcribe for longer than the stale-claim window, and without a heartbeat
   * `reclaimStale` would hand a perfectly healthy job to a second worker. The
   * `status = 'running'` guard keeps a late progress callback from resurrecting
   * a job that was cancelled or already finished.
   */
  async recordProgress(id: string, segmentsSeen: number): Promise<void> {
    await this.sql`
      UPDATE transcription_jobs
      SET segments_seen = ${segmentsSeen},
          claimed_at = (now() at time zone 'utc')::text,
          updated_at = (now() at time zone 'utc')::text
      WHERE id = ${id} AND status = 'running'
    `;
  }

  async markSucceeded(
    id: string,
    result: { transcript: string; segments: TranscriptSegment[]; language: string | null }
  ): Promise<void> {
    await this.sql`
      UPDATE transcription_jobs
      SET status = 'succeeded',
          transcript = ${result.transcript},
          segments = ${JSON.stringify(result.segments)},
          language = ${result.language},
          error = NULL,
          claimed_at = NULL,
          updated_at = (now() at time zone 'utc')::text
      WHERE id = ${id}
    `;
  }

  /**
   * Fails the job, or returns it to the queue when attempts remain.
   *
   * `retryable` is the caller's judgement: a Whisper crash is worth retrying, a
   * file Whisper cannot decode is not, and retrying the latter three times just
   * delays telling the user something they need to act on.
   */
  async markFailed(id: string, error: string, retryable: boolean): Promise<JobStatus> {
    const [row] = await this.sql<{ status: string }[]>`
      UPDATE transcription_jobs
      SET status = CASE
            WHEN ${retryable} AND attempts < ${MAX_ATTEMPTS} THEN 'queued'
            ELSE 'failed'
          END,
          error = ${error},
          claimed_at = NULL,
          updated_at = (now() at time zone 'utc')::text
      WHERE id = ${id}
      RETURNING status
    `;

    const status = (row?.status ?? 'failed') as JobStatus;
    // Re-queued jobs need a nudge, or they wait for the next sweep.
    if (status === 'queued') await this.sql`SELECT pg_notify(${JOB_CHANNEL}, ${id})`;
    return status;
  }

  /**
   * One job, scoped to its owner.
   *
   * Returns null for another user's job rather than throwing a 403, so the API
   * answers 404 and cannot be used to discover which job ids exist.
   */
  async get(id: string, userId: string): Promise<TranscriptionJob | null> {
    const [row] = await this.sql<JobRow[]>`
      SELECT * FROM transcription_jobs WHERE id = ${id} AND user_id = ${userId}
    `;
    return row ? toJob(row) : null;
  }

  async listForUser(userId: string, limit = 50): Promise<TranscriptionJob[]> {
    const rows = await this.sql<JobRow[]>`
      SELECT * FROM transcription_jobs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(toJob);
  }

  /** Cancels a queued job. A running one is left alone — see the API route. */
  async cancelQueued(id: string, userId: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE transcription_jobs
      SET status = 'cancelled', updated_at = (now() at time zone 'utc')::text
      WHERE id = ${id} AND user_id = ${userId} AND status = 'queued'
      RETURNING id
    `;
    return rows.length > 0;
  }
}
