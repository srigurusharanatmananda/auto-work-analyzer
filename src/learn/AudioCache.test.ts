/**
 * Real temp directories on disk, not a mocked `fs`. This is a filesystem
 * module and the standing "no live provider" rule is about network calls to
 * Whisper/TTS/AI/ClickUp — it says nothing about touching a temp directory,
 * and mocking `readFile`/`writeFile` here would mean re-describing this file's
 * own logic in the mock rather than testing it. Each test gets its own unique
 * subdirectory under `os.tmpdir()`, removed in `afterEach`, so tests cannot
 * see each other's cache entries and leave nothing behind on disk.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudioCache } from './AudioCache.js';

let root: string | undefined;

async function newCache(): Promise<AudioCache> {
  root = await mkdtemp(join(tmpdir(), 'audio-cache-test-'));
  return new AudioCache({ root });
}

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe('AudioCache', () => {
  test('a fresh cache misses, without throwing', async () => {
    const cache = await newCache();
    expect(await cache.get('नमस्ते', 'voice-a', 'slow, clear')).toBeNull();
  });

  test('put then get with the exact same (text, voice, prosody) returns the exact same bytes', async () => {
    const cache = await newCache();
    const audio = Buffer.from('synthesised-audio-bytes');

    await cache.put('नमस्ते', 'voice-a', 'slow, clear, measured', audio);
    const hit = await cache.get('नमस्ते', 'voice-a', 'slow, clear, measured');

    expect(hit).not.toBeNull();
    expect(hit).toEqual(audio);
  });

  test('a different text is a miss, even with the same voice and prosody', async () => {
    const cache = await newCache();
    await cache.put('नमस्ते', 'voice-a', 'slow, clear', Buffer.from('bytes-for-namaste'));

    expect(await cache.get('धन्यवाद', 'voice-a', 'slow, clear')).toBeNull();
  });

  test('a different voice is a miss, even with the same text and prosody', async () => {
    const cache = await newCache();
    await cache.put('नमस्ते', 'voice-a', 'slow, clear', Buffer.from('bytes-for-voice-a'));

    expect(await cache.get('नमस्ते', 'voice-b', 'slow, clear')).toBeNull();
  });

  test('a changed prosody description misses rather than reusing stale audio', async () => {
    // The design doc's own verification line: "changed prosody misses" — this
    // is what makes tuning the prosody string a safe edit rather than a silent
    // no-op that keeps serving audio recorded under the old wording.
    const cache = await newCache();
    await cache.put('नमस्ते', 'voice-a', 'slow, clear, measured', Buffer.from('old-prosody-bytes'));

    expect(await cache.get('नमस्ते', 'voice-a', 'fast, casual')).toBeNull();
  });

  test('fields that could collide under a naive "|" join do not collide', async () => {
    // If the key were `${text}|${voice}|${prosody}`, text="a|b" with voice="c"
    // would join to the same string as text="a" with voice="b|c". The
    // JSON.stringify-based key must keep these apart.
    const cache = await newCache();
    await cache.put('a|b', 'c', 'prosody', Buffer.from('first'));
    await cache.put('a', 'b|c', 'prosody', Buffer.from('second'));

    expect(await cache.get('a|b', 'c', 'prosody')).toEqual(Buffer.from('first'));
    expect(await cache.get('a', 'b|c', 'prosody')).toEqual(Buffer.from('second'));
  });

  test('defaults the root under storage/learn-audio when none is given', () => {
    const cache = new AudioCache();
    expect((cache as unknown as { root: string }).root).toContain(join('storage', 'learn-audio'));
  });
});
