/**
 * Letters only, deliberately. Sequencing note in the design doc: Sanskrit
 * was built first specifically so a Tamil-shaped assumption could not harden
 * into the engine unnoticed — this file is the test of that, and it is
 * "same shape, less data", not "same shape, equivalent data".
 *
 * The gap is not laziness: composing correct standalone Tamil vocabulary
 * from bare, inherent-a consonants is not the same exercise it is in
 * Sanskrit. Tamil words commonly end in a "dead" consonant (marked with a
 * pulli, e.g. ழ்) or a vowel sign, which is exactly the kind of grapheme this
 * seed has not taught yet — the same constraint that kept Sanskrit's stage 3
 * empty. Rather than reach for a word that merely looks right, this manifest
 * stops at the stage that needed no judgment call: five consonants and the
 * sound each one makes. Words and sentences are for a Tamil speaker to add.
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

    // Stages 2 (words) and 3 (sentences) are intentionally empty. See the
    // file header.
  ],
};
