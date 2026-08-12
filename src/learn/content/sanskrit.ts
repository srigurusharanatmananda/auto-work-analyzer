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
 * person other than 3rd, नये ("I lead", 1st singular ātmanepada). See
 * `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md` for the full
 * beginner-to-advanced plan this is a tranche of — tiṣṭhati is still
 * blocked on the ṣṭha conjunct this file doesn't teach yet. The vowel-sign
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
      // (see skt-word-ashva). tiṣṭhati (stand) needs a different conjunct
      // (ṣṭha) this file still doesn't teach, and remains future work.
      text: 'वृक्ष',
      gloss: 'vṛkṣa — tree',
      composedOf: ['skt-letter-vri', 'skt-letter-ksa'],
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
  ],
};
