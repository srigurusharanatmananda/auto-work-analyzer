/**
 * As of 2026-08-12: the complete Tamil alphabet (all 12 vowels, the āytham,
 * all 18 consonants — ABC of Tamil, Lessons One and Two), the full vowel-sign
 * table on க specifically (ABC of Tamil, Lessons Three-Fifteen — tranche 3),
 * plus a first small set of real words and one sentence, extended
 * 2026-08-09/10. See `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`
 * for the full beginner-to-advanced plan this is a tranche of — mirrors the
 * Sanskrit manifest's own tranche-2 alphabet completion and tranche-3
 * vowel-sign/conjunct batch, same rigor. The other 17 consonants' vowel-sign
 * forms are deliberately deferred, same reasoning as Sanskrit's own
 * single-consonant vowel-sign tranche — see that block's own comment.
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
    // consonant the primer itself always lists first (க), leaving the other
    // 17 consonants' sign forms for a later tranche if a real word needs
    // one, the same rule skt-letter-ti/tam-letter-naa were added under.
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
  ],
};
