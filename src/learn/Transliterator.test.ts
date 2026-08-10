/**
 * Both languages are identity today. See the Transliterator.ts file header
 * for why Sanskrit is: `sanskrit_tts`/Vāgdhenu needed a Kannada route because
 * neither has dedicated Sanskrit training, but the self-hosted backend this
 * app actually runs (`ai4bharat/indic-parler-tts`, see `services/tts`) does,
 * and empirical testing against the real container found Kannada input makes
 * its output *worse* — longer and garbled — not better.
 */

import { describe, expect, test } from 'bun:test';
import Sanscript from '@indic-transliteration/sanscript';
import { transliterateForSynthesis } from './Transliterator.js';

describe('transliterateForSynthesis — sanskrit', () => {
  test('is the identity function', () => {
    // Not "not yet implemented" — deliberate, and reversed from an earlier
    // design. See the file header: the Kannada route this app once used was
    // built for backends without native Sanskrit training; the backend this
    // app actually runs has it, and Kannada input measurably hurt its output.
    const text = 'नर';
    expect(transliterateForSynthesis(text, 'sanskrit')).toBe(text);
  });

  test('preserves vowel length and conjuncts untouched, being identity', () => {
    // No transformation happens, so there is nothing that could lose the
    // vowel-length contrast the 2026-08-08 whisper probe found ASR could
    // hear but not decode, or collapse a conjunct into two syllables.
    expect(transliterateForSynthesis('दिन', 'sanskrit')).toBe('दिन'); // dina, "day"
    expect(transliterateForSynthesis('दीन', 'sanskrit')).toBe('दीन'); // dīna, "wretched"
    expect(transliterateForSynthesis('नमस्ते', 'sanskrit')).toBe('नमस्ते'); // namaste
  });
});

describe('transliterateForSynthesis — tamil', () => {
  test('is the identity function', () => {
    // See the file header: Tamil's consonant ambiguity makes a Kannada route
    // lossy, and Indic-Parler-TTS takes Tamil directly.
    const text = 'தமிழ்';
    expect(transliterateForSynthesis(text, 'tamil')).toBe(text);
  });

  test('routing tamil through the kannada scheme would pick the wrong consonant', () => {
    // Documents *why* tamil is identity rather than routed: transliterating
    // தமிழ் (tamizh) into Kannada script does not yield a Kannada spelling of
    // "tamizh" — it silently resolves the ambiguous த to "dha", not "ta".
    // If this assertion ever starts failing, the identity choice above needs
    // re-examining, not this test.
    expect(Sanscript.t('தமிழ்', 'tamil', 'kannada')).not.toBe('ತಮಿೞ್');
  });
});
