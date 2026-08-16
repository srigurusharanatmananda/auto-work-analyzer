/**
 * Text -> speech, via the Gemini API's speech generation — a REAL,
 * already-configured provider, unlike `SpeechClient.ts`'s provisional
 * Indic-Parler-TTS contract.
 *
 * Verified 2026-08-09 against Google's current docs, not memory: Gemini TTS
 * supports Tamil (`ta`) but does NOT list Sanskrit among its supported
 * languages (https://ai.google.dev/gemini-api/docs/speech-generation). So
 * this client is Tamil's real backend, not Sanskrit's — `learn.routes.ts`
 * is what decides which language gets which client, this file only knows
 * how to speak to Gemini.
 *
 * Uses the same `GOOGLE_API_KEY` the app's commit-grouping fallback already
 * authenticates with (`src/ai/AiClient.ts`) — no new signup needed. Calls
 * the REST endpoint directly with `fetch` rather than pulling in a second
 * Google SDK: `@google/generative-ai` (already a dependency, used by
 * AiClient) predates this API surface and has no typings for it, and the
 * newer `@google/genai` would be a second SDK for one call. `WhisperClient`
 * and `SpeechClient` are already raw-fetch clients in this codebase for the
 * same reason — this stays consistent with them.
 *
 * The one real wrinkle: Gemini returns raw PCM (mono, 16-bit, 24kHz), not a
 * file a browser can play. `pcmToWav` wraps it in a standard 44-byte RIFF/
 * WAVE header — cheap, well-defined, and the only step between "bytes that
 * are technically audio" and "bytes a <audio> element will actually play."
 */

import { SpeechUnavailableError, SynthesisFailedError, withTimeout, isAbortError } from './SpeechClient.js';
import type { SpeechSynthesizer, SynthesizeOptions, SynthesisResult } from './SpeechClient.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Kore';

/** Fixed by the API today; the response tells us nothing different. */
const SAMPLE_RATE_HZ = 24_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Extra attempts (so 1 + this many requests) for a `content_blocked` 400.
 * Three total: enough that a filter which fires intermittently is very
 * unlikely to fire on all of them, few enough to stay inside
 * `DEFAULT_TIMEOUT_MS` with a real synthesis call in each attempt.
 */
const CONTENT_BLOCKED_RETRIES = 2;
/** Multiplied by the attempt number, so 1s then 2s. */
const CONTENT_BLOCKED_BACKOFF_MS = 1_000;

export interface GeminiSpeechClientOptions {
  /** Defaults to GOOGLE_API_KEY. */
  apiKey?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  model?: string;
  /** Injectable for tests, so retry backoff does not really sleep — same seam `SpeechClient` gives its own health poll. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * A standard PCM WAVE header (44 bytes) prepended to raw samples. Every
 * field is little-endian, per the RIFF/WAVE spec — there is no ambiguity
 * here to get subtly wrong the way there is with, say, a timezone.
 */
function pcmToWav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE_HZ * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE_HZ, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export class GeminiSpeechClient implements SpeechSynthesizer {
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly model: string;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: GeminiSpeechClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.model = options.model ?? DEFAULT_MODEL;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesisResult> {
    const { text, voice = DEFAULT_VOICE, prosody, signal } = options;

    if (!text.trim()) {
      throw new SynthesisFailedError('synthesize() needs text to speak');
    }

    // Not a config error to surface as a 500: an unset key here means
    // "this provider isn't configured", the same class of thing
    // SpeechUnavailableError already means for the other client.
    if (!this.apiKey || this.apiKey === 'your_google_api_key_here') {
      throw new SpeechUnavailableError(
        'GOOGLE_API_KEY is not set, so Gemini speech generation is unavailable.'
      );
    }

    return withTimeout(DEFAULT_TIMEOUT_MS, signal, async (innerSignal) => {
      // Prosody is a spoken-style instruction to the model, not a config
      // field on Gemini's side — folded into the input text itself, the
      // way Gemini's own docs show ("Say cheerfully: ..."). The "Say ...:"
      // framing is not just stylistic: verified by hand that sending bare
      // text with no instruction gets a 400 ("Model tried to generate text,
      // but it should only be used for TTS") — the model needs to be told
      // this is something to speak, not to respond to. So this always
      // wraps, even with no prosody given.
      const input = `Say ${prosody ? `in a ${prosody} voice` : 'clearly'}: ${text}`;

      let response!: Response;
      let blockedBody = '';

      // Gemini's safety filter intermittently answers a perfectly ordinary
      // request with 400 `content_blocked` ("Request blocked for an
      // unspecified policy reason"). Established as FLAKY rather than a
      // property of the input, by hand against the live API: the same
      // devotional Sanskrit pāda that was blocked came back 200 on the very
      // next attempt with byte-identical input. Left unretried it meant a
      // learner chanting through a text hit a hard, unexplained failure on
      // a random verse and a different one each time.
      //
      // Retried here rather than at the caller because only this file can
      // tell `content_blocked` apart from a genuine 400 (a bad model name,
      // a malformed body) — those must still fail immediately rather than
      // burn three attempts on a request that cannot succeed.
      for (let attempt = 0; attempt <= CONTENT_BLOCKED_RETRIES; attempt++) {
        if (attempt > 0) await this.sleep(CONTENT_BLOCKED_BACKOFF_MS * attempt);

        try {
          response = await this.fetchImpl(ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': this.apiKey,
            },
            body: JSON.stringify({
              model: this.model,
              input,
              response_format: { type: 'audio' },
              generation_config: { speech_config: [{ voice }] },
            }),
            signal: innerSignal,
          });
        } catch (error) {
          // A caller-side timeout (learn.routes.ts's outer bound, or this
          // client's own DEFAULT_TIMEOUT_MS) — retryable, same as a dropped
          // connection below, not a hard failure.
          if (isAbortError(error)) {
            throw new SpeechUnavailableError('Synthesis timed out.');
          }
          const code = (error as NodeJS.ErrnoException)?.code;
          if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
            throw new SpeechUnavailableError('Could not reach the Gemini API.');
          }
          throw error;
        }

        if (response.ok) break;

        const body = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
          throw new SpeechUnavailableError(`Gemini rejected the API key (${response.status}).`);
        }
        if (response.status === 429) {
          throw new SpeechUnavailableError(
            'Gemini rate-limited this request (429) — its free tier is per-minute, so this usually clears on its own.'
          );
        }
        if (response.status === 400 && body.includes('content_blocked')) {
          blockedBody = body;
          continue;
        }
        throw new SynthesisFailedError(
          `Gemini returned ${response.status} ${response.statusText}: ${body}`.trim()
        );
      }

      if (!response.ok) {
        // Every attempt was blocked. Surfaced as *unavailable* rather than
        // failed because it is a transient provider decision the learner
        // can do nothing about and which usually clears — the same class of
        // thing a 429 is, not the same class as a malformed request.
        throw new SpeechUnavailableError(
          `Gemini's safety filter blocked this text on every attempt: ${blockedBody}`.trim()
        );
      }

      // Verified by hand against the live API: the docs' own summary of this
      // shape (`output_audio.data` at the top level) does not match what the
      // API actually returns. The real shape is `steps[].content[]`, each
      // content item carrying a `mime_type` and `data` — find the first
      // audio one rather than assuming it is always steps[0].content[0], in
      // case a future response ever includes a text step alongside it.
      const payload = (await response.json()) as {
        steps?: Array<{ content?: Array<{ mime_type?: string; data?: string }> }>;
      };
      const base64Audio = payload.steps
        ?.flatMap((step) => step.content ?? [])
        .find((item) => item.mime_type?.startsWith('audio/'))?.data;
      if (!base64Audio) {
        throw new SynthesisFailedError('Gemini response had no audio content in steps[].content[]');
      }

      const pcm = Buffer.from(base64Audio, 'base64');
      return { audio: pcmToWav(pcm), contentType: 'audio/wav' };
    });
  }
}
