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
import { API_BASE_URL } from './config';

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
  /** Lines with timings — what makes the transcript seekable. */
  segments?: TranscriptSegment[];
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

export interface IngestUrlInput {
  url: string;
  callTitle?: string;
  callDate?: string;
}

/**
 * Queues a recording the server will go and download itself.
 *
 * Same 202-then-poll shape as `uploadAudio`, and deliberately so: from the
 * moment a job exists the two are indistinguishable, so everything downstream —
 * the poller, the recordings list, the player — needs no idea which one made
 * it.
 *
 * The wait before that 202 is longer than an upload's, because the server is
 * doing the download rather than receiving one. A slow host, or a YouTube video
 * yt-dlp has to negotiate for, can take a while with nothing to show for it.
 */
export function ingestFromUrl(input: IngestUrlInput): Promise<TranscriptionJob> {
  return api.post<TranscriptionJob>('/transcription/from-url', {
    url: input.url.trim(),
    ...(input.callTitle ? { callTitle: input.callTitle } : {}),
    ...(input.callDate ? { callDate: input.callDate } : {}),
  });
}

/**
 * A cheap client-side sniff for whether a link is worth submitting.
 *
 * Deliberately permissive, and deliberately NOT a copy of the server's
 * `classifyMediaUrl`. Reproducing that here would mean two allowlists drifting
 * apart, with the browser confidently refusing links the server would accept.
 * The server is the authority; this only catches the typo that would otherwise
 * cost a round trip.
 */
export function looksLikeUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export function getTranscriptionJob(jobId: string): Promise<TranscriptionJob> {
  return api.get<TranscriptionJob>(`/transcription/jobs/${jobId}`);
}

/** The caller's jobs, newest first. Scoped server-side; never anyone else's. */
export function listTranscriptionJobs(): Promise<TranscriptionJob[]> {
  return api.get<TranscriptionJob[]>('/transcription/jobs');
}

/** One occurrence of the phrase, with context and a place in the recording. */
export interface TranscriptHighlight {
  text: string;
  /** Where the phrase sits inside `text` — offsets, not a second search. */
  matchStart: number;
  matchEnd: number;
  transcriptOffset: number;
  /** Null when the transcript was edited and no longer lines up with its audio. */
  startSeconds: number | null;
  endSeconds: number | null;
}

export interface TranscriptSearchResult {
  id: string;
  originalFilename: string;
  callTitle: string | null;
  callDate: string | null;
  language: string | null;
  durationSeconds: number | null;
  createdAt: string;
  /** Set once every action item from this call has reached ClickUp. */
  sweptAt: string | null;
  transcriptLength: number;
  /** Total occurrences, which can exceed `highlights.length`. */
  matchCount: number;
  highlights: TranscriptHighlight[];
  /** The phrase is in the title or filename only — so there is no excerpt. */
  titleOnlyMatch: boolean;
}

export interface TranscriptSearchResponse {
  query: string;
  results: TranscriptSearchResult[];
  total: number;
  limit: number;
}

export interface TranscriptSearchInput {
  query?: string;
  /** Inclusive `YYYY-MM-DD` bounds. */
  from?: string;
  to?: string;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Searches the caller's finished transcripts.
 *
 * An empty query is a browse, not an error — the date filters alone answer
 * "what did I record last week", and the server treats it the same way.
 *
 * Parameters go through `ApiClient`'s `query` option rather than being pasted
 * into the path: it drops the empty ones and encodes the rest, which is what
 * keeps a search for `R&D` or `C#` from being truncated at the ampersand.
 */
export function searchTranscripts(
  input: TranscriptSearchInput = {}
): Promise<TranscriptSearchResponse> {
  return api.get<TranscriptSearchResponse>('/transcription/search', {
    query: {
      q: input.query?.trim() || undefined,
      from: input.from || undefined,
      to: input.to || undefined,
      limit: input.limit,
    },
    ...(input.signal ? { signal: input.signal } : {}),
  });
}

/**
 * `1h 04m` / `4m 12s` / `9s`, dropping the leading units that are zero.
 *
 * Null when there is no duration to show — a job that has not finished, or a
 * transcript that was pasted rather than recorded. The caller decides whether
 * that renders as a dash or as nothing at all, because the recordings list
 * omits the chip entirely while a table needs a placeholder to keep its
 * columns aligned.
 *
 * Lives here rather than in a component because both surfaces show it, and the
 * two copies had already started to differ.
 */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.round(seconds % 60);

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, '0')}s`;
  return `${rest}s`;
}

/** `12:34`, for pointing at a moment inside a recording. */
export function formatTimestamp(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;

  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** One line of the transcript, with the moment it was spoken. */
export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface AudioPlaybackUrl {
  /** Server-relative; `playbackSrc` turns it into something `<audio>` can load. */
  url: string;
  expiresAt: string;
}

/**
 * The absolute URL for a media element.
 *
 * The server returns a path because it does not know its own public origin. A
 * relative URL would work only while the UI and the API share one — which is
 * true on this machine and false everywhere else, and it fails as a silent 404
 * from Next rather than as anything that names the problem.
 */
export function playbackSrc(url: string): string {
  return `${API_BASE_URL}${url}`;
}

/**
 * Asks for a short-lived URL the `<audio>` element can fetch.
 *
 * A media element issues its own request and there is no way to attach an
 * Authorization header to it, so authority has to be in the URL. POST because
 * this mints a capability — see `src/transcription/audioTokens.ts`.
 */
export function requestAudioUrl(jobId: string): Promise<AudioPlaybackUrl> {
  return api.post<AudioPlaybackUrl>(`/transcription/jobs/${jobId}/audio-token`);
}

/** How action items from one call are shaped into tasks. */
export type TranscriptGrouping = 'per-item' | 'single-task' | 'by-theme';

export interface SweptJobResult {
  jobId: string;
  filename: string;
  callTitle: string | null;
  actionItems: number;
  /** Skipped because an earlier run already filed them. */
  alreadyFiled: number;
  tasksCreated: number;
  destination: string | null;
  /** The extraction was reused, not re-run — so it costs no model spend. */
  reusedExtraction: boolean;
  error?: string;
  /** Only on a dry run. */
  wouldCreate?: Array<{ name: string; description: string }>;
}

export interface SweepSummary {
  dryRun: boolean;
  jobs: SweptJobResult[];
  totalTasksCreated: number;
}

export interface SweepInput {
  /**
   * Required, with no default, on purpose.
   *
   * The server defaults it to `true` so a forgotten flag is the safe one. Here
   * the opposite rule applies: a caller that omits it should not compile,
   * because the two meanings are "show me" and "create real tasks in ClickUp"
   * and there is no sensible guess between them.
   */
  dryRun: boolean;
  grouping?: TranscriptGrouping;
}

/** Files action items from every finished recording not yet swept. */
export function runTranscriptSweep(input: SweepInput): Promise<SweepSummary> {
  return api.post<SweepSummary>('/transcription/sweep', input);
}

/** Still moving — worth polling for, and not yet safe to read a transcript from. */
export function isJobActive(job: TranscriptionJob): boolean {
  return job.status === 'queued' || job.status === 'running';
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
