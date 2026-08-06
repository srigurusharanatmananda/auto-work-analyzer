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
  isAudioFile,
  waitForTranscript,
} from './transcription';
import { api } from './ApiClient';

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
