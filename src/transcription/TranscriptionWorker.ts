/**
 * The loop that turns queued jobs into transcripts.
 *
 * Runs in the API process. That is a deliberate limit, not an oversight: on this
 * hardware exactly one transcription can run at a time anyway (Whisper on 8 GB),
 * so a separate worker process would buy isolation at the cost of another thing
 * to start, and the concurrency it would enable is concurrency we cannot afford.
 * `concurrency` is here so that changes when the hardware does.
 *
 * Two failure modes shape the design, both learned from the reference
 * implementation's scars:
 *
 *  - **Whisper gets OOM-killed.** That is retryable and must return the job to
 *    the queue. Distinguishing it from "this file is not audio", which must not
 *    be retried, is `WhisperUnavailableError` vs `TranscriptionFailedError`.
 *  - **This process dies mid-job.** Nothing in-process can handle that, so
 *    recovery is `reclaimStale` on startup and on a timer. Without it a job sits
 *    `running` forever and the user watches something that never finishes and
 *    never errors.
 *
 * Wake-ups come from `LISTEN`, with a periodic sweep as the backstop. The sweep
 * is what makes NOTIFY an optimisation rather than a dependency: a notification
 * lost to a dropped connection costs one sweep interval, never the job.
 */

import type { PostgresHandle } from '../db/client.js';
import { getPool } from '../db/pool.js';
import {
  JOB_CHANNEL,
  TranscriptionJobStore,
  type TranscriptionJob,
} from './TranscriptionJobStore.js';
import {
  TranscriptionFailedError,
  WhisperClient,
  WhisperUnavailableError,
} from './WhisperClient.js';

export interface TranscriptionWorkerOptions {
  store: TranscriptionJobStore;
  whisper: WhisperClient;
  /**
   * How often to look for work regardless of notifications. Also how often
   * abandoned jobs are reclaimed.
   */
  sweepIntervalMs?: number;
  /** One at a time on 8 GB — see the header. */
  concurrency?: number;
  pg?: PostgresHandle;
  /** Called after each job settles. For logging and tests. */
  onSettled?: (job: TranscriptionJob, outcome: 'succeeded' | 'failed' | 'requeued') => void;
}

const DEFAULT_SWEEP_MS = 30_000;

export class TranscriptionWorker {
  private readonly store: TranscriptionJobStore;
  private readonly whisper: WhisperClient;
  private readonly sweepIntervalMs: number;
  private readonly concurrency: number;
  private readonly injected?: PostgresHandle;
  private readonly onSettled?: TranscriptionWorkerOptions['onSettled'];

  private timer: NodeJS.Timeout | null = null;
  private listener: { unlisten: () => Promise<void> } | null = null;
  private running = 0;
  private stopped = true;
  /** Guards against two sweeps interleaving into the same claim. */
  private draining: Promise<void> | null = null;

  constructor(options: TranscriptionWorkerOptions) {
    this.store = options.store;
    this.whisper = options.whisper;
    this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_MS;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.injected = options.pg;
    this.onSettled = options.onSettled;
  }

  private get sql() {
    return (this.injected ?? getPool()).sql;
  }

  /**
   * Begins processing. Safe to call once per process.
   *
   * Reclaims abandoned jobs BEFORE taking new work: after a crash the queue's
   * oldest work is whatever the dead worker was holding, and leaving it until
   * the first sweep would let newer uploads overtake it.
   */
  async start(): Promise<void> {
    if (!this.stopped) return;
    this.stopped = false;

    await this.reclaim();
    await this.subscribe();

    this.timer = setInterval(() => {
      void this.sweep();
    }, this.sweepIntervalMs);
    // Never hold the process open just to poll an empty queue.
    this.timer.unref?.();

    void this.drainNow();
  }

  /**
   * Stops taking new work and waits for the current job to finish.
   *
   * Deliberately does NOT drain the queue: shutdown should finish what is in
   * flight and exit, not start a fresh 30-minute transcription. Use
   * {@link drainNow} when you want the queue emptied.
   */
  async stop(): Promise<void> {
    this.stopped = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.listener) {
      await this.listener.unlisten().catch(() => {});
      this.listener = null;
    }

    // The in-flight job is left to complete: killing it mid-Whisper would waste
    // the minutes already spent and leave a claim to be reclaimed later.
    await this.draining?.catch(() => {});
  }

  /**
   * Subscribes to the enqueue channel.
   *
   * Failure is not fatal — the sweep covers it. A worker that refused to start
   * because LISTEN was unavailable would stop transcribing entirely over a
   * missing optimisation.
   */
  private async subscribe(): Promise<void> {
    try {
      const handle = await this.sql.listen(JOB_CHANNEL, () => {
        void this.drainNow();
      });
      this.listener = handle;
    } catch (error) {
      console.warn(
        `Transcription worker could not LISTEN on ${JOB_CHANNEL}; ` +
          `falling back to polling every ${this.sweepIntervalMs}ms:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  private async sweep(): Promise<void> {
    await this.reclaim();
    await this.drainNow();
  }

  private async reclaim(): Promise<void> {
    try {
      const { requeued, failed } = await this.store.reclaimStale();
      if (requeued > 0 || failed > 0) {
        console.log(
          `Transcription: recovered ${requeued} abandoned job(s), ` +
            `gave up on ${failed} that had exhausted their attempts.`
        );
      }
    } catch (error) {
      console.error('Transcription: could not reclaim stale jobs:', error);
    }
  }

  /**
   * Claims and runs jobs until the queue is empty or capacity is reached.
   *
   * Public because "process everything, then let me know" is a real need — a
   * one-shot CLI run, and every test in this module — and because without it the
   * only way to observe the loop is to `stop()` it, which by design cuts the
   * drain short after the current job.
   *
   * Serialised through `this.draining` so overlapping wake-ups — a NOTIFY
   * arriving during a sweep, say — cannot both be claiming at once. The database
   * would cope (SKIP LOCKED), but the capacity check would not: two drains could
   * each see a free slot and start a job, running two Whispers on 8 GB.
   */
  drainNow(): Promise<void> {
    // The promise IS the flag — see the comment above. A concurrent wake-up
    // joins the drain already in progress instead of starting a second.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.draining) return this.draining;

    this.draining = this.drainOnce().finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  private async drainOnce(): Promise<void> {
    while (!this.stopped && this.running < this.concurrency) {
      let job: TranscriptionJob | null;
      try {
        job = await this.store.claimNext();
      } catch (error) {
        console.error('Transcription: could not claim a job:', error);
        return;
      }

      if (!job) return;

      this.running += 1;
      try {
        await this.process(job);
      } finally {
        this.running -= 1;
      }
    }
  }

  /** Transcribes one claimed job and records the outcome. */
  private async process(job: TranscriptionJob): Promise<void> {
    try {
      const result = await this.whisper.transcribe({
        audioPath: job.audioPath,
        jobId: job.id,
        onSegment: (_segment, index) => {
          // Fire-and-forget: a failed progress write must not abort a
          // transcription that is otherwise going fine. It also refreshes the
          // claim heartbeat, which is why it is per-segment and not per-job.
          void this.store.recordProgress(job.id, index + 1).catch(() => {});
        },
      });

      await this.store.markSucceeded(job.id, {
        transcript: result.text,
        segments: result.segments,
        language: result.language,
      });
      this.onSettled?.(job, 'succeeded');
    } catch (error) {
      await this.recordFailure(job, error);
    }
  }

  /**
   * Decides whether a failure deserves another attempt.
   *
   * `WhisperUnavailableError` means the service was down, restarting, or killed
   * mid-file — the file itself is probably fine, so retry. Anything else is
   * treated as a problem with this input: retrying an undecodable file three
   * times only delays telling the user something they must act on.
   */
  private async recordFailure(job: TranscriptionJob, error: unknown): Promise<void> {
    const retryable = error instanceof WhisperUnavailableError;
    const message =
      error instanceof TranscriptionFailedError || error instanceof WhisperUnavailableError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Transcription failed for an unknown reason';

    try {
      const status = await this.store.markFailed(job.id, message, retryable);
      this.onSettled?.(job, status === 'queued' ? 'requeued' : 'failed');
    } catch (writeError) {
      // The job stays `running` and will be reclaimed once its claim goes stale.
      console.error(`Transcription: could not record failure for job ${job.id}:`, writeError);
    }
  }
}
