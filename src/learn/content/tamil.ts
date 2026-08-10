/**
 * Letters, plus a first small set of real words — extended 2026-08-09 after
 * a curriculum-resource survey turned up the actual pedagogy real Tamil
 * courses use, correcting an assumption made when this file was first
 * written; and again 2026-08-10, reaching this file's first real sentence.
 *
 * The 2026-08-10 extension is sourced from the same primer as everything
 * else here — ABC of Tamil, Lesson Three ("Consonantal Vowels (contd.)"),
 * read directly, not paraphrased. Lesson Three's own vocabulary gives
 * நான் ("I") and யார் ("who?"), and its very next line gives, verbatim,
 * "நான் யார் - who (am) I?" — the primer's own worked phrase, not a sentence
 * assembled here from separately-sourced words. Tamil equational questions
 * like this take no copula, so no verb-tense lesson was needed to reach a
 * real, grammatical sentence — only the vowel sign this file did not
 * previously teach (ா, lengthening a consonant's inherent -a to -ā) plus two
 * of that same lesson's own words. Quoted exactly as the primer prints it,
 * including its own inconsistent punctuation on that page (the line above
 * it, "உன் அப்பா யார்?", does carry a question mark; this one does not) —
 * fidelity to the source is the whole safety mechanism here, not a
 * typesetting choice for this app to correct.
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

    // --- Extension, 2026-08-10: the letters நான் யார் needs beyond the above ---
    {
      id: 'tam-letter-naa',
      stage: 'letters',
      // ந (dental na, already taught) + the vowel sign for ஆ (long ā).
      // Lesson Three's own combination table gives this exact pairing:
      // "ந் + ஆ = நா (nā)". Modelled as one atomic letter, the same way the
      // pulli marks above are, rather than as a separately-taught vowel sign
      // — this file does not yet have a "vowel sign" category of its own.
      text: 'நா',
      gloss: 'nā',
      composedOf: [],
    },
    {
      id: 'tam-pulli-na',
      stage: 'letters',
      // Alveolar ṉ — a different letter from ந (dental na) and ண் (retroflex
      // ṇ, already taught above), even though ந/ன carry no audible
      // distinction in modern spoken Tamil (the primer still lists them as
      // separate graphemes, which is what matters for reading/writing).
      text: 'ன்',
      gloss: 'ṉ — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-letter-yaa',
      stage: 'letters',
      // ய (ya) + the vowel sign for ஆ (long ā). Lesson Three's combination
      // table: "ய் + ஆ = யா (yā)".
      text: 'யா',
      gloss: 'yā',
      composedOf: [],
    },
    {
      id: 'tam-pulli-ra',
      stage: 'letters',
      text: 'ர்',
      gloss: 'r — dead consonant (no vowel), used at the end of a word',
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

    {
      id: 'tam-word-naan',
      stage: 'words',
      text: 'நான்',
      gloss: 'nān — I',
      composedOf: ['tam-letter-naa', 'tam-pulli-na'],
    },
    {
      id: 'tam-word-yaar',
      stage: 'words',
      text: 'யார்',
      gloss: 'yār — who?',
      composedOf: ['tam-letter-yaa', 'tam-pulli-ra'],
    },

    {
      id: 'tam-sentence-naan-yaar',
      stage: 'sentences',
      // Not assembled from separately-sourced words — the primer's own next
      // line after teaching நான் and யார், quoted exactly as printed (see
      // file header for its own inconsistent punctuation on this page).
      // Tamil equational sentences take no copula, so the two words
      // juxtaposed already form the complete sentence.
      //
      // composedOf here is two WORDS (per Curriculum.ts: a sentence composes
      // from the stage before it), joined by a single space in the actual
      // text — the convention for every future sentence-stage entry:
      // concatenate composedOf's words with one space between each, not
      // directly.
      text: 'நான் யார்',
      gloss: 'nān yār — who am I? (lit. "I who?")',
      composedOf: ['tam-word-naan', 'tam-word-yaar'],
    },
  ],
};
