/**
 * Warms AudioCache for every Sanskrit lesson before any learner hits "Play
 * audio".
 *
 * Why this exists: `services/tts` is a self-hosted 0.9B-parameter model
 * running CPU-only (Docker Desktop on macOS cannot pass the Apple GPU
 * through). Measured against the real container, synthesising even a single
 * two-character word took several minutes. `AudioCache`'s own design comment
 * already says the quiet part — "the same hundred lessons are replayed
 * constantly... this cache is what makes replay free" — but a cache that
 * only fills on first request means the FIRST learner to open any given
 * lesson is the one stuck waiting minutes for it, on a route with no
 * background-job plumbing. Running this once (or after any manifest change)
 * means every real request that follows is a cache hit.
 *
 * Tamil has no equivalent script: GeminiSpeechClient calls a live, fast API,
 * so there is no multi-minute cold path to pre-warm there.
 *
 * Run: npx tsx scripts/pregenerate-sanskrit-audio.ts
 * Requires: docker compose up tts (and the model already downloaded/loaded —
 * see services/tts/main.py's own /health).
 */

import 'dotenv/config';
import { sanskritManifest } from '../src/learn/content/sanskrit.js';
import { transliterateForSynthesis } from '../src/learn/Transliterator.js';
import { SpeechClient, DEFAULT_PROSODY } from '../src/learn/SpeechClient.js';
import { AudioCache } from '../src/learn/AudioCache.js';
import { DEFAULT_VOICE as CACHE_VOICE_KEY } from '../src/routes/learn.routes.js';

// `undefined` is what's actually passed to synthesize(), so the backend's
// own default voice applies — the same reasoning as learn.routes.ts's own
// comment on why sending the literal string 'default' as a voice name broke
// real requests. `CACHE_VOICE_KEY` (imported above) is only ever used as
// the cache lookup/write key, never passed to synthesize() itself.

async function main() {
  const speechClient = new SpeechClient();
  const audioCache = new AudioCache();

  console.log(`Checking TTS service health at ${process.env.TTS_API_URL ?? 'http://localhost:8001'}...`);
  await speechClient.waitUntilReady();
  console.log('TTS service is healthy. Pregenerating audio for the sanskrit manifest...');

  let cached = 0;
  let generated = 0;
  const failed: string[] = [];

  // One lesson failing (a transient container restart, an OOM under load)
  // should not cost every lesson after it in the manifest a cache entry —
  // the whole point of running this ahead of time is that a single slow or
  // flaky attempt is cheap to retry, unlike making a live learner wait for it.
  for (const lesson of sanskritManifest.lessons) {
    const synthesisText = transliterateForSynthesis(lesson.text, sanskritManifest.language);
    const existing = await audioCache.get(synthesisText, CACHE_VOICE_KEY, DEFAULT_PROSODY);
    if (existing) {
      cached++;
      console.log(`[cached]    ${lesson.id} (${lesson.text})`);
      continue;
    }

    console.log(`[synthesizing] ${lesson.id} (${lesson.text}) — this can take several minutes on CPU...`);
    const started = Date.now();
    try {
      const result = await speechClient.synthesize({ text: synthesisText, prosody: DEFAULT_PROSODY });
      await audioCache.put(synthesisText, CACHE_VOICE_KEY, DEFAULT_PROSODY, result.audio);
      generated++;
      console.log(`[done]      ${lesson.id} — ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (error) {
      failed.push(lesson.id);
      console.error(`[failed]    ${lesson.id} — ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(
    `\nDone. ${cached} already cached, ${generated} newly generated, ${failed.length} failed, ` +
      `${sanskritManifest.lessons.length} total.`
  );
  if (failed.length > 0) {
    console.log(`Failed lesson ids (re-run this script to retry just these, via the cache-hit skip above): ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Pregeneration failed:', error);
  process.exitCode = 1;
});
