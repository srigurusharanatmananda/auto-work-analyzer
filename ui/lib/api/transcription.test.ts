/**
 * The upload-then-poll loop.
 *
 * `sleep` is injected throughout: a real 2-second poll interval would make this
 * file take minutes, and stubbing global timers to avoid that is how a test
 * ends up hanging forever when the code under test also reads the clock.
 */

import { describe, expect, mock, test } from 'bun:test';
import {
  AUDIO_EXTENSIONS,
  TranscriptionFailedError,
  type TranscriptionJob,
  formatDuration,
  formatTimestamp,
  ingestFromUrl,
  isAudioFile,
  looksLikeUrl,
  searchTranscripts,
  waitForTranscript,
} from './transcription';
import { api, type RequestOptions } from './ApiClient';

const job = (overrides: Partial<TranscriptionJob> = {}): TranscriptionJob => ({
  id: 'job-1',
  status: 'queued',
  originalFilename: 'call.m4a',
  ...overrides,
});

/** Replaces the shared client's `get` for the duration of one test. */
function stubGet(sequence: TranscriptionJob[]) {
  let index = 0;
  const spy = mock(async () => sequence[Math.min(index++, sequence.length - 1)]!);
  const original = api.get;
  (api as unknown as { get: unknown }).get = spy;
  return {
    spy,
    restore: () => {
      (api as unknown as { get: unknown }).get = original;
    },
  };
}

const noSleep = async () => {};

describe('isAudioFile', () => {
  test('recognises every extension the server accepts', () => {
    for (const extension of AUDIO_EXTENSIONS) {
      expect(isAudioFile(new File([], `recording${extension}`))).toBe(true);
    }
  });

  /** The picker is case-insensitive on macOS and phones emit .M4A. */
  test('is case-insensitive', () => {
    expect(isAudioFile(new File([], 'CALL.M4A'))).toBe(true);
  });

  test('text files take the read-locally path instead', () => {
    expect(isAudioFile(new File([], 'notes.txt'))).toBe(false);
    expect(isAudioFile(new File([], 'notes.md'))).toBe(false);
  });

  /** ".m4a summary.txt" is a text file, whatever it has in the middle. */
  test('matches the extension, not a substring of the name', () => {
    expect(isAudioFile(new File([], 'the .mp3 conversion notes.txt'))).toBe(false);
  });
});

describe('waitForTranscript', () => {
  test('polls until the job succeeds and returns it', async () => {
    const { spy, restore } = stubGet([
      job({ status: 'queued' }),
      job({ status: 'running', segmentsSeen: 12 }),
      job({ status: 'succeeded', transcript: 'hello world' }),
    ]);

    try {
      const result = await waitForTranscript('job-1', { sleep: noSleep });
      expect(result.transcript).toBe('hello world');
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      restore();
    }
  });

  test('reports every poll so the UI can show progress', async () => {
    const { restore } = stubGet([
      job({ status: 'running', segmentsSeen: 4 }),
      job({ status: 'succeeded', transcript: 'x' }),
    ]);
    const seen: number[] = [];

    try {
      await waitForTranscript('job-1', {
        sleep: noSleep,
        onProgress: (current) => seen.push(current.segmentsSeen ?? 0),
      });
      expect(seen).toEqual([4, 0]);
    } finally {
      restore();
    }
  });

  /** A failed job must not resolve with an empty transcript — that reads as "no speech". */
  test('throws with the backend reason when the job fails', async () => {
    const { restore } = stubGet([job({ status: 'failed', error: 'Whisper is unreachable' })]);

    try {
      const caught = await waitForTranscript('job-1', { sleep: noSleep }).catch((e) => e);
      expect(caught).toBeInstanceOf(TranscriptionFailedError);
      expect((caught as Error).message).toBe('Whisper is unreachable');
    } finally {
      restore();
    }
  });

  test('a cancelled job is a failure, not a success with no text', async () => {
    const { restore } = stubGet([job({ status: 'cancelled' })]);

    try {
      const caught = await waitForTranscript('job-1', { sleep: noSleep }).catch((e) => e);
      expect(caught).toBeInstanceOf(TranscriptionFailedError);
    } finally {
      restore();
    }
  });

  /** Walking away from the page must stop the polling, not the job. */
  test('an aborted signal stops the loop with an AbortError', async () => {
    const { spy, restore } = stubGet([job({ status: 'running' })]);
    const controller = new AbortController();
    controller.abort();

    try {
      const caught = await waitForTranscript('job-1', {
        sleep: noSleep,
        signal: controller.signal,
      }).catch((e) => e);
      expect((caught as Error).name).toBe('AbortError');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

/** Captures the path and options `api.get` was called with, typed. */
type GetOptions = Omit<RequestOptions, 'method' | 'body'>;

function stubGetCapturing(response: unknown) {
  const calls: Array<{ path: string; options: GetOptions }> = [];
  const original = api.get;

  (api as unknown as { get: unknown }).get = mock(
    async (path: string, options: GetOptions = {}) => {
      calls.push({ path, options });
      return response;
    }
  );

  return {
    calls,
    restore: () => {
      (api as unknown as { get: unknown }).get = original;
    },
  };
}

describe('searchTranscripts', () => {
  const empty = { query: '', results: [], total: 0, limit: 25 };

  test('sends the query, dates and limit as query parameters', async () => {
    const { calls, restore } = stubGetCapturing(empty);

    try {
      await searchTranscripts({ query: '  contract  ', from: '2026-01-01', to: '2026-02-01', limit: 10 });
    } finally {
      restore();
    }

    expect(calls[0]!.path).toBe('/transcription/search');
    expect(calls[0]!.options.query).toEqual({
      q: 'contract',
      from: '2026-01-01',
      to: '2026-02-01',
      limit: 10,
    });
  });

  /**
   * Not hand-built into the path: `ApiClient` drops the undefined entries and
   * encodes the rest, so a search for `R&D` survives the trip.
   */
  test('omits empty filters rather than sending blanks', async () => {
    const { calls, restore } = stubGetCapturing(empty);

    try {
      await searchTranscripts({ query: '   ' });
    } finally {
      restore();
    }

    expect(calls[0]!.options.query).toEqual({
      q: undefined,
      from: undefined,
      to: undefined,
      limit: undefined,
    });
  });

  test('passes an abort signal through when one is given', async () => {
    const { calls, restore } = stubGetCapturing(empty);
    const controller = new AbortController();

    try {
      await searchTranscripts({ query: 'x', signal: controller.signal });
    } finally {
      restore();
    }

    expect(calls[0]!.options.signal).toBe(controller.signal);
  });

  test('sends no signal key at all when none is given', async () => {
    const { calls, restore } = stubGetCapturing(empty);

    try {
      await searchTranscripts({ query: 'x' });
    } finally {
      restore();
    }

    expect('signal' in calls[0]!.options).toBe(false);
  });
});

describe('formatDuration', () => {
  test('drops the leading units that are zero', () => {
    expect(formatDuration(9)).toBe('9s');
    expect(formatDuration(252)).toBe('4m 12s');
    expect(formatDuration(3852)).toBe('1h 04m');
  });

  /** Null, not "0s" — the caller decides whether that is a dash or nothing. */
  test('is null when there is no duration to show', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });
});

describe('formatTimestamp', () => {
  test('is mm:ss, and h:mm:ss past an hour', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(754)).toBe('12:34');
    expect(formatTimestamp(3754)).toBe('1:02:34');
  });

  /**
   * Zero is a real timestamp — the very start of the recording — so unlike a
   * duration it must not be treated as absent.
   */
  test('distinguishes the start of the recording from no timestamp', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(null)).toBeNull();
  });
});

describe('looksLikeUrl', () => {
  test('accepts what could plausibly be fetched', () => {
    for (const value of [
      'https://www.youtube.com/watch?v=abc',
      'http://cdn.example.com/a.mp3',
      '  https://example.com/a.mp3  ',
    ]) {
      expect(looksLikeUrl(value)).toBe(true);
    }
  });

  test('rejects what is obviously not a link', () => {
    for (const value of ['', 'not a url', 'example.com/a.mp3', 'file:///etc/passwd']) {
      expect(looksLikeUrl(value)).toBe(false);
    }
  });

  /**
   * Deliberately permissive. This is a typo catcher, not a second allowlist —
   * the server refuses these, and duplicating its rules here would give two
   * lists to keep in step with the browser holding the stale one.
   */
  test('leaves the real decision to the server', () => {
    expect(looksLikeUrl('http://127.0.0.1/a.mp3')).toBe(true);
    expect(looksLikeUrl('https://example.com/notes.pdf')).toBe(true);
  });
});

describe('ingestFromUrl', () => {
  /** Replaces the shared client's `post`, capturing what it was sent. */
  function stubPost() {
    const calls: Array<{ path: string; body: unknown }> = [];
    const original = api.post;
    (api as unknown as { post: (path: string, body?: unknown) => Promise<TranscriptionJob> }).post =
      async (path, body) => {
        calls.push({ path, body });
        return job({ id: 'queued-1' });
      };
    return { calls, restore: () => ((api as unknown as { post: unknown }).post = original) };
  }

  test('posts the link and returns the queued job', async () => {
    const { calls, restore } = stubPost();
    try {
      const queued = await ingestFromUrl({ url: 'https://cdn.example.com/a.mp3' });

      expect(queued.id).toBe('queued-1');
      expect(calls[0]!.path).toBe('/transcription/from-url');
      expect(calls[0]!.body).toEqual({ url: 'https://cdn.example.com/a.mp3' });
    } finally {
      restore();
    }
  });

  test('trims the link and omits the optional fields when they are empty', async () => {
    const { calls, restore } = stubPost();
    try {
      await ingestFromUrl({ url: '  https://cdn.example.com/a.mp3  ', callTitle: '', callDate: '' });

      expect(calls[0]!.body).toEqual({ url: 'https://cdn.example.com/a.mp3' });
    } finally {
      restore();
    }
  });

  test('sends the title and date when there are any', async () => {
    const { calls, restore } = stubPost();
    try {
      await ingestFromUrl({
        url: 'https://cdn.example.com/a.mp3',
        callTitle: 'Acme renewal',
        callDate: '2026-08-01',
      });

      expect(calls[0]!.body).toEqual({
        url: 'https://cdn.example.com/a.mp3',
        callTitle: 'Acme renewal',
        callDate: '2026-08-01',
      });
    } finally {
      restore();
    }
  });
});
