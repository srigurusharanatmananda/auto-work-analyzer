/**
 * As of 2026-08-12: the complete Tamil alphabet (all 12 vowels, the āytham,
 * all 18 consonants — ABC of Tamil, Lessons One and Two), and the full
 * vowel-sign table (ABC of Tamil, Lessons Three-Fifteen) on every consonant
 * the primer itself actually teaches it for — 17 of 18 (க shipped in
 * tranche 3, the other 16 in tranche 5); ங alone is excluded, by the
 * primer's own explicit statement. Of those 17, only 10 (க plus 9 of the 16
 * added by tranche 5) get the rare au sign, again per the primer's own
 * account of which words actually use it — see the tranche-5 block's own
 * comment in this file for the citations.
 * Plus a first small set of real words and one sentence, extended
 * 2026-08-09/10. See `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`
 * for the full beginner-to-advanced plan this is a tranche of — mirrors the
 * Sanskrit manifest's own tranche-2 alphabet completion and tranche-3
 * vowel-sign/conjunct batch, same rigor. Tranche 3 shipped the table for க
 * only, deliberately deferring the other 17 consonants (the same reasoning
 * Sanskrit's own single-consonant vowel-sign tranche used); tranche 5
 * completes that backlog item for all but ங (see that tranche's own block
 * comment for why ங stays excluded). Tranche 6 adds the Tamil half of the
 * plan doc's "conjunction rules" item — the உம் ("and"/"too") suffix, ABC of
 * Tamil Lesson Twelve — unblocked by `Curriculum.ts`'s new `sandhiRule`
 * field; see that tranche's own block comment below for why an engine
 * change was needed before this was possible at all. Tranche 7 adds this
 * language's first verb conjugation — present tense, ABC of Tamil Lesson
 * Seventeen — needing zero new letters, every one already taught by an
 * earlier tranche. Tranche 8 adds this language's first case, accusative
 * (ஐ), ABC of Tamil Lesson Nineteen — again zero new letters. Tranche 9
 * adds a second case, dative (கு/க்கு), ABC of Tamil Lesson Twenty —
 * needing one new letter (a dead க், this file's first). Tranche 10 adds a
 * third case, genitive (உடைய), ABC of Tamil Lesson Twenty-One — zero new
 * letters again. Tranche 11 pivots away from cases (re-testing against the
 * actual target verse after tranches 8-10 showed no real progress) toward
 * this file's first person other than 1st: அவன் ("he") and செய்கிறான்
 * ("he does", ABC of Tamil Lesson Seventeen's own person table) — zero new
 * letters yet again. Tranche 12 adds this file's first tense other than
 * present: past (செய்தேன்/செய்தான்), sourced from M.S. Andronov's *A
 * Grammar of Modern and Classical Tamil* (1989) — ABC of Tamil, Book One
 * genuinely ends at Lesson Twenty-One and never reaches past/future tense
 * (confirmed by reading its remaining pages, not assumed), so this is the
 * first tranche in either language to use a source beyond the original
 * two. See the tranche-12 block's own comment below, and this file's
 * `resources.ts` entry `tam-andronov-grammar`, for the full citation.
 * Tranche 13 adds this file's first negation, செய்யாதே ("don't do!",
 * literary negative imperative singular, Andronov §229) — zero new
 * letters, same source. Tranche 14 adds this file's first tense beyond
 * present/past, future (செய்வேன், "I shall do", Andronov §110/§115) —
 * zero new letters again. Tranche 15 adds a second person for செய்,
 * present tense (நீ செய்கிறாய், "you do", ABC of Tamil Lesson Seventeen
 * line 1432) — நீ itself is real taught vocabulary since Lesson Five, not
 * a repurposed vowel-sign letter. Zero new letters yet again. Tranche 16
 * adds this file's first negative INDICATIVE (செய்யாது, "does not do",
 * Andronov §223/§225/line 21686 — tranche 13's செய்யாதே was the negative
 * IMPERATIVE) and a second dative sub-rule for short, doubling nouns
 * (கண்ணுக்கு "to the eye", பல்லுக்கு "to the tooth", ABC of Tamil Lesson
 * Twenty, lines 1961-1973) — zero new letters both times. Tamil-only:
 * this tranche's research turned up no unspent Sanskrit lead (tranche
 * 15 already consumed the sweep's Sanskrit findings), and the
 * tranche-13 operator decision — grammar completeness on its own merits
 * — no longer requires lockstep parity between the two languages.
 * Tranche 18 adds a pronoun genitive, அவனுடைய ("his", the genitive of
 * அவன், ABC of Tamil Lesson Twenty-One, line 2046) — zero new letters,
 * every grapheme (அ, வ, னு, டை, ய) already taught by an earlier tranche.
 *
 * The paragraphs below describe the file's state BEFORE this tranche
 * (2026-08-09 pulli extension, 2026-08-10 first sentence) — kept as the
 * historical record of why those specific words/sentence were chosen, which
 * is still exactly why they are still here.
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
    // ================= Letters: the complete alphabet =================
    // Extension, 2026-08-11 (tranche 2): the original six consonants (ka ta
    // na ma va pa) and two pulli marks taught NO vowel at all and only 6 of
    // 18 consonants. This tranche completes both — all 12 vowels plus the
    // āytham, and all 18 consonants in Siddalingaiah's own fixed
    // alphabetical order (ABC of Tamil, Lesson One for vowels, Lesson Two
    // for consonants) — mirroring the Sanskrit manifest's own tranche-2
    // reorganization: existing ids keep their id/text/gloss unchanged and
    // simply take their correct place in that order.
    //
    // Encoding note: the cached primer extraction (a 1968 PDF) uses a
    // non-Unicode, glyph-mapped font, so the raw text file contains Latin-1
    // placeholder codepoints standing in for Tamil letterforms, not Tamil
    // Unicode itself. Every glyph below was identified from its LETTER'S
    // fixed, unambiguous position in the standard 12-vowel/18-consonant
    // Tamil order — not decoded from that font mapping — and cross-checked
    // against two self-confirming clues the primer's own English prose
    // gives directly: it states its two vowel sounds absent from Sanskrit
    // are items 7 and 10 (which can only be short எ/ஒ), and that its final
    // consonant "is an alveolar sound" (which can only be ன) — the
    // identical evidentiary method this file's own pre-existing pulli
    // entries already relied on, not a new or lower bar.

    // --- The twelve vowels plus āytham, ABC of Tamil Lesson One ---
    { id: 'tam-letter-a', stage: 'letters', level: 1, text: 'அ', gloss: "a — as in 'but', 'cut', 'shut'", composedOf: [] },
    { id: 'tam-letter-aa', stage: 'letters', level: 1, text: 'ஆ', gloss: "ā — as in 'cot', 'pot'", composedOf: [] },
    { id: 'tam-letter-i', stage: 'letters', level: 1, text: 'இ', gloss: "i — as in 'tin', 'pin'", composedOf: [] },
    { id: 'tam-letter-ii', stage: 'letters', level: 1, text: 'ஈ', gloss: "ī — as in 'feet', 'sheet'", composedOf: [] },
    { id: 'tam-letter-u', stage: 'letters', level: 1, text: 'உ', gloss: "u — as in 'put', 'foot'", composedOf: [] },
    { id: 'tam-letter-uu', stage: 'letters', level: 1, text: 'ஊ', gloss: "ū — as in 'moon', 'mood'", composedOf: [] },
    {
      id: 'tam-letter-e',
      stage: 'letters',
      level: 1,
      // Lesson One's own note: its two vowel sounds absent from Sanskrit are
      // items 7 and 10 of the twelve — the fact that self-confirms this is
      // short e and not some other vowel.
      text: 'எ',
      gloss: "e — as in 'emit', 'emblem'; one of the two Tamil vowel sounds absent from Sanskrit",
      composedOf: [],
    },
    { id: 'tam-letter-ee', stage: 'letters', level: 1, text: 'ஏ', gloss: "ē — as in 'ape', 'mane'", composedOf: [] },
    { id: 'tam-letter-ai', stage: 'letters', level: 1, text: 'ஐ', gloss: "ai — as in 'idle', 'item'", composedOf: [] },
    {
      id: 'tam-letter-o',
      stage: 'letters',
      level: 1,
      // The other Sanskrit-absent sound — see tam-letter-e's comment.
      text: 'ஒ',
      gloss: "o — as in 'omit', 'opinion'; the other Tamil vowel sound absent from Sanskrit",
      composedOf: [],
    },
    { id: 'tam-letter-oo', stage: 'letters', level: 1, text: 'ஓ', gloss: "ō — as in 'show', 'coal'", composedOf: [] },
    { id: 'tam-letter-au', stage: 'letters', level: 1, text: 'ஔ', gloss: "au — as in 'fowl', 'now'", composedOf: [] },
    {
      id: 'tam-letter-aytham',
      stage: 'letters',
      level: 1,
      // A 13th letter Lesson One adds after its twelve vowels proper — a
      // fixed, unique grapheme, not part of either the vowel or consonant
      // set, so its identity is unambiguous regardless of the source font.
      text: 'ஃ',
      gloss: "āytham — pronounced almost like 'ach' in 'stomach'",
      composedOf: [],
    },

    // --- The eighteen consonants, ABC of Tamil Lesson Two, fixed alphabetical order ---
    { id: 'tam-letter-ka', stage: 'letters', level: 1, text: 'க', gloss: 'ka', composedOf: [] },
    { id: 'tam-letter-nga', stage: 'letters', level: 1, text: 'ங', gloss: "ṅa — the nasal sound in 'sing'", composedOf: [] },
    { id: 'tam-letter-ca', stage: 'letters', level: 1, text: 'ச', gloss: "ca — as 'ch' in 'chip', 'birch'", composedOf: [] },
    { id: 'tam-letter-nya', stage: 'letters', level: 1, text: 'ஞ', gloss: "ña — the nasal sound in 'ginger'", composedOf: [] },
    {
      id: 'tam-letter-tta',
      stage: 'letters',
      level: 1,
      // Retroflex ṭ — a different letter from த (dental ta, already taught)
      // — doubled "tt" in the id, mirroring tam-pulli-nna's own
      // retroflex-disambiguation convention.
      text: 'ட',
      gloss: "ṭa — retroflex t, as in 'cut', 'put'",
      composedOf: [],
    },
    {
      id: 'tam-letter-nna',
      stage: 'letters',
      level: 1,
      // The bare, inherent-vowel form of the consonant already taught only
      // as its dead form, tam-pulli-nna (ண்) below — Lesson Two's own
      // presentation teaches every consonant, this one included, with its
      // inherent vowel first ("the first vowel, Ü, is added to and
      // pronounced"), the pulli form being a second, separate grapheme
      // layered on top, not a substitute for this one.
      text: 'ண',
      gloss: "ṇa — retroflex n, the nasal sound in 'round'",
      composedOf: [],
    },
    { id: 'tam-letter-ta', stage: 'letters', level: 1, text: 'த', gloss: 'ta', composedOf: [] },
    { id: 'tam-letter-na', stage: 'letters', level: 1, text: 'ந', gloss: 'na', composedOf: [] },
    { id: 'tam-letter-pa', stage: 'letters', level: 1, text: 'ப', gloss: 'pa', composedOf: [] },
    { id: 'tam-letter-ma', stage: 'letters', level: 1, text: 'ம', gloss: 'ma', composedOf: [] },
    {
      id: 'tam-letter-ya',
      stage: 'letters',
      level: 1,
      // Bare consonant — previously only present fused inside tam-letter-yaa
      // (ய + ஆ) below. Lesson Two teaches it on its own too.
      text: 'ய',
      gloss: "ya — as in 'young'",
      composedOf: [],
    },
    {
      id: 'tam-letter-ra',
      stage: 'letters',
      level: 1,
      // Bare, inherent-vowel form — same reasoning as tam-letter-nna above,
      // for the consonant already taught only as its dead form tam-pulli-ra
      // (ர்) below.
      text: 'ர',
      gloss: "ra — as in 'rust', 'rum'",
      composedOf: [],
    },
    {
      id: 'tam-letter-la',
      stage: 'letters',
      level: 1,
      // Bare, inherent-vowel form — same reasoning as tam-letter-nna, for
      // the consonant already taught only as its dead form tam-pulli-la
      // (ல்) below.
      text: 'ல',
      gloss: "la — as in 'lump', 'lung'",
      composedOf: [],
    },
    { id: 'tam-letter-va', stage: 'letters', level: 1, text: 'வ', gloss: 'va', composedOf: [] },
    {
      id: 'tam-letter-zha',
      stage: 'letters',
      level: 1,
      // The retroflex approximant at the centre of "தமிழ்" (Tamil) itself —
      // no English equivalent (see tam-audio-htla's inAppNotes in
      // resources.ts for why this is the sound learners most often flatten
      // into a plain l).
      text: 'ழ',
      gloss: "ḻa — like the first syllable of French 'Jean'; transliterated 'zh' or 'l'",
      composedOf: [],
    },
    {
      id: 'tam-letter-lla',
      stage: 'letters',
      level: 1,
      // Retroflex l — a different letter from ல (la, above). Doubled "ll" in
      // the id, mirroring tam-letter-tta's own disambiguation.
      text: 'ள',
      gloss: "ḷa — retroflex l, as in 'pearl'",
      composedOf: [],
    },
    {
      id: 'tam-letter-rra',
      stage: 'letters',
      level: 1,
      // A trill/tap, not a retroflex — a different letter from ர (ra,
      // above). Doubled "rr" in the id for the same disambiguation reason.
      text: 'ற',
      gloss: "ṟa — as 'rrh' in 'catarrh'",
      composedOf: [],
    },
    {
      id: 'tam-letter-alveolar-na',
      stage: 'letters',
      level: 1,
      // Bare, inherent-vowel form of the consonant already taught only as
      // its dead form tam-pulli-alveolar-na (ன்) below — named
      // "alveolar-na", not bare "na", to stay distinct from already-taught
      // tam-letter-na (dental na, ந), mirroring that pulli entry's own id
      // choice. Position confirmed by Lesson Two's own "this is an alveolar
      // sound" remark, the identical self-confirming clue tam-pulli-alveolar
      // -na's existing comment already relies on.
      text: 'ன',
      gloss: "ṉa — alveolar n, as in 'nun'",
      composedOf: [],
    },

    // --- Vowel signs on க (ka), ABC of Tamil Lessons Three-Fifteen ---
    // Extension, 2026-08-12 (tranche 3), mirroring Sanskrit's own single-
    // consonant vowel-sign tranche: rather than all 18 consonants across all
    // 11 signs (198 entries), this teaches the full sign set on the one
    // consonant the primer itself always lists first (க) first, leaving the
    // other 17 consonants for a later tranche. That later tranche is
    // tranche 5 below, which completes 16 of those 17 unconditionally
    // (ங being the one the primer itself excludes) — not word-driven the
    // way this sentence originally framed it; see tranche 5's own block
    // comment.
    //
    // Each lesson gives its vowel-sign table as two columns of consonant
    // rows in the primer's own fixed order (க ங ச ஞ ட ண த ந ப ம ய ர ல வ ழ ள
    // ற ன — already taught above); க's row is always the first row of the
    // left column. The Tamil glyphs in the cached extraction are unreadable
    // (1968 font, non-Unicode — see the header comment on this file's
    // pre-existing entries), so identification rests on that fixed row
    // position plus the plain-ASCII transliteration syllable each row gives
    // in parentheses, both of which the extraction preserves legibly — the
    // same method already used for this file's own tam-letter-naa/-yaa.
    //
    // Short i (Lesson Four) and long ī (Lesson Five) both print the same
    // transliteration, "(ki)" — the OCR lost the macron for this one pair
    // only. Lesson One's own explicit numbered vowel list (Ü1 Ý2 Þ3 ß4 à5
    // á6 â7 ã8 ä9 å10 æ11 å÷12) settles it directly: Þ (i) is item 3, ß (ī)
    // is item 4, immediately after — not just the same short-before-long
    // pattern every other pair here follows (confirmed independently for
    // u/ū at Lessons Six/Seven, and stated outright in the prose for e/ē at
    // Lessons Nine/Ten: "the vowel 'â' (short)" vs "the vowel 'ã' (long)").
    { id: 'tam-letter-kaa', stage: 'letters', level: 1, text: 'கா', gloss: 'kā', composedOf: [] },
    { id: 'tam-letter-ki', stage: 'letters', level: 1, text: 'கி', gloss: 'ki', composedOf: [] },
    { id: 'tam-letter-kii', stage: 'letters', level: 1, text: 'கீ', gloss: 'kī', composedOf: [] },
    { id: 'tam-letter-ku', stage: 'letters', level: 1, text: 'கு', gloss: 'ku', composedOf: [] },
    { id: 'tam-letter-kuu', stage: 'letters', level: 1, text: 'கூ', gloss: 'kū', composedOf: [] },
    { id: 'tam-letter-ke', stage: 'letters', level: 1, text: 'கெ', gloss: 'ke', composedOf: [] },
    { id: 'tam-letter-kee', stage: 'letters', level: 1, text: 'கே', gloss: 'kē', composedOf: [] },
    { id: 'tam-letter-kai', stage: 'letters', level: 1, text: 'கை', gloss: 'kai', composedOf: [] },
    {
      id: 'tam-letter-ko',
      stage: 'letters',
      level: 1,
      // Lesson Thirteen, explicit: short 'o' has no separate sign of its
      // own — it is written as the short-e sign before the consonant AND
      // the ā sign after it, both at once. கொ is exactly that: ெ + ா.
      text: 'கொ',
      gloss: 'ko',
      composedOf: [],
    },
    {
      id: 'tam-letter-koo',
      stage: 'letters',
      level: 1,
      // Lesson Fourteen, explicit: long 'ō' is the same construction with
      // the long-e sign instead. கோ is ே + ா.
      text: 'கோ',
      gloss: 'kō',
      composedOf: [],
    },
    {
      id: 'tam-letter-kau',
      stage: 'letters',
      level: 1,
      // Lesson Fifteen: short-e sign before the consonant plus the au
      // length mark after — Wikner's Tamil counterpart here notes there are
      // "hardly half-a-dozen words" with this sound in the language at all.
      // The primer's own house style transliterates this row "kow", not
      // "kau" — kept as "kau" here to match this file's own pre-existing
      // tam-letter-au (bare ஔ), which already glosses it that way.
      text: 'கௌ',
      gloss: 'kau',
      composedOf: [],
    },

    // --- Vowel signs on the other 16 consonants, ABC of Tamil Lessons
    // Three-Fifteen (tranche 5) ---
    // Extension, 2026-08-12 (tranche 5): completes what tranche 3 deliberately
    // left partial — the same 11-sign table already taught on க, now for
    // every other consonant the primer actually teaches it for. Each lesson's
    // table (Lessons Three/Four/Five/Six/Seven/Nine/Ten/Eleven/Thirteen/
    // Fourteen for ā/i/ī/u/ū/e/ē/ai/o/ō, Lesson Fifteen for au) lists all 18
    // consonants in the primer's own fixed order in two columns of nine —
    // க's row (already taught) is always first; this tranche reads the
    // other 17 rows of each of those same 11 tables, identified the same way
    // க's row was: fixed row position plus the plain-ASCII transliteration
    // syllable each row gives in parentheses (the Tamil glyphs themselves
    // are unreadable in the cached 1968-font extraction — see this file's
    // header comment). Romanization below normalizes the primer's own
    // inconsistent bracket transliteration — which drops diacritics/macrons
    // in more places than just "chā"/"ţā"/"ņā"/"ļā"/bare-"lā"-for-ழ (that
    // same flattening recurs on ற (prints identically to ர's own bracket
    // text throughout, not just once), on ட/ண's ū-row ("tū"/"nū", no
    // cedilla), and on ன+ஆ specifically (Lesson Three's own bracket prints
    // bare "na", not "ṉā") — to this file's own established diacritic set
    // (cā, ṭā, ṇā, ḷā, ḻā, ṟā, ṉā), already used on every bare consonant's
    // gloss above and not a new convention. None of this is guesswork: every
    // row's IDENTITY is resolved from its fixed position in the primer's own
    // fixed 18-consonant order (see Lesson Two, cited in this file's header),
    // never from the bracket text alone, which is exactly what makes the
    // normalization safe even where the bracket itself is ambiguous or
    // flattened — confirmed by two independent adversarial verifiers
    // re-deriving all 167 entries below from the primer directly, not from
    // this comment. Short i/long ī (Lessons Four/Five) print the same
    // bracketed transliteration for every consonant, the identical
    // macron-loss already documented and resolved via lesson order for
    // க's own கி/கீ pair; the same resolution applies here, and recurs (same
    // resolution, same safety) in every other lesson in this range too.
    //
    // 17 consonants remained after க; only 16 of them get any of this table.
    // ங (ṅa) is explicitly excluded by the primer itself. Lesson Three's own
    // note, already quoted in this file's header for a different reason:
    // "the combination of ங் with other vowels need not be learnt" — ங
    // combines with a vowel-length sign so rarely that the primer says
    // not to bother teaching it. (Its dead/pulli form, ங், is not itself
    // taught in this file either — only the bare form, tam-letter-nga,
    // above; that is a separate, pre-existing gap, not something this
    // sentence should be read as claiming is already closed.) That ங's
    // exclusion here is not inference from the note alone:
    // ங's row is the ONLY one missing from every single one of Lessons
    // Four/Five/Six/Seven/Nine/Ten/Eleven/Thirteen/Fourteen — it appears
    // once, in Lesson Three's table, for structural completeness, not
    // because the form is real.
    //
    // Of the 16 consonants that do get a table, only 9 — ச/த/ந/ப/ம/ய/ர/ல/வ —
    // get the 11th (au) sign. Lesson Fifteen is explicit about why: "There
    // are hardly half-a-dozen words with 'ஔ' sound in Tamil. So there is no
    // necessity to study all the consonants with 'ஔ' combination" — and its
    // own table lists only those 9, not all 16 or 18. ஞ/ட/ண/ழ/ள/ற/ன's
    // au-forms are excluded for the same reason the primer excludes them:
    // they are not real Tamil.
    //
    // நா and யா (ந/ய + the ā sign) are not repeated here — already taught,
    // 2026-08-10, as tam-letter-naa/tam-letter-yaa below.

    // --- ச (ca) ---
    { id: 'tam-letter-caa', stage: 'letters', level: 1, text: 'சா', gloss: 'cā', composedOf: [] },
    { id: 'tam-letter-ci', stage: 'letters', level: 1, text: 'சி', gloss: 'ci', composedOf: [] },
    { id: 'tam-letter-cii', stage: 'letters', level: 1, text: 'சீ', gloss: 'cī', composedOf: [] },
    { id: 'tam-letter-cu', stage: 'letters', level: 1, text: 'சு', gloss: 'cu', composedOf: [] },
    { id: 'tam-letter-cuu', stage: 'letters', level: 1, text: 'சூ', gloss: 'cū', composedOf: [] },
    { id: 'tam-letter-ce', stage: 'letters', level: 1, text: 'செ', gloss: 'ce', composedOf: [] },
    { id: 'tam-letter-cee', stage: 'letters', level: 1, text: 'சே', gloss: 'cē', composedOf: [] },
    { id: 'tam-letter-cai', stage: 'letters', level: 1, text: 'சை', gloss: 'cai', composedOf: [] },
    { id: 'tam-letter-co', stage: 'letters', level: 1, text: 'சொ', gloss: 'co', composedOf: [] },
    { id: 'tam-letter-coo', stage: 'letters', level: 1, text: 'சோ', gloss: 'cō', composedOf: [] },
    { id: 'tam-letter-cau', stage: 'letters', level: 1, text: 'சௌ', gloss: 'cau', composedOf: [] },

    // --- ஞ (ña) — no au form, see block comment above ---
    { id: 'tam-letter-nyaa', stage: 'letters', level: 1, text: 'ஞா', gloss: 'ñā', composedOf: [] },
    { id: 'tam-letter-nyi', stage: 'letters', level: 1, text: 'ஞி', gloss: 'ñi', composedOf: [] },
    { id: 'tam-letter-nyii', stage: 'letters', level: 1, text: 'ஞீ', gloss: 'ñī', composedOf: [] },
    { id: 'tam-letter-nyu', stage: 'letters', level: 1, text: 'ஞு', gloss: 'ñu', composedOf: [] },
    { id: 'tam-letter-nyuu', stage: 'letters', level: 1, text: 'ஞூ', gloss: 'ñū', composedOf: [] },
    { id: 'tam-letter-nye', stage: 'letters', level: 1, text: 'ஞெ', gloss: 'ñe', composedOf: [] },
    { id: 'tam-letter-nyee', stage: 'letters', level: 1, text: 'ஞே', gloss: 'ñē', composedOf: [] },
    { id: 'tam-letter-nyai', stage: 'letters', level: 1, text: 'ஞை', gloss: 'ñai', composedOf: [] },
    { id: 'tam-letter-nyo', stage: 'letters', level: 1, text: 'ஞொ', gloss: 'ño', composedOf: [] },
    { id: 'tam-letter-nyoo', stage: 'letters', level: 1, text: 'ஞோ', gloss: 'ñō', composedOf: [] },

    // --- ட (ṭa) — no au form, see block comment above ---
    { id: 'tam-letter-ttaa', stage: 'letters', level: 1, text: 'டா', gloss: 'ṭā', composedOf: [] },
    { id: 'tam-letter-tti', stage: 'letters', level: 1, text: 'டி', gloss: 'ṭi', composedOf: [] },
    { id: 'tam-letter-ttii', stage: 'letters', level: 1, text: 'டீ', gloss: 'ṭī', composedOf: [] },
    { id: 'tam-letter-ttu', stage: 'letters', level: 1, text: 'டு', gloss: 'ṭu', composedOf: [] },
    { id: 'tam-letter-ttuu', stage: 'letters', level: 1, text: 'டூ', gloss: 'ṭū', composedOf: [] },
    { id: 'tam-letter-tte', stage: 'letters', level: 1, text: 'டெ', gloss: 'ṭe', composedOf: [] },
    { id: 'tam-letter-ttee', stage: 'letters', level: 1, text: 'டே', gloss: 'ṭē', composedOf: [] },
    { id: 'tam-letter-ttai', stage: 'letters', level: 1, text: 'டை', gloss: 'ṭai', composedOf: [] },
    { id: 'tam-letter-tto', stage: 'letters', level: 1, text: 'டொ', gloss: 'ṭo', composedOf: [] },
    { id: 'tam-letter-ttoo', stage: 'letters', level: 1, text: 'டோ', gloss: 'ṭō', composedOf: [] },

    // --- ண (ṇa) — no au form, see block comment above ---
    { id: 'tam-letter-nnaa', stage: 'letters', level: 1, text: 'ணா', gloss: 'ṇā', composedOf: [] },
    { id: 'tam-letter-nni', stage: 'letters', level: 1, text: 'ணி', gloss: 'ṇi', composedOf: [] },
    { id: 'tam-letter-nnii', stage: 'letters', level: 1, text: 'ணீ', gloss: 'ṇī', composedOf: [] },
    { id: 'tam-letter-nnu', stage: 'letters', level: 1, text: 'ணு', gloss: 'ṇu', composedOf: [] },
    { id: 'tam-letter-nnuu', stage: 'letters', level: 1, text: 'ணூ', gloss: 'ṇū', composedOf: [] },
    { id: 'tam-letter-nne', stage: 'letters', level: 1, text: 'ணெ', gloss: 'ṇe', composedOf: [] },
    { id: 'tam-letter-nnee', stage: 'letters', level: 1, text: 'ணே', gloss: 'ṇē', composedOf: [] },
    { id: 'tam-letter-nnai', stage: 'letters', level: 1, text: 'ணை', gloss: 'ṇai', composedOf: [] },
    { id: 'tam-letter-nno', stage: 'letters', level: 1, text: 'ணொ', gloss: 'ṇo', composedOf: [] },
    { id: 'tam-letter-nnoo', stage: 'letters', level: 1, text: 'ணோ', gloss: 'ṇō', composedOf: [] },

    // --- த (ta) ---
    { id: 'tam-letter-taa', stage: 'letters', level: 1, text: 'தா', gloss: 'tā', composedOf: [] },
    { id: 'tam-letter-ti', stage: 'letters', level: 1, text: 'தி', gloss: 'ti', composedOf: [] },
    { id: 'tam-letter-tii', stage: 'letters', level: 1, text: 'தீ', gloss: 'tī', composedOf: [] },
    { id: 'tam-letter-tu', stage: 'letters', level: 1, text: 'து', gloss: 'tu', composedOf: [] },
    { id: 'tam-letter-tuu', stage: 'letters', level: 1, text: 'தூ', gloss: 'tū', composedOf: [] },
    { id: 'tam-letter-te', stage: 'letters', level: 1, text: 'தெ', gloss: 'te', composedOf: [] },
    { id: 'tam-letter-tee', stage: 'letters', level: 1, text: 'தே', gloss: 'tē', composedOf: [] },
    { id: 'tam-letter-tai', stage: 'letters', level: 1, text: 'தை', gloss: 'tai', composedOf: [] },
    { id: 'tam-letter-to', stage: 'letters', level: 1, text: 'தொ', gloss: 'to', composedOf: [] },
    { id: 'tam-letter-too', stage: 'letters', level: 1, text: 'தோ', gloss: 'tō', composedOf: [] },
    { id: 'tam-letter-tau', stage: 'letters', level: 1, text: 'தௌ', gloss: 'tau', composedOf: [] },

    // --- ந (na) — ā-form already taught as tam-letter-naa ---
    { id: 'tam-letter-ni', stage: 'letters', level: 1, text: 'நி', gloss: 'ni', composedOf: [] },
    { id: 'tam-letter-nii', stage: 'letters', level: 1, text: 'நீ', gloss: 'nī', composedOf: [] },
    { id: 'tam-letter-nu', stage: 'letters', level: 1, text: 'நு', gloss: 'nu', composedOf: [] },
    { id: 'tam-letter-nuu', stage: 'letters', level: 1, text: 'நூ', gloss: 'nū', composedOf: [] },
    { id: 'tam-letter-ne', stage: 'letters', level: 1, text: 'நெ', gloss: 'ne', composedOf: [] },
    { id: 'tam-letter-nee', stage: 'letters', level: 1, text: 'நே', gloss: 'nē', composedOf: [] },
    { id: 'tam-letter-nai', stage: 'letters', level: 1, text: 'நை', gloss: 'nai', composedOf: [] },
    { id: 'tam-letter-no', stage: 'letters', level: 1, text: 'நொ', gloss: 'no', composedOf: [] },
    { id: 'tam-letter-noo', stage: 'letters', level: 1, text: 'நோ', gloss: 'nō', composedOf: [] },
    { id: 'tam-letter-nau', stage: 'letters', level: 1, text: 'நௌ', gloss: 'nau', composedOf: [] },

    // --- ப (pa) ---
    { id: 'tam-letter-paa', stage: 'letters', level: 1, text: 'பா', gloss: 'pā', composedOf: [] },
    { id: 'tam-letter-pi', stage: 'letters', level: 1, text: 'பி', gloss: 'pi', composedOf: [] },
    { id: 'tam-letter-pii', stage: 'letters', level: 1, text: 'பீ', gloss: 'pī', composedOf: [] },
    { id: 'tam-letter-pu', stage: 'letters', level: 1, text: 'பு', gloss: 'pu', composedOf: [] },
    { id: 'tam-letter-puu', stage: 'letters', level: 1, text: 'பூ', gloss: 'pū', composedOf: [] },
    { id: 'tam-letter-pe', stage: 'letters', level: 1, text: 'பெ', gloss: 'pe', composedOf: [] },
    { id: 'tam-letter-pee', stage: 'letters', level: 1, text: 'பே', gloss: 'pē', composedOf: [] },
    { id: 'tam-letter-pai', stage: 'letters', level: 1, text: 'பை', gloss: 'pai', composedOf: [] },
    { id: 'tam-letter-po', stage: 'letters', level: 1, text: 'பொ', gloss: 'po', composedOf: [] },
    { id: 'tam-letter-poo', stage: 'letters', level: 1, text: 'போ', gloss: 'pō', composedOf: [] },
    { id: 'tam-letter-pau', stage: 'letters', level: 1, text: 'பௌ', gloss: 'pau', composedOf: [] },

    // --- ம (ma) ---
    { id: 'tam-letter-maa', stage: 'letters', level: 1, text: 'மா', gloss: 'mā', composedOf: [] },
    { id: 'tam-letter-mi', stage: 'letters', level: 1, text: 'மி', gloss: 'mi', composedOf: [] },
    { id: 'tam-letter-mii', stage: 'letters', level: 1, text: 'மீ', gloss: 'mī', composedOf: [] },
    { id: 'tam-letter-mu', stage: 'letters', level: 1, text: 'மு', gloss: 'mu', composedOf: [] },
    { id: 'tam-letter-muu', stage: 'letters', level: 1, text: 'மூ', gloss: 'mū', composedOf: [] },
    { id: 'tam-letter-me', stage: 'letters', level: 1, text: 'மெ', gloss: 'me', composedOf: [] },
    { id: 'tam-letter-mee', stage: 'letters', level: 1, text: 'மே', gloss: 'mē', composedOf: [] },
    { id: 'tam-letter-mai', stage: 'letters', level: 1, text: 'மை', gloss: 'mai', composedOf: [] },
    { id: 'tam-letter-mo', stage: 'letters', level: 1, text: 'மொ', gloss: 'mo', composedOf: [] },
    { id: 'tam-letter-moo', stage: 'letters', level: 1, text: 'மோ', gloss: 'mō', composedOf: [] },
    { id: 'tam-letter-mau', stage: 'letters', level: 1, text: 'மௌ', gloss: 'mau', composedOf: [] },

    // --- ய (ya) — ā-form already taught as tam-letter-yaa ---
    { id: 'tam-letter-yi', stage: 'letters', level: 1, text: 'யி', gloss: 'yi', composedOf: [] },
    { id: 'tam-letter-yii', stage: 'letters', level: 1, text: 'யீ', gloss: 'yī', composedOf: [] },
    { id: 'tam-letter-yu', stage: 'letters', level: 1, text: 'யு', gloss: 'yu', composedOf: [] },
    { id: 'tam-letter-yuu', stage: 'letters', level: 1, text: 'யூ', gloss: 'yū', composedOf: [] },
    { id: 'tam-letter-ye', stage: 'letters', level: 1, text: 'யெ', gloss: 'ye', composedOf: [] },
    { id: 'tam-letter-yee', stage: 'letters', level: 1, text: 'யே', gloss: 'yē', composedOf: [] },
    { id: 'tam-letter-yai', stage: 'letters', level: 1, text: 'யை', gloss: 'yai', composedOf: [] },
    { id: 'tam-letter-yo', stage: 'letters', level: 1, text: 'யொ', gloss: 'yo', composedOf: [] },
    { id: 'tam-letter-yoo', stage: 'letters', level: 1, text: 'யோ', gloss: 'yō', composedOf: [] },
    { id: 'tam-letter-yau', stage: 'letters', level: 1, text: 'யௌ', gloss: 'yau', composedOf: [] },

    // --- ர (ra) ---
    { id: 'tam-letter-raa', stage: 'letters', level: 1, text: 'ரா', gloss: 'rā', composedOf: [] },
    { id: 'tam-letter-ri', stage: 'letters', level: 1, text: 'ரி', gloss: 'ri', composedOf: [] },
    { id: 'tam-letter-rii', stage: 'letters', level: 1, text: 'ரீ', gloss: 'rī', composedOf: [] },
    { id: 'tam-letter-ru', stage: 'letters', level: 1, text: 'ரு', gloss: 'ru', composedOf: [] },
    { id: 'tam-letter-ruu', stage: 'letters', level: 1, text: 'ரூ', gloss: 'rū', composedOf: [] },
    { id: 'tam-letter-re', stage: 'letters', level: 1, text: 'ரெ', gloss: 're', composedOf: [] },
    { id: 'tam-letter-ree', stage: 'letters', level: 1, text: 'ரே', gloss: 'rē', composedOf: [] },
    { id: 'tam-letter-rai', stage: 'letters', level: 1, text: 'ரை', gloss: 'rai', composedOf: [] },
    { id: 'tam-letter-ro', stage: 'letters', level: 1, text: 'ரொ', gloss: 'ro', composedOf: [] },
    { id: 'tam-letter-roo', stage: 'letters', level: 1, text: 'ரோ', gloss: 'rō', composedOf: [] },
    { id: 'tam-letter-rau', stage: 'letters', level: 1, text: 'ரௌ', gloss: 'rau', composedOf: [] },

    // --- ல (la) ---
    { id: 'tam-letter-laa', stage: 'letters', level: 1, text: 'லா', gloss: 'lā', composedOf: [] },
    { id: 'tam-letter-li', stage: 'letters', level: 1, text: 'லி', gloss: 'li', composedOf: [] },
    { id: 'tam-letter-lii', stage: 'letters', level: 1, text: 'லீ', gloss: 'lī', composedOf: [] },
    { id: 'tam-letter-lu', stage: 'letters', level: 1, text: 'லு', gloss: 'lu', composedOf: [] },
    { id: 'tam-letter-luu', stage: 'letters', level: 1, text: 'லூ', gloss: 'lū', composedOf: [] },
    { id: 'tam-letter-le', stage: 'letters', level: 1, text: 'லெ', gloss: 'le', composedOf: [] },
    { id: 'tam-letter-lee', stage: 'letters', level: 1, text: 'லே', gloss: 'lē', composedOf: [] },
    { id: 'tam-letter-lai', stage: 'letters', level: 1, text: 'லை', gloss: 'lai', composedOf: [] },
    { id: 'tam-letter-lo', stage: 'letters', level: 1, text: 'லொ', gloss: 'lo', composedOf: [] },
    { id: 'tam-letter-loo', stage: 'letters', level: 1, text: 'லோ', gloss: 'lō', composedOf: [] },
    { id: 'tam-letter-lau', stage: 'letters', level: 1, text: 'லௌ', gloss: 'lau', composedOf: [] },

    // --- வ (va) ---
    { id: 'tam-letter-vaa', stage: 'letters', level: 1, text: 'வா', gloss: 'vā', composedOf: [] },
    { id: 'tam-letter-vi', stage: 'letters', level: 1, text: 'வி', gloss: 'vi', composedOf: [] },
    { id: 'tam-letter-vii', stage: 'letters', level: 1, text: 'வீ', gloss: 'vī', composedOf: [] },
    { id: 'tam-letter-vu', stage: 'letters', level: 1, text: 'வு', gloss: 'vu', composedOf: [] },
    { id: 'tam-letter-vuu', stage: 'letters', level: 1, text: 'வூ', gloss: 'vū', composedOf: [] },
    { id: 'tam-letter-ve', stage: 'letters', level: 1, text: 'வெ', gloss: 've', composedOf: [] },
    { id: 'tam-letter-vee', stage: 'letters', level: 1, text: 'வே', gloss: 'vē', composedOf: [] },
    { id: 'tam-letter-vai', stage: 'letters', level: 1, text: 'வை', gloss: 'vai', composedOf: [] },
    { id: 'tam-letter-vo', stage: 'letters', level: 1, text: 'வொ', gloss: 'vo', composedOf: [] },
    { id: 'tam-letter-voo', stage: 'letters', level: 1, text: 'வோ', gloss: 'vō', composedOf: [] },
    { id: 'tam-letter-vau', stage: 'letters', level: 1, text: 'வௌ', gloss: 'vau', composedOf: [] },

    // --- ழ (ḻa) — no au form, see block comment above ---
    { id: 'tam-letter-zhaa', stage: 'letters', level: 1, text: 'ழா', gloss: 'ḻā', composedOf: [] },
    { id: 'tam-letter-zhi', stage: 'letters', level: 1, text: 'ழி', gloss: 'ḻi', composedOf: [] },
    { id: 'tam-letter-zhii', stage: 'letters', level: 1, text: 'ழீ', gloss: 'ḻī', composedOf: [] },
    { id: 'tam-letter-zhu', stage: 'letters', level: 1, text: 'ழு', gloss: 'ḻu', composedOf: [] },
    { id: 'tam-letter-zhuu', stage: 'letters', level: 1, text: 'ழூ', gloss: 'ḻū', composedOf: [] },
    { id: 'tam-letter-zhe', stage: 'letters', level: 1, text: 'ழெ', gloss: 'ḻe', composedOf: [] },
    { id: 'tam-letter-zhee', stage: 'letters', level: 1, text: 'ழே', gloss: 'ḻē', composedOf: [] },
    { id: 'tam-letter-zhai', stage: 'letters', level: 1, text: 'ழை', gloss: 'ḻai', composedOf: [] },
    { id: 'tam-letter-zho', stage: 'letters', level: 1, text: 'ழொ', gloss: 'ḻo', composedOf: [] },
    { id: 'tam-letter-zhoo', stage: 'letters', level: 1, text: 'ழோ', gloss: 'ḻō', composedOf: [] },

    // --- ள (ḷa) — no au form, see block comment above ---
    { id: 'tam-letter-llaa', stage: 'letters', level: 1, text: 'ளா', gloss: 'ḷā', composedOf: [] },
    { id: 'tam-letter-lli', stage: 'letters', level: 1, text: 'ளி', gloss: 'ḷi', composedOf: [] },
    { id: 'tam-letter-llii', stage: 'letters', level: 1, text: 'ளீ', gloss: 'ḷī', composedOf: [] },
    { id: 'tam-letter-llu', stage: 'letters', level: 1, text: 'ளு', gloss: 'ḷu', composedOf: [] },
    { id: 'tam-letter-lluu', stage: 'letters', level: 1, text: 'ளூ', gloss: 'ḷū', composedOf: [] },
    { id: 'tam-letter-lle', stage: 'letters', level: 1, text: 'ளெ', gloss: 'ḷe', composedOf: [] },
    { id: 'tam-letter-llee', stage: 'letters', level: 1, text: 'ளே', gloss: 'ḷē', composedOf: [] },
    { id: 'tam-letter-llai', stage: 'letters', level: 1, text: 'ளை', gloss: 'ḷai', composedOf: [] },
    { id: 'tam-letter-llo', stage: 'letters', level: 1, text: 'ளொ', gloss: 'ḷo', composedOf: [] },
    { id: 'tam-letter-lloo', stage: 'letters', level: 1, text: 'ளோ', gloss: 'ḷō', composedOf: [] },

    // --- ற (ṟa) — no au form, see block comment above ---
    { id: 'tam-letter-rraa', stage: 'letters', level: 1, text: 'றா', gloss: 'ṟā', composedOf: [] },
    { id: 'tam-letter-rri', stage: 'letters', level: 1, text: 'றி', gloss: 'ṟi', composedOf: [] },
    { id: 'tam-letter-rrii', stage: 'letters', level: 1, text: 'றீ', gloss: 'ṟī', composedOf: [] },
    { id: 'tam-letter-rru', stage: 'letters', level: 1, text: 'று', gloss: 'ṟu', composedOf: [] },
    { id: 'tam-letter-rruu', stage: 'letters', level: 1, text: 'றூ', gloss: 'ṟū', composedOf: [] },
    { id: 'tam-letter-rre', stage: 'letters', level: 1, text: 'றெ', gloss: 'ṟe', composedOf: [] },
    { id: 'tam-letter-rree', stage: 'letters', level: 1, text: 'றே', gloss: 'ṟē', composedOf: [] },
    { id: 'tam-letter-rrai', stage: 'letters', level: 1, text: 'றை', gloss: 'ṟai', composedOf: [] },
    { id: 'tam-letter-rro', stage: 'letters', level: 1, text: 'றொ', gloss: 'ṟo', composedOf: [] },
    { id: 'tam-letter-rroo', stage: 'letters', level: 1, text: 'றோ', gloss: 'ṟō', composedOf: [] },

    // --- ன (ṉa) — no au form, see block comment above ---
    { id: 'tam-letter-alveolar-naa', stage: 'letters', level: 1, text: 'னா', gloss: 'ṉā', composedOf: [] },
    { id: 'tam-letter-alveolar-ni', stage: 'letters', level: 1, text: 'னி', gloss: 'ṉi', composedOf: [] },
    { id: 'tam-letter-alveolar-nii', stage: 'letters', level: 1, text: 'னீ', gloss: 'ṉī', composedOf: [] },
    { id: 'tam-letter-alveolar-nu', stage: 'letters', level: 1, text: 'னு', gloss: 'ṉu', composedOf: [] },
    { id: 'tam-letter-alveolar-nuu', stage: 'letters', level: 1, text: 'னூ', gloss: 'ṉū', composedOf: [] },
    { id: 'tam-letter-alveolar-ne', stage: 'letters', level: 1, text: 'னெ', gloss: 'ṉe', composedOf: [] },
    { id: 'tam-letter-alveolar-nee', stage: 'letters', level: 1, text: 'னே', gloss: 'ṉē', composedOf: [] },
    { id: 'tam-letter-alveolar-nai', stage: 'letters', level: 1, text: 'னை', gloss: 'ṉai', composedOf: [] },
    { id: 'tam-letter-alveolar-no', stage: 'letters', level: 1, text: 'னொ', gloss: 'ṉo', composedOf: [] },
    { id: 'tam-letter-alveolar-noo', stage: 'letters', level: 1, text: 'னோ', gloss: 'ṉō', composedOf: [] },

    // --- Pre-existing dead (pulli) and bound-vowel-sign forms, unchanged ---
    {
      id: 'tam-pulli-nna',
      stage: 'letters',
      level: 1,
      text: 'ண்',
      // Retroflex ṇ — a different letter from ந (dental na) already taught
      // above, not a variant spelling of it.
      gloss: 'ṇ — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-pulli-la',
      stage: 'letters',
      level: 1,
      text: 'ல்',
      gloss: 'l — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },

    // --- Extension, 2026-08-10: the letters நான் யார் needs beyond the above ---
    {
      id: 'tam-letter-naa',
      stage: 'letters',
      level: 1,
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
      id: 'tam-pulli-alveolar-na',
      stage: 'letters',
      level: 1,
      // Alveolar ṉ — a different letter from ந (dental na) and ண் (retroflex
      // ṇ, already taught above), even though ந/ன carry no audible
      // distinction in modern spoken Tamil (the primer still lists them as
      // separate graphemes, which is what matters for reading/writing).
      // Named 'alveolar-na' rather than the bare 'na' that already-taught
      // tam-letter-na uses, mirroring tam-pulli-nna's own doubled-consonant
      // disambiguation for the same reason — an id that reads like a dead
      // form of an unrelated already-taught letter is exactly the kind of
      // mistake a future word could silently make.
      text: 'ன்',
      gloss: 'ṉ — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-letter-yaa',
      stage: 'letters',
      level: 1,
      // ய (ya) + the vowel sign for ஆ (long ā). Lesson Three's combination
      // table: "ய் + ஆ = யா (yā)".
      text: 'யா',
      gloss: 'yā',
      composedOf: [],
    },
    {
      id: 'tam-pulli-ra',
      stage: 'letters',
      level: 1,
      text: 'ர்',
      gloss: 'r — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-pulli-ma',
      stage: 'letters',
      level: 1,
      // Not part of the original pulli set — added later (tranche 6), the
      // same rule tam-letter-naa/skt-letter-vri were added under: ம் is
      // needed only because உம் (tam-word-um, below) needs it. ABC of Tamil
      // Lesson Twelve's own examples spell it exactly this way, e.g.
      // "èí¢ + í¢ + àñ¢ = èí¢µñ¢" (kaṇ + ṇ + um = kaṇṇum), where உம் itself
      // is written உ + ம் (bare u vowel, then dead ma).
      text: 'ம்',
      gloss: 'm — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-pulli-ya',
      stage: 'letters',
      level: 1,
      // Also new (tranche 6), same reasoning as tam-pulli-ma above: needed
      // because நீயும் (tam-word-niiyum, below) needs it. ABC of Tamil
      // Lesson Twelve names this exact medial consonant by name (line 1028:
      // "ï¦ + ò¢ + àñ¢ = ï¦»ñ¢" — nī + y + um = nīyum).
      text: 'ய்',
      gloss: 'y — dead consonant (no vowel), used at the end of a word',
      composedOf: [],
    },
    {
      id: 'tam-pulli-ka',
      stage: 'letters',
      level: 1,
      // New (tranche 9): needed because யாருக்கு (tam-word-yaarukku, below)
      // needs it. ABC of Tamil Lesson Twenty's own dative examples spell
      // the "kku" suffix exactly this way — a doubled dead-க் followed by
      // கு (e.g. line 1843-1844: "ò£ó¢+°=...=ò£¼è¢°" — yār + ku = yār + u
      // + k + ku = yārukku).
      text: 'க்',
      // Not "used at the end of a word" — every other pulli letter in this
      // file uses that phrase, but it isn't accurate here: this one sits
      // medially in its own first use (யாருக்கு, between ரு and கு), not
      // word-finally. Described more generally instead of repeating a
      // claim this specific letter doesn't fit.
      gloss: 'k — dead consonant (no vowel)',
      composedOf: [],
    },

    {
      id: 'tam-word-kan',
      stage: 'words',
      level: 2,
      text: 'கண்',
      gloss: 'kaṇ — eye',
      composedOf: ['tam-letter-ka', 'tam-pulli-nna'],
    },
    {
      id: 'tam-word-kal',
      stage: 'words',
      level: 2,
      text: 'கல்',
      gloss: 'kal — stone',
      composedOf: ['tam-letter-ka', 'tam-pulli-la'],
    },
    {
      id: 'tam-word-man',
      stage: 'words',
      level: 2,
      text: 'மண்',
      gloss: 'maṇ — earth, soil',
      composedOf: ['tam-letter-ma', 'tam-pulli-nna'],
    },
    {
      id: 'tam-word-pal',
      stage: 'words',
      level: 2,
      text: 'பல்',
      gloss: 'pal — tooth',
      composedOf: ['tam-letter-pa', 'tam-pulli-la'],
    },

    {
      id: 'tam-word-naan',
      stage: 'words',
      level: 2,
      text: 'நான்',
      gloss: 'nān — I',
      composedOf: ['tam-letter-naa', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-word-yaar',
      stage: 'words',
      level: 2,
      text: 'யார்',
      gloss: 'yār — who?',
      composedOf: ['tam-letter-yaa', 'tam-pulli-ra'],
    },

    {
      id: 'tam-sentence-naan-yaar',
      stage: 'sentences',
      level: 2,
      // Not assembled from separately-sourced words — the primer's own next
      // line after teaching நான் and யார், quoted exactly as printed (see
      // file header for its own inconsistent punctuation on this page).
      // Tamil equational sentences take no copula, so the two words
      // juxtaposed already form the complete sentence.
      //
      // composedOf is two WORDS (see Curriculum.ts's JOINER for how a
      // sentence's text is required to reconstruct from them).
      text: 'நான் யார்',
      gloss: 'nān yār — who am I? (lit. "I who?")',
      composedOf: ['tam-word-naan', 'tam-word-yaar'],
    },

    // ================= Conjunction rules (level 3) =================
    // Extension, 2026-08-12 (tranche 6): the Tamil half of the plan doc's
    // "what's next" item 2, unblocked by Curriculum.ts's new `sandhiRule`
    // field — see that field's own comment, and skt-sentence-naro-vadati's
    // comment in sanskrit.ts, for why an engine change was needed first.
    // All of this is ABC of Tamil, Lesson Twelve ("Conjunction"), lines
    // 950-1064 of the cached extraction: the enclitic உம் ("and"/"too"),
    // added to every word in a list rather than placed once between two
    // words the way English "and" is.
    //
    // உம் itself is not in the primer's own list of words that already need
    // it — it's the suffix Lesson Twelve's whole rule set is about — so it
    // is taught here as its own atomic word (உ + ம், both already-taught
    // atomic sounds), then reused, unlike every previous tranche's new
    // vocabulary. Its own text reconstructs by plain concatenation, no
    // sandhiRule needed.
    {
      id: 'tam-word-um',
      stage: 'words',
      level: 3,
      text: 'உம்',
      gloss: 'um — "and" / "too", attached to every word in a list (never a standalone word)',
      composedOf: ['tam-letter-u', 'tam-pulli-ma'],
    },
    // Lesson Twelve's Rule I: a two-letter word with a short vowel first and
    // a single final consonant doubles that consonant before உம். The
    // primer's own worked example (line 985): "èí¢ (eye) + àñ¢= èí¢ + (í¢)
    // àñ¢ = èí¢µñ¢" — kaṇ + um = kaṇ + ṇ + um = kaṇṇum. கண் is already
    // taught (tam-word-kan, spelled the same two letters below); the
    // doubled ண் is the SAME already-taught dead-consonant letter
    // (tam-pulli-nna) reused twice, not a new one. `composedOf` must be the
    // letters this word is built from (words compose only from `letters` —
    // see `Curriculum.ts`'s `prerequisiteStage`), so it repeats
    // tam-word-kan's own two letters rather than referencing that word
    // directly.
    //
    // sandhiRule is still required, though: the doubled ண், a dead
    // consonant, is immediately followed by உ (உம்'s own leading vowel), so
    // it fuses into ணு the same way ய் does in நீயும் below — plain
    // concatenation of the five letters gives கண்ண்உம், not the real
    // கண்ணும்.
    {
      id: 'tam-word-kannum',
      stage: 'words',
      level: 3,
      text: 'கண்ணும்',
      gloss: 'kaṇṇum — and (the) eye(s) too',
      composedOf: ['tam-letter-ka', 'tam-pulli-nna', 'tam-pulli-nna', 'tam-letter-u', 'tam-pulli-ma'],
      sandhiRule:
        'The doubled ண் (Lesson Twelve, Rule I) is a dead consonant immediately followed by a vowel-initial suffix (உம்), so it fuses into ணு instead of staying separate — கண் + ண் + உம் surfaces as கண்ணும், not கண்ண்உம்.',
    },
    // Lesson Twelve's Rule III (lines 1022-1042): a word ending in a vowel
    // takes a medial consonant (ய் or வ்) before உம். The primer's own
    // worked example (line 1028): "ï¦ (you-singular) + àñ¢ > ï¦ + ò¢ + àñ¢
    // = ï¦»ñ¢" — nī + um = nī + y + um = nīyum. நீ is already taught
    // (tam-letter-nii, from tranche 5's vowel-sign table — and Lesson
    // Five's own vocabulary independently confirms நீ as the real word
    // "you", singular, line 538: "ï¦ - (ni) - you (singular)").
    //
    // sandhiRule is required here, not optional: ய் (the medial consonant)
    // immediately followed by உ (உம்'s own first letter) does not stay two
    // separate glyphs — ய dead-marked (ய்) plus a following vowel takes
    // that vowel's sign instead, the same mechanism that makes vowel-sign
    // letters (கா, கி, ...) exist at all. நீ + உம், even with the medial ய்
    // Lesson Twelve names, does not concatenate to "நீய்உம்" — it surfaces
    // as நீயும் (ய + the ு vowel sign, not ய் + உ as separate letters).
    {
      id: 'tam-word-niiyum',
      stage: 'words',
      level: 3,
      text: 'நீயும்',
      gloss: 'nīyum — you too / and you',
      // Letters, not words (same reason as tam-word-kannum above): நீ plus
      // உம்'s own two letters, plus the medial ய் Rule III names — even
      // though sandhiRule below exempts this lesson from needing the exact
      // reconstruction those letters would otherwise have to produce.
      composedOf: ['tam-letter-nii', 'tam-pulli-ya', 'tam-letter-u', 'tam-pulli-ma'],
      sandhiRule:
        'Lesson Twelve, Rule III: a vowel-final word takes a medial consonant (here ய்) before உம். That medial consonant then combines with உம்\'s own leading vowel the same way any dead consonant does — நீ + ய் + உம் surfaces as நீயும் (ய + the ு vowel sign), not as the separate letters ய் and உ side by side.',
    },
    // நான் already ends in a dead consonant (ன், not a vowel), so Rule III
    // above does not literally apply — no medial letter is inserted, and no
    // Rule IV is ever named for this case. But the same general fact still
    // holds: a dead consonant immediately followed by a vowel-initial
    // suffix takes that vowel's sign rather than staying dead, so நான் +
    // உம் still does not concatenate to "நான்உம்". This is not inferred:
    // the primer's own translation exercise (line 1061, "Translate into
    // English: 1. ï¦»ñ¢ ï£Âñ¢") uses நீயும் நானும் as the Tamil PROMPT to be
    // translated (not a shown answer — the primer never prints the English
    // side of this one) — but the Tamil string itself is real, printed
    // text, which is what confirms நானும் as the actual correct surface
    // form, one inferential step more indirect than tam-word-kannum/
    // tam-word-niiyum's own named-rule citations above, and flagged as such.
    {
      id: 'tam-word-naanum',
      stage: 'words',
      level: 3,
      text: 'நானும்',
      gloss: 'nāṉum — I too / and I',
      // Letters, not words — நான்'s own two letters (the same ones
      // tam-word-naan is built from) plus உம்'s own two letters.
      composedOf: ['tam-letter-naa', 'tam-pulli-alveolar-na', 'tam-letter-u', 'tam-pulli-ma'],
      sandhiRule:
        'A dead consonant (ன், already dead in நான்) immediately followed by a vowel-initial suffix takes that vowel\'s sign instead of staying dead — நான் + உம் surfaces as நானும் (ன + the ு vowel sign), not as the separate letters ன் and உ side by side. Confirmed directly by the primer\'s own printed exercise answer, not inferred from the rule alone.',
    },
    {
      id: 'tam-sentence-niiyum-naanum',
      stage: 'sentences',
      level: 3,
      // ABC of Tamil, Lesson Twelve, line 1061 — the primer's own printed
      // answer to "Translate into English: 1. ï¦»ñ¢ ï£Âñ¢", not a sentence
      // assembled here from separately-sourced words. Both words above are
      // already fully-formed surface strings (their own sandhiRule already
      // accounts for the suffix fusion), so joining them with a single
      // space needs no further sandhi — ordinary reconstruction applies,
      // same as every other sentence in this file.
      text: 'நீயும் நானும்',
      gloss: 'nīyum nāṉum — you and I (lit. "you too, I too")',
      composedOf: ['tam-word-niiyum', 'tam-word-naanum'],
    },

    // ================= Present tense (level 3) =================
    // Extension, 2026-08-12 (tranche 7): the plan doc's next backlog item
    // after conjunction rules — the real prerequisite for expert-tier
    // reading, per that plan's own research (Thirukkural 1, checked
    // word-by-word, failed entirely on missing verb conjugation, not
    // vocabulary). ABC of Tamil, Lesson Seventeen ("Tenses - Present"),
    // lines 1324-1465: a finite verb has three parts — root, tense symbol
    // (இக்கிறு/கின்று, either may be used), and personal suffix.
    //
    // Every letter this needs — செ, ய், கி, றே, ன் — is already taught:
    // கி from tranche 3's க vowel-sign table, செ and றே from tranche 5's
    // completion of the other consonants' tables (ச and ற respectively),
    // ய்/ன் from tranche 6. Zero new letters, unlike Sanskrit's own half of
    // this pass.
    {
      id: 'tam-word-sey',
      stage: 'words',
      level: 2,
      // Lesson Nine's own vocabulary (already cited elsewhere in this
      // file): செய் - chey - "to do". The bare root, not yet conjugated.
      text: 'செய்',
      gloss: 'sey — to do (verb root)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya'],
    },
    {
      id: 'tam-word-seykirren',
      stage: 'words',
      level: 3,
      // Lesson Seventeen's own worked example, line 1388: செய் = to do;
      // நான் செய்+கிறு+ஏன்=நான் செய்கிறேன்=I do — root செய் + tense symbol
      // கிறு + 1st-person-singular personal suffix ஏன், the primer's own
      // worked fusion (line 1383-1385) collapsing கிறு's short உ into the
      // personal suffix's long ஏ: செய் + கிறு + ஏன் → செய்கிறேன்.
      //
      // No sandhiRule needed: கி (already an atomic letter) + றே (already
      // an atomic letter, ற + the ே sign) + ன் (already atomic) concatenate
      // to exactly கிறேன் — the fusion Lesson Seventeen describes already
      // happened when this file's own vowel-sign tranche taught றே as one
      // unit, not two.
      text: 'செய்கிறேன்',
      gloss: 'seykiṟēṉ — I do (1st person singular, present)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rree', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-sentence-naan-seykirren',
      stage: 'sentences',
      level: 3,
      // Lesson Seventeen's own worked sentence (line 1388), with நான்
      // (already taught) as the explicit subject the primer's own example
      // uses ("I do" — the pronoun is also spelled out, not implied, since
      // Lesson Seventeen introduces it that way before the personal-suffix
      // system alone would let a learner drop it).
      text: 'நான் செய்கிறேன்',
      gloss: 'nāṉ seykiṟēṉ — I do',
      composedOf: ['tam-word-naan', 'tam-word-seykirren'],
    },

    // ================= A first case: accusative (level 3) =================
    // Extension, 2026-08-12 (tranche 8): one more slice of the plan doc's
    // "more case morphology" item — Tamil's own first case suffix, ஐ
    // (accusative), ABC of Tamil Lesson Nineteen, lines 1578-1821.
    //
    // Lesson Nineteen's own worked examples (line 1748, its consonant-
    // doubling sub-rule, the same rule already proven for உம் in tranche
    // 6's கண்ணும்): "èí¢ = an eye èí¢ + ä = èí¢ + (í¢)ä = èí¢¬í" — kaṇ + ai
    // = kaṇ + ṇ + ai = kaṇṇai. கண் is already taught (tam-word-kan). ணை
    // (ṇa + the ai vowel sign) is already an atomic letter, from tranche
    // 5's ண vowel-sign table — so, like tranche 7's Tamil half, this ships
    // with zero new letters.
    {
      id: 'tam-word-kannai',
      stage: 'words',
      // Level 3, same reasoning as the Sanskrit case-form words above: a
      // grammatical category (direct object marking), not new vocabulary —
      // கண் itself is already taught at level 2.
      level: 3,
      text: 'கண்ணை',
      gloss: 'kaṇṇai — eye (accusative, direct object)',
      composedOf: ['tam-letter-ka', 'tam-pulli-nna', 'tam-letter-nnai'],
    },
    {
      id: 'tam-word-pallai',
      stage: 'words',
      level: 3,
      // Line 1752, the same consonant-doubling sub-rule: "ðô¢ = a tooth
      // ðô¢ + ä = ðô¢ + (í¢)ä = ðô¢¬ô" — pal + ai = pal + l + ai = pallai.
      // பல் is already taught (tam-word-pal). லை (la + the ai vowel sign)
      // is already an atomic letter, from tranche 5's ல vowel-sign table.
      text: 'பல்லை',
      gloss: 'pallai — tooth (accusative, direct object)',
      composedOf: ['tam-letter-pa', 'tam-pulli-la', 'tam-letter-lai'],
    },

    // ================= A second case: dative (level 3) =================
    // Extension, 2026-08-12 (tranche 9): Tamil's second case, dative (the
    // "fourth case", symbol கு/க்கு), ABC of Tamil Lesson Twenty, lines
    // 1822-1941.
    //
    // Lesson Twenty's own worked example for யார் specifically (line
    // 1843-1844): "ò£ó¢ +°= ò£ó¢ +à(è¢)+°= ò£¼è¢°= to whom" — yār + ku =
    // yār + u + k + ku = yārukku. யார் is already taught (tam-word-yaar).
    // ரு (ra + the u vowel sign) is already an atomic letter, from tranche
    // 5's ர vowel-sign table — using it directly (rather than decomposing
    // to the dead ர் + bare உ) is what lets plain concatenation reach the
    // real spelling: a dead consonant immediately followed by a vowel
    // always fuses into consonant+vowel-sign (the same fact tranche 6's
    // sandhiRule comments on நீயும்/நானும் explain), so decomposing to
    // ர்+உ would need a sandhiRule this way round doesn't.
    {
      id: 'tam-word-yaarukku',
      stage: 'words',
      level: 3,
      text: 'யாருக்கு',
      gloss: 'yārukku — to whom',
      composedOf: ['tam-letter-yaa', 'tam-letter-ru', 'tam-pulli-ka', 'tam-letter-ku'],
    },

    // ================= A third case: genitive (level 3) =================
    // Extension, 2026-08-12 (tranche 10): Tamil's third case, genitive (the
    // "sixth case", symbol உடைய), ABC of Tamil Lesson Twenty-One, lines
    // 2039-2138.
    //
    // Lesson Twenty-One's own opening line (2042-2043): "Genitive case...
    // has two symbols, 'அது' and 'உடைய'. 'உடைய' is used more frequently."
    // யார் (already taught, tam-word-yaar) is not a personal pronoun, so
    // none of this lesson's pronoun-mutation sub-rules (நான்→என், etc.)
    // apply — it takes உடைய directly, the same way this lesson's own
    // -ம்-ending nouns (மரம், "of the tree") take it once their own
    // insertion rule is done. Plain concatenation: யார் + உடைய = யாருடைய.
    //
    // ரு (already an atomic letter, reused from tranche 9's யாருக்கு for
    // the same reason — a dead consonant immediately followed by a vowel
    // fuses, so using the pre-fused letter directly avoids needing a
    // sandhiRule here too) + டை (ட + the ai vowel sign, tranche 5) + ய
    // (already taught, tam-letter-ya, bare ய).
    {
      id: 'tam-word-yaarudaiya',
      stage: 'words',
      level: 3,
      text: 'யாருடைய',
      gloss: 'yāruṭaiya — whose',
      composedOf: ['tam-letter-yaa', 'tam-letter-ru', 'tam-letter-ttai', 'tam-letter-ya'],
    },

    // ================= Pivot: a second person (level 2-3) =================
    // Extension, 2026-08-12 (tranche 11): tranches 8-10 added a case each,
    // but re-testing against Thirukkural 1 after all three showed no real
    // progress — that verse's actual blocker is verb-derived morphology
    // and vocabulary breadth, not case coverage. This tranche pivots
    // toward a second grammatical person for a verb already taught (this
    // file's first person other than 1st), the same shift Sanskrit's own
    // tranche-11 half makes.
    //
    // ABC of Tamil Lesson Seventeen's own person table (line 1440, the
    // same lesson tam-word-seykirren already cites): "அவன் செய்கிறான் -
    // He does (singular-masculine)". அவன் ("he") is not yet taught.
    {
      id: 'tam-word-avan',
      stage: 'words',
      level: 2,
      text: 'அவன்',
      gloss: 'avan — he',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-pulli-alveolar-na'],
    },
    // Same tense-symbol + personal-suffix fusion already established for
    // செய்கிறேன் (tam-word-seykirren) — here with ஆன் (3rd person singular
    // masculine) instead of ஏன் (1st person singular): செய் + கிறு + ஆன் →
    // செய்கிறான். றா (already an atomic letter, ற + the ā vowel sign,
    // tranche 5) plays the same role றே played for கிறேன் — plain
    // concatenation of already-taught letters reaches the real spelling
    // directly, no sandhiRule needed.
    {
      id: 'tam-word-seykirraan',
      stage: 'words',
      level: 3,
      text: 'செய்கிறான்',
      gloss: 'seykiṟāṉ — he does (3rd person singular masculine, present)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rraa', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-sentence-avan-seykirraan',
      stage: 'sentences',
      level: 3,
      // Lesson Seventeen's own worked sentence (line 1440), the 3rd-person
      // masculine counterpart to tam-sentence-naan-seykirren above.
      text: 'அவன் செய்கிறான்',
      gloss: 'avan seykiṟāṉ — he does',
      composedOf: ['tam-word-avan', 'tam-word-seykirraan'],
    },

    // ================= Past tense (level 3) =================
    // Extension, 2026-08-12 (tranche 12): ABC of Tamil, Book One (this
    // file's only source through tranche 11) ends at Lesson Twenty-One
    // (genitive case) and never reaches past or future tense — confirmed
    // by reading the primer's own remaining pages, not assumed. This
    // tranche's past-tense content is sourced instead from M.S. Andronov,
    // *A Grammar of Modern and Classical Tamil* (1989) — see this file's
    // header and `resources.ts`'s new `tam-andronov-grammar` entry for the
    // citation and why it's the right next source (checked, not just
    // convenient: Wikibooks Tamil's own "Grammar" and "Advanced topics"
    // pages are unwritten redlinks, already noted in this app's own
    // resources catalogue).
    //
    // Andronov, p.147 (archive.org text line ~12013-12023): "In the past
    // tense the suffix -een is used in forms derived by the suffixes
    // [-t(t)-/-nt-/-in-, per the OCR-legible parallel passage for -aan
    // below, line ~12723 — the extraction is garbled at this exact spot,
    // legible only as "-i-"]... e.g., ceytal 'to do' - ceyteen 'I did'."
    // செய் (already taught, tam-word-sey) + the past-tense -த- marker +
    // the same -ேன் (1st person singular) personal suffix already
    // established for present tense (செய்கிறேன்) — Tamil's personal
    // endings are shared across tenses; only the tense marker before them
    // changes.
    {
      id: 'tam-word-seytheen',
      stage: 'words',
      level: 3,
      // தே (already an atomic letter, த + the ē vowel sign, tranche 5)
      // plays the same role it always does — plain concatenation of
      // already-taught letters reaches the real spelling directly, no
      // sandhiRule needed.
      text: 'செய்தேன்',
      gloss: 'seytēṉ — I did (1st person singular, past)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-tee', 'tam-pulli-alveolar-na'],
    },
    // Andronov, p.148 (archive.org text line ~12723-12731): "In the past
    // tense the suffix -aan is used in forms derived by the tense
    // suffixes -t(t)-, -nt-, -i-... e.g., ceytal 'to do' - ceytaan 'he
    // did'." Same -த- marker as above, this file's already-established
    // 3rd-person-singular-masculine suffix -ஆன் (already used for
    // செய்கிறான்).
    {
      id: 'tam-word-seythaan',
      stage: 'words',
      level: 3,
      text: 'செய்தான்',
      gloss: 'seytāṉ — he did (3rd person singular masculine, past)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-taa', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-sentence-naan-seytheen',
      stage: 'sentences',
      level: 3,
      // The past-tense counterpart to tam-sentence-naan-seykirren.
      text: 'நான் செய்தேன்',
      gloss: 'nāṉ seytēṉ — I did',
      composedOf: ['tam-word-naan', 'tam-word-seytheen'],
    },
    {
      id: 'tam-sentence-avan-seythaan',
      stage: 'sentences',
      level: 3,
      // The past-tense counterpart to tam-sentence-avan-seykirraan.
      text: 'அவன் செய்தான்',
      gloss: 'avan seytāṉ — he did',
      composedOf: ['tam-word-avan', 'tam-word-seythaan'],
    },

    // ================= Negative imperative (level 3) =================
    // Extension, 2026-08-12 (tranche 13): Tamil negation turned out to be
    // genuinely more complex than past tense was — Andronov describes
    // separate literary/colloquial registers and separate
    // indicative/imperative constructions, and the clearest, most
    // directly-citable worked example for the already-taught செய் turned
    // out to be the negative imperative, not the negative indicative
    // (whose own worked examples all use different verbs).
    //
    // Andronov §229 (archive.org text line ~15340-15344): "In Literary
    // Tamil the negative imperative singular is denoted by the suffixes
    // -ee... joined to the negative suffix -aat-; e.g., ceytal 'to do' -
    // ceyyaatee 'don't do'." Morpheme boundaries don't line up with
    // syllable/grapheme boundaries here (Tamil orthography doesn't mark
    // them): செய் (already taught) + ய (the glide increment vowel-final
    // stems take before a vowel-initial suffix, per Andronov §223,
    // doubling the stem's own final ய்) + ஆ (the negative suffix itself)
    // + த (the negative suffix's own tail consonant, -aat-, not part of
    // the imperative morpheme) + ே (the actual imperative morpheme, -ee).
    // தே (already an atomic letter, reused from this file's own
    // past-tense work) happens to span that last boundary in one grapheme.
    {
      id: 'tam-word-ceyyaathee',
      stage: 'words',
      level: 3,
      // யா (already an atomic letter, ய + the ā vowel sign, reused from
      // யார்/யாருக்கு) plays the glide-plus-negative-suffix role in one
      // step — plain concatenation of already-taught letters reaches the
      // real spelling directly, no sandhiRule needed.
      text: 'செய்யாதே',
      gloss: 'ceyyātē — don\'t do! (literary negative imperative, singular)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-tee'],
    },

    // ================= Future tense (level 3) =================
    // Extension, 2026-08-12 (tranche 14): per the tranche-13 operator
    // decision — grammar completeness on its own merits, not gated on the
    // two calibration verses — this file's first tense beyond present and
    // past: future.
    //
    // Andronov §110/§115 (archive.org text lines 11996-12003, 12121-12124)
    // give TWO different forms for செய்'s own future 1st person singular:
    // "ceytal 'to do' - ceykeen 'I shall do'" (§110's own rule list, line
    // 12000) versus "ceytal 'to do' - ceyveen 'I shall do'" (§115, line
    // 12124) — and §110's OWN worked example sentence two lines after its
    // rule list already uses "ceyveen", not "ceykeen" (line 12003).
    // Neither is a fluke: ceyveen recurs in four separate real quoted
    // sentences across the book (TU 82, JP 37, BKa 326, JSP 26) and is the
    // form §115 names explicitly as Colloquial/Modern Tamil's own
    // standard; ceykeen recurs too, once, in a real quotation from
    // Tiruvācakam (line 13472, a 9th-century classical text) — a rarer,
    // likely classical/poetic register, not a transcription error. This
    // file ships ceyveen as the modern colloquial standard, not as the
    // only form Tamil grammar allows.
    {
      id: 'tam-word-seyveen',
      stage: 'words',
      level: 3,
      // வே (already an atomic letter, வ + the ē vowel sign, tranche 5)
      // plays the same role தே/றா/யா play elsewhere in this file's own
      // tense/person system — plain concatenation of already-taught
      // letters reaches the real spelling directly, no sandhiRule needed.
      text: 'செய்வேன்',
      gloss: 'seyvēṉ — I shall do, I will do (1st person singular, future)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-vee', 'tam-pulli-alveolar-na'],
    },

    // ================= A second person, present tense (level 2-3) =================
    // Extension, 2026-08-12 (tranche 15): this file's second grammatical
    // person for செய், 2nd person singular present.
    //
    // நீ ("you", singular) is real, pre-existing taught vocabulary in ABC
    // of Tamil, not just this file's own already-taught vowel-sign LETTER
    // of the same shape — Lesson Five's own vocabulary (line 538: "நீ -
    // (ni) - you (singular)"), its own worked phrase (line 543: "நீ வா -
    // you come"), and its own grammar note (lines 549, 554, 560-562,
    // giving நீ's case-change rule) all introduce it as a real word, well
    // before Lesson Seventeen reuses it in the செய் conjugation.
    {
      id: 'tam-word-nii',
      stage: 'words',
      level: 2,
      // composedOf is the one letter this word IS (Curriculum.ts's words
      // JOINER is '', so a single-letter composedOf reconstructs exactly)
      // — same pattern already used for skt-word-nau.
      text: 'நீ',
      gloss: 'nī — you (singular)',
      composedOf: ['tam-letter-nii'],
    },
    // Lesson Seventeen's own person-suffix table (line 1411: -ஆய், II
    // person singular) applied to செய், worked example at line 1432:
    // "நீ செய்கிறாய் - You do (singular)."
    {
      id: 'tam-word-seykiraay',
      stage: 'words',
      level: 3,
      // றா (already an atomic letter, reused from tranche 14's
      // செய்கிறான்) plays the same role here as it does there — plain
      // concatenation of already-taught letters reaches the real
      // spelling directly, no sandhiRule needed.
      text: 'செய்கிறாய்',
      gloss: 'seykiṟāy — you do (2nd person singular, present)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rraa', 'tam-pulli-ya'],
    },
    {
      id: 'tam-sentence-nii-seykiraay',
      stage: 'sentences',
      level: 3,
      // Lesson Seventeen's own worked sentence, line 1432.
      text: 'நீ செய்கிறாய்',
      gloss: 'nī seykiṟāy — you do',
      composedOf: ['tam-word-nii', 'tam-word-seykiraay'],
    },

    // ================= Negative indicative (level 3) =================
    // Extension, 2026-08-12 (tranche 16): grammar completeness on its own
    // merits — Tamil's first negative INDICATIVE (tranche 13 shipped only
    // the negative IMPERATIVE, செய்யாதே, "don't do!").
    //
    // Andronov §223 (archive.org text line 15185) gives செய் itself as
    // the worked example for the negative stem: "ceyial 'to do' -
    // ceyyaa(t)- / cey-". §225 (line 15215) lists the personal suffixes
    // joined to that stem, including "-aatu (in the 3rd person singular
    // neuter)" — the generic, tense-unmarked negative used, per §226
    // (line 15232), for present, future, or past alike. The combination,
    // ceyyaatu, is independently attested in a real quoted sentence (NMY,
    // 71; line 21686): "...niRkakkuuTac ceyyaatu" — "[they] do not even
    // stop [at the bus stand]".
    {
      id: 'tam-word-ceyyaathu',
      stage: 'words',
      level: 3,
      // செ + ய் + யா, same three graphemes ceyyaathee (tranche 13) already
      // uses for this same cey-y-aa- stem, followed by து (already an
      // atomic letter, tranche 9) in the person-suffix's own role — plain
      // concatenation of already-taught letters reaches the real spelling
      // directly, no sandhiRule needed.
      text: 'செய்யாது',
      gloss: "ceyyātu — [it/they] do(es) not do (3rd person singular neuter negative indicative)",
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-tu'],
    },

    // ================= Dative extension: short/doubling nouns (level 3) =================
    // Extension, 2026-08-12 (tranche 16): tranche 9 shipped the dative
    // (கு/க்கு) via யாருக்கு. ABC of Tamil Lesson Twenty's own further
    // examples (lines 1961-1973, immediately after the range tranche 9
    // already cited) give a second dative sub-rule: short, two-letter
    // nouns ending in a consonant double that consonant before the case
    // suffix — line 1961-1962: "கண் + கு = கண் + (ண்) + கு = கண்ணுக்கு = to
    // the eye"; line 1970-1971: "பல் + கு = பல் + (ல்) + கு = பல்லுக்கு =
    // to the tooth." கண் and பல் are already taught (tam-word-kan,
    // tam-word-pal).
    {
      id: 'tam-word-kannukku',
      stage: 'words',
      level: 3,
      // ணு (already an atomic letter, tranche 5's ண vowel-sign table) and
      // க்/கு (already taught, tranche 9's own யாருக்கு) — zero new
      // letters, same reuse pattern as கண்ணை/பல்லை (tranche 8) and
      // யாருக்கு (tranche 9) before it.
      text: 'கண்ணுக்கு',
      gloss: 'kaṇṇukku — to the eye (dative)',
      composedOf: ['tam-letter-ka', 'tam-pulli-nna', 'tam-letter-nnu', 'tam-pulli-ka', 'tam-letter-ku'],
    },
    {
      id: 'tam-word-pallukku',
      stage: 'words',
      level: 3,
      // லு (already an atomic letter, tranche 5's ல vowel-sign table) —
      // same reuse pattern as கண்ணுக்கு directly above.
      text: 'பல்லுக்கு',
      gloss: 'pallukku — to the tooth (dative)',
      composedOf: ['tam-letter-pa', 'tam-pulli-la', 'tam-letter-lu', 'tam-pulli-ka', 'tam-letter-ku'],
    },

    // ================= Pronoun genitive (level 3) =================
    // Extension, 2026-08-12 (tranche 18): tranche 10 shipped the genitive
    // only for யார் ("who"); ABC of Tamil Lesson Twenty-One's own further
    // examples (lines 2039-2050) give the pronoun genitives, starting with
    // "அவன் + உடைய = அவனுடைய = his" (line 2046) — the genitive of
    // தம்-word-avan ("he"), already taught.
    {
      id: 'tam-word-avanudaiya',
      stage: 'words',
      level: 3,
      // அ + வ (both already taught) + னு (already an atomic letter,
      // tam-letter-alveolar-nu — the alveolar ன fused with the u vowel
      // sign, distinct from dental நு) + டை + ய (both already taught,
      // reused from யாருடைய, tranche 10) — zero new letters, the dead ன்
      // of அவன் fusing directly into னு the same way a dead consonant
      // immediately followed by a vowel always does elsewhere in this
      // file (யாருடைய's own ரு, கண்ணுக்கு's own ணு).
      text: 'அவனுடைய',
      gloss: 'avaṉuṭaiya — his',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-letter-alveolar-nu', 'tam-letter-ttai', 'tam-letter-ya'],
    },
  ],
};
