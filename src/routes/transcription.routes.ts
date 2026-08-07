/**
 * Upload audio, watch it transcribe, read the transcript.
 *
 * The upload returns 202 with a job id rather than waiting: transcription takes
 * minutes, so a synchronous response would hold a connection open past every
 * sensible proxy timeout and give the user nothing to look at.
 *
 * Audio is written to disk, NOT held in memory like /api/notes does with its 5 MB
 * text files. A recording is two orders of magnitude larger, and Whisper reads
 * the file from a bind mount rather than receiving bytes over HTTP — so the file
 * has to exist on disk regardless, and buffering it first would only add a copy
 * and a memory spike on a machine with 8 GB.
 */

import { Router } from 'express';
import multer from 'multer';
import { mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';
import type { TranscriptionJobStore, TranscriptionJob } from '../transcription/TranscriptionJobStore.js';
import { WhisperClient } from '../transcription/WhisperClient.js';
import type { TranscriptSweeper } from '../calls/TranscriptSweeper.js';

export interface TranscriptionRouterDeps {
  store: TranscriptionJobStore;
  /**
   * Where uploads are written. Must be the directory bind-mounted into the
   * Whisper container, or nothing can be transcribed — see `containerPathFor`.
   */
  storageRoot: string;
  /** Only used to validate the path before enqueueing. */
  whisper?: WhisperClient;
  /**
   * Files action items from finished transcriptions. Absent when no AI provider
   * or destination resolver is configured, in which case the sweep route says
   * so rather than 404ing on a feature that exists.
   */
  sweeper?: TranscriptSweeper;
}

/** Generous for a long recording; Whisper's own limits bite well before this. */
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

/**
 * Extensions ffmpeg (inside Whisper) reliably decodes.
 *
 * An allowlist rather than a blocklist, and checked on extension rather than
 * only mimetype because browsers report audio mimetypes inconsistently — Safari
 * sends `application/octet-stream` for perfectly good m4a.
 */
const ALLOWED_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.wav',
  '.aac',
  '.ogg',
  '.opus',
  '.flac',
  '.webm',
  '.mp4',
  '.mpga',
  '.mpeg',
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What the client sees. Excludes `audioPath` deliberately: it is a server
 * filesystem path, of no use to a browser and not worth disclosing.
 */
/**
 * How long the audio ran, from the last segment's end time.
 *
 * Derived rather than stored: Whisper reports it, but persisting it would mean
 * a column and a migration for a number already implied by data the job
 * carries. Null while a job is still producing segments — a partial duration
 * would read as "this call was 12 seconds long".
 */
function durationOf(job: TranscriptionJob): number | null {
  if (job.status !== 'succeeded') return null;
  const segments = job.segments ?? [];
  const last = segments[segments.length - 1];
  return last ? Math.round(last.end) : null;
}

function toResponse(job: TranscriptionJob) {
  return {
    id: job.id,
    status: job.status,
    originalFilename: job.originalFilename,
    transcript: job.transcript,
    segments: job.segments,
    language: job.language,
    durationSeconds: durationOf(job),
    error: job.error,
    attempts: job.attempts,
    segmentsSeen: job.segmentsSeen,
    callTitle: job.callTitle,
    callDate: job.callDate,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function createTranscriptionRouter(deps: TranscriptionRouterDeps): Router {
  const router = Router();
  const audioDir = resolve(deps.storageRoot, 'audio');
  const userIdOf = (req: any): string => req.user!.userId;

  const fail = (res: any, error: string, status = 400): void => {
    res.status(status).json({ success: false, error });
  };

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        // Created on demand: a fresh clone has no storage directory, and failing
        // the first upload with ENOENT would be a confusing first experience.
        mkdir(audioDir, { recursive: true })
          .then(() => cb(null, audioDir))
          .catch((error) => cb(error, audioDir));
      },
      filename: (_req, file, cb) => {
        // A uuid, keeping only the extension. The uploaded name is stored in the
        // database for display instead of being trusted on the filesystem, which
        // takes path traversal and collisions off the table at once.
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: MAX_AUDIO_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
        cb(null, true);
        return;
      }
      cb(
        new Error(
          `That file type is not supported. Audio only: ${[...ALLOWED_EXTENSIONS].join(', ')}`
        )
      );
    },
  });

  /**
   * Turns multer's rejections into 400s.
   *
   * Left alone they reach Express's default handler and become a 500 "Internal
   * server error", which blames the server for the caller sending a 2 GB video.
   */
  const acceptAudio = (req: any, res: any, next: any): void => {
    upload.single('audio')(req, res, (error: any) => {
      if (!error) {
        next();
        return;
      }
      fail(
        res,
        error?.code === 'LIMIT_FILE_SIZE'
          ? `That file is larger than the ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB limit.`
          : error instanceof Error
            ? error.message
            : 'Upload rejected'
      );
    });
  };

  /**
   * Deletes an upload that will not become a job.
   *
   * Every early return after multer has written the file has to come through
   * here, or the directory accumulates audio no row points at — invisible, and
   * on this disk, expensive.
   */
  const discard = async (path: string): Promise<void> => {
    await unlink(path).catch((error) => {
      console.warn(`Could not delete rejected upload ${path}:`, error?.message ?? error);
    });
  };

  /**
   * POST /api/transcription/upload
   *
   * `authenticate` runs BEFORE multer, unlike /api/notes which parses first.
   * That ordering matters here: multer writes to disk, so parsing before
   * authenticating would hand an unauthenticated caller a way to fill the disk
   * 500 MB at a time. `authenticate` only reads the Authorization header, so it
   * needs nothing from the body and can go first.
   */
  router.post('/upload', authenticate, anyRole, acceptAudio, async (req: any, res) => {
    const file = req.file;
    if (!file) return fail(res, 'Attach an audio file as the "audio" field');

    const { callTitle, callDate } = req.body ?? {};
    if (callDate && !DATE_PATTERN.test(callDate)) {
      await discard(file.path);
      return fail(res, 'callDate must be YYYY-MM-DD');
    }

    // Proves Whisper will be able to read it BEFORE a job exists. Otherwise the
    // failure surfaces minutes later as a job that dies on a misconfigured
    // storage root, which reads like a transcription problem and is not.
    const whisper = deps.whisper ?? new WhisperClient({ storageRoot: deps.storageRoot });
    try {
      whisper.containerPathFor(file.path);
    } catch (error) {
      await discard(file.path);
      return fail(
        res,
        error instanceof Error ? error.message : 'Uploaded audio is not readable by Whisper',
        500
      );
    }

    let job;
    try {
      job = await deps.store.enqueue({
        userId: userIdOf(req),
        audioPath: file.path,
        originalFilename: file.originalname,
        callTitle: typeof callTitle === 'string' && callTitle.trim() ? callTitle.trim() : undefined,
        callDate: callDate || undefined,
      });
    } catch (error) {
      // No row means nothing will ever transcribe or clean up this file.
      await discard(file.path);
      throw error;
    }

    // 202, not 200: the work is accepted, not done.
    res.status(202).json({
      success: true,
      data: toResponse(job),
      message: 'Queued for transcription.',
    });
  });

  router.get('/jobs', authenticate, anyRole, async (req, res) => {
    const jobs = await deps.store.listForUser(userIdOf(req));
    res.json({ success: true, data: jobs.map(toResponse) });
  });

  /**
   * Files action items from every finished transcription not yet swept.
   *
   * `dryRun` defaults to TRUE. This route creates real ClickUp tasks with no
   * per-item review, which is the opposite of every other path into ClickUp in
   * this app — so the safe answer has to be the one you get by forgetting the
   * flag, not the one you get by remembering it.
   */
  router.post('/sweep', authenticate, anyRole, async (req, res) => {
    if (!deps.sweeper) {
      return fail(
        res,
        'Sweeping is not configured on this server. It needs an AI provider and a ClickUp destination.',
        400
      );
    }

    const dryRun = req.body?.dryRun !== false;
    try {
      const summary = await deps.sweeper.run(userIdOf(req), { dryRun });
      res.json({
        success: true,
        data: summary,
        message: dryRun
          ? `Dry run: ${summary.jobs.length} recording(s) would produce tasks. Nothing was created.`
          : `Swept ${summary.jobs.length} recording(s), created ${summary.totalTasksCreated} task(s).`,
      });
    } catch (error) {
      console.error('Transcript sweep failed:', error);
      fail(res, error instanceof Error ? error.message : 'Sweep failed', 500);
    }
  });

  /** 404 for someone else's job — the store scopes it, so ids stay unguessable. */
  router.get('/jobs/:id', authenticate, anyRole, async (req, res) => {
    const job = await deps.store.get(req.params.id, userIdOf(req));
    if (!job) return fail(res, 'No such transcription job', 404);
    res.json({ success: true, data: toResponse(job) });
  });

  /**
   * Cancels a job that has not started.
   *
   * A running job is refused rather than silently accepted: flipping the row
   * would not stop the Whisper call, so the job would go on and overwrite the
   * cancellation on completion — telling the user it was cancelled when it was
   * not is worse than telling them it is too late.
   */
  router.post('/jobs/:id/cancel', authenticate, anyRole, async (req, res) => {
    const userId = userIdOf(req);
    const job = await deps.store.get(req.params.id, userId);
    if (!job) return fail(res, 'No such transcription job', 404);

    if (job.status !== 'queued') {
      return fail(
        res,
        job.status === 'running'
          ? 'That job has already started transcribing and cannot be cancelled.'
          : `That job is already ${job.status}.`,
        409
      );
    }

    await deps.store.cancelQueued(req.params.id, userId);
    res.json({ success: true, data: { id: req.params.id, status: 'cancelled' } });
  });

  return router;
}
