/**
 * Against a stubbed fetch — nothing here calls the real Gemini API, per the
 * standing rule that no test may hit a live AI provider. The real call was
 * verified once, by hand, outside the test suite.
 */

import { describe, expect, test } from 'bun:test';
import { GeminiSpeechClient } from './GeminiSpeechClient.js';
import { SpeechUnavailableError, SynthesisFailedError } from './SpeechClient.js';

const SAMPLE_PCM_BASE64 = Buffer.from([1, 2, 3, 4]).toString('base64');

/**
 * The real shape, verified by hand against the live API — NOT
 * `{ output_audio: { data } }`, which is what Google's own docs page
 * claimed and turned out not to match what the API actually returns.
 */
function audioResponse(base64: string): Response {
  return new Response(
    JSON.stringify({ steps: [{ content: [{ mime_type: 'audio/l16', data: base64 }] }] }),
    { status: 200 }
  );
}

function clientFor(options: {
  apiKey?: string;
  respond?: (init?: RequestInit) => Response;
} = {}) {
  const requests: Array<{ url: string; body?: unknown; headers?: Record<string, string> }> = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: init?.headers as Record<string, string> | undefined,
    });
    return options.respond ? options.respond(init) : audioResponse(SAMPLE_PCM_BASE64);
  }) as unknown as typeof fetch;

  const client = new GeminiSpeechClient({
    apiKey: options.apiKey ?? 'test-key',
    fetchImpl,
    // Retry backoff must not really sleep, or every content_blocked test
    // pays 3 real seconds.
    sleep: async () => {},
  });

  return { client, requests };
}

/** The real body Gemini returns when its safety filter fires, verified against the live API. */
function contentBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: 'Request blocked for an unspecified policy reason. Please modify your input and retry.',
        code: 'content_blocked',
      },
    }),
    { status: 400 }
  );
}

describe('synthesize', () => {
  test('wraps the returned PCM in a valid WAV header and returns audio/wav', async () => {
    const { client } = clientFor();
    const result = await client.synthesize({ text: 'வணக்கம்' });

    expect(result.contentType).toBe('audio/wav');
    // RIFF....WAVEfmt  — the header this client is responsible for building.
    expect(result.audio.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(result.audio.subarray(8, 12).toString('ascii')).toBe('WAVE');
    // 44-byte header + the 4 raw PCM bytes from SAMPLE_PCM_BASE64.
    expect(result.audio.length).toBe(48);
    expect(result.audio.subarray(44)).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  test('sends the model, input text, and voice in the verified request shape', async () => {
    const { client, requests } = clientFor();
    await client.synthesize({ text: 'வணக்கம்', voice: 'Kore' });

    expect(requests[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(requests[0]!.headers?.['x-goog-api-key']).toBe('test-key');
    expect(requests[0]!.body).toMatchObject({
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    });
  });

  test('always wraps input in a "Say ...:" instruction, with or without prosody', async () => {
    // Verified by hand: bare text with no instruction gets a 400 ("Model
    // tried to generate text, but it should only be used for TTS") — the
    // model needs to be told this is something to speak, not respond to.
    const { client, requests } = clientFor();
    await client.synthesize({ text: 'வணக்கம்', prosody: 'slow, clear, measured' });
    expect((requests[0]!.body as { input: string }).input).toBe(
      'Say in a slow, clear, measured voice: வணக்கம்'
    );

    await client.synthesize({ text: 'வணக்கம்' });
    expect((requests[1]!.body as { input: string }).input).toBe('Say clearly: வணக்கம்');
  });

  test('an unset or placeholder API key is unavailable, without calling fetch', async () => {
    const requests: unknown[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ input, init });
      return audioResponse(SAMPLE_PCM_BASE64);
    }) as unknown as typeof fetch;

    // No `apiKey` at all — must not fall back to a real env var in this test process.
    const noKey = new GeminiSpeechClient({ fetchImpl, apiKey: '' });
    await expect(noKey.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SpeechUnavailableError);

    const placeholder = new GeminiSpeechClient({ apiKey: 'your_google_api_key_here', fetchImpl });
    await expect(placeholder.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SpeechUnavailableError);

    expect(requests.length).toBe(0);
  });

  test('empty text is refused before any request is sent', async () => {
    const { client, requests } = clientFor();
    await expect(client.synthesize({ text: '   ' })).rejects.toThrow(SynthesisFailedError);
    expect(requests.length).toBe(0);
  });

  test('a 401 or 403 is service-unavailable, not a generic failure', async () => {
    const { client } = clientFor({ respond: () => new Response('bad key', { status: 401 }) });
    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SpeechUnavailableError);
  });

  test('a 429 is service-unavailable, not a generic failure', async () => {
    const { client } = clientFor({ respond: () => new Response('slow down', { status: 429 }) });
    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SpeechUnavailableError);
  });

  test('any other non-ok response is a synthesis failure', async () => {
    const { client } = clientFor({
      respond: () => new Response('model error', { status: 500, statusText: 'Internal Server Error' }),
    });
    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SynthesisFailedError);
  });

  test('retries a content_blocked 400 and succeeds when a later attempt is not blocked', async () => {
    let calls = 0;
    const { client, requests } = clientFor({
      respond: () => (++calls === 1 ? contentBlockedResponse() : audioResponse(SAMPLE_PCM_BASE64)),
    });

    const result = await client.synthesize({ text: 'कैलास शिखरे रम्ये' });

    expect(result.contentType).toBe('audio/wav');
    expect(requests).toHaveLength(2);
    // The retry must send the SAME input — retrying with altered text would
    // cache audio under a key no real request ever asks for.
    expect((requests[1].body as { input: string }).input).toBe(
      (requests[0].body as { input: string }).input
    );
  });

  test('a persistently blocked request is unavailable (retryable), not a synthesis failure', async () => {
    const { client, requests } = clientFor({ respond: () => contentBlockedResponse() });

    await expect(client.synthesize({ text: 'कैलास शिखरे रम्ये' })).rejects.toThrow(
      SpeechUnavailableError
    );
    // One initial attempt plus CONTENT_BLOCKED_RETRIES.
    expect(requests).toHaveLength(3);
  });

  test('each retry attempt gets its own timeout budget, not a shared one', async () => {
    // The retry loop used to sit INSIDE one withTimeout, so three attempts
    // plus backoff shared a single 30s budget: a first attempt that spent
    // most of it and then returned content_blocked left no room for the
    // retries, and the learner got "Synthesis timed out." instead of the
    // audio a retry would have produced. Proven by the signals rather than
    // by wall-clock: a shared budget means every attempt sees the SAME
    // AbortSignal instance; a per-attempt budget means a fresh one each time.
    const signals: AbortSignal[] = [];
    let calls = 0;
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      signals.push(init!.signal as AbortSignal);
      return ++calls === 1 ? contentBlockedResponse() : audioResponse(SAMPLE_PCM_BASE64);
    }) as unknown as typeof fetch;

    const client = new GeminiSpeechClient({ apiKey: 'test-key', fetchImpl, sleep: async () => {} });
    await client.synthesize({ text: 'कैलास' });

    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
  });

  test('a 400 that is NOT content_blocked fails immediately, without retrying', async () => {
    const { client, requests } = clientFor({
      respond: () => new Response('{"error":{"message":"Unknown model"}}', { status: 400 }),
    });

    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SynthesisFailedError);
    expect(requests).toHaveLength(1);
  });

  test('a response with no audio content in steps[].content[] is a synthesis failure', async () => {
    const { client } = clientFor({ respond: () => new Response(JSON.stringify({}), { status: 200 }) });
    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SynthesisFailedError);
  });

  test('a network-level failure surfaces as service-unavailable', async () => {
    const fetchImpl = (async () => {
      const error = new Error('connection refused') as NodeJS.ErrnoException;
      error.code = 'ECONNREFUSED';
      throw error;
    }) as unknown as typeof fetch;
    const client = new GeminiSpeechClient({ apiKey: 'test-key', fetchImpl });

    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SpeechUnavailableError);
  });

  test('a timeout/abort surfaces as service-unavailable, not a raw AbortError', async () => {
    // What `withTimeout` (SpeechClient.ts) actually produces when its
    // deadline fires: `fetch` rejects with a DOMException named AbortError,
    // which carries no `.code` — the network-error branch above would miss
    // it entirely without the dedicated isAbortError check.
    const fetchImpl = (async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;
    const client = new GeminiSpeechClient({ apiKey: 'test-key', fetchImpl });

    await expect(client.synthesize({ text: 'வணக்கம்' })).rejects.toThrow(SpeechUnavailableError);
  });
});
