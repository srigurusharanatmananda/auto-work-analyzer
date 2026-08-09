/**
 * Synthesised audio, on disk, keyed by (text, voice, prosody).
 *
 * See `docs/specs/2026-08-08-learning-module-design.md`: "AudioCache is not an
 * optimisation, it is the architecture." At one user the same hundred lessons
 * are replayed constantly. Indic-Parler-TTS is 0.9B and CPU inference is slow
 * (per the design doc's own risk note), so re-synthesising on every play would
 * make the app feel broken for no reason. This cache is what makes replay free.
 *
 * Keying on the prosody description, not just the text, is deliberate and load
 * -bearing: prosody is a plain-text description ("slow, clear, measured"), and
 * if it is ever tuned, every lesson's audio must resynthesise rather than keep
 * serving stale bytes recorded under the old wording. A key that ignored
 * prosody would make that change silently do nothing.
 *
 * Deliberately filesystem-only, no database. The separate `learn_audio_cache`
 * Postgres table (src/db/schema.ts) is cache metadata bookkeeping across
 * restarts, but that is bookkeeping *about* the cache, not the cache itself —
 * this module has no reason to know Postgres exists, and stays usable (and
 * testable) without it.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

export interface AudioCacheOptions {
  /**
   * Defaults to LEARN_AUDIO_CACHE_ROOT, else `<cwd>/storage/learn-audio`.
   * Mirrors how WhisperClient resolves `storageRoot` — same env-var-with-
   * fallback shape, same `storage/` parent so one `.gitignore` entry and one
   * deploy volume cover audio for both transcription and learning.
   */
  root?: string;
}

export class AudioCache {
  private readonly root: string;

  constructor(options: AudioCacheOptions = {}) {
    this.root = resolve(
      options.root ?? process.env.LEARN_AUDIO_CACHE_ROOT ?? resolve('storage', 'learn-audio')
    );
  }

  /**
   * Where (text, voice, prosody) lives on disk.
   *
   * The key is a sha256 of `JSON.stringify([text, voice, prosody])`, not the
   * three fields joined with a plain separator like "|". Lesson text is
   * authored content and voice/prosody are free-text descriptions ("slow,
   * clear, measured, no background noise") — none of the three is guaranteed
   * not to contain "|" itself, and a delimiter that can appear inside a field
   * lets two different triples collide on the same joined string (e.g.
   * text="a|b", voice="c" colliding with text="a", voice="b|c"). JSON.stringify
   * escapes the field boundaries themselves (quoting each element, escaping any
   * embedded quote), so no combination of characters inside one field can be
   * mistaken for a boundary between fields — the encoding, not the separator
   * character, is what makes it collision-safe.
   */
  private keyFor(text: string, voice: string, prosody: string): string {
    return createHash('sha256').update(JSON.stringify([text, voice, prosody])).digest('hex');
  }

  private pathFor(key: string): string {
    return join(this.root, `${key}.audio`);
  }

  /**
   * The cached bytes for this exact (text, voice, prosody), or null on a miss.
   *
   * A missing file is the expected miss case, not a failure, so ENOENT is
   * swallowed into `null`. Anything else — EACCES, EISDIR, disk gone away — is
   * a real problem the caller needs to see, so only ENOENT is caught.
   */
  async get(text: string, voice: string, prosody: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(this.keyFor(text, voice, prosody)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /** Writes the synthesised audio for (text, voice, prosody), creating the cache directory if needed. */
  async put(text: string, voice: string, prosody: string, audio: Buffer): Promise<void> {
    const path = this.pathFor(this.keyFor(text, voice, prosody));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, audio);
  }
}
