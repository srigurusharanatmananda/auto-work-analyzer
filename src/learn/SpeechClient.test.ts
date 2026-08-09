/**
 * The Speech client, against a stubbed fetch. Nothing here opens a socket or
 * needs the (not yet built) TTS container running — per the standing rule, no
 * test may hit a live AI provider.
 */

import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_PROSODY,
  SpeechClient,
  SpeechUnavailableError,
  SynthesisFailedError,
} from './SpeechClient.js';

/** Healthy on /health, replays `audio` on /synthesize. */
function clientFor(audio: Uint8Array, options: { healthy?: boolean } = {}) {
  const requests: Array<{ url: string; body?: unknown }> = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (url.endsWith('/health')) {
      if (options.healthy === false) throw new Error('connection refused');
      return new Response('ok', { status: 200 });
    }
    return new Response(audio, { status: 200, headers: { 'Content-Type': 'audio/wav' } });
  }) as unknown as typeof fetch;

  const client = new SpeechClient({
    baseUrl: 'http://tts.test',
    fetchImpl,
    sleep: async () => {},
  });

  return { client, requests };
}

describe('synthesize', () => {
  test('returns the audio bytes and content type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { client } = clientFor(bytes);

    const result = await client.synthesize({ text: 'namaste' });

    expect(Buffer.from(result.audio)).toEqual(Buffer.from(bytes));
    expect(result.contentType).toBe('audio/wav');
  });

  test('sends text, voice and the default prosody as JSON', async () => {
    const { client, requests } = clientFor(new Uint8Array());

    await client.synthesize({ text: 'namaste', voice: 'voice-1' });

    const post = requests.find((r) => r.url.endsWith('/synthesize'));
    expect(post?.body).toEqual({ text: 'namaste', voice: 'voice-1', prosody: DEFAULT_PROSODY });
  });

  test('an explicit prosody overrides the default', async () => {
    const { client, requests } = clientFor(new Uint8Array());

    await client.synthesize({ text: 'namaste', prosody: 'fast and loud' });

    const post = requests.find((r) => r.url.endsWith('/synthesize'));
    expect((post?.body as { prosody: string }).prosody).toBe('fast and loud');
  });

  test('an empty text is refused', async () => {
    const { client } = clientFor(new Uint8Array());
    await expect(client.synthesize({ text: '   ' })).rejects.toThrow(SynthesisFailedError);
  });

  test('a non-ok response fails synthesis with the right error type', async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/health')) return new Response('ok', { status: 200 });
      return new Response('model error', { status: 500, statusText: 'Internal Server Error' });
    }) as unknown as typeof fetch;

    const client = new SpeechClient({ baseUrl: 'http://tts.test', fetchImpl, sleep: async () => {} });

    await expect(client.synthesize({ text: 'namaste' })).rejects.toThrow(SynthesisFailedError);
  });

  test('a network-level failure surfaces as service-unavailable, not a raw error', async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/health')) return new Response('ok', { status: 200 });
      const error = new Error('connection reset') as NodeJS.ErrnoException;
      error.code = 'ECONNRESET';
      throw error;
    }) as unknown as typeof fetch;

    const client = new SpeechClient({ baseUrl: 'http://tts.test', fetchImpl, sleep: async () => {} });

    await expect(client.synthesize({ text: 'namaste' })).rejects.toThrow(SpeechUnavailableError);
  });

  test('a timeout/abort after health passes surfaces as service-unavailable, not a raw AbortError', async () => {
    // What withTimeout actually produces when its deadline fires — fetch
    // rejects with a DOMException named AbortError, carrying no `.code`, so
    // the network-error branch above would miss it without a dedicated check.
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/health')) return new Response('ok', { status: 200 });
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;

    const client = new SpeechClient({ baseUrl: 'http://tts.test', fetchImpl, sleep: async () => {} });

    await expect(client.synthesize({ text: 'namaste' })).rejects.toThrow(SpeechUnavailableError);
  });

  /** Fail fast: a bad request should not cost three minutes of health polling. */
  test('rejects empty text before waiting on health', async () => {
    const { client, requests } = clientFor(new Uint8Array(), { healthy: false });

    await expect(client.synthesize({ text: '' })).rejects.toThrow(SynthesisFailedError);
    expect(requests).toHaveLength(0);
  });
});

describe('waitUntilReady', () => {
  test('gives up with an actionable message when the TTS service never answers', async () => {
    let polls = 0;
    const client = new SpeechClient({
      baseUrl: 'http://tts.test',
      fetchImpl: (async () => {
        polls += 1;
        throw new Error('connection refused');
      }) as unknown as typeof fetch,
      // Real elapsed time, just a very short deadline — no fake clock, because
      // a stubbed sleep that does not advance Date.now spins forever.
      healthTimeoutMs: 30,
      healthPollMs: 5,
    });

    await expect(client.waitUntilReady()).rejects.toThrow(SpeechUnavailableError);
    await expect(client.waitUntilReady()).rejects.toThrow(/container running/i);
    expect(polls).toBeGreaterThan(0);
  });

  test('returns as soon as health passes', async () => {
    let calls = 0;
    const client = new SpeechClient({
      baseUrl: 'http://tts.test',
      fetchImpl: (async () => {
        calls += 1;
        if (calls < 3) throw new Error('starting up');
        return new Response('ok', { status: 200 });
      }) as unknown as typeof fetch,
      sleep: async () => {},
    });

    await client.waitUntilReady();
    expect(calls).toBe(3);
  });
});
