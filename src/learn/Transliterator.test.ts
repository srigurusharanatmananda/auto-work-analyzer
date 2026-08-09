/**
 * The one place a silent error is unrecoverable: if this mapping is wrong,
 * the learner hears confident, incorrect pronunciation and has no way to
 * know it. Verified mechanically against known Devanagari->Kannada pairs
 * rather than spot-checked, per the design doc's own risk note.
 */

import { describe, expect, test } from 'bun:test';
import Sanscript from '@indic-transliteration/sanscript';
import { transliterateForSynthesis } from './Transliterator.js';

describe('transliterateForSynthesis — sanskrit', () => {
  test('vowel length is preserved, not just carried through', () => {
    // The meaning-bearing contrast the whisper probe (2026-08-08) found ASR
    // could hear but not decode. The synthesis side must not lose it either.
    expect(transliterateForSynthesis('दिन', 'sanskrit')).toBe('ದಿನ'); // dina, "day"
    expect(transliterateForSynthesis('दीन', 'sanskrit')).toBe('ದೀನ'); // dīna, "wretched"
    expect(transliterateForSynthesis('दिन', 'sanskrit')).not.toBe(
      transliterateForSynthesis('दीन', 'sanskrit')
    );

    expect(transliterateForSynthesis('कर', 'sanskrit')).toBe('ಕರ'); // kara, "hand"
    expect(transliterateForSynthesis('कार', 'sanskrit')).toBe('ಕಾರ'); // kāra, "maker"

    expect(transliterateForSynthesis('सुत', 'sanskrit')).toBe('ಸುತ'); // suta, "son"
    expect(transliterateForSynthesis('सूत', 'sanskrit')).toBe('ಸೂತ'); // sūta, "charioteer"
  });

  test('conjuncts render as the joined consonant cluster, not two syllables', () => {
    expect(transliterateForSynthesis('नमस्ते', 'sanskrit')).toBe('ನಮಸ್ತೇ'); // namaste
    expect(transliterateForSynthesis('क्ष', 'sanskrit')).toBe('ಕ್ಷ'); // kṣa
    expect(transliterateForSynthesis('ज्ञ', 'sanskrit')).toBe('ಜ್ಞ'); // jña
  });

  test('anusvara, visarga and vocalic r carry over', () => {
    expect(transliterateForSynthesis('अं', 'sanskrit')).toBe('ಅಂ');
    expect(transliterateForSynthesis('अः', 'sanskrit')).toBe('ಅಃ');
    expect(transliterateForSynthesis('ऋ', 'sanskrit')).toBe('ಋ');
  });

  test('a full phrase from the whisper probe', () => {
    expect(transliterateForSynthesis('ॐ नमः शिवाय', 'sanskrit')).toBe('ಓಂ ನಮಃ ಶಿವಾಯ');
    expect(transliterateForSynthesis('सत्यमेव जयते', 'sanskrit')).toBe('ಸತ್ಯಮೇವ ಜಯತೇ');
  });
});

describe('transliterateForSynthesis — tamil', () => {
  test('is the identity function', () => {
    // Not "not yet implemented" — deliberate. See the file header: Tamil's
    // consonant ambiguity makes a Kannada route lossy, and Indic-Parler-TTS
    // takes Tamil directly.
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
