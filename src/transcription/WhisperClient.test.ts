/**
 * The Whisper client, against a stubbed fetch. Nothing here opens a socket or
 * needs the container running.
 *
 * The tests worth having are the stream-assembly ones: Whisper's output arrives
 * as NDJSON over chunks that do not align with lines, and every way of getting
 * that wrong loses transcript text silently rather than failing.
 */

import { describe, expect, test } from 'bun:test';
import { NdjsonParser } from './ndjson.js';
import {
  TranscriptionFailedError,
  WhisperClient,
  WhisperUnavailableError,
} from './WhisperClient.js';

const STORAGE_ROOT = '/srv/awa/storage';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/** Healthy on /health, replays `chunks` on /transcribe-stream. */
function clientFor(chunks: string[], options: { healthy?: boolean } = {}) {
  const requests: Array<{ url: string; body?: unknown }> = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (url.endsWith('/health')) {
      if (options.healthy === false) throw new Error('connection refused');
      return new Response('ok', { status: 200 });
    }
    return new Response(streamOf(chunks), { status: 200 });
  }) as unknown as typeof fetch;

  const client = new WhisperClient({
    baseUrl: 'http://whisper.test',
    storageRoot: STORAGE_ROOT,
    fetchImpl,
    sleep: async () => {},
  });

  return { client, requests };
}

const segment = (text: string, start: number, end: number) =>
  JSON.stringify({ text, start, end }) + '\n';
const done = (language: string | null = 'en', confidence: number | null = 0.98) =>
  JSON.stringify({ _done: true, language, confidence }) + '\n';

describe('NdjsonParser', () => {
  test('assembles an object split across chunks', () => {
    const parser = new NdjsonParser<{ a: number }>();
    expect(parser.push('{"a":')).toEqual([]);
    expect(parser.push('1}\n')).toEqual([{ a: 1 }]);
  });

  test('returns several objects from one chunk', () => {
    const parser = new NdjsonParser<{ a: number }>();
    expect(parser.push('{"a":1}\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  /**
   * The reference implementation's bug: its flush path handled only the control
   * objects, so a final segment with no trailing newline vanished.
   */
  test('flush returns a final line that had no trailing newline', () => {
    const parser = new NdjsonParser<{ a: number }>();
    expect(parser.push('{"a":1}')).toEqual([]);
    expect(parser.flush()).toEqual([{ a: 1 }]);
  });

  test('flush is empty for a well-terminated stream', () => {
    const parser = new NdjsonParser<{ a: number }>();
    parser.push('{"a":1}\n');
    expect(parser.flush()).toEqual([]);
  });

  test('a truncated final object is dropped, not thrown', () => {
    // The stream was cut mid-object. There is nothing to recover, and throwing
    // would discard an otherwise complete transcript.
    const parser = new NdjsonParser<{ a: number }>();
    parser.push('{"a":');
    expect(parser.flush()).toEqual([]);
  });

  test('blank lines are ignored', () => {
    const parser = new NdjsonParser<{ a: number }>();
    expect(parser.push('\n\n{"a":1}\n\n')).toEqual([{ a: 1 }]);
  });
});

describe('containerPathFor', () => {
  const client = new WhisperClient({ storageRoot: STORAGE_ROOT, baseUrl: 'http://whisper.test' });

  /**
   * Whisper opens the file itself rather than receiving bytes, and sees the
   * mount as /storage. A host path would simply not exist for it.
   */
  test('rewrites a host path to the container mount', () => {
    expect(client.containerPathFor(`${STORAGE_ROOT}/audio/call-1.mp3`)).toBe(
      '/storage/audio/call-1.mp3'
    );
  });

  test('refuses a path outside the mount instead of letting the container 404', () => {
    expect(() => client.containerPathFor('/etc/passwd')).toThrow(TranscriptionFailedError);
    expect(() => client.containerPathFor('/etc/passwd')).toThrow(/outside the transcription/i);
  });

  test('refuses the storage root itself', () => {
    expect(() => client.containerPathFor(STORAGE_ROOT)).toThrow(TranscriptionFailedError);
  });
});

describe('transcribe', () => {
  test('assembles segments and the joined text', async () => {
    const { client } = clientFor([
      segment('Before we wrap up,', 0, 2.5),
      segment('the export is dropping the last row.', 2.5, 6),
      done(),
    ]);

    const result = await client.transcribe({
      audioPath: `${STORAGE_ROOT}/audio/a.mp3`,
      jobId: 'job-1',
    });

    expect(result.segments).toHaveLength(2);
    expect(result.text).toBe('Before we wrap up, the export is dropping the last row.');
    expect(result.language).toBe('en');
    expect(result.languageConfidence).toBe(0.98);
  });

  /** The realistic case: chunk boundaries fall mid-line. */
  test('survives chunks that split lines arbitrarily', async () => {
    const whole = segment('one', 0, 1) + segment('two', 1, 2) + done();
    const cut = Math.floor(whole.length / 3);

    const { client } = clientFor([whole.slice(0, cut), whole.slice(cut, cut * 2), whole.slice(cut * 2)]);

    const result = await client.transcribe({
      audioPath: `${STORAGE_ROOT}/audio/a.mp3`,
      jobId: 1,
    });

    expect(result.text).toBe('one two');
  });

  /** The dropped-tail bug, at the level that would actually bite. */
  test('keeps a final segment sent without a trailing newline', async () => {
    const { client } = clientFor([
      segment('first', 0, 1),
      JSON.stringify({ text: 'last', start: 1, end: 2 }),
    ]);

    const result = await client.transcribe({
      audioPath: `${STORAGE_ROOT}/audio/a.mp3`,
      jobId: 1,
    });

    expect(result.text).toBe('first last');
  });

  test('reports progress per segment, in order', async () => {
    const { client } = clientFor([segment('one', 0, 1), segment('two', 1, 2), done()]);
    const seen: Array<[string, number]> = [];

    await client.transcribe({
      audioPath: `${STORAGE_ROOT}/audio/a.mp3`,
      jobId: 1,
      onSegment: (s, index) => seen.push([s.text, index]),
    });

    expect(seen).toEqual([
      ['one', 0],
      ['two', 1],
    ]);
  });

  test('an _error line fails the transcription rather than returning a partial', async () => {
    const { client } = clientFor([
      segment('one', 0, 1),
      JSON.stringify({ _error: 'ffmpeg could not read the file' }) + '\n',
    ]);

    await expect(
      client.transcribe({ audioPath: `${STORAGE_ROOT}/audio/a.mp3`, jobId: 1 })
    ).rejects.toThrow(/ffmpeg could not read the file/);
  });

  test('sends the container path, not the host path', async () => {
    const { client, requests } = clientFor([done()]);

    await client.transcribe({ audioPath: `${STORAGE_ROOT}/audio/nested/a.mp3`, jobId: 'job-9' });

    const post = requests.find((r) => r.url.endsWith('/transcribe-stream'));
    expect((post?.body as { audio_path: string }).audio_path).toBe('/storage/audio/nested/a.mp3');
    expect((post?.body as { call_id: string }).call_id).toBe('job-9');
  });

  /** Fail fast: a bad path should not cost three minutes of health polling. */
  test('rejects an unreachable path before waiting on health', async () => {
    const { client, requests } = clientFor([done()], { healthy: false });

    await expect(client.transcribe({ audioPath: '/tmp/elsewhere.mp3', jobId: 1 })).rejects.toThrow(
      TranscriptionFailedError
    );
    expect(requests).toHaveLength(0);
  });

  test('an empty path is refused', async () => {
    const { client } = clientFor([done()]);
    await expect(client.transcribe({ audioPath: '   ', jobId: 1 })).rejects.toThrow(
      TranscriptionFailedError
    );
  });

  test('a silent recording yields empty text, not a failure', async () => {
    const { client } = clientFor([done(null, null)]);

    const result = await client.transcribe({
      audioPath: `${STORAGE_ROOT}/audio/a.mp3`,
      jobId: 1,
    });

    expect(result.segments).toEqual([]);
    expect(result.text).toBe('');
    expect(result.language).toBeNull();
  });
});

describe('waitUntilReady', () => {
  test('gives up with an actionable message when Whisper never answers', async () => {
    let polls = 0;
    const client = new WhisperClient({
      baseUrl: 'http://whisper.test',
      storageRoot: STORAGE_ROOT,
      fetchImpl: (async () => {
        polls += 1;
        throw new Error('connection refused');
      }) as unknown as typeof fetch,
      // Real elapsed time, just a very short deadline — no fake clock, because
      // a stubbed sleep that does not advance Date.now spins forever.
      healthTimeoutMs: 30,
      healthPollMs: 5,
    });

    await expect(client.waitUntilReady()).rejects.toThrow(WhisperUnavailableError);
    await expect(client.waitUntilReady()).rejects.toThrow(/container running/i);
    expect(polls).toBeGreaterThan(0);
  });

  test('returns as soon as health passes', async () => {
    let calls = 0;
    const client = new WhisperClient({
      baseUrl: 'http://whisper.test',
      storageRoot: STORAGE_ROOT,
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
