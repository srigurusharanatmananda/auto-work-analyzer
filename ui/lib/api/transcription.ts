/**
 * Audio -> transcript, from the browser's side.
 *
 * The upload route answers 202 and returns a *queued* job: transcription runs
 * in a worker and a 40-minute recording takes minutes, far past any request
 * timeout. So the flow is necessarily upload-then-poll, and this module owns
 * both halves so no component has to know that.
 *
 * Kept out of the `./index` barrel for the same reason `useApiQuery` is: the
 * barrel is the transport layer, and this is a feature that happens to use it.
 */

import { api } from './ApiClient';

/** The queue row, as the transcription routes serialise it. */
export interface TranscriptionJob {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  originalFilename: string;
  callTitle?: string | null;
  callDate?: string | null;
  transcript?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  /** Climbs while the worker streams; the only honest progress signal we get. */
  segmentsSeen?: number;
  attempts?: number;
  error?: string | null;
}

/**
 * A convenience filter for the file picker, NOT the security boundary — a user
 * can always choose "All Files", and `ALLOWED_EXTENSIONS` in
 * `src/routes/transcription.routes.ts` is what actually decides. Kept in sync by
 * hand because one static list is not worth an endpoint; if they diverge the
 * failure is a clear 400, not a silent accept.
 */
export const AUDIO_EXTENSIONS = [
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
] as const;

export const TEXT_EXTENSIONS = ['.txt', '.md'] as const;

/** True when the picker handed us something to transcribe rather than to read. */
export function isAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export interface UploadAudioInput {
  file: File;
  callTitle?: string;
  callDate?: string;
}

/** Queues the file. Resolves as soon as it is accepted, not when it is done. */
export async function uploadAudio(input: UploadAudioInput): Promise<TranscriptionJob> {
  const form = new FormData();
  form.append('audio', input.file);
  if (input.callTitle) form.append('callTitle', input.callTitle);
  if (input.callDate) form.append('callDate', input.callDate);

  return api.post<TranscriptionJob>('/transcription/upload', form);
}

export function getTranscriptionJob(jobId: string): Promise<TranscriptionJob> {
  return api.get<TranscriptionJob>(`/transcription/jobs/${jobId}`);
}

/** Raised when a job ends in any state other than `succeeded`. */
export class TranscriptionFailedError extends Error {
  constructor(public readonly job: TranscriptionJob) {
    super(job.error || `Transcription ${job.status}`);
    this.name = 'TranscriptionFailedError';
  }
}

export interface WaitOptions {
  /** Called on every poll, so the UI can show the job moving. */
  onProgress?: (job: TranscriptionJob) => void;
  /** Abort the wait. Does NOT cancel the job — use `cancelTranscription`. */
  signal?: AbortSignal;
  pollMs?: number;
  /** Injectable for tests; the default is `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Polls until the job reaches a terminal state.
 *
 * Deliberately unbounded in time: the only honest ceiling would be a guess at
 * how long the audio is, and giving up on a job that is still making progress
 * would report failure for work that is about to succeed. The caller holds an
 * `AbortSignal` and the user holds a Cancel button; between them that is a
 * better stop condition than a timer.
 */
export async function waitForTranscript(
  jobId: string,
  options: WaitOptions = {}
): Promise<TranscriptionJob> {
  const { onProgress, signal, pollMs = 2000, sleep = defaultSleep } = options;

  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const job = await getTranscriptionJob(jobId);
    onProgress?.(job);

    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new TranscriptionFailedError(job);
    }

    await sleep(pollMs);
  }
}

/** Only possible while the job is still queued; a running job answers 409. */
export function cancelTranscription(jobId: string): Promise<unknown> {
  return api.post(`/transcription/jobs/${jobId}/cancel`);
}
