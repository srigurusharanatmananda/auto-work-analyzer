/**
 * Warms AudioCache for the chanting-practice feature's verses, the same
 * reasoning and the same problem `pregenerate-sanskrit-audio.ts` already
 * solves for the letters-up curriculum: `services/tts` is self-hosted,
 * CPU-only, and slow (multiple minutes even for a short word) — pre-warming
 * means a real learner's "Play audio" click is a cache hit, not the first
 * cold synthesis.
 *
 * Chanting phrases are longer than curriculum words (a whole pāda, or a
 * whole four-pāda verse), so this can take considerably longer to run than
 * the curriculum script does — that's expected, and is exactly why it needs
 * to run ahead of time rather than on a learner's own click.
 *
 * Caches BOTH each pāda's own text (per-phrase "Play audio" in the UI) AND
 * the full concatenated verse text (the "Play full verse" button) — two
 * different cache keys, since `AudioCache` keys on exact synthesised text.
 *
 * Run: npx tsx scripts/pregenerate-chanting-audio.ts
 * Requires: docker compose up tts (and the model already downloaded/loaded —
 * see services/tts/main.py's own /health).
 */

import 'dotenv/config';
import { guruGitaVerses } from '../src/learn/content/chanting.js';
import { transliterateForSynthesis } from '../src/learn/Transliterator.js';
import { SpeechClient, DEFAULT_PROSODY } from '../src/learn/SpeechClient.js';
import { AudioCache } from '../src/learn/AudioCache.js';

// Mirrors learn.routes.ts's DEFAULT_VOICE — a cache-key label only, matching
// exactly what a real "Play audio" click in the UI sends (no `voice` field),
// so this pregeneration lands in the same cache entries real requests read.
const CACHE_VOICE_KEY = 'default';

interface Item {
  id: string;
  text: string;
}

function itemsFor(verse: (typeof guruGitaVerses)[number]): Item[] {
  const padaItems = verse.padas.map((pada, i) => ({ id: `${verse.id}-pada-${i + 1}`, text: pada.text }));
  const fullVerseText = verse.padas.map((p) => p.text).join(' ');
  return [...padaItems, { id: `${verse.id}-full`, text: fullVerseText }];
}

async function main() {
  const speechClient = new SpeechClient();
  const audioCache = new AudioCache();

  console.log(`Checking TTS service health at ${process.env.TTS_API_URL ?? 'http://localhost:8001'}...`);
  await speechClient.waitUntilReady();
  console.log('TTS service is healthy. Pregenerating audio for chanting verses...');

  const items = guruGitaVerses.flatMap(itemsFor);

  let cached = 0;
  let generated = 0;
  const failed: string[] = [];

  // Same reasoning as pregenerate-sanskrit-audio.ts: one item failing (a
  // transient container restart, an OOM under load) should not cost every
  // item after it a cache entry.
  for (const item of items) {
    // `.trim()` matches `learn.routes.ts`'s own `POST /speak` handler
    // exactly (`transliterateForSynthesis(text.trim(), ...)`) — a mismatch
    // here would mean this pregeneration writes a cache entry a real
    // request's own key never reads.
    const synthesisText = transliterateForSynthesis(item.text.trim(), 'sanskrit');
    const existing = await audioCache.get(synthesisText, CACHE_VOICE_KEY, DEFAULT_PROSODY);
    if (existing) {
      cached++;
      console.log(`[cached]       ${item.id} (${item.text})`);
      continue;
    }

    console.log(`[synthesizing] ${item.id} (${item.text}) — this can take several minutes on CPU, longer for longer phrases...`);
    const started = Date.now();
    try {
      const result = await speechClient.synthesize({ text: synthesisText, prosody: DEFAULT_PROSODY });
      await audioCache.put(synthesisText, CACHE_VOICE_KEY, DEFAULT_PROSODY, result.audio);
      generated++;
      console.log(`[done]         ${item.id} — ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (error) {
      failed.push(item.id);
      console.error(`[failed]       ${item.id} — ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\nDone. ${cached} already cached, ${generated} newly generated, ${failed.length} failed, ${items.length} total.`);
  if (failed.length > 0) {
    console.log(`Failed item ids (re-run this script to retry just these, via the cache-hit skip above): ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Pregeneration failed:', error);
  process.exitCode = 1;
});
