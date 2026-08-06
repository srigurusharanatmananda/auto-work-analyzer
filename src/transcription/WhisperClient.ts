/**
 * Audio -> transcript, via the Whisper service in `services/whisper`.
 *
 * Whisper runs as a separate Python container and is spoken to over HTTP, which
 * is why it was worth taking as-is from call-intelligence-system: the seam is
 * already clean. This client is a reimplementation rather than a copy, and
 * differs from the reference in three ways that matter:
 *
 *  - **It emits nothing.** The reference called socket.io directly from inside
 *    the transcription loop, so transcribing required a websocket layer and
 *    could not be tested without one. Progress here is an optional `onSegment`
 *    callback the caller supplies.
 *  - **NDJSON parsing is shared** between the streaming path and the final
 *    flush. See `ndjson.ts` — the reference had two copies and the second one
 *    dropped trailing segments.
 *  - **`fetch` is injectable**, so the tests never open a socket.
 *
 * The container-path translation below is the subtle part and the reason a
 * plain absolute path fails.
 */

import { relative, resolve } from 'node:path';
import { NdjsonParser } from './ndjson.js';

export interface TranscriptSegment {
  text: string;
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  /** Every segment joined — what the action-item extractor consumes. */
  text: string;
  /** BCP-47-ish code Whisper detected, e.g. "en", "sa", "ta". Null if unknown. */
  language: string | null;
  /** Whisper's own confidence in the language detection, not the text. */
  languageConfidence: number | null;
}

/** One line of the `/transcribe-stream` response. */
type WhisperLine =
  | { _error: string }
  | { _done: true; language?: string | null; confidence?: number | null }
  | { text: string; start: number; end: number };

export interface WhisperClientOptions {
  /** Defaults to WHISPER_API_URL, else http://localhost:8000. */
  baseUrl?: string;
  /**
   * Host directory bind-mounted into the container as `/storage`. Defaults to
   * TRANSCRIPTION_STORAGE_ROOT, else `<cwd>/storage`.
   */
  storageRoot?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests, so waiting for health does not really sleep. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * How long to keep polling /health before giving up. Injectable so a test can
   * exercise the give-up path in milliseconds.
   *
   * A stubbed `sleep` alone is not enough: the deadline is measured against the
   * real clock, so a fake sleep that does not advance time produces a loop that
   * never expires — it spins forever instead of failing.
   */
  healthTimeoutMs?: number;
  healthPollMs?: number;
}

export interface TranscribeOptions {
  /** Path on the HOST. Translated to the container's view internally. */
  audioPath: string;
  /** Correlation id passed through to Whisper's logs. */
  jobId: string | number;
  /** Forces a language instead of detecting one. */
  language?: string | null;
  /** Called as each segment arrives, for live progress. */
  onSegment?: (segment: TranscriptSegment, index: number) => void;
  signal?: AbortSignal;
}

/** Whisper can be slow to load its model, and restarts after an OOM. */
const HEALTH_TIMEOUT_MS = 3 * 60 * 1000;
const HEALTH_POLL_MS = 5_000;

/**
 * A two-hour recording can take 20-30 minutes on CPU, so this is generous by
 * necessity. Override with WHISPER_TIMEOUT_MS.
 */
const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 30 * 60 * 1000;

export class WhisperUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhisperUnavailableError';
  }
}

export class TranscriptionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionFailedError';
  }
}

export class WhisperClient {
  private readonly baseUrl: string;
  private readonly storageRoot: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly healthTimeoutMs: number;
  private readonly healthPollMs: number;

  constructor(options: WhisperClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.WHISPER_API_URL ??
      'http://localhost:8000'
    ).replace(/\/+$/, '');
    this.storageRoot = resolve(
      options.storageRoot ?? process.env.TRANSCRIPTION_STORAGE_ROOT ?? resolve('storage')
    );
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
    this.healthTimeoutMs = options.healthTimeoutMs ?? HEALTH_TIMEOUT_MS;
    this.healthPollMs = options.healthPollMs ?? HEALTH_POLL_MS;
  }

  /**
   * Rewrites a host path to the container's view of the same file.
   *
   * Whisper opens the file itself; it does not receive the bytes. The container
   * bind-mounts `storageRoot` at `/storage`, so a host path means nothing to it
   * and it would report a missing file. Throwing on a path outside the mount is
   * deliberate — the alternative is a confusing "file not found" from a
   * container the caller may not know exists.
   *
   * Exported behaviour, not an implementation detail: it is what makes an
   * absolute path from an upload handler work.
   */
  containerPathFor(audioPath: string): string {
    const absolute = resolve(audioPath);
    const relativePath = relative(this.storageRoot, absolute);

    if (relativePath.startsWith('..') || relativePath.length === 0) {
      throw new TranscriptionFailedError(
        `Audio at ${absolute} is outside the transcription storage root ` +
          `(${this.storageRoot}), so the Whisper container cannot read it. ` +
          `Move it under that directory or set TRANSCRIPTION_STORAGE_ROOT.`
      );
    }

    // Always POSIX separators: the container is Linux regardless of this host.
    return `/storage/${relativePath.split(/[\\/]/).join('/')}`;
  }

  /** Resolves once Whisper answers /health, or throws once the deadline passes. */
  async waitUntilReady(signal?: AbortSignal): Promise<void> {
    const deadline = Date.now() + this.healthTimeoutMs;

    for (;;) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/health`, {
          signal: AbortSignal.timeout(4_000),
        });
        if (response.ok) return;
      } catch {
        // Still starting, or restarting after an OOM kill.
      }

      if (signal?.aborted) throw new WhisperUnavailableError('Cancelled while waiting for Whisper');
      if (Date.now() >= deadline) {
        throw new WhisperUnavailableError(
          `Whisper at ${this.baseUrl} did not become healthy within ` +
            `${Math.round(this.healthTimeoutMs / 1000)}s. Is the container running? ` +
            `(docker compose up whisper)`
        );
      }

      await this.sleep(this.healthPollMs);
    }
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    const { audioPath, jobId, language = null, onSegment, signal } = options;

    if (!audioPath.trim()) {
      throw new TranscriptionFailedError('transcribe() needs an audio path');
    }

    // Resolved before waiting on health: a path the container could never read
    // should fail immediately, not three minutes later.
    const containerPath = this.containerPathFor(audioPath);

    await this.waitUntilReady(signal);

    const timeoutMs = Number(process.env.WHISPER_TIMEOUT_MS) || DEFAULT_TRANSCRIBE_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener('abort', onCallerAbort);

    try {
      const response = await this.post(containerPath, jobId, language, controller.signal);

      if (!response.ok) {
        throw new TranscriptionFailedError(
          `Whisper returned ${response.status} ${response.statusText}`.trim()
        );
      }
      if (!response.body) {
        throw new TranscriptionFailedError('Whisper returned no response body');
      }

      return await this.consume(response.body, onSegment);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  private async post(
    containerPath: string,
    jobId: string | number,
    language: string | null,
    signal: AbortSignal
  ): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}/transcribe-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_path: containerPath,
          call_id: jobId,
          language,
          start_time_offset: 0,
        }),
        signal,
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      // Whisper is memory-hungry; the kernel killing it mid-file shows up here
      // as a dropped connection. Naming it saves a long debugging session.
      if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
        throw new WhisperUnavailableError(
          'Whisper crashed or restarted mid-transcription — most often the ' +
            'container running out of memory. Retrying is usually the right move.'
        );
      }
      throw error;
    }
  }

  /** Reads the NDJSON stream to completion. */
  private async consume(
    body: ReadableStream<Uint8Array>,
    onSegment?: TranscribeOptions['onSegment']
  ): Promise<TranscriptionResult> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const parser = new NdjsonParser<WhisperLine>();

    const segments: TranscriptSegment[] = [];
    let language: string | null = null;
    let languageConfidence: number | null = null;

    const handle = (line: WhisperLine): void => {
      if ('_error' in line) {
        throw new TranscriptionFailedError(`Whisper reported: ${line._error}`);
      }
      if ('_done' in line) {
        language = line.language ?? null;
        languageConfidence = line.confidence ?? null;
        return;
      }

      const segment: TranscriptSegment = { text: line.text, start: line.start, end: line.end };
      segments.push(segment);
      onSegment?.(segment, segments.length - 1);
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of parser.push(decoder.decode(value, { stream: true }))) handle(line);
      }
      for (const line of parser.flush()) handle(line);
    } finally {
      await reader.cancel().catch(() => {});
    }

    return {
      segments,
      // Single spaces: Whisper's segment texts carry their own leading space
      // inconsistently, so they are trimmed and rejoined rather than
      // concatenated raw.
      text: segments.map((segment) => segment.text.trim()).filter(Boolean).join(' '),
      language,
      languageConfidence,
    };
  }
}
