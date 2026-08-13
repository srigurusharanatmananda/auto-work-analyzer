/**
 * As of 2026-08-12: the complete Sanskrit alphabet (all 14 vowels, all 33
 * consonants — Wikner's own Lessons 1-3), a first batch of vowel signs
 * (mātrā, Wikner 6.A.1 — tranche 2), the two special conjunct consonants
 * kṣa and jña (Wikner 7.A.3-7.A.5 — tranche 3), one more word, vṛkṣa
 * ("tree", Wikner 3.B.2 — tranche 4, the first word kṣa unblocks), the
 * original seven words plus one new word and one sentence, — tranche 6 —
 * the first sandhi lesson: नरो वदति, the exact same words as नरः वदति
 * above, showing the visarga sandhi (Wikner 11.A.1) that actually applies
 * when they meet in real speech, and — tranche 7 — the accusative
 * (dvitīyā) case, one ātmanepada verb (नयते), aśva (unblocked — the śva
 * conjunct named as missing since tranche 4 is taught now), and Wikner's
 * own worked sentence नरः अश्वम् वृक्षम् नयते ("the man leads the horse to
 * the tree", 3.B.2), and — tranche 8 — a second case, ṣaṣṭhī (genitive):
 * नरस्य ("of the man"), and — tranche 9 — a third, tṛtīyā (instrumental):
 * नरेण ("by/with the man"), and — tranche 10 — a fourth, caturthī (dative):
 * नराय ("to/for the man"), all three from Wikner 5.B.1's own declension
 * table. Tranche 11 pivots away from cases (re-testing against the actual
 * target verse after tranches 8-10 showed no real progress) toward the
 * indeclinable particle इति (Wikner 9.B.2) and this file's first verb
 * person other than 3rd, नये ("I lead", 1st singular ātmanepada). Tranche
 * 12 finally unblocks tiṣṭhati (Wikner 2.B.1's own full person paradigm,
 * lines 744-756) via the ṣṭha conjunct, adds a parasmaipada 1st-person
 * form (तिष्ठामि), and ships अश्वः तिष्ठति — the other half of the
 * sentence tranche 6/7 already quoted (Wikner 3.B.3, exercise 4) but
 * couldn't teach in full until now. Tranche 13 adds three isolated
 * personal-pronoun/particle glossary words — अहम् ("I", Wikner's
 * back-matter Bhagavad Gītā study exercise §15.8, line 3875), नौ ("of us
 * two") and अस्तु ("let it be", both from Wikner's front-matter
 * Invocation-verse analysis, lines 190-233) — since Wikner has no pronoun
 * declension table or imperative-mood lesson to draw a real one from.
 * Tranche 14 adds a second particle, हे (vocative, "O!" — Wikner 9.B.1, the
 * same lesson's own classification section इति's citation, 9.B.2, is part
 * of) and the sentence हे नर
 * ("O man!" — Wikner 5.B.1's own declension table for नर, already this
 * file's own citation for every case built on नर since tranche 7).
 * Tranche 15 mines the last two words of that same front-matter Invocation
 * verse (lines 190-233, the one नौ/अस्तु already came from — not अहम्,
 * which is a separate back-matter passage): तेजस्वि ("brilliant", an
 * adjective) and अधीतम् ("studied", a past passive participle) — both
 * taught as flat vocabulary, the same convention already used for every
 * other morphologically complex word in this file. Tranche 17 adds a
 * second particle, एव ("indeed, verily" — Wikner's own back-matter §15.8,
 * line 3876, the same passage अहम् came from) — zero new letters,
 * Sanskrit-only (Tamil's own next candidate needs a new letter not yet
 * cleanly scoped). Tranche 18 finally closes the 2nd-person-pronoun gap,
 * via a second source — William Dwight Whitney's Sanskrit Grammar (1889,
 * public domain, `skt-whitney-grammar`), §491: त्वम् ("you", singular)
 * and यूयम् ("you all", plural) — two new letters (त्व, यू). See
 * `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md` for the full
 * beginner-to-advanced plan this is a tranche of. The vowel-sign
 * batch is deliberately partial (one consonant's full table, plus a few
 * more worked examples) rather than exhaustive across
 * all 33 consonants, and the conjunct batch is deliberately just the two
 * Wikner himself singles out as special rather than his own ~150-entry
 * reference table — see each block's own comment for why.
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
      // than moved next to the rest of the real Lesson 6 vowel-signs tranche
      // below (added later, tranche 2) — nothing requires moving it.
      text: 'ति',
      gloss: 'ti',
      composedOf: [],
    },

    // --- Vowel signs (mātrā), Wikner 6.A.1 "Vowels after Consonants" ---
    // Extension, 2026-08-11 (tranche 2): the first real content past the bare
    // alphabet. A vowel sign has nothing to visually attach to as its own
    // bare glyph, so — same reasoning as skt-letter-ti above — each of these
    // fuses an already-taught consonant with a vowel sign into one atomic
    // letter, rather than teaching the sign alone.
    //
    // Sourced from Wikner 6.A.1's own worked table for ब (already taught,
    // skt-letter-ba), which walks through all fourteen vowels. The table
    // survives OCR extraction with several transliterations intact (bi, bu,
    // bū's row-partner, be, bai, bo, bau) and several lost to corruption
    // (bā, bī specifically) — for those two, the Devanagari is still exactly
    // right (a consonant + a vowel sign is unambiguous, standard composition,
    // not a guess), it is only WHICH garbled table cell corresponds to which
    // that rests on the table's own stated a/ā, i/ī, u/ū... vowel-pair
    // ordering rather than on a directly-legible transliteration for those
    // two specific cells.
    //
    // Deliberately not extended to बॄ/बॢ/बॣ (long-r̥/l̥/long-l̥), even though
    // Wikner's table includes them. For बॄ/बॣ specifically: this file's own
    // existing bare-vowel entries already call ṝ/ḹ "theoretical — not used
    // in standard grammar" (skt-letter-rii/-lii), so sign-forms of them
    // would be extending coverage of letters already flagged as not worth
    // teaching. बॢ (short l̥) is a separate case — its bare counterpart
    // skt-letter-li is only "rare" (occurs in forms of one root, √kḷp), not
    // theoretical — but that root's own inflected forms are well beyond
    // this file's current word list, so its sign form isn't needed yet
    // either; it can be added once a word actually calls for it. Also not
    // extended to र/ह + any vowel sign: Wikner 6.A.1 names रु/हृ as explicit
    // EXCEPTIONS to "these vowel signs are used with all consonants," but the
    // sentence explaining what the exception actually is does not survive in
    // this extraction — proposing a form for an explicitly-flagged exception
    // whose rule cannot be read would be exactly the kind of guess this file
    // does not make.
    {
      id: 'skt-letter-baa',
      stage: 'letters',
      level: 1,
      // Table row 1 (a/ā) — transliteration lost to OCR corruption on this
      // cell specifically, position inferred from the table's own stated
      // vowel-pair order (see block comment above). Placed here, ahead of
      // skt-letter-bi, to match that same a/ā-before-i/ī row order.
      text: 'बा',
      gloss: 'bā',
      composedOf: [],
    },
    { id: 'skt-letter-bi', stage: 'letters', level: 1, text: 'बि', gloss: 'bi', composedOf: [] },
    {
      id: 'skt-letter-bii',
      stage: 'letters',
      level: 1,
      // Table row 2 (i/ī), second cell — same OCR-loss/position-inference
      // situation as skt-letter-baa above.
      text: 'बी',
      gloss: 'bī',
      composedOf: [],
    },
    { id: 'skt-letter-bu', stage: 'letters', level: 1, text: 'बु', gloss: 'bu', composedOf: [] },
    { id: 'skt-letter-buu', stage: 'letters', level: 1, text: 'बू', gloss: 'bū', composedOf: [] },
    {
      id: 'skt-letter-bri',
      stage: 'letters',
      level: 1,
      // The vocalic-r. sign — the one member of its table row (r./r..)
      // extended here, since bare ऋ (skt-letter-ri) is this file's own
      // "common today" vowel; its long partner ॠ is not (see block comment).
      text: 'बृ',
      gloss: 'bṛ',
      composedOf: [],
    },
    {
      id: 'skt-letter-vri',
      stage: 'letters',
      level: 1,
      // Not part of the ब-table above — added later (tranche 4), the same
      // rule skt-letter-ti/skt-letter-ca were added under: व (already
      // taught) plus the vocalic-r̥ sign, purely because skt-word-vrksa
      // below needs it. Wikner never works through व+ऋ as its own example;
      // the sign itself is the identical one already proven on ब above.
      text: 'वृ',
      gloss: 'vṛ',
      composedOf: [],
    },
    { id: 'skt-letter-be', stage: 'letters', level: 1, text: 'बे', gloss: 'be', composedOf: [] },
    { id: 'skt-letter-bai', stage: 'letters', level: 1, text: 'बै', gloss: 'bai', composedOf: [] },
    { id: 'skt-letter-bo', stage: 'letters', level: 1, text: 'बो', gloss: 'bo', composedOf: [] },
    {
      id: 'skt-letter-bau',
      stage: 'letters',
      level: 1,
      // Completes Wikner's own full worked table for ब across every vowel
      // this file teaches bare.
      text: 'बौ',
      gloss: 'bau',
      composedOf: [],
    },
    {
      id: 'skt-letter-ki',
      stage: 'letters',
      level: 1,
      // Wikner 6.A.1's own second worked example, for the same short-i sign
      // as skt-letter-ti's बि, on a different consonant: क is already taught
      // (skt-letter-ka). 6.A.1 groups i/e/o/ai/au together as embellishments
      // written above the letter, linking to the consonant's top horizontal
      // bar (at its rightmost junction if the consonant meets the bar more
      // than once) — this is about where the sign's connecting stroke
      // attaches, not a claim that the whole glyph sits to the consonant's
      // right. For i specifically, 6.A.2 goes on to note the sign is still
      // written "back to front," i.e. to the consonant's visual left (the
      // same fact skt-letter-ti's comment states) — the two descriptions
      // are Wikner's own two different lenses on the same sign, not a
      // contradiction.
      text: 'कि',
      gloss: 'ki',
      composedOf: [],
    },
    {
      id: 'skt-letter-nne',
      stage: 'letters',
      level: 1,
      // The second half of the same worked-example pair as skt-letter-ki
      // (Wikner gives both together to illustrate the top-bar-linking rule).
      // ण is already taught (skt-letter-nna, retroflex ṇa) — named "nne",
      // not "ne", to stay distinct from the dental-na family, mirroring
      // skt-letter-nna's own disambiguation.
      text: 'णे',
      gloss: 'ṇe',
      composedOf: [],
    },

    // --- Conjunct consonants (saṁyoga), Wikner 7.A.3-7.A.5 ---
    // Extension, 2026-08-12 (tranche 3). A conjunct joins two or more
    // consonants with no vowel between them — Wikner's own 7.A.6 gives a
    // ~150-entry reference table of them, but that table's actual glyphs are
    // almost entirely lost to the same OCR/font-extraction corruption this
    // file has flagged before (only the plain-ASCII transliteration next to
    // each cell survives), so it is deliberately NOT taught here wholesale.
    // The two exceptions below are singled out by Wikner HIMSELF as a
    // special pair (7.A.3: "there are two which are quite different from
    // their component parts") and get their own extensive pronunciation
    // sections (7.A.4, 7.A.5) — legible prose, not a table cell. Their
    // Devanagari is standard, well-attested composition from consonants
    // already taught bare in this file (कष, जञ), not a read of the
    // corrupted glyph. Further ordinary conjuncts are deferred until an
    // actual word needs one — the same rule skt-letter-ti was added under.
    {
      id: 'skt-letter-ksa',
      stage: 'letters',
      level: 1,
      // Wikner 7.A.3-7.A.4: one of exactly two conjuncts whose written form
      // "reflects sounds somewhat different from their components," formed
      // from क् (ka, already taught) + ष (ṣa, already taught, skt-letter-ssa).
      text: 'क्ष',
      gloss: 'kṣa',
      composedOf: [],
    },
    {
      id: 'skt-letter-jna',
      stage: 'letters',
      level: 1,
      // Wikner 7.A.3/7.A.5: the other of the two special conjuncts, formed
      // from ज् (ja, already taught) + ञ (ña, already taught, skt-letter-nya).
      text: 'ज्ञ',
      gloss: 'jña',
      composedOf: [],
    },

    // --- Halanta consonants (word-final, no vowel) and one more conjunct,
    // Wikner 7.A.1-7.A.2 — tranche 7 ---
    // Not taught until now: every word/sentence shipped so far either ends
    // in a vowel or a visarga-marked vowel (नरः), never a bare consonant.
    // Wikner 7.A.1 is explicit that Sanskrit has this exact category —
    // "halanta means 'ending in a consonant'... this is the form used when
    // a word ends in a consonant" — written with a virama stroke, the same
    // role Tamil's pulli mark plays, added here the same way every pulli
    // letter in tamil.ts was: one atomic letter per consonant, only once a
    // real word needs it.
    {
      id: 'skt-letter-ma-halanta',
      stage: 'letters',
      level: 1,
      // Needed for skt-word-naram/skt-word-ashvam/skt-word-vrksam below —
      // the accusative singular (dvitīyā eka-vacana) ending of every
      // a-stem noun this file teaches is exactly "-am": the bare stem plus
      // this one word-final letter, per Wikner's own declension table
      // (5.B.1, line 978/1202): "dvitya naram narau naran".
      text: 'म्',
      gloss: 'm — word-final, no vowel',
      composedOf: [],
    },
    // Not a halanta letter itself — Wikner 7.A.1's own distinction (lines
    // 1538-1541): a halanta mark used WITHIN a word, not at its end, forms
    // a conjunct consonant instead, "a different method." श in अश्व is
    // followed by व within the same word, so this is 7.A.2's ordinary,
    // non-special conjunct case (left-to-right stacking, dropping the
    // vertical stroke from all but the last letter — Wikner's own examples
    // at that section: "त्+म्=त्म=tma", "न्+त्+य्=न्त्य=ntya") — not one of
    // the two conjuncts (kṣa, jña) Wikner singles out above as visually
    // unrecognizable from their parts.
    {
      id: 'skt-letter-shva',
      stage: 'letters',
      level: 1,
      // श (śa, already taught, skt-letter-sha) + व (va, already taught,
      // skt-letter-va) — needed only because skt-word-ashva below needs it,
      // the same rule skt-letter-ti/skt-letter-vri were added under. This
      // is the specific conjunct earlier tranches' own comments named as
      // still blocking aśva ("tiṣṭhati and aśva... still need conjuncts
      // (śva, ṣṭha) this file does not teach yet" — vṛkṣa's own comment,
      // tranche 4).
      text: 'श्व',
      gloss: 'śva',
      composedOf: [],
    },
    {
      id: 'skt-letter-te',
      stage: 'letters',
      level: 1,
      // Reuses the े sign already proven on ब (skt-letter-be) and given as
      // a worked example on ण (skt-letter-nne) — the same sign, a different
      // consonant, needed only because skt-word-nayate below needs it.
      text: 'ते',
      gloss: 'te',
      composedOf: [],
    },
    {
      id: 'skt-letter-sya',
      stage: 'letters',
      level: 1,
      // Wikner 7.A.1-7.A.2, same reasoning as skt-letter-shva above: स
      // (already taught, skt-letter-sa) followed by य (already taught,
      // skt-letter-ya) within one word is a word-internal cluster, not a
      // word-final halanta — an ordinary conjunct. Needed only because
      // skt-word-narasya below needs it.
      text: 'स्य',
      gloss: 'sya',
      composedOf: [],
    },
    {
      id: 'skt-letter-re',
      stage: 'letters',
      level: 1,
      // Reuses the े sign already proven on ब/ण/त (skt-letter-be,
      // skt-letter-nne, skt-letter-te) — the same sign, a different
      // consonant, needed only because skt-word-narena below needs it.
      text: 'रे',
      gloss: 're',
      composedOf: [],
    },
    {
      id: 'skt-letter-raa',
      stage: 'letters',
      level: 1,
      // Reuses the ा sign already proven on ब (skt-letter-baa, tranche 2)
      // — the same sign, a different consonant, needed only because
      // skt-word-naraya below needs it. Already named as missing in an
      // earlier tranche's own comment on skt-word-raja: "रा (ra + the ā
      // vowel sign)... not taught even now that बा exists."
      text: 'रा',
      gloss: 'rā',
      composedOf: [],
    },
    {
      id: 'skt-letter-ye',
      stage: 'letters',
      level: 1,
      // Reuses the े sign already proven on ब/ण/त/र (skt-letter-be,
      // skt-letter-nne, skt-letter-te, skt-letter-re) — the same sign, a
      // different consonant, needed only because skt-word-naye below needs
      // it.
      text: 'ये',
      gloss: 'ye',
      composedOf: [],
    },
    {
      id: 'skt-letter-shtha',
      stage: 'letters',
      level: 1,
      // Wikner 7.A.1-7.A.2, same reasoning as skt-letter-shva/skt-letter-sya:
      // ष (already taught, skt-letter-ssa) followed by ठ (already taught,
      // skt-letter-ttha) within one word is a word-internal cluster, an
      // ordinary conjunct — not one of the two Wikner singles out as
      // visually irregular (kṣa, jña). Needed only because
      // skt-word-tishthati below needs it — the specific conjunct every
      // tranche since 4 has named as still blocking tiṣṭhati (see
      // skt-word-vrksa's own comment: "tiṣṭhati (stand)... needs a
      // different conjunct (ṣṭha) this file does not teach yet").
      text: 'ष्ठ',
      gloss: 'ṣṭha',
      composedOf: [],
    },
    {
      id: 'skt-letter-shthaa',
      stage: 'letters',
      level: 1,
      // Reuses the ा sign already proven on ब/र (skt-letter-baa,
      // skt-letter-raa) — the same sign, on the conjunct above instead of
      // a single consonant, needed only because skt-word-tishthami below
      // needs it.
      text: 'ष्ठा',
      gloss: 'ṣṭhā',
      composedOf: [],
    },
    {
      id: 'skt-letter-mi',
      stage: 'letters',
      level: 1,
      // Reuses the ि sign already proven on क/त (skt-letter-ki,
      // skt-letter-ti) — the same sign, a different consonant, needed only
      // because skt-word-tishthami below needs it.
      text: 'मि',
      gloss: 'mi',
      composedOf: [],
    },
    {
      id: 'skt-letter-nau',
      stage: 'letters',
      level: 1,
      // Reuses the ौ sign already proven on ब (skt-letter-bau, tranche 2)
      // — the same sign, a different consonant, needed only because
      // skt-word-nau below needs it.
      text: 'नौ',
      gloss: 'nau',
      composedOf: [],
    },
    {
      id: 'skt-letter-stu',
      stage: 'letters',
      level: 1,
      // Wikner 7.A.1-7.A.2, same reasoning as skt-letter-shva/skt-letter-
      // sya/skt-letter-shtha: स followed immediately by त WITHIN one word
      // (अस्तु — स् sits mid-word, not word-final) is a conjunct, not a
      // plain halanta letter — the same distinction this file already
      // draws for every other word-internal virama. स्त (an ordinary,
      // non-special conjunct) + the ु sign already proven on ब
      // (skt-letter-bu, tranche 2), combined the same way ष्ठा combines
      // the ष्ठ conjunct with ा. Needed only because skt-word-astu below
      // needs it.
      text: 'स्तु',
      gloss: 'stu',
      composedOf: [],
    },
    {
      id: 'skt-letter-he',
      stage: 'letters',
      level: 1,
      // Reuses the े sign already proven on ब/ण/त/र/य (skt-letter-be,
      // skt-letter-nne, skt-letter-te, skt-letter-re, skt-letter-ye) —
      // the same sign, a different consonant, needed only because
      // skt-word-he below needs it.
      text: 'हे',
      gloss: 'he',
      composedOf: [],
    },
    {
      id: 'skt-letter-dhii',
      stage: 'letters',
      level: 1,
      // Reuses the ी sign already proven on ब (skt-letter-bii, tranche 2)
      // — the same sign, a different consonant, needed only because
      // skt-word-adhitam below needs it.
      text: 'धी',
      gloss: 'dhī',
      composedOf: [],
    },
    {
      id: 'skt-letter-svi',
      stage: 'letters',
      level: 1,
      // Wikner 7.A.1-7.A.2, same reasoning as this file's other
      // word-internal conjuncts (skt-letter-shva/sya/shtha/stu): स
      // (already taught) followed by व (already taught) within one word
      // is an ordinary conjunct, not a special one — combined with the
      // ि sign already proven on क/त (skt-letter-ki, skt-letter-ti).
      // Needed only because skt-word-tejasvi below needs it.
      text: 'स्वि',
      gloss: 'svi',
      composedOf: [],
    },
    {
      id: 'skt-letter-tva',
      stage: 'letters',
      level: 1,
      // New (tranche 18): a conjunct, त् (dead त) immediately followed by
      // व — needed only because skt-word-tvam needs it. Modeled as one
      // atomic letter, the same conjunct-not-halanta rule this file
      // already enforces for श्व/स्य/ष्ठ/स्तु/स्वि (a virama immediately
      // followed by another consonant within the same word is a
      // conjunct, not a word-final halanta).
      text: 'त्व',
      gloss: 'tva — conjunct (त् + व)',
      composedOf: [],
    },
    {
      id: 'skt-letter-yuu',
      stage: 'letters',
      level: 1,
      // New (tranche 18): य + the ū vowel sign — needed only because
      // skt-word-yuyam needs it, the same "add only what's needed"
      // reasoning every other new letter in this file already follows.
      text: 'यू',
      gloss: 'yū',
      composedOf: [],
    },
    {
      id: 'skt-letter-tvaa',
      stage: 'letters',
      level: 1,
      // New (tranche 19): the already-taught conjunct त्व (skt-letter-tva,
      // tranche 18) + the ा vowel sign already proven on ब/र/ष्ठ — needed
      // only because skt-word-tvaam below needs it. Whitney §491(a)'s own
      // 2nd-person-singular accusative row: "A. त्वाम्, त्वा tvā́m, tvā"
      // (Sanskrit Grammar, 1889, Chapter VII) — quoted from a live fetch of
      // the Wikisource transcription, cross-checked twice (once during
      // drafting, once independently during adversarial verification;
      // both fetches agreed character-for-character).
      //
      // Disclosed, not overlooked: this glyph is taught here purely as a
      // phonetic unit, the same as every other 'letters'-stage entry in
      // this file — but unlike most of them, त्वा ALSO happens to be a
      // real, valid (if unaccented) standalone Sanskrit word: exactly the
      // brief accusative alternate skt-word-tvaam's own comment says is
      // deliberately not shipped as its own vocabulary item. That decision
      // stands; this letter's gloss is intentionally left as the bare
      // phonetic "tvā", matching every other letter's own convention, not
      // a silent reintroduction of the word skt-word-tvaam avoids shipping.
      text: 'त्वा',
      gloss: 'tvā',
      composedOf: [],
    },
    {
      id: 'skt-letter-yaa',
      stage: 'letters',
      level: 1,
      // New (tranche 19): य (already taught) + the ा vowel sign already
      // proven on ब/र/ष्ठ/त्व — needed only because skt-word-tvaya below
      // needs it. Whitney §491(a)'s own 2nd-person-singular instrumental
      // row: "I. त्वया tváyā" — same double-fetch verification as
      // skt-letter-tvaa above.
      text: 'या',
      gloss: 'yā',
      composedOf: [],
    },
    {
      id: 'skt-letter-ta-halanta',
      stage: 'letters',
      level: 1,
      // New (tranche 20): word-final त्, no vowel — the same halanta
      // category as the already-taught म् (skt-letter-ma-halanta), per
      // Wikner 7.A.1's general halanta rule ("this is the form used when a
      // word ends in a consonant"), a different consonant, needed only
      // because skt-word-tvat below needs it. Whitney §491(a)'s own
      // 2nd-person-singular ablative row: "Ab. त्वत् tvát" (Sanskrit
      // Grammar, 1889, Chapter VII) — quoted from a live fetch of the
      // Wikisource transcription, cross-checked against a second,
      // independent live fetch during adversarial verification. §491(b)'s
      // note on accentless "briefer" alternates ("for accus., dat., and
      // gen., in all numbers") does not apply to this case — the ablative
      // row gives only the one form, so there is no alternate to exclude
      // here (unlike tranche 19's accusative/genitive).
      text: 'त्',
      gloss: 't — word-final, no vowel',
      composedOf: [],
    },
    {
      id: 'skt-letter-yi',
      stage: 'letters',
      level: 1,
      // New (tranche 20): य (already taught) + the ि vowel sign already
      // proven on क/त (skt-letter-ki, skt-letter-ti) — needed only because
      // skt-word-tvayi below needs it. Whitney §491(a)'s own
      // 2nd-person-singular locative row: "L. त्वयि tváyi" — same
      // double-fetch verification as skt-letter-ta-halanta above, and
      // likewise a single unambiguous form with no accentless alternate.
      text: 'यि',
      gloss: 'yi',
      composedOf: [],
    },
    {
      id: 'skt-letter-tu',
      stage: 'letters',
      level: 1,
      // New (tranche 20): त (already taught) + the ु vowel sign already
      // proven on ब — needed only because skt-word-tishthatu below needs
      // it. Whitney (1889), Chapter VIII §553(d): the general parasmaipada
      // imperative endings, 3rd person singular "tu"; Chapter IX §739
      // confirms the concrete cell in bhū's own worked paradigm (bhávatu).
      text: 'तु',
      gloss: 'tu',
      composedOf: [],
    },
    {
      id: 'skt-letter-ni',
      stage: 'letters',
      level: 1,
      // New (tranche 20): न (already taught) + the ि vowel sign already
      // proven on क/त — needed only because skt-word-tishthani below needs
      // it. Whitney (1889), Chapter VIII §553(d): the 1st person singular
      // parasmaipada imperative ending "āni"; Chapter IX §739 confirms the
      // concrete cell (bhávāni).
      text: 'नि',
      gloss: 'ni',
      composedOf: [],
    },
    {
      id: 'skt-letter-muu',
      stage: 'letters',
      level: 1,
      // New (tranche 20): म (already taught) + the ू vowel sign already
      // proven on ब (Wikner 6.A.1) — needed only because skt-word-mula
      // below needs it.
      text: 'मू',
      gloss: 'mū',
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
      id: 'skt-word-vrksa',
      stage: 'words',
      level: 2,
      // Wikner 3.B.2, line 979: "Other nouns that take this form of
      // declension are asva `horse', and vr. ks.a `tree'" — cited bare, the
      // pratipadika/dictionary form, the same convention skt-word-nara uses
      // (3.B.2's own explicit framing for nara at line 974). Declines
      // exactly like nara/asva (masculine a-stem) in every example sentence
      // that uses it (3.B.2, e.g. "narah. asvam vr.ks.am nayate", line 987
      // — the same section, not 3.B.3, whose own content is the lesson's
      // exercises). kṣa is this tranche's own newly-added conjunct
      // (skt-letter-ksa); vṛ is a new enabling letter (skt-letter-vri,
      // added above) needed only for this word. aśva (horse), from the
      // same passage, was still blocked on an untaught conjunct (śva) as of
      // this tranche — tranche 7 later adds skt-letter-shva and unblocks it
      // (see skt-word-ashva). tiṣṭhati (stand) needed a different conjunct
      // (ṣṭha) this file didn't teach yet either — tranche 12 adds
      // skt-letter-shtha and unblocks it too (see skt-word-tishthati).
      text: 'वृक्ष',
      gloss: 'vṛkṣa — tree',
      composedOf: ['skt-letter-vri', 'skt-letter-ksa'],
    },
    {
      id: 'skt-word-mula',
      stage: 'words',
      level: 2,
      // Wikner 11.B.2, lines 2732-2733: "vṛkṣamūlam ← vṛkṣasya mūlam
      // (ṣaṣṭhī-tatpuruṣa) = root of a tree, tree-root." मूल itself is
      // glossed directly by Wikner's own translation of the compound;
      // cited bare, the pratipadika/dictionary form, the same convention
      // skt-word-vrksa uses. मू is a new enabling letter (skt-letter-muu,
      // above), needed only for this word.
      text: 'मूल',
      gloss: 'mūla — root, base, foundation',
      composedOf: ['skt-letter-muu', 'skt-letter-la'],
    },
    {
      id: 'skt-word-mulam',
      stage: 'words',
      // Level 3 — a case form, not new vocabulary: same reasoning as
      // skt-word-naram/skt-word-vrksam. मूल is neuter, so its nominative
      // and accusative singular are identical (standard neuter a-stem
      // declension) — both मूलम्, per Wikner 11.B.2's own worked example
      // (line 2732: "vṛkṣamūlam ← vṛkṣasya mūlam"). This is the specific
      // form skt-sentence-vrksamulam below needs: in a tatpuruṣa compound
      // only the LAST member takes the case ending (Wikner 10.B.1, line
      // 2538), so वृक्ष there stays bare (skt-word-vrksa) while मूल takes
      // it — मूलम्, not मूल.
      level: 3,
      // मूल (already taught, skt-word-mula) + the same word-final म्
      // already taught for नरम्/वृक्षम्/अश्वम्/अहम्.
      text: 'मूलम्',
      gloss: 'mūlam — root (nominative/accusative singular, neuter)',
      composedOf: ['skt-letter-muu', 'skt-letter-la', 'skt-letter-ma-halanta'],
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
      // Unmarked "raja" (dust, pollen) — not rājā "king", which needs रा
      // (ra + the ā vowel sign) specifically, not taught even now that बा
      // exists (tranche 2 added ā only fused to ब, not to र). Worth a
      // comment precisely because the two are one macron apart and that
      // macron is meaning-bearing, the same class of silent error the
      // vowel-length tests guard against in Transliterator.test.ts.
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
      id: 'skt-word-ca',
      stage: 'words',
      level: 2,
      // Wikner, Lesson 1.B.2: "Some words, such as adverbs and conjunctions,
      // do not have endings — these are called indeclinables (avyaya). An
      // example of this is ca ('and') which is placed after the last word of
      // the series it links (or after each word in the series)." An
      // indeclinable, not a noun or verb — it never takes the case/verb
      // endings every other word in this file so far does, worth flagging so
      // a learner meeting it right after नरः/वदति doesn't expect it to
      // inflect the same way.
      text: 'च',
      gloss: 'ca — and (placed after the word or series it links, never inflected)',
      composedOf: ['skt-letter-ca'],
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

    // ================= Sandhi (level 3) =================
    // Extension, 2026-08-12: the first item of the plan doc's "what's next"
    // list, unblocked by Curriculum.ts's new `sandhiRule` field (see that
    // field's own comment for why it had to exist before this was possible
    // at all — validateManifest's exact-reconstruction check cannot
    // represent a real external-sandhi sound change any other way).
    //
    // Not a new sentence: the SAME two words as skt-sentence-narah-vadati
    // above, in the same order, differing only in the sandhi applied at
    // their boundary. Wikner is explicit that this is the relationship
    // between the two (11.A.1, lines 2633-2639): "the declension of nouns...
    // is given in the form of independent words, which means that sandhi
    // rules applicable to a following avasana [pause] have already been
    // applied... when the word is used in a sentence, this sandhi must be
    // removed." skt-sentence-narah-vadati is that independent-word/pausa
    // form; this is what the same two words actually sound like spoken
    // together, and is the form a learner will actually meet in real text.
    //
    // The rule itself (Wikner 11.A.1, visarga-sandhi table, rule 1, line
    // 2619): "-as before a ghoṣa consonant becomes -o." नरः is nara + -s,
    // realized as visarga (ः) in isolation; वदति begins with व, a ghoṣa
    // (voiced) consonant. So the visarga is replaced by ओ: नरः + वदति →
    // नरो वदति. This is exactly why simple concatenation of the two words'
    // own `text` cannot produce this lesson's `text` — the sound change
    // IS the content being taught, not a typo `sandhiRule` is required to
    // name what changed, which is this lesson's whole point.
    {
      id: 'skt-sentence-naro-vadati',
      stage: 'sentences',
      level: 3,
      text: 'नरो वदति',
      gloss: 'naro vadati — the man speaks (spoken/connected form of naraḥ vadati)',
      composedOf: ['skt-word-narah', 'skt-word-vadati'],
      sandhiRule:
        "Visarga sandhi (Wikner 11.A.1, rule 1): a final -aḥ becomes -o before a voiced (ghoṣa) consonant. नरः ends in visarga (from nara + -s); वदति begins with व, which is voiced — so नरः + वदति surfaces as नरो वदति, not नरः वदति.",
    },

    // ================= Noun case + verb pada (level 2-3) =================
    // Extension, 2026-08-12 (tranche 7): the plan doc's next backlog item
    // after sandhi/conjunction — the real prerequisite for expert-tier
    // reading, per that same plan's research (Bhagavad Gītā 2.47, checked
    // word-by-word, failed entirely on missing case/verb morphology, not
    // vocabulary). This tranche adds exactly one more case (dvitīyā,
    // accusative) and one more verb pada (ātmanepada), both fully worked
    // through Wikner's own tables rather than invented, and ships them in
    // Wikner's own worked sentence — not an example built for this app.
    //
    // Wikner 5.B.1 (lines 1198-1207) gives the "strictly correct" full
    // declension of नर; its dvitīyā (accusative) row: eka-vacana naram,
    // dvi-vacana narau, bahu-vacana naran. Only the singular is taught here
    // — dual/plural are a further, separate extension, not needed by the
    // one sentence below.
    {
      id: 'skt-word-naram',
      stage: 'words',
      // Level 3, not 2: this is a case FORM, not new vocabulary — नर itself
      // is already taught (level 2); what's new here is dvitīyā as a
      // grammatical category, which is exactly what LEVELS (Curriculum.ts)
      // names level 3 ("Grammar & Sentences": "noun cases, verb forms") for.
      level: 3,
      // नर (already taught, skt-word-nara) + the word-final म् (added
      // above). Wikner 5.B.1's own table, dvitīyā eka-vacana: "naram".
      text: 'नरम्',
      gloss: 'naram — man (accusative singular, direct object)',
      composedOf: ['skt-letter-na', 'skt-letter-ra', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-vrksam',
      stage: 'words',
      // Level 3 — same reasoning as skt-word-naram above: a case form, not
      // new vocabulary (वृक्ष itself is already taught, level 2).
      level: 3,
      // वृक्ष (already taught, skt-word-vrksa) + the same word-final म् —
      // 3.B.2 states directly that vṛkṣa declines exactly like nara (both
      // masculine a-stem), so its accusative singular is formed the
      // identical way.
      text: 'वृक्षम्',
      gloss: 'vṛkṣam — tree (accusative singular, here: destination)',
      composedOf: ['skt-letter-vri', 'skt-letter-ksa', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-ashva',
      stage: 'words',
      level: 2,
      // Wikner 3.B.2, line 979 — the same sentence already cited for
      // vṛkṣa's own bare-stem entry: "Other nouns that take this form of
      // declension are aśva 'horse', and vṛkṣa 'tree'." Named as blocked on
      // the śva conjunct by every tranche since (tranche 4's own comment on
      // skt-word-vrksa); unblocked here by skt-letter-shva above.
      text: 'अश्व',
      gloss: 'aśva — horse',
      composedOf: ['skt-letter-a', 'skt-letter-shva'],
    },
    {
      id: 'skt-word-ashvam',
      stage: 'words',
      // Level 3 — a case form (dvitīyā), unlike bare skt-word-ashva just
      // above (level 2, plain vocabulary): same reasoning as
      // skt-word-naram/skt-word-vrksam.
      level: 3,
      // अश्व + the same word-final म् — declines like nara/vṛkṣa (3.B.2
      // names all three together as one declension class).
      text: 'अश्वम्',
      gloss: 'aśvam — horse (accusative singular, direct object)',
      composedOf: ['skt-letter-a', 'skt-letter-shva', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-nayate',
      stage: 'words',
      // Level 3, not 2: a verb FORM (ātmanepada pada), the other half of
      // "noun cases, verb forms" LEVELS names for level 3 — not new
      // vocabulary the way skt-word-vadati's own level-2 placement was
      // (vadati was this file's very first verb, taught before the
      // parasmaipada/ātmanepada distinction existed to teach against).
      level: 3,
      // Wikner 3.B.1 (lines 928-955): the ātmanepada personal endings,
      // introduced specifically because √nī ("lead") is conjugated in this
      // pada, not parasmaipada — "in the case of dhātu nī for example, use
      // the ātmanepada endings." The paradigm table (line 944) gives
      // prathama-puruṣa eka-vacana as "nayate", exactly the form 3.B.2's
      // own worked sentence below uses. skt-word-vadati (already taught)
      // is parasmaipada — this is this file's first ātmanepada verb, a
      // different personal-ending set for the same "3rd person singular
      // present" meaning, not a variant spelling of the same word.
      text: 'नयते',
      gloss: 'nayate — leads (he/she/it, ātmanepada)',
      composedOf: ['skt-letter-na', 'skt-letter-ya', 'skt-letter-te'],
    },
    {
      id: 'skt-sentence-narah-ashvam-vrksam-nayate',
      stage: 'sentences',
      level: 3,
      // Wikner 3.B.2, line 987 — quoted verbatim, not assembled from
      // separately-sourced words: "narah. asvam v.rks.am nayate / the man
      // leads the horse to the tree." That same passage (line 984-986)
      // explains why there are two accusatives: "there are some verbs
      // (such as nī) which have both a direct object and a destination, in
      // which case both are expressed in dvitīyā" — अश्वम् is the direct
      // object, वृक्षम् the destination, both dvitīyā for that reason, not
      // two nouns doing the same job.
      //
      // Each word here is independently taught above in its own citation
      // form (pausa) — no sandhiRule: this is the four words' independent
      // forms, the same relationship skt-sentence-narah-vadati has to its
      // own sandhi'd counterpart, not yet carried through for this longer
      // sentence. composedOf is four WORDS, joined with a single space.
      text: 'नरः अश्वम् वृक्षम् नयते',
      gloss: 'naraḥ aśvam vṛkṣam nayate — the man leads the horse to the tree',
      composedOf: ['skt-word-narah', 'skt-word-ashvam', 'skt-word-vrksam', 'skt-word-nayate'],
    },

    // ================= A second case: ṣaṣṭhī (level 3) =================
    // Extension, 2026-08-12 (tranche 8): one more slice of the plan doc's
    // "more case morphology" item — ṣaṣṭhī (genitive), Wikner 5.B.1's own
    // full declension table for नर (line 1206, already cited for tranche
    // 7's accusative row): "s.as.t.h narasya narayoh. naran.am" — only the
    // singular (eka-vacana) is taught here, same scoping as tranche 7's
    // accusative singular.
    {
      id: 'skt-word-narasya',
      stage: 'words',
      // Level 3, same reasoning as tranche 7's case-form words: this is a
      // grammatical category (possession/relation, "of the man"), not new
      // vocabulary — नर itself is already taught at level 2.
      level: 3,
      text: 'नरस्य',
      gloss: 'narasya — of the man, the man\'s',
      composedOf: ['skt-letter-na', 'skt-letter-ra', 'skt-letter-sya'],
    },

    // ================= A third case: tṛtīyā (level 3) =================
    // Extension, 2026-08-12 (tranche 9): a third case for नर — tṛtīyā
    // (instrumental), Wikner 5.B.1's own declension table (line 1203,
    // already cited for tranche 7's/8's dvitīyā/ṣaṣṭhī rows): "tr. tya
    // naren.a narabhyam naraih." — eka-vacana narena. Only the singular is
    // taught here, same scoping as the previous two cases.
    {
      id: 'skt-word-narena',
      stage: 'words',
      // Level 3, same reasoning as narasya/naram above.
      level: 3,
      // नर (already taught) + रे (added above) + ण (already taught,
      // skt-letter-nna, retroflex ṇa — not the dental न this word starts
      // with).
      text: 'नरेण',
      gloss: 'narena — by/with the man (instrumental)',
      composedOf: ['skt-letter-na', 'skt-letter-re', 'skt-letter-nna'],
    },

    // ================= A fourth case: caturthī (level 3) =================
    // Extension, 2026-08-12 (tranche 10): a fourth case for नर — caturthī
    // (dative), Wikner 5.B.1's own declension table (line 1204, already
    // cited for the previous three cases' rows): "caturth naraya
    // narabhyam narebhyah." — eka-vacana naraya (spelled नराय: the a-stem
    // dative-singular ending is -āya, long, hence रा not bare र — the
    // exact letter an earlier tranche's own comment on skt-word-raja
    // already named as missing). Wikner's own 5.B.1 prose (line 1103)
    // glosses this case directly: "indicates the indirect object, the
    // recipient." Only the singular is taught here, same scoping as the
    // previous three cases.
    {
      id: 'skt-word-naraya',
      stage: 'words',
      // Level 3, same reasoning as narasya/naram/narena above.
      level: 3,
      text: 'नराय',
      gloss: 'narāya — to/for the man (dative)',
      composedOf: ['skt-letter-na', 'skt-letter-raa', 'skt-letter-ya'],
    },

    // ================= Pivot: particle and person (level 2-3) =================
    // Extension, 2026-08-12 (tranche 11): tranches 8-10 added a case each,
    // but re-testing against Bhagavad Gītā 2.47 after all three showed no
    // real progress toward expert-tier reading — that verse's blockers
    // (a pronoun system, a prohibitive/imperative mood, indeclinable
    // particles) are categorically different from "one more case for नर."
    // This tranche pivots toward two of those instead: an indeclinable
    // particle, and a second grammatical person for a verb already taught
    // (this file's first person other than 3rd).
    //
    // इति, Wikner 9.B.2 (lines 2265-2277): "the nipata iti means 'thus':
    // it lays stress on what precedes it, typically referring to something
    // that has been said — it is the Sanskrit equivalent of inverted
    // commas." An indeclinable (avyaya), like च (skt-word-ca) — never
    // takes case/verb endings.
    {
      id: 'skt-word-iti',
      stage: 'words',
      level: 2,
      composedOf: ['skt-letter-i', 'skt-letter-ti'],
      text: 'इति',
      gloss: "iti — 'thus' (marks the end of a quoted statement, like closing quotation marks)",
    },
    // नये, Wikner 3.B.1's own paradigm table (line 948, already cited for
    // skt-word-nayate's own 3rd-person row): "uttama-purusa naye nayavahe
    // nayamahe" — eka-vacana uttama-puruṣa (1st person singular) ātmanepada
    // of नी. Same root as skt-word-nayate, different person — this file's
    // first verb form in any person other than 3rd (prathama-puruṣa).
    {
      id: 'skt-word-naye',
      stage: 'words',
      // Level 3, same reasoning as this file's other case/person-marked
      // grammar forms: a person-marking distinction, not new vocabulary —
      // the root नी itself is already taught (skt-word-nayate).
      level: 3,
      text: 'नये',
      gloss: 'naye — I lead (1st person singular, ātmanepada)',
      composedOf: ['skt-letter-na', 'skt-letter-ye'],
    },

    // ================= Unblocking tiṣṭhati (level 2-3) =================
    // Extension, 2026-08-12 (tranche 12): tiṣṭhati (root स्था, "stand") has
    // been named as blocked on an untaught conjunct in every tranche's own
    // comments since tranche 4 (skt-word-vrksa's comment: "aśva (horse)
    // and tiṣṭhati (stand), from the same passage, still need conjuncts
    // (śva, ṣṭha) this file does not teach yet and remain future work" —
    // tranche 7 unblocked aśva via śva; this tranche closes the other half.
    //
    // Wikner 2.B.1 (lines 744-756) gives the FULL parasmaipada
    // person/number paradigm for तिष्ठति as its own worked table — the
    // same shape of table 3.B.1 later gives for नी (already cited for
    // skt-word-nayate/skt-word-naye), but for a DIFFERENT pada
    // (parasmaipada, not ātmanepada) and taught earlier in the book. Only
    // two cells are taught here: prathama-puruṣa eka-vacana (तिष्ठति,
    // "he/she/it stands" — line 750) and uttama-puruṣa eka-vacana
    // (तिष्ठामि, "I stand" — line 754) — this file's first parasmaipada
    // verb form in any person other than 3rd, the parasmaipada
    // counterpart to skt-word-naye's ātmanepada.
    {
      id: 'skt-word-tishthati',
      stage: 'words',
      level: 2,
      text: 'तिष्ठति',
      gloss: 'tiṣṭhati — stands (he/she/it)',
      composedOf: ['skt-letter-ti', 'skt-letter-shtha', 'skt-letter-ti'],
    },
    {
      id: 'skt-word-tishthami',
      stage: 'words',
      // Level 3, same reasoning as skt-word-naye: a person-marking
      // distinction on an already-taught root, not new vocabulary.
      level: 3,
      text: 'तिष्ठामि',
      gloss: 'tiṣṭhāmi — I stand (1st person singular, parasmaipada)',
      composedOf: ['skt-letter-ti', 'skt-letter-shthaa', 'skt-letter-mi'],
    },
    // अश्वः, nominative singular of अश्व (already taught, bare stem) — the
    // same visarga-suffixation already proven on नर (skt-word-narah).
    // Needed for the sentence below.
    {
      id: 'skt-word-ashvah',
      stage: 'words',
      level: 2,
      text: 'अश्वः',
      gloss: 'aśvaḥ — horse (nominative singular)',
      composedOf: ['skt-letter-a', 'skt-letter-shva', 'skt-letter-visarga'],
    },
    {
      id: 'skt-sentence-ashvah-tishthati',
      stage: 'sentences',
      // Level 2, matching skt-sentence-narah-vadati's own precedent: two
      // level-2 words placed side by side, no sandhi and no case/verb-form
      // novelty beyond what those two words already carry — not the
      // "grammar" LEVELS reserves level 3 for.
      level: 2,
      // Wikner 3.B.3, exercise 4, line 1004 — the OTHER half of the same
      // sentence skt-sentence-narah-vadati already quotes: "aśvaḥ
      // tiṣṭhati ca naraḥ vadati ca" ("the horse stands and the man
      // speaks"). That earlier tranche stripped this clause off because
      // tiṣṭhati wasn't teachable yet; it now is.
      text: 'अश्वः तिष्ठति',
      gloss: 'aśvaḥ tiṣṭhati — the horse stands',
      composedOf: ['skt-word-ashvah', 'skt-word-tishthati'],
    },

    // ================= Pronoun glossary words (level 2) =================
    // Extension, 2026-08-12 (tranche 13): per the tranche-12 sourcing
    // research, Wikner has no personal-pronoun declension table anywhere
    // (the "Declension Paradigms" appendix, lines 1932-1967, tables only
    // nouns) and no imperative-mood conjugation (the course explicitly
    // limits itself to present indicative, lines 763-766). What it DOES
    // have are three isolated glossary-style word-notes — each Wikner's
    // own analysis of one word inside a real quoted verse, not a lesson.
    // Operator decision: ship these three as bare vocabulary rather than
    // wait for a lesson that doesn't exist in this source, being explicit
    // in each one's own comment that this is what it is.
    {
      id: 'skt-word-aham',
      stage: 'words',
      level: 2,
      // Wikner's back-matter Bhagavad Gītā study exercise (§15.8), line
      // 3875: "Aham | prathama eka-vacana of personal pronoun 'I'" —
      // nominative singular. अ (already taught) + ह (already taught,
      // skt-letter-ha) + म् (already taught, skt-letter-ma-halanta).
      text: 'अहम्',
      gloss: 'aham — I (nominative singular personal pronoun)',
      composedOf: ['skt-letter-a', 'skt-letter-ha', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-nau',
      // Level 3, not 2: this is a case-marked pronoun form (dual,
      // accusative/dative/genitive — see below), the same reasoning
      // every other case-marked word in this file (naram, narasya,
      // narena, naraya) is level 3 for, not new bare vocabulary the way
      // skt-word-aham (nominative, a pronoun's own basic complete form)
      // is.
      stage: 'words',
      level: 3,
      // Wikner's front-matter Invocation analysis, line 207: "nau |
      // genitive dual of personal pronoun 'I', giving the meaning 'of us
      // both (student and teacher)', or simply 'our'." That is नौ's
      // function IN THIS SPECIFIC VERSE, not its only one: नौ is the
      // shared enclitic dual form covering accusative, dative, AND
      // genitive alike (standard Sanskrit pronominal-enclitic behaviour,
      // not unique to this word) — glossed below accordingly, rather
      // than overclaiming "genitive" as नौ's one fixed case. Dual, not
      // singular — "we two", the traditional teacher-student pair the
      // Invocation itself addresses. composedOf is the one letter this
      // word IS (Curriculum.ts's words JOINER is '', so a single-letter
      // composedOf reconstructs exactly).
      text: 'नौ',
      gloss: 'nau — us two, of us two, to/for us two (accusative/genitive/dative dual personal pronoun — case-ambiguous by design)',
      composedOf: ['skt-letter-nau'],
    },
    {
      id: 'skt-word-astu',
      // Level 3, not 2: an imperative-mood verb form, the same reasoning
      // every other mood/person-marked verb in this file (naye,
      // tishthami) is level 3 for.
      stage: 'words',
      level: 3,
      // Wikner's front-matter Invocation analysis, line 226: "Astu | rst
      // [first] person singular imperative of as (to be), i.e. 'let it
      // be', 'may it be', or simply 'be!'" Quoted faithfully, but flagged:
      // standard Sanskrit grammar gives अस्तु as 3rd person singular
      // imperative (parasmaipada) of अस्, not 1st — "let it be"/"may it
      // be" is a 3rd-person-subject meaning ("[it] be"), not "[I] be".
      // Wikner's own label here looks like an error in his text, not a
      // different tradition; glossed below per the linguistically correct
      // analysis, not per his mislabel, so a learner isn't taught the
      // error even though the word itself and its meaning are exactly his.
      text: 'अस्तु',
      gloss: 'astu — let it be, may it be, be! (3rd person singular imperative of √as, "to be")',
      composedOf: ['skt-letter-a', 'skt-letter-stu'],
    },

    // ================= A second particle (level 2-3) =================
    // Extension, 2026-08-12 (tranche 14): per the tranche-13 operator
    // decision — treat the benchmark verses as calibration, not a
    // checklist, and target grammar completeness on its own merits —
    // this file's second indeclinable particle, हे (vocative). Wikner
    // 9.B.1, line 2263: "words of this class are ca (and) and he (vocative
    // particle)." Not इति's own citation (9.B.2, cited above) — a
    // different subsection of the same lesson, read at the same time but
    // not previously mined for this word. Not a new source either way:
    // both this word and the sentence below come from tables this file
    // has already read (5.B.1 for cases, 9.B.1/9.B.2 for both particles),
    // just not fully mined until now.
    {
      id: 'skt-word-he',
      stage: 'words',
      level: 2,
      // An indeclinable (avyaya), like च and इति above — never takes
      // case/verb endings.
      text: 'हे',
      gloss: 'he — O! (vocative particle, addresses someone directly)',
      composedOf: ['skt-letter-he'],
    },
    {
      id: 'skt-sentence-he-nara',
      stage: 'sentences',
      // Level 2, matching skt-sentence-narah-vadati/skt-sentence-ashvah-
      // tishthati's own precedent: two level-2 words placed side by side,
      // no sandhi, no grammar novelty beyond what they already carry.
      level: 2,
      // Wikner 5.B.1, line 1201 (already this file's own citation for
      // तिष्ठति as नर's own dvitīyā row, and for every case built on नर
      // since tranche 7) — the sambodhana (vocative) prathama row of नर's
      // own "strictly correct" declension table: "sambodhana prathama he
      // nara he narau he narah." Only the singular is quoted here, same
      // scoping as every other row already taken from this table. The
      // vocative particle's own comment there: "traditionally sounded in
      // the paradigm[,] it is optional in a sentence."
      text: 'हे नर',
      gloss: 'he nara — O man!',
      composedOf: ['skt-word-he', 'skt-word-nara'],
    },

    // ================= Two more words from the Invocation (level 2) =================
    // Extension, 2026-08-12 (tranche 15): the same front-matter Invocation
    // verse already mined for नौ/अस्तु (lines 190-233) has two more words —
    // तेजस्वि and अधीतम् — that weren't picked up yet. अहम् (tranche 13) is
    // NOT from this verse — its own citation above is a separate back-matter
    // passage (§15.8, line 3875) — so it's not relisted here. Neither तेजस्वि
    // nor अधीतम् is a bare pronoun/particle the way नौ/अस्तु were: तेजस्वि is an
    // adjective (a -vin possessive-suffix derivative) and अधीतम् is a
    // past passive participle used as an abstract noun. This file already
    // teaches morphologically complex forms as flat vocabulary — letters
    // decomposed, not the derivation itself (नरस्य, तिष्ठति, नयते) — so
    // both are taught the same way here, not as a new participle- or
    // adjective-formation rule.
    {
      id: 'skt-word-adhitam',
      stage: 'words',
      level: 2,
      // Wikner's front-matter Invocation analysis, lines 209-211:
      // "Adhītam | neuter nominative singular of adhītam. (The past
      // passive participle used in the sense of an abstract noun.)
      // adhītaḥ | mw 22c mfn. attained, studied, read; well-read,
      // learned." Glossed here per that participial sense ("studied"),
      // not the unrelated "abstract noun" framing alone.
      text: 'अधीतम्',
      gloss: 'adhītam — studied, learned (past passive participle, neuter nominative singular)',
      composedOf: ['skt-letter-a', 'skt-letter-dhii', 'skt-letter-ta', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-tejasvi',
      stage: 'words',
      level: 2,
      // Wikner's front-matter Invocation analysis, lines 193-195: "...avi
      // | neuter nominative singular of adjective tejasvin. tejasvin | mw
      // 454c mfn. brilliant, splendid, bright, energetic." The verse's own
      // form is तेजस्वि (neuter nominative singular), not the bare
      // dictionary stem तेजस्विन् — same convention as skt-word-vrksa's
      // own bare-pratipadika citation.
      text: 'तेजस्वि',
      gloss: 'tejasvi — brilliant, splendid, bright, energetic',
      composedOf: ['skt-letter-te', 'skt-letter-ja', 'skt-letter-svi'],
    },

    // ================= A second particle-glossary word (level 2) =================
    // Extension, 2026-08-12 (tranche 17): grammar completeness on its own
    // merits — a second indeclinable particle beyond च/इति/हे, found in
    // the very same back-matter passage that already sourced अहम्
    // (Wikner §15.8, line 3875). Right next to it, line 3876: "Ov | avyaya
    // = verily, indeed" — Wikner's own sandhi-free breakdown of the
    // Bhagavad Gītā verse "अहम् एव अक्षयः कालः..." ("I am verily
    // inexhaustible Time..."), glossed directly, dictionary-style, exactly
    // like every other word already taken from this passage.
    {
      id: 'skt-word-eva',
      stage: 'words',
      level: 2,
      // ए (already taught, the independent vowel letter — this word
      // starts with the vowel sound itself, not a consonant, so it's not
      // built from a vowel SIGN) + व (already taught, bare consonant with
      // its own inherent 'a' — this word ends in the syllable "va", no
      // virama needed). Zero new letters.
      text: 'एव',
      gloss: 'eva — indeed, verily (emphatic particle)',
      composedOf: ['skt-letter-e', 'skt-letter-va'],
    },

    // ================= Second-person pronoun (level 2) =================
    // Extension, 2026-08-12 (tranche 18): Wikner has been confirmed (two
    // separate full-text checks) to have no 2nd-person pronoun anywhere in
    // his text — 2nd person there is only ever expressed through verb
    // endings. This tranche closes that gap with a second source: William
    // Dwight Whitney's Sanskrit Grammar (1889, public domain), Chapter VII
    // ("Pronouns"), §491 — read via its Wikisource proofread transcription
    // (clean Devanagari + IAST, not a raw OCR dump — catalogued as
    // `skt-whitney-grammar`, the same "adopt a second source" pattern
    // already used for Andronov on the Tamil side, tranche 12).
    //
    // §491's own table, "2d pers." column: nominative singular त्वम् tvám,
    // nominative plural यूयम् yūyám (quoted verbatim from the table's own
    // cells). New letters (त्व, यू) live up in this file's letters block,
    // right after skt-letter-svi.
    {
      id: 'skt-word-tvam',
      stage: 'words',
      level: 2,
      // त्व (new, above) + म् (already taught, skt-letter-ma-halanta).
      text: 'त्वम्',
      gloss: 'tvam — you (nominative singular personal pronoun)',
      composedOf: ['skt-letter-tva', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-yuyam',
      stage: 'words',
      level: 2,
      // यू (new, above) + य (already taught, skt-letter-ya, bare — its own
      // inherent 'a' gives the "ya" syllable) + म् (already taught,
      // skt-letter-ma-halanta).
      text: 'यूयम्',
      gloss: 'yūyam — you all, you (plural) (nominative plural personal pronoun)',
      composedOf: ['skt-letter-yuu', 'skt-letter-ya', 'skt-letter-ma-halanta'],
    },

    // ============ 2nd-person pronoun, tranche 19: fuller case forms ============
    // Tranche 18 shipped only the nominative (त्वम्/यूयम्, above). §491(a)'s
    // own table has the rest — this tranche ships three more singular case
    // forms, a small verified slice rather than the whole table at once,
    // matching this file's own established tranche-7-14 preference. Every
    // citation below double-checked against two independent live fetches
    // of the same Wikisource transcription (once while drafting, once
    // during adversarial verification) — not a cached/stale copy.
    {
      id: 'skt-word-tvaam',
      stage: 'words',
      level: 3,
      // त्वा (new, above) + म् (already taught, skt-letter-ma-halanta).
      // Ships the fuller/accented accusative त्वाम्, not the accentless
      // brief alternate त्वा the same table row also gives (per §491(b):
      // "the briefer second forms for accus., dat., and gen... are
      // accentless") — left unshipped as its own word to avoid teaching a
      // second, bare form of a letter this file otherwise only ever uses
      // as part of त्वाम्. Level 3, matching this file's own precedent that
      // a case-marked form (नरस्य/नरेण/नराय) is level 3, not level 2 like
      // the bare nominative.
      text: 'त्वाम्',
      gloss: 'tvām — you (accusative singular personal pronoun, direct object)',
      composedOf: ['skt-letter-tvaa', 'skt-letter-ma-halanta'],
    },
    {
      id: 'skt-word-tava',
      stage: 'words',
      level: 3,
      // त (already taught) + व (already taught) — zero new letters.
      // §491(a)'s genitive row: "G. तव, ते táva, te". Ships the fuller
      // तव, not the accentless brief alternate ते — which this table's
      // own dative row ALSO gives as its own brief alternate ("D.
      // तुभ्यम्, ते túbhyam, te"), a genuine same-syllable overlap between
      // two different cases, so ते is deliberately not shipped as its own
      // bare vocabulary item (it would conflate the two).
      text: 'तव',
      gloss: 'tava — of you, your (genitive singular personal pronoun)',
      composedOf: ['skt-letter-ta', 'skt-letter-va'],
    },
    {
      id: 'skt-word-tvaya',
      stage: 'words',
      level: 3,
      // त्व (already taught, tranche 18) + या (new, above). §491(a)'s
      // instrumental row: "I. त्वया tváyā" — a single, unambiguous form,
      // no accentless alternate given for this case. Parallels the
      // already-taught instrumental case for नर (नरेण).
      text: 'त्वया',
      gloss: 'tvayā — by/with you (instrumental singular personal pronoun)',
      composedOf: ['skt-letter-tva', 'skt-letter-yaa'],
    },

    // ============ 2nd-person pronoun, tranche 20: ablative and locative singular ============
    // Whitney §491(a)'s own table, the same source tranches 18-19 used for
    // the nominative/accusative/genitive/instrumental. These two forms were
    // picked over the still-open dative (तुभ्यम्) specifically because they
    // are each the table's ONLY form for that case — no accentless "briefer
    // second form" to weigh excluding, unlike accusative/dative/genitive
    // (see skt-word-tvaam's and skt-word-tava's own comments). Every
    // citation below double-checked against two independent live fetches of
    // the same Wikisource transcription (once while drafting, once during
    // adversarial verification) — not a cached/stale copy.
    {
      id: 'skt-word-tvat',
      stage: 'words',
      level: 3,
      // त्व (already taught, tranche 18) + त् (new, above). §491(a)'s
      // ablative row: "Ab. त्वत् tvát" — a single, unambiguous form.
      text: 'त्वत्',
      gloss: 'tvat — from you (ablative singular personal pronoun)',
      composedOf: ['skt-letter-tva', 'skt-letter-ta-halanta'],
    },
    {
      id: 'skt-word-tvayi',
      stage: 'words',
      level: 3,
      // त्व (already taught, tranche 18) + यि (new, above). §491(a)'s
      // locative row: "L. त्वयि tváyi" — a single, unambiguous form.
      text: 'त्वयि',
      gloss: 'tvayi — in/on you (locative singular personal pronoun)',
      composedOf: ['skt-letter-tva', 'skt-letter-yi'],
    },

    // ============ Imperative mood, tranche 20: √sthā, singular ============
    // Whitney (1889), Chapter IX §671: तिष्ठ (this file's own already-taught
    // present-stem, तिष्ठति/तिष्ठामि) "is inflected not like mímāmi, but
    // like bhávāmi" — i.e. takes the same endings as the fully-tabulated
    // thematic root bhū. Chapter VIII §553(d) gives the general
    // parasmaipada imperative endings (1sg āni, 2sg dhí/hí/—, 3sg tu);
    // Chapter IX §739 confirms the concrete cells in bhū's own worked
    // paradigm (bhávāni/bháva/bhávatu). Independently corroborated within
    // this file itself: अस् (root-class, athematic) instead takes the -hi
    // ending (एधि, already shipped — see skt-word-astu's own comment,
    // quoting Wikner's असानि/एधि/अस्तु), confirming the bare-stem 2nd-
    // singular ending is specifically an a-class property, not universal.
    {
      id: 'skt-word-tishtha',
      stage: 'words',
      level: 3,
      // ति + ष्ठ (both already taught) — the bare present-stem, no suffix,
      // per §553(d)'s third listed 2nd-singular option (the one thematic
      // a-class verbs like bhū/tiṣṭha take). Coincidence, not an error:
      // this is visually identical to the mid-word तिष्ठ- syllable already
      // taught inside तिष्ठति/तिष्ठामि — same "disclosed, not overlooked"
      // treatment this file already gives त्वा (skt-letter-tvaa).
      text: 'तिष्ठ',
      gloss: 'tiṣṭha — stand! (2nd person singular imperative, parasmaipada)',
      composedOf: ['skt-letter-ti', 'skt-letter-shtha'],
    },
    {
      id: 'skt-word-tishthatu',
      stage: 'words',
      level: 3,
      // तिष्ठ + तु (new, above) — matches this file's own already-shipped
      // अस्तु (astu = अस् + tu), the same 3rd-singular -tu ending on a
      // different root/class.
      text: 'तिष्ठतु',
      gloss: 'tiṣṭhatu — let him/her/it stand! (3rd person singular imperative, parasmaipada)',
      composedOf: ['skt-letter-ti', 'skt-letter-shtha', 'skt-letter-tu'],
    },
    {
      id: 'skt-word-tishthani',
      stage: 'words',
      level: 3,
      // तिष्ठ + आ-lengthening (ष्ठा, already taught from तिष्ठामि) + नि
      // (new, above) — matches this file's own already-shipped असानि
      // (1st singular of अस्), the same -āni ending shared across classes.
      text: 'तिष्ठानि',
      gloss: 'tiṣṭhāni — let me stand! (1st person singular imperative, parasmaipada)',
      composedOf: ['skt-letter-ti', 'skt-letter-shthaa', 'skt-letter-ni'],
    },

    // ============ Compound words (samāsa), tranche 20 ============
    // Wikner 10.B-11.B, flagged "not started" since this plan's very first
    // pass — the first samāsa lesson in this file. Only the ṣaṣṭhī-
    // tatpuruṣa subtype, using Wikner's own worked example (11.B.2, lines
    // 2732-2733): "vṛkṣamūlam ← vṛkṣasya mūlam (ṣaṣṭhī-tatpuruṣa) = root of
    // a tree, tree-root."
    {
      id: 'skt-sentence-vrksamulam',
      stage: 'sentences',
      level: 3,
      // वृक्षमूलम् does not reconstruct as वृक्ष + मूलम् (space-joined,
      // the ordinary sentence joiner) — a samāsa fuses its members with NO
      // space (Wikner 10.B.1, line 2530: "a compound word (samāsa) is
      // always written without a break"). That is the ONLY divergence
      // sandhiRule accounts for here: composedOf itself already names
      // both real dependencies, वृक्ष (bare pratipadika — 10.B.1, lines
      // 2535-2541: "only the last member appears to decline, while
      // earlier members retain their pratipadika form") and मूलम् (the
      // case-marked last member, skt-word-mulam above) — so every
      // character in वृक्षमूलम् is traceable through composedOf, unlike
      // an earlier draft of this lesson that left the case ending
      // undeclared and leaned on sandhiRule to paper over it.
      sandhiRule:
        'Ṣaṣṭhī-tatpuruṣa compounding (Wikner 10.B.1, lines 2530-2541): the two members fuse with no space between them — vṛkṣa + mūlam, not vṛkṣa + a space + mūlam. The case ending itself is not part of this rule; it is already accounted for by mūlam\'s own composedOf.',
      text: 'वृक्षमूलम्',
      gloss:
        'vṛkṣamūlam — root of a tree, tree-root (a ṣaṣṭhī-tatpuruṣa compound: the same genitive relationship already taught as नरस्य, "of the man", now expressed by compounding instead of a case ending)',
      composedOf: ['skt-word-vrksa', 'skt-word-mulam'],
    },
  ],
};
