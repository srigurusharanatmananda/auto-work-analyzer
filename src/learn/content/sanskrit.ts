/**
 * A seed, not a curriculum: six consonants and the five real words they build.
 *
 * Kept deliberately small and deliberately verifiable rather than broad.
 * Every letter and word below was checked by hand before it went in this
 * file — the design doc's own warning ("a beginner cannot detect a bad
 * teacher, which makes this the one quality gate that has to be human")
 * applies just as much to typing the Devanagari itself as to what a
 * synthesiser does with it. (Until 2026-08-10 this checked
 * `transliterateForSynthesis`'s Kannada output instead: that route no longer
 * exists for Sanskrit — see `../Transliterator.ts` — so there is nothing
 * left to read but the Devanagari itself.)
 *
 * Every word uses only the inherent short-a vowel that a bare Devanagari
 * consonant already carries — no vowel signs, no conjuncts, no anusvara or
 * visarga. That is a real limitation: it rules out the plurals, cases and
 * verbs a grammatically simple *sentence* would need, which is why stage 3
 * is empty here rather than populated with something not actually
 * grammatical. Extending this manifest with vowel-sign letters and a verb is
 * exactly the kind of change the data-not-code split exists to make cheap —
 * it is content work for whoever authors it next, not an engine change.
 */

import type { Manifest } from '../Curriculum.js';

export const sanskritManifest: Manifest = {
  language: 'sanskrit',
  lessons: [
    { id: 'skt-letter-na', stage: 'letters', text: 'न', gloss: 'na', composedOf: [] },
    { id: 'skt-letter-ra', stage: 'letters', text: 'र', gloss: 'ra', composedOf: [] },
    { id: 'skt-letter-ja', stage: 'letters', text: 'ज', gloss: 'ja', composedOf: [] },
    { id: 'skt-letter-va', stage: 'letters', text: 'व', gloss: 'va', composedOf: [] },
    { id: 'skt-letter-dha', stage: 'letters', text: 'ध', gloss: 'dha', composedOf: [] },
    { id: 'skt-letter-ga', stage: 'letters', text: 'ग', gloss: 'ga', composedOf: [] },

    {
      id: 'skt-word-nara',
      stage: 'words',
      text: 'नर',
      gloss: 'nara — man',
      composedOf: ['skt-letter-na', 'skt-letter-ra'],
    },
    {
      id: 'skt-word-jana',
      stage: 'words',
      text: 'जन',
      gloss: 'jana — people',
      composedOf: ['skt-letter-ja', 'skt-letter-na'],
    },
    {
      id: 'skt-word-vana',
      stage: 'words',
      text: 'वन',
      gloss: 'vana — forest',
      composedOf: ['skt-letter-va', 'skt-letter-na'],
    },
    {
      id: 'skt-word-dhana',
      stage: 'words',
      text: 'धन',
      gloss: 'dhana — wealth',
      composedOf: ['skt-letter-dha', 'skt-letter-na'],
    },
    {
      id: 'skt-word-raja',
      stage: 'words',
      // Unmarked "raja" (dust, pollen) — not rājā "king", which needs the ā
      // vowel sign this seed does not teach. Worth a comment precisely
      // because the two are one macron apart and that macron is meaning-bearing,
      // the same class of silent error the vowel-length tests guard against
      // in Transliterator.test.ts.
      text: 'रज',
      gloss: 'raja — dust, pollen',
      composedOf: ['skt-letter-ra', 'skt-letter-ja'],
    },

    // Stage 3 (sentences) is intentionally empty. See the file header.
  ],
};
