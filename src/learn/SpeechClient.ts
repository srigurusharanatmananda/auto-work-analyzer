/**
 * Text -> speech, via the Indic-Parler-TTS service this deliberately expects
 * to live beside Whisper (see `services/whisper` and `WhisperClient.ts`).
 *
 * There is no `services/tts` yet — this client is written against a
 * **provisional, guessed HTTP contract**: a `/health` endpoint and a
 * `POST /synthesize` endpoint that takes `{ text, voice, prosody }` and
 * returns raw audio bytes. That guess is modelled on `services/whisper`'s own
 * shape (a Python model-serving container with a health check and one real
 * endpoint), because `SpeechClient` is meant to mirror `WhisperClient`
 * deliberately: same health-check-then-call shape, same injectable
 * fetch/sleep so tests never open a socket. Once a real TTS server exists,
 * this contract should be treated as a starting point to reconcile against
 * reality, not as settled.
 *
 * Deliberately absent: `containerPathFor` / any file-path rewriting.
 * WhisperClient rewrites a host path because Whisper opens the file itself
 * inside its container. SpeechClient sends text in and receives audio bytes
 * back over the wire — there is no file for either side to resolve a path
 * to, so that seam has nothing to mirror.
 *
 * Also absent: streaming. WhisperClient streams NDJSON because a two-hour
 * recording is large and progressive. A lesson line is one short sentence;
 * returning the whole audio buffer at once is simpler and not worth
 * complicating for a response this small.
 */

export interface SynthesisResult {
  audio: Buffer;
  contentType: string;
}

/**
 * What `learn.routes.ts` actually depends on. `SpeechClient` below is one
 * implementation; `GeminiSpeechClient.ts` is another, for the one language
 * (Tamil, today) a real, already-configured provider can speak. An
 * interface rather than the concrete class, so the route can be handed
 * either one without either implementation knowing the other exists.
 */
export interface SpeechSynthesizer {
  synthesize(options: SynthesizeOptions): Promise<SynthesisResult>;
}

export interface SpeechClientOptions {
  /** Defaults to TTS_API_URL, else http://localhost:8001 (Whisper owns 8000). */
  baseUrl?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests, so waiting for health does not really sleep. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * How long to keep polling /health before giving up. Injectable so a test
   * can exercise the give-up path in milliseconds.
   *
   * A stubbed `sleep` alone is not enough: the deadline is measured against
   * the real clock, so a fake sleep that does not advance time produces a
   * loop that never expires — it spins forever instead of failing.
   */
  healthTimeoutMs?: number;
  healthPollMs?: number;
}

export interface SynthesizeOptions {
  /** Text to speak, already routed through Transliterator if needed. */
  text: string;
  /** One of Indic-Parler-TTS's voices. Server picks a default if omitted. */
  voice?: string;
  /**
   * Plain-text description of how the line should be spoken. Defaults to
   * `DEFAULT_PROSODY` — this is a teaching voice, not a toy, so callers
   * should have a specific reason before overriding it.
   */
  prosody?: string;
  signal?: AbortSignal;
}

/**
 * The one prosody description this app uses, per the design doc: a fixed
 * teaching voice, tuned once and held constant. Exported so the audio cache
 * can key on it without duplicating the string.
 */
export const DEFAULT_PROSODY = 'slow, clear, measured, no background noise';

/** Indic-Parler-TTS is 0.9B params; CPU model loading is slow. */
const HEALTH_TIMEOUT_MS = 3 * 60 * 1000;
const HEALTH_POLL_MS = 5_000;

/**
 * A single lesson line is short, but CPU inference for this model is not
 * instant. Generous by necessity, same as WhisperClient. Override with
 * TTS_TIMEOUT_MS.
 */
const DEFAULT_SYNTHESIZE_TIMEOUT_MS = 60 * 1000;

export class SpeechUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechUnavailableError';
  }
}

export class SynthesisFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SynthesisFailedError';
  }
}

export class SpeechClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly healthTimeoutMs: number;
  private readonly healthPollMs: number;

  constructor(options: SpeechClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.TTS_API_URL ??
      'http://localhost:8001'
    ).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
    this.healthTimeoutMs = options.healthTimeoutMs ?? HEALTH_TIMEOUT_MS;
    this.healthPollMs = options.healthPollMs ?? HEALTH_POLL_MS;
  }

  /** Resolves once the TTS service answers /health, or throws once the deadline passes. */
  async waitUntilReady(signal?: AbortSignal): Promise<void> {
    const deadline = Date.now() + this.healthTimeoutMs;

    for (;;) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/health`, {
          signal: AbortSignal.timeout(4_000),
        });
        if (response.ok) return;
      } catch {
        // Still loading the model, or restarting.
      }

      if (signal?.aborted) throw new SpeechUnavailableError('Cancelled while waiting for the TTS service');
      if (Date.now() >= deadline) {
        throw new SpeechUnavailableError(
          `TTS service at ${this.baseUrl} did not become healthy within ` +
            `${Math.round(this.healthTimeoutMs / 1000)}s. Is the container running? ` +
            `(docker compose up tts)`
        );
      }

      await this.sleep(this.healthPollMs);
    }
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesisResult> {
    const { text, voice, prosody = DEFAULT_PROSODY, signal } = options;

    if (!text.trim()) {
      throw new SynthesisFailedError('synthesize() needs text to speak');
    }

    await this.waitUntilReady(signal);

    const timeoutMs = Number(process.env.TTS_TIMEOUT_MS) || DEFAULT_SYNTHESIZE_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener('abort', onCallerAbort);

    try {
      const response = await this.post(text, voice, prosody, controller.signal);

      if (!response.ok) {
        throw new SynthesisFailedError(
          `TTS service returned ${response.status} ${response.statusText}`.trim()
        );
      }

      const contentType = response.headers.get('content-type') ?? 'audio/wav';
      const audio = Buffer.from(await response.arrayBuffer());
      return { audio, contentType };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  private async post(
    text: string,
    voice: string | undefined,
    prosody: string,
    signal: AbortSignal
  ): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, prosody }),
        signal,
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      // Mirrors WhisperClient: a dropped connection here is almost always the
      // model container restarting, not a transient blip worth hiding.
      if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
        throw new SpeechUnavailableError(
          'The TTS service crashed or restarted mid-synthesis — most often the ' +
            'container running out of memory. Retrying is usually the right move.'
        );
      }
      throw error;
    }
  }
}
