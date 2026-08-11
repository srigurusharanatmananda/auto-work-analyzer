/**
 * As of 2026-08-11: the complete Sanskrit alphabet (all 14 vowels, all 33
 * consonants — Wikner's own Lessons 1-3), plus the original seven words and
 * one sentence a much smaller seed reached first. See
 * `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md` for the full
 * beginner-to-advanced plan this is the first tranche of — vowel signs
 * (Lesson 6), conjuncts (Lesson 7) and sandhi (Lessons 10-11) are the next
 * ones, not yet written.
 *
 * The paragraphs below describe the ORIGINAL seed (six consonants, five
 * words) and its first, 2026-08-10 extension (one sentence) — kept as the
 * historical record of why नर/वदति/नरः वदति specifically were chosen, which
 * is still exactly why they are still here. Read them as "how this file's
 * first seven words came to exist", not as a claim about the file's current
 * size.
 *
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
    // ================= Letters: the complete alphabet =================
    // Extension, 2026-08-11: the original six-letter seed and its 2026-08-10
    // "just enough for one sentence" follow-up (na ra ja va dha ga, then da/
    // visarga/ti) covered 7 of Sanskrit's 33 consonants and NONE of its 14
    // vowels — every word after this point had to dodge whatever letter
    // wasn't yet taught. This tranche is the rest of Wikner's own Lessons
    // 1-3: all 14 vowels (1.A.3-1.A.7), the 25 stops (2.A.2, table reproduced
    // in 3.A.4), the 4 semivowels and 3 sibilants and ha (3.A.1-3.A.3), in
    // Wikner's own alphabetical order (3.A.5) rather than the ad hoc order
    // the seed happened to need. Every id, text and gloss already shipped is
    // unchanged — ga, ra and va simply take their correct place in the
    // grid/semivowel groups below; ja, dha, na and da are left grouped with
    // skt-letter-ti near the end instead, since all five exist only to
    // support the words and sentence that already depend on them.
    //
    // Vowel SIGNS (mātrā — how a vowel attaches to a consonant, Wikner
    // Lesson 6) and conjunct consonants (Lesson 7) are deliberately NOT in
    // this tranche: they depend on having the bare consonants and vowels
    // first, which is exactly what this tranche completes. skt-letter-ti
    // below is the one pre-existing exception, kept only because
    // skt-word-vadati already depends on it.

    // --- The fourteen vowels, Wikner 1.A.3-1.A.6 ---
    { id: 'skt-letter-a', stage: 'letters', level: 1, text: 'अ', gloss: 'a', composedOf: [] },
    { id: 'skt-letter-aa', stage: 'letters', level: 1, text: 'आ', gloss: 'ā', composedOf: [] },
    { id: 'skt-letter-i', stage: 'letters', level: 1, text: 'इ', gloss: 'i', composedOf: [] },
    { id: 'skt-letter-ii', stage: 'letters', level: 1, text: 'ई', gloss: 'ī', composedOf: [] },
    { id: 'skt-letter-u', stage: 'letters', level: 1, text: 'उ', gloss: 'u', composedOf: [] },
    { id: 'skt-letter-uu', stage: 'letters', level: 1, text: 'ऊ', gloss: 'ū', composedOf: [] },
    {
      id: 'skt-letter-ri',
      stage: 'letters',
      level: 1,
      // Wikner 1.A.4: a genuine vowel (the vocalic r. at the centre of
      // Kr.s.n.a), not r followed by a vowel — pronounced with the tongue
      // tip raised, not as "ri". Common today, unlike its long/l. siblings below.
      text: 'ऋ',
      gloss: 'ṛ',
      composedOf: [],
    },
    {
      id: 'skt-letter-rii',
      stage: 'letters',
      level: 1,
      // Wikner 1.A.4, verbatim: "not used in the standard grammar." Taught
      // for alphabet completeness (it is one of the sixteen śakti in 1.A.7's
      // own list), not because a learner will meet it in real words.
      text: 'ॠ',
      gloss: 'ṝ (theoretical — not used in standard grammar)',
      composedOf: [],
    },
    {
      id: 'skt-letter-li',
      stage: 'letters',
      level: 1,
      // Wikner 1.A.4: occurs only in inflections of one root, kl.p ("to
      // manage, to be well ordered").
      text: 'ऌ',
      gloss: 'ḷ (rare — occurs only in forms of √kḷp)',
      composedOf: [],
    },
    {
      id: 'skt-letter-lii',
      stage: 'letters',
      level: 1,
      // Wikner 1.A.4, verbatim: "The long l. is not used in the standard
      // grammar" — the rarest letter in the alphabet, listed only because
      // 1.A.7 lists it among the sixteen śakti.
      text: 'ॡ',
      gloss: 'ḹ (theoretical — not used in standard grammar)',
      composedOf: [],
    },
    { id: 'skt-letter-e', stage: 'letters', level: 1, text: 'ए', gloss: 'e', composedOf: [] },
    { id: 'skt-letter-ai', stage: 'letters', level: 1, text: 'ऐ', gloss: 'ai', composedOf: [] },
    { id: 'skt-letter-o', stage: 'letters', level: 1, text: 'ओ', gloss: 'o', composedOf: [] },
    { id: 'skt-letter-au', stage: 'letters', level: 1, text: 'औ', gloss: 'au', composedOf: [] },

    // --- Anusvara and visarga, the other two of the "sixteen śakti", Wikner 1.A.7 ---
    {
      id: 'skt-letter-anusvara',
      stage: 'letters',
      level: 1,
      // Wikner 1.A.7: "an 'after sound', a nasal sound following a vowel...
      // sounded through the nose only". Shown bare, matching how visarga
      // just below is already shown bare in this file, even though both are
      // properly written after a vowel (Wikner himself writes them that way
      // only because "these both arise after a vowel", not because either
      // has no independent, alone-renderable glyph).
      text: 'ं',
      gloss: 'ṃ — anusvara (nasal sound after a vowel)',
      composedOf: [],
    },
    {
      id: 'skt-letter-visarga',
      stage: 'letters',
      level: 1,
      // Wikner, Lesson 1.A.7 "The Sixteen śakti": "The visarga (ḥ), or
      // visarjanīya, is an unvoiced breath following a vowel, and is
      // breathed through the mouth position of that vowel." Also the
      // nominative-singular case ending on an a-stem noun (see नरः below) —
      // the one piece of grammar this seed was missing to inflect नर at all.
      text: 'ः',
      gloss: 'ḥ — visarga (unvoiced breath after a vowel)',
      composedOf: [],
    },

    // --- The twenty-five stops, Wikner 2.A.2/2.A.4, ka-varga through pa-varga ---
    // ka-varga (guttural)
    { id: 'skt-letter-ka', stage: 'letters', level: 1, text: 'क', gloss: 'ka', composedOf: [] },
    { id: 'skt-letter-kha', stage: 'letters', level: 1, text: 'ख', gloss: 'kha', composedOf: [] },
    { id: 'skt-letter-ga', stage: 'letters', level: 1, text: 'ग', gloss: 'ga', composedOf: [] },
    { id: 'skt-letter-gha', stage: 'letters', level: 1, text: 'घ', gloss: 'gha', composedOf: [] },
    {
      id: 'skt-letter-nga',
      stage: 'letters',
      level: 1,
      // The guttural nasal (Wikner's _na row 5 of ka-varga) — distinct from
      // both ña (ca-varga's nasal, skt-letter-nya below) and ṇa (ṭa-varga's
      // nasal, skt-letter-nna below) and na (ta-varga's nasal, already
      // taught as skt-letter-na): four different letters that are all "some
      // kind of n" to an English ear, exactly why Wikner tables them by
      // mouth position rather than by sound alone.
      text: 'ङ',
      gloss: 'ṅa',
      composedOf: [],
    },
    // ca-varga (palatal) — row 3, ja, pre-existed this tranche (added
    // 2026-08-10) and is declared LATER in this array, not here: see
    // skt-letter-ja below, grouped with skt-word-vadati and its other
    // pre-existing dependents rather than moved into this row's position
    { id: 'skt-letter-ca', stage: 'letters', level: 1, text: 'च', gloss: 'ca', composedOf: [] },
    { id: 'skt-letter-cha', stage: 'letters', level: 1, text: 'छ', gloss: 'cha', composedOf: [] },
    { id: 'skt-letter-jha', stage: 'letters', level: 1, text: 'झ', gloss: 'jha', composedOf: [] },
    {
      id: 'skt-letter-nya',
      stage: 'letters',
      level: 1,
      // ca-varga's nasal — see skt-letter-nga's comment for why this gets a
      // distinct id rather than reusing "na".
      text: 'ञ',
      gloss: 'ña',
      composedOf: [],
    },
    // ṭa-varga (cerebral/retroflex) — none of this row exists yet
    { id: 'skt-letter-tta', stage: 'letters', level: 1, text: 'ट', gloss: 'ṭa', composedOf: [] },
    { id: 'skt-letter-ttha', stage: 'letters', level: 1, text: 'ठ', gloss: 'ṭha', composedOf: [] },
    { id: 'skt-letter-dda', stage: 'letters', level: 1, text: 'ड', gloss: 'ḍa', composedOf: [] },
    { id: 'skt-letter-ddha', stage: 'letters', level: 1, text: 'ढ', gloss: 'ḍha', composedOf: [] },
    {
      id: 'skt-letter-nna',
      stage: 'letters',
      level: 1,
      // ṭa-varga's (retroflex) nasal — see skt-letter-nga's comment.
      text: 'ण',
      gloss: 'ṇa',
      composedOf: [],
    },
    // ta-varga (dental) — da/dha/na pre-existed this tranche and are
    // declared LATER in this array (see skt-letter-da/-dha/-na below, same
    // reasoning as skt-letter-ja above); ta/tha here are the two genuinely
    // new members completing the row.
    {
      id: 'skt-letter-ta',
      stage: 'letters',
      level: 1,
      // Unvoiced, unaspirated dental stop — distinct from द (da, declared
      // below: VOICED) and ध (dha, declared below: voiced AND aspirated).
      // Previously taught only fused with a vowel sign in skt-letter-ti;
      // this is the same sound bare.
      text: 'त',
      gloss: 'ta',
      composedOf: [],
    },
    { id: 'skt-letter-tha', stage: 'letters', level: 1, text: 'थ', gloss: 'tha', composedOf: [] },
    // pa-varga (labial) — none of this row exists yet
    { id: 'skt-letter-pa', stage: 'letters', level: 1, text: 'प', gloss: 'pa', composedOf: [] },
    { id: 'skt-letter-pha', stage: 'letters', level: 1, text: 'फ', gloss: 'pha', composedOf: [] },
    { id: 'skt-letter-ba', stage: 'letters', level: 1, text: 'ब', gloss: 'ba', composedOf: [] },
    { id: 'skt-letter-bha', stage: 'letters', level: 1, text: 'भ', gloss: 'bha', composedOf: [] },
    { id: 'skt-letter-ma', stage: 'letters', level: 1, text: 'म', gloss: 'ma', composedOf: [] },

    // --- The four semivowels, Wikner 3.A.1 (va/ra already exist) ---
    { id: 'skt-letter-ya', stage: 'letters', level: 1, text: 'य', gloss: 'ya', composedOf: [] },
    { id: 'skt-letter-ra', stage: 'letters', level: 1, text: 'र', gloss: 'ra', composedOf: [] },
    { id: 'skt-letter-la', stage: 'letters', level: 1, text: 'ल', gloss: 'la', composedOf: [] },
    { id: 'skt-letter-va', stage: 'letters', level: 1, text: 'व', gloss: 'va', composedOf: [] },

    // --- The three sibilants, Wikner 3.A.2 ---
    { id: 'skt-letter-sha', stage: 'letters', level: 1, text: 'श', gloss: 'śa', composedOf: [] },
    {
      id: 'skt-letter-ssa',
      stage: 'letters',
      level: 1,
      // Retroflex ṣa — distinct from श (śa, palatal, above) and स (sa,
      // dental, below). Wikner 3.A.2: "s.a like the 'sh' in 'ship'."
      text: 'ष',
      gloss: 'ṣa',
      composedOf: [],
    },
    { id: 'skt-letter-sa', stage: 'letters', level: 1, text: 'स', gloss: 'sa', composedOf: [] },

    // --- ha, the last letter of the alphabet, Wikner 3.A.3 ---
    { id: 'skt-letter-ha', stage: 'letters', level: 1, text: 'ह', gloss: 'ha', composedOf: [] },

    // --- Pre-existing exception, unchanged: kept only because skt-word-vadati depends on it ---
    {
      id: 'skt-letter-ja',
      stage: 'letters',
      level: 1,
      // ca-varga row 3 — its correct place in the grid above, but left
      // where it already was rather than moved, since nothing requires
      // moving it and every other id in this file is stable by design.
      text: 'ज',
      gloss: 'ja',
      composedOf: [],
    },
    { id: 'skt-letter-dha', stage: 'letters', level: 1, text: 'ध', gloss: 'dha', composedOf: [] },
    { id: 'skt-letter-na', stage: 'letters', level: 1, text: 'न', gloss: 'na', composedOf: [] },
    { id: 'skt-letter-da', stage: 'letters', level: 1, text: 'द', gloss: 'da', composedOf: [] },
    {
      id: 'skt-letter-ti',
      stage: 'letters',
      level: 1,
      // त (now also taught bare, above) plus the short-i vowel sign, fused
      // into one atomic letter — the same choice this file's Tamil sibling
      // makes for நா/யா, and for the same reason: a vowel sign is meant to
      // attach to a consonant, so teaching it as its own bare glyph (as an
      // earlier draft of this file did) has nothing to visually attach to
      // and would not render the way a learner will ever actually see it.
      // Wikner, Lesson 6.A.1 "Vowels after Consonants": a vowel sign
      // replaces a consonant's inherent -a and is written after the
      // consonant it modifies but displayed to that consonant's visual left
      // (Wikner's own worked example: ब + the same vowel sign = बि, "bi") —
      // त + the same vowel sign = ति, "ti", by the identical rule. Left
      // where it already was, ahead of the words that depend on it, rather
      // than moved next to the real Lesson 6 vowel-signs tranche that has
      // not been written yet.
      text: 'ति',
      gloss: 'ti',
      composedOf: [],
    },

    // ================= Words =================
    {
      id: 'skt-word-nara',
      stage: 'words',
      level: 2,
      text: 'नर',
      gloss: 'nara — man',
      composedOf: ['skt-letter-na', 'skt-letter-ra'],
    },
    {
      id: 'skt-word-jana',
      stage: 'words',
      level: 2,
      text: 'जन',
      gloss: 'jana — people',
      composedOf: ['skt-letter-ja', 'skt-letter-na'],
    },
    {
      id: 'skt-word-vana',
      stage: 'words',
      level: 2,
      text: 'वन',
      gloss: 'vana — forest',
      composedOf: ['skt-letter-va', 'skt-letter-na'],
    },
    {
      id: 'skt-word-dhana',
      stage: 'words',
      level: 2,
      text: 'धन',
      gloss: 'dhana — wealth',
      composedOf: ['skt-letter-dha', 'skt-letter-na'],
    },
    {
      id: 'skt-word-raja',
      stage: 'words',
      level: 2,
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
      level: 2,
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
      level: 2,
      // Root √vad, class 1 (bhvādi-gaṇa), 3rd person singular present,
      // parasmaipada. Wikner, Lesson 1.B.2: "√vad remains clearly
      // recognizable in the form vadati 'he/she/it speaks'." Also the verb
      // in the same Lesson 3.B.3 exercise-4 sentence naraḥ is drawn from.
      text: 'वदति',
      gloss: 'vadati — speaks (he/she/it)',
      composedOf: ['skt-letter-va', 'skt-letter-da', 'skt-letter-ti'],
    },

    {
      id: 'skt-sentence-narah-vadati',
      stage: 'sentences',
      level: 2,
      // Not invented: a literal sub-clause of Wikner's own Lesson 3.B.3
      // exercise-4 sentence "aśvaḥ tiṣṭhati ca naraḥ vadati ca" ("the horse
      // stands and the man speaks"), stripped of "aśvaḥ tiṣṭhati ca" (the
      // horse stands, and). What remains — nominative subject, then verb —
      // is already a complete grammatical sentence on its own: Wikner,
      // Lesson 3.B.2, states Sanskrit's normal word order is subject before
      // verb, and that an explicit subject displaces the pronoun a bare verb
      // like vadati ("he/she/it speaks") would otherwise imply.
      //
      // composedOf is two WORDS (see Curriculum.ts's JOINER for how a
      // sentence's text is required to reconstruct from them).
      text: 'नरः वदति',
      gloss: 'naraḥ vadati — the man speaks',
      composedOf: ['skt-word-narah', 'skt-word-vadati'],
    },
  ],
};
