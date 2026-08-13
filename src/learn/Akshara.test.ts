/**
 * Every expected split/weight here is checked against a real source, not
 * assumed — see `Akshara.ts`'s own header for the citations (Whitney §77/
 * §79, Macdonell's Metre appendix, Apte's Metrical Appendix,
 * LearnSanskrit.org's "Syllables" page).
 */

import { describe, expect, test } from 'bun:test';
import { splitIntoSyllables } from './Akshara.js';

describe('splitIntoSyllables — segmentation', () => {
  test('brahmaṇe splits exactly as Whitney §77 gives it (bra-hma-ṇe), guru-laghu-guru', () => {
    const syllables = splitIntoSyllables('ब्रह्मणे', { finalIsAnceps: false });
    expect(syllables.map((s) => s.text)).toEqual(['ब्र', 'ह्म', 'णे']);
    // ब्र: short अ, but ह्म opens with two consonants (ह्, म्) — a real
    // cluster, so ब्र is long "by position." ह्म: short अ, णे opens with
    // only one consonant (ण्) — not a cluster, so ह्म is laghu. णे: long
    // by nature (े is unconditionally long) — guru regardless of position.
    expect(syllables.map((s) => s.weight)).toEqual(['guru', 'laghu', 'guru']);
  });

  test('ignores whitespace between words, per LearnSanskrit.org\'s own worked example', () => {
    const withSpace = splitIntoSyllables('कैलास शिखरे', { finalIsAnceps: false });
    const withoutSpace = splitIntoSyllables('कैलासशिखरे', { finalIsAnceps: false });
    expect(withSpace.map((s) => s.text)).toEqual(withoutSpace.map((s) => s.text));
  });

  test('a word-final bare consonant (halanta) is folded into the preceding syllable, not returned as its own entry', () => {
    // नमः: न + मः (visarga fuses onto the vowel, so this word has no bare
    // trailing consonant — see the anusvāra/visarga test below for that).
    // भक्तिसन्धाननायकम् ends in ...क + म् — म् has no vowel of its own.
    const syllables = splitIntoSyllables('भक्तिसन्धाननायकम्', { finalIsAnceps: false });
    expect(syllables.map((s) => s.text)).toEqual(['भ', 'क्ति', 'स', 'न्धा', 'न', 'ना', 'य', 'क']);
    expect(syllables.every((s) => s.vowel !== '')).toBe(true);
  });
});

describe('splitIntoSyllables — metrical weight', () => {
  test('long vowel (ā) is guru regardless of position', () => {
    const [syl] = splitIntoSyllables('पा', { finalIsAnceps: false });
    expect(syl.weight).toBe('guru');
  });

  test('short vowel with no following cluster is laghu', () => {
    // स in सशिखरे — short अ, followed by शि which opens with exactly one
    // consonant (श्) before its own vowel — not a cluster.
    const syllables = splitIntoSyllables('सशिखरे', { finalIsAnceps: false });
    expect(syllables[0].weight).toBe('laghu');
  });

  test('short vowel followed by a consonant cluster is guru ("long by position")', () => {
    // क्ति itself: short इ, but followed by स (single consonant, opens
    // the next syllable) — NOT a cluster on its own. Use सन्धा instead:
    // स is short अ followed by न्धा, which opens with two consonants
    // (न्, ध्) before its own vowel — a real cluster.
    const syllables = splitIntoSyllables('सन्धा', { finalIsAnceps: false });
    expect(syllables[0].weight).toBe('guru');
  });

  test('e/ai/o/au are unconditionally guru, not merely "usually" long', () => {
    for (const vowelWord of ['के', 'कै', 'को', 'कौ']) {
      const [syl] = splitIntoSyllables(vowelWord, { finalIsAnceps: false });
      expect(syl.weight).toBe('guru');
    }
  });

  test('anusvāra alone makes an otherwise-short vowel guru', () => {
    const [syl] = splitIntoSyllables('शङ्करं', { finalIsAnceps: false }).slice(-1);
    expect(syl.vowel).toBe('अं');
    expect(syl.weight).toBe('guru');
  });

  test('visarga alone makes an otherwise-short vowel guru', () => {
    const [syl] = splitIntoSyllables('नमः', { finalIsAnceps: false }).slice(-1);
    expect(syl.vowel).toBe('अः');
    expect(syl.weight).toBe('guru');
  });

  test('a trailing bare consonant with nothing else after it does NOT by itself make the preceding syllable guru', () => {
    // क in भक्तिसन्धाननायकम्: short अ, followed by exactly one trailing
    // consonant (म्) with nothing after it — one consonant is not "two or
    // more," so this stays laghu despite being word-final.
    const syllables = splitIntoSyllables('भक्तिसन्धाननायकम्', { finalIsAnceps: false });
    const last = syllables[syllables.length - 1];
    expect(last.text).toBe('क');
    expect(last.weight).toBe('laghu');
  });

  test('finalIsAnceps (default true) marks the last syllable ambiguous regardless of its phonetic weight', () => {
    const withDefault = splitIntoSyllables('भक्तिसन्धाननायकम्');
    expect(withDefault[withDefault.length - 1].weight).toBe('anceps');

    const withoutOverride = splitIntoSyllables('भक्तिसन्धाननायकम्', { finalIsAnceps: false });
    expect(withoutOverride[withoutOverride.length - 1].weight).toBe('laghu');
  });
});

describe('splitIntoSyllables — the full verse, pāda by pāda', () => {
  // Guru Gita (popular Siddha Yoga recension), verse 1, all four pādas —
  // each an anuṣṭubh line of 8 syllables, matching the metre's own count.
  test('all four pādas of verse 1 have 8 syllables each, matching anuṣṭubh metre', () => {
    const padas = ['कैलास शिखरे रम्ये', 'भक्तिसन्धाननायकम्', 'प्रणम्य पार्वती भक्त्या', 'शङ्करं पर्यपृच्छत'];
    for (const pada of padas) {
      expect(splitIntoSyllables(pada)).toHaveLength(8);
    }
  });
});
