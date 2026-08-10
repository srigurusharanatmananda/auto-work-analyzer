/**
 * A seed, not a curriculum: six bare consonants and the five real words they
 * build — plus, as of 2026-08-10, the smallest extension that reaches one
 * real, grammatical sentence.
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
 * The original six letters and five words use only the inherent short-a
 * vowel that a bare Devanagari consonant already carries — no vowel signs,
 * no conjuncts, no anusvara or visarga. That ruled out the case endings and
 * verbs a grammatically simple *sentence* needs, which is why stage 3 was
 * empty. "Extending this manifest with vowel-sign letters and a verb is
 * exactly the kind of change the data-not-code split exists to make cheap"
 * — this is that extension.
 *
 * Source: Charles Wikner, *A Practical Sanskrit Introductory* — the
 * author's own stated public domain release ("The Introductory was produced
 * as a service to mankind: so far as I am concerned, it is freely available
 * in the public domain"). Read directly (not paraphrased, not relied on from
 * training-time recall) via its PDF text and independent web mirrors
 * (danam.co.uk, bolochant.com, archive.org). Every new item below cites the
 * specific lesson section it comes from. नर itself — the existing stem this
 * extension inflects — is literally Wikner's own paradigm noun for the
 * *a*-stem masculine declension (Lesson 3.B.2), which is why extending नर
 * specifically, rather than किसी other existing word, was the natural next
 * step.
 *
 * The new sentence, नरः वदति ("the man speaks"), is not invented — it is a
 * literal sub-clause of Wikner's own Lesson 3.B.3 exercise-4 sentence
 * "aśvaḥ tiṣṭhati ca naraḥ vadati ca" ("the horse stands and the man
 * speaks"), stripped of its first clause and the conjunction. Every new
 * letter, word, and the sentence itself were adversarially cross-checked
 * against Wikner's actual text by independent review before landing here —
 * word/gloss/character-decomposition all confirmed correct; the citations
 * below were tightened afterward to fix a few sourcing imprecisions that
 * review caught (a misquoted technical term, an imprecise pinpoint
 * reference, one fabricated example citation for the i-mātrā that has been
 * replaced with what Wikner actually says).
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

    // --- Extension, 2026-08-10: the letters नरः वदति needs beyond the six above ---
    {
      id: 'skt-letter-da',
      stage: 'letters',
      // Voiced, unaspirated dental stop — distinct from ध (dha, already
      // taught: voiced, ASPIRATED) and from त (ta, below: unvoiced).
      text: 'द',
      gloss: 'da',
      composedOf: [],
    },
    {
      id: 'skt-letter-ta',
      stage: 'letters',
      // Unvoiced, unaspirated dental stop — distinct from द (da, above) and
      // थ (tha, not taught here).
      text: 'त',
      gloss: 'ta',
      composedOf: [],
    },
    {
      id: 'skt-letter-visarga',
      stage: 'letters',
      // Wikner, Lesson 1.A.7 "The Sixteen śakti": "The visarga (ḥ), or
      // visarjanīya, is an unvoiced breath following a vowel, and is
      // breathed through the mouth position of that vowel." Also the
      // nominative-singular case ending on an a-stem noun (see नरः below) —
      // the one piece of grammar this seed was missing to inflect नर at all.
      text: 'ः',
      gloss: 'ḥ — visarga (unvoiced breath after a vowel)',
      composedOf: [],
    },
    {
      id: 'skt-letter-i-matra',
      stage: 'letters',
      // Wikner, Lesson 6.A.1 "Vowels after Consonants": a vowel sign that
      // replaces a consonant's inherent -a; written after the consonant it
      // modifies but displayed to that consonant's visual left (e.g. ब + ि
      // = बि, "bi" — Wikner's own worked example for this exact vowel sign).
      text: 'ि',
      gloss: 'i (vowel sign, attaches to a preceding consonant)',
      composedOf: [],
    },

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

    {
      id: 'skt-word-narah',
      stage: 'words',
      // The nominative singular (prathamā, eka-vacana) of नर — not the bare
      // stem skt-word-nara above, which is grammatically incomplete on its
      // own. Wikner, Lesson 3.B.2's declension table gives naraḥ for exactly
      // this form (nara + visarga, no vowel change) — and naraḥ is the
      // subject of a real clause in that lesson's own exercise 4: "aśvaḥ
      // tiṣṭhati ca naraḥ vadati ca" ("the horse stands and the man speaks").
      text: 'नरः',
      gloss: 'naraḥ — man (nominative singular)',
      composedOf: ['skt-letter-na', 'skt-letter-ra', 'skt-letter-visarga'],
    },
    {
      id: 'skt-word-vadati',
      stage: 'words',
      // Root √vad, class 1 (bhvādi-gaṇa), 3rd person singular present,
      // parasmaipada. Wikner, Lesson 1.B.2: "√vad remains clearly
      // recognizable in the form vadati 'he/she/it speaks'." Also the verb
      // in the same Lesson 3.B.3 exercise-4 sentence naraḥ is drawn from.
      text: 'वदति',
      gloss: 'vadati — speaks (he/she/it)',
      composedOf: ['skt-letter-va', 'skt-letter-da', 'skt-letter-ta', 'skt-letter-i-matra'],
    },

    {
      id: 'skt-sentence-narah-vadati',
      stage: 'sentences',
      // Not invented: a literal sub-clause of Wikner's own Lesson 3.B.3
      // exercise-4 sentence "aśvaḥ tiṣṭhati ca naraḥ vadati ca" ("the horse
      // stands and the man speaks"), stripped of "aśvaḥ tiṣṭhati ca" (the
      // horse stands, and). What remains — nominative subject, then verb —
      // is already a complete grammatical sentence on its own: Wikner,
      // Lesson 3.B.2, states Sanskrit's normal word order is subject before
      // verb, and that an explicit subject displaces the pronoun a bare verb
      // like vadati ("he/she/it speaks") would otherwise imply.
      //
      // composedOf here is two WORDS, not letters (per Curriculum.ts: a
      // sentence composes from the stage before it, i.e. words) — joined by
      // a single space in the actual text, which is the convention for every
      // future sentence-stage entry: concatenate composedOf's words with one
      // space between each, not directly.
      text: 'नरः वदति',
      gloss: 'naraḥ vadati — the man speaks',
      composedOf: ['skt-word-narah', 'skt-word-vadati'],
    },
  ],
};
