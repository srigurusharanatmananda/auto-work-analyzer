/**
 * Letters, plus a first small set of real words — extended 2026-08-09 after
 * a curriculum-resource survey turned up the actual pedagogy real Tamil
 * courses use, correcting an assumption made when this file was first
 * written.
 *
 * That assumption was: restrict early words to consonants carrying only
 * their default inherent vowel, to sidestep the "dead consonant" pulli mark
 * (ண், ல், etc.) and vowel signs, on the theory that a beginner-safe
 * curriculum needed to defer them. Checked directly against T.B.
 * Siddalingaiah's *ABC of Tamil, Book One* (1968, hosted by the Tamil
 * Virtual Academy — https://www.tamilvu.org/coresite/download/ABC_Tamil.pdf,
 * read in full, not taken on a paraphrase): real courses do not do this.
 * Lesson 2 teaches all 18 consonants AND the pulli mark together, and its
 * very first vocabulary is pulli-final — கண் (kaṇ, "eye"), கல் (kal,
 * "stone"), மண் (maṇ, "earth"), பல் (pal, "tooth"). Avoiding pulli was a
 * theoretical safety constraint this seed invented, not actual practice.
 *
 * The four words below are exactly those four, for that reason: they are
 * what an established, real Tamil primer actually teaches next, not
 * lesson content invented for this app. The specific translations are
 * basic, common dictionary facts, independently checkable against Tamil
 * Wiktionary (ta.wiktionary.org, CC BY-SA) or any Tamil dictionary — this
 * file does not reproduce Siddalingaiah's own prose or exercises, whose
 * copyright status the survey could not confirm as open.
 *
 * Introducing pulli means introducing the "dead" (vowel-less) form of a
 * consonant as its own taught unit, distinct from that consonant's
 * default inherent-a form already taught in stage 1 — ண (ṇa) and ண் (ṇ)
 * are two different graphemes a learner must recognise separately, which is
 * exactly the kind of thing `composedOf` exists to make explicit rather
 * than assumed.
 */

import type { Manifest } from '../Curriculum.js';

export const tamilManifest: Manifest = {
  language: 'tamil',
  lessons: [
    { id: 'tam-letter-ka', stage: 'letters', text: 'க', gloss: 'ka', composedOf: [] },
    { id: 'tam-letter-ta', stage: 'letters', text: 'த', gloss: 'ta', composedOf: [] },
    { id: 'tam-letter-na', stage: 'letters', text: 'ந', gloss: 'na', composedOf: [] },
    { id: 'tam-letter-ma', stage: 'letters', text: 'ம', gloss: 'ma', composedOf: [] },
    { id: 'tam-letter-va', stage: 'letters', text: 'வ', gloss: 'va', composedOf: [] },
    { id: 'tam-letter-pa', stage: 'letters', text: 'ப', gloss: 'pa', composedOf: [] },
    {
      id: 'tam-pulli-nna',
      stage: 'letters',
      text: 'ண்',
      // Retroflex ṇ — a different letter from ந (dental na) already taught
      // above, not a variant spelling of it.
      gloss: 'ṇ — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-pulli-la',
      stage: 'letters',
      text: 'ல்',
      gloss: 'l — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },

    {
      id: 'tam-word-kan',
      stage: 'words',
      text: 'கண்',
      gloss: 'kaṇ — eye',
      composedOf: ['tam-letter-ka', 'tam-pulli-nna'],
    },
    {
      id: 'tam-word-kal',
      stage: 'words',
      text: 'கல்',
      gloss: 'kal — stone',
      composedOf: ['tam-letter-ka', 'tam-pulli-la'],
    },
    {
      id: 'tam-word-man',
      stage: 'words',
      text: 'மண்',
      gloss: 'maṇ — earth, soil',
      composedOf: ['tam-letter-ma', 'tam-pulli-nna'],
    },
    {
      id: 'tam-word-pal',
      stage: 'words',
      text: 'பல்',
      gloss: 'pal — tooth',
      composedOf: ['tam-letter-pa', 'tam-pulli-la'],
    },

    // Stage 3 (sentences) is still empty — a grammatically simple Tamil
    // sentence needs vowel signs and/or verb forms this seed does not teach
    // yet. See the module header for why that gap is left explicit rather
    // than guessed at.
  ],
};
