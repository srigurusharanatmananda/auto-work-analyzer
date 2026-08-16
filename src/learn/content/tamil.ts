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
 * Tranche 19 adds two more pronoun genitives, அவருடைய ("his/her,
 * honorific", the genitive of the newly-added அவர்) and என்னுடைய ("my",
 * the genitive of already-taught நான் via its own நான்→என் shortening
 * rule) — plus the two base pronoun words (அவர், என்) each turned out to
 * need first. Zero new letters, but four new words, not the "zero new
 * letters for all four [genitives]" tranche 18 had forecast. Tranche 20
 * ships the other two genitives that forecast turned out NOT to hold for
 * — அவளுடைய ("her") and அவர்களுடைய ("their") — confirmed here, via a
 * fresh live fetch of the same primer PDF, to need one new atomic letter
 * (dead ள், tam-pulli-lla) for their base pronouns அவள்/அவர்கள் (neither
 * previously taught as a word either), even though the genitives
 * themselves reuse the already-taught fused ளு and need zero new letters,
 * same split as tranche 19's own அவன்/அவனுடைய.
 * Tranche 22 does three things at once, all Tamil. It completes ABC of
 * Tamil Lesson Seventeen's own eleven-row person table by adding the three
 * person-categories this file had never started at all — "we" (inclusive
 * நாம் and exclusive நாங்கள், sharing one verb form செய்கிறோம்),
 * plural/honorific "you" (நீங்கள் செய்கிறீர்கள்), and the neuter அது/அவை
 * (செய்கிறது, செய்கின்றன) — needing one new atomic letter, the dead ங்
 * (tam-pulli-nga) that நாங்கள்/நீங்கள் both carry and that tranche 5
 * deliberately never reached, the same class of gap that stopped அவளுடைய
 * in tranche 19, caught this time before drafting rather than after. It
 * closes two of the three named past/future person gaps from Andronov —
 * செய்தார் (the honorific SINGULAR past, distinct from the plural
 * செய்தார்கள் tranche 21 shipped) and செய்வான் (அவன்'s future, the tense
 * its past செய்தான் has had to itself since tranche 12) — zero new letters
 * for either, each being an already-shipped form with its final dead
 * consonant swapped. And it establishes, by enumerating every Tamil phrase
 * and sentence the primer prints against this file's own taught
 * vocabulary, that ABC of Tamil Book One contains no graded reading at any
 * vocabulary size: exactly two of its phrases decompose completely, one of
 * which (நான் யார்) was already taught. So Tamil level 4 stays
 * deliberately EMPTY, and the single new find — என் கண் ("my eye"), from
 * Lesson Two's pronunciation drill — ships at level 3, where its
 * provenance actually puts it, rather than being used to make an empty
 * tier look full. Deliberately NOT shipped: செய்வார், the honorific
 * singular future that would have completed the -ஆர் column. Andronov
 * states the -ஆர் future rule but conjugates a different verb under it
 * (ennutal → enpaar), and "ceyvaar" occurs in the whole book only inside
 * the plural ceyvaarkaL this file already ships — deriving it would have
 * been exactly the plausible, derivable, unattested guess that produced
 * skt-word-nayati. Still blocked after this tranche: that honorific future
 * cell, and Tamil level 4 itself — both need a genuinely new source (ABC
 * of Tamil Books Two/Three, if tamilvu.org hosts them, or a printed
 * paradigm/reader such as Arden's *A Progressive Grammar of Common
 * Tamil*), none of which was fetched here. One housekeeping note this
 * tranche's re-fetch turned up: the "line" pinpoints earlier tranches cite
 * for both sources are unreliable — Lesson Seventeen actually runs pp.
 * 38-41 with its suffix table on p.40, not p.39, and the Andronov item now
 * serves a differently-named djvu.txt whose line numbers do not match the
 * ones tranches 12-21 recorded. Tranche 22 therefore cites ABC by page
 * read off rendered page images, and Andronov by § and page only, both of
 * which check out; the older references are worth a cleanup pass.
 * Tranche 23 finishes the person/tense grid for செய், filling five of the
 * nine cells tranche 22's five new pronouns had left standing in the present
 * tense only. Shipped: நீங்கள்'s two missing tenses (செய்வீர்கள்,
 * செய்தீர்கள்) off a single Andronov line, §132 p.159, that conjugates
 * ceytal by name in all three tenses at once; அது's past (செய்தது, §148
 * p.168) and அவை's past (செய்தன, §155 p.172), each from a section that also
 * conjugates ceytal in the present tense this file already ships, so both
 * derivations are checkable against existing content; and நாம்/நாங்கள்'s
 * shared future (செய்வோம், §216 p.209). Zero new letters — every one of the
 * five words is already-taught letters concatenated, which is what made this
 * area worth doing now. Deliberately NOT shipped, four cells, each re-read
 * off a rendered page image this session rather than taken on trust:
 * செய்தோம் (1st plural past — §117 p.150 conjugates ceytal in the present
 * only, and the string "ceytoom" occurs nowhere in the book), செய்யும் (3rd
 * singular neuter future — §150 p.169 illustrates with seven verbs, none of
 * them ceytal), செய்வன (3rd plural neuter future — §155's own future
 * paragraph switches to corital/naTattal, in the very section that
 * conjugates ceytal for the other two tenses), and செய்வார், carried over
 * from tranche 22 and re-confirmed dropped (§142 p.164 states the -ஆர்
 * future rule then switches to ennutal for every example). The resulting
 * asymmetry is deliberate and is the tranche's point: செய்வோம் ships because
 * Andronov prints that string against this verb with his own "we shall do",
 * while its past counterpart செய்தோம் is a string he never prints at all.
 * செய்வோம் is nonetheless the weakest item here by a clear margin — a single
 * occurrence in the whole book, inside a §216 quotation about participial
 * nouns — and its own comment below says so plainly instead of calling the
 * problem a wrinkle. One register judgment is recorded rather than buried:
 * Andronov writes the neuter plural past as "ceyt(an)a", and this file's
 * habit with bracketed material is to drop it (செய்யாதீர், செய்வான்), but
 * here he labels the increment the one used "commonly" and bare joining "in
 * Classical Tamil rarely", so dropping would have produced the rare
 * classical form — the reverse of the modern-register choice those earlier
 * drops were making. Still blocked after this tranche: those four cells,
 * which will not move without a source printing a paradigm TABLE rather than
 * rule-plus-example prose (ABC of Tamil Books Two/Three, if tamilvu.org
 * hosts them; Arden's *A Progressive Grammar of Common Tamil*), and Tamil
 * level 4, unchanged by this tranche and still empty for tranche 22's own
 * enumerated reason.
 * Tranche 24 breaks this file's one-verb habit: every finite form since
 * tranche 7 has been செய், so nothing yet distinguished what belongs to the
 * present tense from what belongs to that particular root. It adds the
 * primer's second root, போ ("to go"), and the three persons ABC of Tamil
 * actually prints it in — போகிறேன், போகிறான், போகிறார் — plus the two
 * sentences the book prints whole (நான் போகிறேன், p.39 and again parsed on
 * p.45; அவர் போகிறார், p.41 exercise item (4)). Unlike tranche 23, one source
 * supplies both halves: ABC of Tamil gives the SPELLING and the GLOSS
 * together, with no romanised form from Andronov involved. Zero new letters —
 * every grapheme was already taught, so nothing had to go ahead of the
 * vocabulary block. Method, unchanged from tranche 22: the TAB/TSCII text
 * layer was used only as a locator, and every form was read off a 600-dpi
 * render, with each new form's tail compared against the same page's
 * already-shipped செய் counterpart to settle ற/ர and ன்/ண் — a stronger
 * discriminator than magnification. One gloss is DERIVED rather than quoted
 * and is labelled so in its own comment: p.41 withholds the English for அவர்
 * போகிறார் because translating it is the student's exercise, so the gloss is
 * recombined from that book's own p.40 suffix table and its own "He goes"
 * (p.55) — the book's English in the book's own paradigm cell, with the Tamil
 * read off the page. Deliberately NOT shipped: அவன் வீட்டுக்குப் போகிறான்
 * (needs a dead ட் and ப், neither taught, AND the noun வீடு, which no
 * rendered vocabulary list gives); அவன் போகிறான் as a standalone sentence,
 * which the book never prints, even though both its words are attested and it
 * would reconstruct cleanly; and the other nine persons of போ's present
 * paradigm, which the primer runs on செய் only — the same line this file drew
 * at செய்வார் and செய்தோம். போ turns out to be attested in exactly three
 * persons, all present, and that partial paradigm is what ships. Still
 * blocked: the whole dative-sentence family, which needs its own ட்/ப்
 * letters tranche plus sourced nouns (வீடு, நாய்) before the primer's printed
 * doubling rule after 'கு' can be taught; and Tamil level 4, still empty for
 * tranche 22's reason and deliberately not filled with verb forms that belong
 * at level 3.
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
    // New (tranche 20): tranche 19 forecast, then corrected, that this
    // letter would eventually be needed for அவளுடைய ("her") and
    // அவர்களுடைய ("their") — confirmed here by a fresh live fetch of ABC
    // of Tamil, Book One (tamilvu.org/coresite/download/ABC_Tamil.pdf),
    // not the earlier cached extraction. It is needed one step earlier
    // than the genitives themselves, though: the BASE pronouns அவள்
    // ("she") and அவர்கள் ("they") both end in this dead consonant and are
    // not yet taught as words at all (p.13, Lesson Two's own
    // "three-lettered words" list: "அவள்– (aval) – she"; p.40-41, Lesson
    // Seventeen's person-suffix table lists both அவள்/ஆள் and
    // அவர்கள்/ஆர்கள் directly). A different letter from the already-taught
    // bare ள (tam-letter-lla, retroflex l with its inherent vowel) — this
    // is its dead (pulli), vowel-less form, the same relationship every
    // other tam-pulli-* letter in this file already has to its bare
    // counterpart.
    {
      id: 'tam-pulli-lla',
      stage: 'letters',
      level: 1,
      text: 'ள்',
      gloss: 'ḷ — dead consonant (no vowel), used at the end of a word',
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
    // New (tranche 22): needed because நாங்கள் ("we", exclusive) and
    // நீங்கள் ("you", plural/honorific) both carry it — this file taught
    // only the LIVE ங (tam-letter-nga, tranche 2), never its dead form, and
    // tranche 5's vowel-sign sweep deliberately skipped ங entirely. ABC of
    // Tamil, Lesson Three ("Consonantal Vowels (contd.)"), p.14 prints this
    // letter in the consonant+ஆ table's left column, second row: "ங் + ஆ =
    // ஙா (nā)". That lesson's closing Notes — running onto p.15,
    // immediately above the LESSON FOUR heading — then names it directly,
    // and in doing so states the very fact tranche 5 acted on: "The
    // following consonantal-vowels can never be the first letter of any
    // Tamil word : ங, ட, ண, ர, ல, ழ, ள, ற & ன, The consonant 'ங்' and
    // consonantal vowel 'ங' only are in use. Other consonantal vowel forms
    // of 'ங' are not in use. As such the combination of ங் with other
    // vowels need not be learnt." The pulli notation itself is Lesson Two,
    // p.11: "Tamil has 18 consonants. They are denoted with a dot above.
    // e.g., க், ட், ப், ம், (k, t, p, m)" — the same mark every other
    // tam-pulli-* letter above already carries.
    //
    // Page numbers here were read off rendered page images, not computed
    // from the cached extraction's line offsets, which is why they differ
    // by one from what a line-derived reference would give.
    {
      id: 'tam-pulli-nga',
      stage: 'letters',
      level: 1,
      text: 'ங்',
      // Not "used at the end of a word" — like tam-pulli-ka above, this one
      // sits medially in both of its uses (நாங்கள், நீங்கள், between the
      // long vowel and க), so the same more general phrasing applies.
      gloss: 'ṅ — dead consonant (no vowel); the only form of ங besides ங itself that Tamil actually uses',
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
    // Tranche 20: அவன்'s feminine counterpart, from the same person-suffix
    // table (a fresh live fetch of ABC of Tamil, Book One confirms it on
    // p.40: "அவள் - ஆள் (III person, singular, feminine)"), independently
    // reinforced by p.13's own Lesson Two vocabulary list ("அவள்– (aval) –
    // she") and p.41's worked sentence ("அவள் செய்கிறாள் - She does
    // (singular-feminine)"). ள் here is the dead consonant tam-pulli-lla,
    // added just above specifically because this word (and அவர்கள் below)
    // need it — the same "add only what a word needs" rule every earlier
    // tranche's enabling letters followed.
    {
      id: 'tam-word-aval',
      stage: 'words',
      level: 2,
      text: 'அவள்',
      gloss: 'avaḷ — she',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-pulli-lla'],
    },
    // Tranche 19: அவன்'s honorific counterpart, from the same lesson's own
    // person table (line 1415-1416: "அவர் - ஆர் (III person, singular,
    // honorific - masculine and feminine)"), independently reinforced by
    // three further worked sentences (line 1442, "அவர் செய்கிறார்"; line
    // 1782, Lesson Nineteen's accusative practice; lines 1847-1848, Lesson
    // Twenty's dative example). ர் here is the dead consonant tam-pulli-ra
    // (already taught, reused from யார் — NOT the same as the fused letter
    // ரு that யாருடைய/யாருக்கு/அவருடைய below instead reuse). Zero new
    // letters.
    {
      id: 'tam-word-avar',
      stage: 'words',
      level: 2,
      text: 'அவர்',
      gloss: 'avar — he/she (honorific)',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-pulli-ra'],
    },
    // Tranche 20: அவர்'s plural counterpart, same person-suffix table (p.40:
    // "அவர்கள் - ஆர்கள் [(III person, plural (for human beings only)]"),
    // independently reinforced by p.41's worked sentence ("அவர்கள்
    // செய்கிறார்கள் - They do (plural-human beings- both masculine and
    // feminine)") and by p.56's own genitive line (see
    // tam-word-avargaludaiya below). ர் is the already-taught dead
    // tam-pulli-ra (reused from அவர் above, NOT the fused ரு); க is the
    // already-taught bare tam-letter-ka; ள் is the dead tam-pulli-lla added
    // just above. Zero new letters beyond that one.
    {
      id: 'tam-word-avargal',
      stage: 'words',
      level: 2,
      text: 'அவர்கள்',
      gloss: 'avarkaḷ — they (human beings)',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-pulli-ra', 'tam-letter-ka', 'tam-pulli-lla'],
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

    // Tranche 20: the feminine counterpart, ABC of Tamil Lesson
    // Seventeen's own person-suffix table (p.40, "அவள் - ஆள் (III
    // person, singular, feminine)", the row directly below the already-
    // shipped masculine -ஆன்), plus its own worked example sentence
    // (p.41, "அவள் செய்கிறாள் - She does (singular-feminine)"). Zero new
    // letters: செ/ய்/கி/றா are all already taught (from செய்கிறான்) and
    // ள் (tam-pulli-lla) is already taught too, added for அவள்/அவர்கள்.
    {
      id: 'tam-word-seykirraal',
      stage: 'words',
      level: 3,
      text: 'செய்கிறாள்',
      gloss: 'seykiṟāḷ — she does (3rd person singular feminine, present)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rraa', 'tam-pulli-lla'],
    },
    {
      id: 'tam-sentence-aval-seykirraal',
      stage: 'sentences',
      level: 3,
      // Lesson Seventeen's own worked sentence (p.41), the feminine
      // counterpart to tam-sentence-avan-seykirraan above.
      text: 'அவள் செய்கிறாள்',
      gloss: 'avaḷ seykiṟāḷ — she does',
      composedOf: ['tam-word-aval', 'tam-word-seykirraal'],
    },

    // Tranche 21: present tense for அவர் (honorific) and அவர்கள்
    // (plural, human) — ABC of Tamil Lesson Seventeen's own "III Person"
    // table, p.41. Zero new letters (all reused from செய்கிறான்/
    // செய்கிறாள் and அவர்/அவர்கள் themselves).
    {
      id: 'tam-word-seykirraar',
      stage: 'words',
      level: 3,
      // Same root+tense-symbol fusion as செய்கிறான்/செய்கிறாள், here
      // with the already-taught dead ர் (reused from அவர்) in the final
      // slot. p.41, "III Person" table, row 3: "அவர் செய்கிறார் - He
      // (she) does (singular-honorific, both masculine and feminine)".
      text: 'செய்கிறார்',
      gloss: 'seykiṟār — he/she does (3rd person singular honorific, present, both masculine and feminine)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rraa', 'tam-pulli-ra'],
    },
    {
      id: 'tam-sentence-avar-seykirraar',
      stage: 'sentences',
      level: 3,
      // p.41's own worked pronoun+verb pairing, row 3.
      text: 'அவர் செய்கிறார்',
      gloss: 'avar seykiṟār — he/she does (honorific)',
      composedOf: ['tam-word-avar', 'tam-word-seykirraar'],
    },
    {
      id: 'tam-word-seykirraargal',
      stage: 'words',
      level: 3,
      // The honorific செய்கிறார் above + the same கள் plural suffix
      // (dead ர் + க + dead ள்) already used on அவர்கள். p.41, "III
      // Person" table, row 4: "அவர்கள் செய்கிறார்கள் - They do
      // (plural-human beings-both masculine and feminine.)".
      text: 'செய்கிறார்கள்',
      gloss: 'seykiṟārkaḷ — they do (3rd person plural, human beings, present, both masculine and feminine)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-ki',
        'tam-letter-rraa',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-pulli-lla',
      ],
    },
    {
      id: 'tam-sentence-avargal-seykirraargal',
      stage: 'sentences',
      level: 3,
      // p.41's own worked pronoun+verb pairing, row 4.
      text: 'அவர்கள் செய்கிறார்கள்',
      gloss: 'avarkaḷ seykiṟārkaḷ — they do',
      composedOf: ['tam-word-avargal', 'tam-word-seykirraargal'],
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
    // Tranche 21: Andronov §138, p.163 — the feminine counterpart to
    // ceytaan above, suffix -aaL. தா (already taught) + the already-taught
    // dead ள் (tam-pulli-lla, reused from அவள்) — plain concatenation, no
    // sandhiRule needed.
    {
      id: 'tam-word-seythaal',
      stage: 'words',
      level: 3,
      text: 'செய்தாள்',
      gloss: 'seytāḷ — she did (3rd person singular feminine, past)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-taa', 'tam-pulli-lla'],
    },
    // Tranche 21: Andronov §143, p.165 — the plural/human counterpart,
    // suffix -aarkaL, matching this file's own already-taught pronoun
    // அவர்கள். Plain concatenation, no sandhiRule needed.
    {
      id: 'tam-word-seythaarkal',
      stage: 'words',
      level: 3,
      text: 'செய்தார்கள்',
      gloss: 'seytārkaḷ — they did (3rd person plural, human beings, past)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-taa',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-pulli-lla',
      ],
    },
    // Tranche 22: the honorific SINGULAR past — a different lesson from the
    // plural செய்தார்கள் directly above, and the past-tense counterpart of
    // the already-shipped செய்கிறார். Andronov §142 (p.164) conjugates
    // ceytal itself under this suffix for present and past: "In the present
    // and the past tenses these suffixes are distributed and used similarly
    // to the suffixes of the 3rd person singular masculine (cf. § 135);
    // e.g., ceytal 'to do' ceyki(n)Raar / ceykiRpaar / ceykinRanar 'they
    // do', ceytaar / ceytanar 'they did'." The SINGULAR reading — the whole
    // reason this is not a duplicate of செய்தார்கள் — is Andronov's own,
    // stated one section earlier at §141 (p.164): the suffixes -aar/-ar are
    // used "usually as common masculine-feminine honorific singular forms"
    // in Modern Tamil. §142 itself then glosses a past-tense -aar form as a
    // singular with a feminine referent: "intap peNmaNi pala kaTTuraikaL
    // ezhutinaar (Se, 111) 'This lady wrote a number of articles'". The
    // pronoun/suffix pairing is the primer's own — ABC of Tamil Lesson
    // Seventeen's person-suffix table, p.40: "அவர் - ஆர் (III person,
    // singular, honorific - masculine and feminine)".
    //
    // Cited by § and page only, on purpose. Andronov romanises throughout
    // and never prints these forms in Tamil script, so the script here is
    // derived — the suffix's letterform coming from ABC's own table — which
    // is a standing property of every past/future form this file has taken
    // from Andronov since tranche 12, not something new. It is unusually
    // well cushioned in this one case: செய்தார் is a proper prefix of the
    // already-shipped செய்தார்கள். And the "archive.org text line" numbers
    // earlier tranches record no longer resolve (that item now serves
    // 2015.201870.A-Grammar_djvu.txt, not the file they name), so § and
    // page — which do check out — are the only pinpoints worth recording.
    {
      id: 'tam-word-seythaar',
      stage: 'words',
      level: 3,
      // The already-shipped செய்தான் with its final dead consonant swapped
      // for ர் (tam-pulli-ra, the same one already in அவர்/செய்கிறார்) —
      // plain concatenation of four already-taught letters reaches the real
      // spelling, no sandhiRule needed.
      text: 'செய்தார்',
      gloss: 'seytār — he/she did (3rd person singular honorific, past, both masculine and feminine)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-taa', 'tam-pulli-ra'],
    },
    {
      id: 'tam-sentence-avar-seythaar',
      stage: 'sentences',
      level: 3,
      // Not assembled here from separately-sourced words: Andronov §186
      // (p.187) prints the clause whole and glosses it with a singular
      // "He" — "avar avviirarukkut tammaal ceyyak kuuTiya utaviyaic ceytaar
      // (MV, 51) 'He rendered all feasible (lit. which could be done by
      // him) assistance to that hero.'" This is that clause with its object
      // phrase stripped, because those words are not yet taught; the two
      // that remain are exactly the two the source puts at its ends. The
      // present-tense counterpart, tam-sentence-avar-seykirraar, is already
      // shipped from the primer's own person paradigm.
      text: 'அவர் செய்தார்',
      gloss: 'avar seytār — he/she did (honorific)',
      composedOf: ['tam-word-avar', 'tam-word-seythaar'],
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
    // Tranche 20: the plural/polite counterpart, from the same Andronov
    // section group, §231 (p.218): "The suffix -iir(kaL) is joined to the
    // negative suffix -aat-; e.g., ceytal 'to do' - ceyyaatiir(kaL) 'don't
    // do'." Shipped bare, without the optional "(kaL)" plural marker —
    // not a form Andronov marks as obligatory, so dropping it is the same
    // kind of choice this file makes for any other bracketed variant.
    {
      id: 'tam-word-ceyyaathiir',
      stage: 'words',
      level: 3,
      // Same cey-y-aa- stem as ceyyaathee above (செ + ய் + யா), followed
      // by தீர் (already-taught தீ + the already-taught dead ர், reused
      // from யார்) — plain concatenation, no sandhiRule needed.
      text: 'செய்யாதீர்',
      gloss: "ceyyātīr — don't do! (literary negative imperative, plural/polite)",
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-tii', 'tam-pulli-ra'],
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
    // Tranche 21: Andronov §138, p.163 — the feminine future counterpart,
    // suffix -aaL (same suffix family as ceythaal above, this file's own
    // established modern-register choice: dropping the optional -ku-
    // increment and keeping the optional -aa-, matching ceyveen not
    // ceykeen). Plain concatenation, no sandhiRule needed.
    {
      id: 'tam-word-seyvaal',
      stage: 'words',
      level: 3,
      text: 'செய்வாள்',
      gloss: 'seyvāḷ — she will do (3rd person singular feminine, future)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-vaa', 'tam-pulli-lla'],
    },
    // Tranche 21: Andronov §143, p.165 — the plural/human future
    // counterpart, suffix -aarkaL, matching அவர்கள். Plain concatenation,
    // no sandhiRule needed.
    {
      id: 'tam-word-seyvaarkal',
      stage: 'words',
      level: 3,
      text: 'செய்வார்கள்',
      gloss: 'seyvārkaḷ — they will do (3rd person plural, human beings, future)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-vaa',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-pulli-lla',
      ],
    },
    // Tranche 22: அவன்'s future — the one tense its past செய்தான் has had
    // to itself since tranche 12. Andronov §135 (p.161): "In the future
    // tense the suffix -aan is used in forms derived by the tense suffixes
    // -v- / -p(p)- and is joined to them directly; e.g., ceytal 'to do' -
    // cey(ku)vaan 'he will do'." The parenthesised (ku) is the optional
    // Classical increment, exactly as in the §138 entry "cey(ku)va(a)L 'she
    // will do'" this file already shipped செய்வாள் from — so dropping it
    // here is the same modern-register choice, not a new one. The bare,
    // (ku)-less spelling is independently attested in running text: "enna
    // cenhcaa tuTTu keTaikkumoo atellaam avanum ceyvaan (JSC, 10) 'He will
    // also do this all if he somehow raises some money'". Pronoun/suffix
    // agreement is the primer's own — ABC of Tamil Lesson Seventeen's
    // person-suffix table, p.40: "அவன் - ஆன் (III person, singular,
    // masculine)".
    {
      id: 'tam-word-seyvaan',
      stage: 'words',
      level: 3,
      // The already-shipped செய்வாள் with its final dead consonant swapped
      // for ன் (tam-pulli-alveolar-na, the same one already in அவன்/நான்/
      // செய்தான்) — plain concatenation, no sandhiRule needed.
      text: 'செய்வான்',
      gloss: 'seyvāṉ — he will do (3rd person singular masculine, future)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-vaa', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-sentence-avan-seyvaan',
      stage: 'sentences',
      level: 3,
      // The subject-verb pairing is Andronov's own, from the running-text
      // sentence quoted above (there with the enclitic உம் this file
      // already teaches as tam-word-um: "avanum ceyvaan"). This drops the
      // enclitic and the object, leaving the bare pronoun + finite verb —
      // the future counterpart of the already-shipped
      // tam-sentence-avan-seythaan and tam-sentence-avan-seykirraan.
      text: 'அவன் செய்வான்',
      gloss: 'avan seyvāṉ — he will do',
      composedOf: ['tam-word-avan', 'tam-word-seyvaan'],
    },
    // NOT shipped, deliberately: செய்வார், the honorific singular future
    // that would complete the -ஆர் column beside செய்கிறார்/செய்தார்.
    // Andronov §142 (p.164) does state the -aar/-ar future rule, but every
    // worked example under it switches verbs (ennutal 'to say' → enpa(a)r /
    // enma(a)r / enmanaar, with running citations koopittukkoLvaar,
    // puRantarukuvar, mozhimanaar) — he conjugates ceytal by name under
    // -aar for the present and the past, then declines to for the future.
    // A grep of the whole text finds "ceyvaar" only ever inside the plural
    // ceyvaarkaL (§143) this file already ships. Applying a stated rule to
    // a verb the source itself refused to apply it to is precisely the
    // skt-word-nayati failure — plausible, derivable, unattested — so this
    // cell stays an honest gap until a source conjugates செய் in it.

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

    // ============ The remaining person-categories, present tense (level 2-3) ============
    // Extension, 2026-08-13 (tranche 22): until now this file could say "I
    // do", "you (singular) do", "he/she does" and "they (people) do", but
    // had no way to say "we" at all, no plural or polite "you", and nothing
    // whatever for things rather than people. This closes all three, and
    // with them ABC of Tamil Lesson Seventeen's own eleven-row person
    // table, which tranches 7/11/15/21 have been filling in a row at a time.
    //
    // Everything below is that single lesson — "TENSES - PRESENT", pp.
    // 38-41. Its 'Suffixes:' table (p.40) and its worked conjugation of
    // செய் down every person-category (pp.40-41) sit on the page together,
    // so no pronoun, suffix or sentence here is assembled from parts found
    // in different chapters; the two pronouns that need outside support
    // (நீங்கள், அது) get it from their own earlier vocabulary lessons,
    // cited per item.
    //
    // Page numbers were read off rendered page images this tranche rather
    // than computed from the cached extraction's line offsets. That matters
    // and is why these differ from earlier tranches' references: Lesson
    // Seventeen runs to p.41, not p.40, and its suffix table is on p.40,
    // not p.39.
    //
    // One new letter, the dead ங் (tam-pulli-nga, added in the letters
    // section above with its own citation), which நாங்கள் and நீங்கள் both
    // need — the same class of gap that stopped அவளுடைய in tranche 19,
    // caught this time before drafting rather than after.

    // p.40, 'Suffixes:' table, second row: "நாம் - ஓம் (I per. Plural,
    // inclusive) - (This includes the II person.)" The inclusive sense is
    // the primer's own bracketed gloss, not a distinction imported from
    // elsewhere; it is reinforced lower on the same page by the worked
    // "நாம் செய்கிறோம் - We do (inclusive)", and independently by Lesson
    // Five's closing Rule, p.18: "It can be generalized that நான், நாம் and
    // நாங்கள் (I person) change into என், எம், எங்கள், respectively." Zero
    // new letters — நா and ம் are both long taught.
    {
      id: 'tam-word-naam',
      stage: 'words',
      level: 2,
      text: 'நாம்',
      gloss: 'nām — we (1st person plural, INCLUSIVE — includes the person being spoken to)',
      composedOf: ['tam-letter-naa', 'tam-pulli-ma'],
    },
    // p.40, the very next row: "நாங்கள் - ஓம் ((I per. Plural, exclusive) -
    // (This excludes the II person.)" (the doubled opening paren is the
    // primer's own typo, kept here in the quote for fidelity), reinforced
    // on the same page by "நாங்கள் செய்கிறோம் - We do (exclusive)". Note
    // the suffix is the SAME ஓம் as நாம் above: the two pronouns differ
    // only in whether the listener is included, which is exactly why the
    // primer prints them as adjacent rows and why the two sentences below
    // differ by one word and nothing else. ங் here is the dead consonant
    // added in the letters section, needed for this word and நீங்கள்.
    {
      id: 'tam-word-naangal',
      stage: 'words',
      level: 2,
      text: 'நாங்கள்',
      gloss: 'nāṅkaḷ — we (1st person plural, EXCLUSIVE — excludes the person being spoken to)',
      composedOf: ['tam-letter-naa', 'tam-pulli-nga', 'tam-letter-ka', 'tam-pulli-lla'],
    },
    // Two independent places in the primer. Lesson Five, p.17, vocabulary:
    // "நீங்கள் - (ningal) - you (honorific and plural as well)", with that
    // page's own note: "'நீ' stands for 'you' (singular), 'நீங்கள்' stands
    // for plural 'you'. It is also used as a respectful form of address in
    // the singular." And Lesson Seventeen's suffix table, p.40, fifth row:
    // "நீங்கள் - ஈர்கள் (II person, plural and honorific)". Its singular
    // நீ is already taught (tam-word-nii, tranche 15) from that same
    // Lesson Five vocabulary.
    {
      id: 'tam-word-niingal',
      stage: 'words',
      level: 2,
      // The LETTER நீ (tam-letter-nii), not the word — words compose only
      // from letters, per Curriculum.ts's prerequisiteStage.
      text: 'நீங்கள்',
      gloss: 'nīṅkaḷ — you (2nd person plural; also the respectful/honorific form of address to one person)',
      composedOf: ['tam-letter-nii', 'tam-pulli-nga', 'tam-letter-ka', 'tam-pulli-lla'],
    },
    // Lesson Six, p.19, vocabulary: "அது - adu - that ( - do - )", the
    // "-do-" carrying down the demonstrative-pronoun label from "இது - idu -
    // This (demonstrative pronoun)" on the line above, and covered by that
    // lesson's Notes on p.20 ("This applies to அந்த, அது and எந்த and எது,
    // also"). Its use as a VERBAL SUBJECT is Lesson Seventeen's, p.40:
    // "அது - அது (III person, singular, neuter gender)" — this pronoun's
    // personal suffix is the pronoun itself, which is why செய்கிறது below
    // ends the way it does. The "it" half of the gloss is the primer's own,
    // from p.41's "அது செய்கிறது - It does (singular-neuter gender)"; the
    // gloss carries both lessons' framings because both are cited.
    {
      id: 'tam-word-athu',
      stage: 'words',
      level: 2,
      text: 'அது',
      gloss: 'atu — it, that (3rd person singular, neuter gender)',
      composedOf: ['tam-letter-a', 'tam-letter-tu'],
    },
    // p.40, the suffix table's final entry, which brackets two pronouns
    // against one suffix: "அவை, / அவைகள் - அன (III person, plural, neuter
    // gender)"; rendered on p.41 as "அவை or அவைகள் — செய்கின்றன - They do
    // (plural-neuter gender)". The contrast with the already-taught
    // அவர்கள் is the primer's own, from the table row four lines above:
    // "அவர்கள் - ஆர்கள் [(III person, plural (for human beings only)]" —
    // these two "they"s split on human versus non-human, not on number.
    // p.41's own exercise "(3) ஒன்பது பூனைகள் ஓடுகின்றன" (nine cats run)
    // is what puts animals on this side of that split.
    //
    // Glossed "they" and not "they, those": the primer glosses அவை only as
    // "They" / "them" / "Their" everywhere it prints it (pp.40, 41, 46, 51,
    // 56) and never lists it among Lesson Six's demonstratives
    // (இது/அது/எது), so "those" would be this file's addition rather than
    // the source's.
    {
      id: 'tam-word-avai',
      stage: 'words',
      level: 2,
      text: 'அவை',
      gloss: 'avai — they (3rd person plural, neuter gender — not human beings, for which the primer uses அவர்கள்)',
      composedOf: ['tam-letter-a', 'tam-letter-vai'],
    },
    // The same braced table entry (p.40) and the same p.41 line — the word
    // "or" there is the primer's own, and is the whole basis for glossing
    // these two as interchangeable rather than distinguishing them. அவைகள்
    // still earns its own lesson despite that, because it is the form the
    // primer's later case lessons actually inflect: Lesson Nineteen, p.46,
    // "அவைகள்+ஐ=அவைகளை"; Lesson Twentyone, p.56, "அவைகள் + உடைய =
    // அவைகளுடைய = Their (neuter gender)". Zero new letters — the same கள்
    // ending அவர்கள் already uses.
    {
      id: 'tam-word-avaigal',
      stage: 'words',
      level: 2,
      text: 'அவைகள்',
      gloss: 'avaikaḷ — they (3rd person plural, neuter gender — the primer gives this and அவை as interchangeable)',
      composedOf: ['tam-letter-a', 'tam-letter-vai', 'tam-letter-ka', 'tam-pulli-lla'],
    },
    // p.40, 'I Person', two consecutive lines under a shared 'Plural'
    // brace: "நாம் செய்கிறோம் - We do (inclusive)" and "நாங்கள்
    // செய்கிறோம் - We do (exclusive)". That ONE verb form serves both
    // pronouns is the primer's own layout, corroborated by the identical
    // ஓம் suffix it assigns them in the table higher on that page — which
    // is why there is one word lesson here and two sentences below. Root
    // and tense marker are p.39's: "செய் = to do; நான் செய்+ கிறு+ ஏன்=
    // நான் செய்கிறேன்= I do" and "The present tense symbols are 'கிறு' and
    // 'கின்று'."
    {
      id: 'tam-word-seykirroom',
      stage: 'words',
      level: 3,
      // The same five-letter shape as the already-shipped செய்கிறேன், with
      // றோ for றே and ம் for ன் — றோ is already an atomic letter (ற + the
      // ō vowel sign, tranche 5), so plain concatenation reaches the real
      // spelling directly and no sandhiRule is needed.
      text: 'செய்கிறோம்',
      gloss: 'seykiṟōm — we do (1st person plural, present — one and the same form for inclusive நாம் and exclusive நாங்கள்)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rroo', 'tam-pulli-ma'],
    },
    // p.40, 'II Person': "நீங்கள் செய்கிறீர்கள் - You do (plural and as
    // well honorific singular)", its suffix ஈர்கள் from the table higher
    // on the same page. Independently attested in that lesson's own
    // exercise, p.41: "(6) நீங்கள் என்ன செய்கிறீர்கள்?" — the primer
    // printing the finished form in running text, not only in the
    // paradigm.
    {
      id: 'tam-word-seykirriirgal',
      stage: 'words',
      level: 3,
      // றீ (already an atomic letter, ற + the ī vowel sign, tranche 5) plus
      // the same ர்கள் ending செய்கிறார்கள் already uses — zero new
      // letters, no sandhiRule.
      text: 'செய்கிறீர்கள்',
      gloss: 'seykiṟīrkaḷ — you do (2nd person plural, present; also the honorific singular)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-ki',
        'tam-letter-rrii',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-pulli-lla',
      ],
    },
    // p.41, 'III Person': "அது செய்கிறது - It does (singular-neuter
    // gender)". The personal suffix is the pronoun itself, per the suffix
    // table on p.40 ("அது - அது").
    {
      id: 'tam-word-seykirrathu',
      stage: 'words',
      level: 3,
      // Note the BARE ற here (tam-letter-rra), not a vowel-signed றா/றே/றோ
      // like every other present-tense form in this file: the suffix அது
      // supplies its own vowel, so this word's letter breakdown is a
      // genuinely different shape from its siblings'. Zero new letters
      // even so — ற and து are both long taught.
      text: 'செய்கிறது',
      gloss: 'seykiṟatu — it does (3rd person singular, neuter gender, present)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ki', 'tam-letter-rra', 'tam-letter-tu'],
    },
    // p.41, 'III Person': "அவை or அவைகள் — செய்கின்றன - They do
    // (plural-neuter gender)", immediately followed on the same page by the
    // primer's own bracketed rule: "[With Neuter gender plural the tense
    // symbol 'கின்று' is used always, to sound rythmically with the
    // 'personal suffix' 'அன'.]" — the source of this gloss's parenthetical,
    // and the one stated exception to p.39's "The present tense symbols are
    // 'கிறு' and 'கின்று'. There is no difference between these two. Either
    // of them can be used." Suffix அன from the p.40 table.
    //
    // That exception governs which tense marker gets SELECTED, not any
    // sound change at a join, so this word still concatenates exactly and
    // correctly carries no sandhiRule — a euphonic motivation in the
    // source's prose is not a sandhi rule in this file's sense.
    //
    // The p.41 exercise "(3) ஒன்பது பூனைகள் ஓடுகின்றன" (nine cats run)
    // shows the same ending on another root. Those two are the ONLY -கின்ற-
    // forms printed anywhere in the primer, which is also why no
    // கின்று-marked form for any other person is shipped here: p.39 invites
    // the inference, but the primer never prints செய்கின்றேன் or
    // செய்கின்றோம், and generating them would be recall rather than
    // reading.
    {
      id: 'tam-word-seykinrrana',
      stage: 'words',
      level: 3,
      // ன் (tam-pulli-alveolar-na) and ன (tam-letter-alveolar-na) are two
      // distinct already-taught entries and both appear here, in that
      // order, either side of the bare ற — zero new letters.
      text: 'செய்கின்றன',
      gloss: 'seykiṉṟaṉa — they do (3rd person plural, neuter gender, present — built on the alternative tense marker கின்று, which this person-category always takes)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-ki',
        'tam-pulli-alveolar-na',
        'tam-letter-rra',
        'tam-letter-alveolar-na',
      ],
    },
    {
      id: 'tam-sentence-naam-seykirroom',
      stage: 'sentences',
      level: 3,
      // p.40, under 'e.g., I Person', printed as a complete sentence with
      // its English: "நாம் செய்கிறோம் - We do (inclusive)".
      text: 'நாம் செய்கிறோம்',
      gloss: 'nām seykiṟōm — we do (inclusive — "we" including you)',
      composedOf: ['tam-word-naam', 'tam-word-seykirroom'],
    },
    {
      id: 'tam-sentence-naangal-seykirroom',
      stage: 'sentences',
      level: 3,
      // p.40, the line directly beneath the one above: "நாங்கள்
      // செய்கிறோம் - We do (exclusive)". Printing them one under the other,
      // identical verb and different pronoun, is what makes this minimal
      // pair the primer's own teaching point rather than an arrangement of
      // this file's.
      text: 'நாங்கள் செய்கிறோம்',
      gloss: 'nāṅkaḷ seykiṟōm — we do (exclusive — "we" not including you)',
      composedOf: ['tam-word-naangal', 'tam-word-seykirroom'],
    },
    {
      id: 'tam-sentence-niingal-seykirriirgal',
      stage: 'sentences',
      level: 3,
      // p.40, under 'II Person': "நீங்கள் செய்கிறீர்கள் - You do (plural
      // and as well honorific singular)".
      text: 'நீங்கள் செய்கிறீர்கள்',
      gloss: 'nīṅkaḷ seykiṟīrkaḷ — you do (plural, and honorific to one person)',
      composedOf: ['tam-word-niingal', 'tam-word-seykirriirgal'],
    },
    {
      id: 'tam-sentence-athu-seykirrathu',
      stage: 'sentences',
      level: 3,
      // p.41, under 'III Person': "அது செய்கிறது - It does (singular-neuter
      // gender)".
      text: 'அது செய்கிறது',
      gloss: 'atu seykiṟatu — it does',
      composedOf: ['tam-word-athu', 'tam-word-seykirrathu'],
    },
    {
      id: 'tam-sentence-avai-seykinrrana',
      stage: 'sentences',
      level: 3,
      // p.41, under 'III Person': "அவை or அவைகள் — செய்கின்றன - They do
      // (plural-neuter gender)". அவை is taken as the subject because the
      // primer's own brace explicitly offers either pronoun with this one
      // verb form; the parallel அவைகள் sentence is deliberately NOT shipped
      // for that same reason — it would teach nothing this one does not.
      // The "not human beings" half of the gloss is the primer's own
      // contrast, from the அவர்கள் line on the same page ("They do
      // (plural-human beings- both masculine and feminine.)") and the p.40
      // table row "அவர்கள் - ஆர்கள் [(III person, plural (for human beings
      // only)]".
      text: 'அவை செய்கின்றன',
      gloss: 'avai seykiṉṟaṉa — they do (of things and animals, not human beings)',
      composedOf: ['tam-word-avai', 'tam-word-seykinrrana'],
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

    // ============ Negative participial nouns, tranche 20 ============
    // Andronov §240 (p.223, "PARTICIPIAL NOUNS"): the negative suffix
    // -aat- (already established, ceyyaathee/ceyyaathu above) takes a
    // further set of person/number suffixes to form a nominal ("he/she/it/
    // they who does/did/will not do") — grammatically distinct from a
    // finite verb: no tense distinction of its own, per Andronov's own
    // note. Each shipped bare, without Andronov's optional "(kaL)" plural
    // marker (same choice as ceyyaathiir above).
    {
      id: 'tam-word-ceyyaathavan',
      stage: 'words',
      level: 3,
      // செய்யா (already-taught stem) + தவன் (த + வ + the already-taught
      // dead ன், reused from அவன்) — plain concatenation, no sandhiRule.
      text: 'செய்யாதவன்',
      gloss: 'ceyyātavaṉ — he who does/will/did not do (negative participial noun, masculine singular)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-ta', 'tam-letter-va', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-word-ceyyaathavar',
      stage: 'words',
      level: 3,
      // Same stem + தவர் (த + வ + the already-taught dead ர், reused from
      // ceyyaathiir above) — the epicene-plural counterpart of ceyyaathavan.
      // Andronov §240 itself labels this specific form "(pl. epic)", but
      // the -அவர்/-ஆர் suffix family is standardly dual-purpose in Tamil
      // (the same double duty this file's own bare pronoun அவர் already
      // carries — "he/she, honorific" — see tam-word-avar) — disclosed in
      // the gloss rather than presented as exclusively plural.
      text: 'செய்யாதவர்',
      gloss:
        'ceyyātavar — they who do/will/did not do (negative participial noun; Andronov cites this specifically as epicene plural, but the -avar suffix, like this file\'s own அவர் pronoun, standardly doubles as honorific singular — "he/she who does/did not do")',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-ta', 'tam-letter-va', 'tam-pulli-ra'],
    },
    {
      id: 'tam-word-ceyyaathavai',
      stage: 'words',
      level: 3,
      // Same stem + தவை (த + வை, the already-taught bare vai letter) —
      // the neuter-plural counterpart, distinct from ceyyaathatu below.
      text: 'செய்யாதவை',
      gloss: 'ceyyātavai — those which do/will/did not do (negative participial noun, neuter plural)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-ta', 'tam-letter-vai'],
    },
    {
      id: 'tam-word-ceyyaathatu',
      stage: 'words',
      level: 3,
      // Same stem + தது (த + து, already taught from ceyyaathu itself) —
      // the neuter-SINGULAR participial noun, grammatically distinct from
      // the already-shipped tam-word-ceyyaathu (a FINITE 3rd-singular-
      // neuter negative indicative verb) despite the surface-similar gloss
      // and different spelling (செய்யாது vs செய்யாதது).
      text: 'செய்யாதது',
      gloss: "ceyyātatu — that which does/will/did not do; also a fossilised abstract noun meaning 'inaction' (negative participial noun, neuter singular)",
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-yaa', 'tam-letter-ta', 'tam-letter-tu'],
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

    // Tranche 20: the feminine counterpart, from the same Lesson
    // Twenty-One passage (a fresh live fetch of ABC of Tamil confirms it
    // on p.56: "அவள் + உடைய = அவளுடைய = her") — the genitive of
    // tam-word-aval ("she"), just added above. ளு here is the
    // already-taught FUSED letter tam-letter-llu (from tranche 5's ள
    // vowel-sign table) — using it directly, rather than decomposing to
    // dead ள் + உ, is what lets plain concatenation reach the real
    // spelling without a sandhiRule, the same reasoning already documented
    // on யாருடைய/அவனுடைய/அவருடைய. This is also why the genitive itself
    // needs zero new letters even though its base pronoun needed one
    // (dead ள், tam-pulli-lla, added above) — the same split tranche 19
    // already established for அவன்/அவனுடைய.
    {
      id: 'tam-word-avaludaiya',
      stage: 'words',
      level: 3,
      text: 'அவளுடைய',
      gloss: 'avaḷuṭaiya — her',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-letter-llu', 'tam-letter-ttai', 'tam-letter-ya'],
    },

    // Tranche 19: the honorific counterpart, from the same Lesson
    // Twenty-One passage, line 2048: "அவர் + உடைய = அவருடைய = his
    // (honorific)". ரு here is the already-taught FUSED letter
    // tam-letter-ru (from யாருக்கு/யாருடைய, tranche 9-10) — using it
    // directly, rather than decomposing to dead ர் + உ, is what lets
    // plain concatenation reach the real spelling without a sandhiRule,
    // the same reasoning already documented on யாருடைய and அவனுடைய.
    // Zero new letters.
    {
      id: 'tam-word-avarudaiya',
      stage: 'words',
      level: 3,
      text: 'அவருடைய',
      gloss: 'avaruṭaiya — his/her (honorific)',
      composedOf: ['tam-letter-a', 'tam-letter-va', 'tam-letter-ru', 'tam-letter-ttai', 'tam-letter-ya'],
    },

    // Tranche 20: the plural counterpart, same Lesson Twenty-One passage
    // (p.56: "அவர்கள் + உடைய = அவர்களுடைய = Their (Human beings)") — the
    // genitive of tam-word-avargal ("they"), just added above. Same ளு
    // fusion as அவளுடைய directly above (the dead ள் of அவர்கள் fuses into
    // ளு before உடைய); ர் and க are the already-taught tam-pulli-ra and
    // tam-letter-ka reused from அவர்கள் itself. Zero new letters.
    {
      id: 'tam-word-avargaludaiya',
      stage: 'words',
      level: 3,
      text: 'அவர்களுடைய',
      gloss: 'avarkaḷuṭaiya — their (human beings)',
      composedOf: [
        'tam-letter-a',
        'tam-letter-va',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-letter-llu',
        'tam-letter-ttai',
        'tam-letter-ya',
      ],
    },

    // Tranche 19: நான்'s genitive, "my" — the primer's own Lesson
    // Twenty-One derivation (lines 2069-2071) explains நான் irregularly
    // shortens to என் before the case-ending: "நான் + உடைய: நான் becomes
    // என் before taking a case-ending... = என் + (ன்) + உடைய = என்னுடைய".
    // என் itself is independently and separately taught vocabulary —
    // Lesson Two's own two-lettered-words list (line 354: "என் (en) -
    // my"), reinforced by Lesson Three's worked phrase "என் கால் - my
    // leg" (line 440) — not invented for this genitive. Zero new letters
    // (எ, ன் both already taught).
    {
      id: 'tam-word-en',
      stage: 'words',
      level: 3,
      text: 'என்',
      gloss: 'en — my',
      composedOf: ['tam-letter-e', 'tam-pulli-alveolar-na'],
    },
    // The primer's own derivation inserts an extra dead ன் before the
    // fused னு (a genuine gemination the primer documents directly, not
    // inferred, unlike அவனுடைய's own single-னு fusion): என் + (ன்) +
    // உடைய = என்னுடைய. Letters: எ + ன் (reused from tam-word-en above) +
    // னு (the same fused letter அவனுடைய already uses) + டை + ய (both
    // already taught). Zero new letters.
    {
      id: 'tam-word-ennudaiya',
      stage: 'words',
      level: 3,
      text: 'என்னுடைய',
      gloss: 'eṉṉuṭaiya — my',
      composedOf: [
        'tam-letter-e',
        'tam-pulli-alveolar-na',
        'tam-letter-alveolar-nu',
        'tam-letter-ttai',
        'tam-letter-ya',
      ],
    },

    // ============ A taught noun behind a taught possessive (level 3) ============
    // Extension, 2026-08-13 (tranche 22). This one lesson is the residue of
    // a search for level-4 ("Reading Practice — graded reading of real
    // text") material, and the size of that residue IS the finding: ABC of
    // Tamil, Book One contains no graded reading at all. It runs from
    // alphabet drill through word lists, derivations and short exercises to
    // Lesson Twenty-One's genitives and stops, its final exercise being
    // English-only prompts. Every Tamil phrase and sentence the book prints
    // was enumerated against this file's own taught words; exactly two
    // decompose completely, and one of them (நான் யார்) has been taught
    // since 2026-08-10. So Tamil level 4 stays empty — per LEVELS's own
    // comment that is a content-completeness signal, not an engine problem
    // — and opening it needs a different source, not more vocabulary.
    //
    // The remainder is என் கண், printed verbatim in Lesson Two's "Practise
    // with pronunciation" line, p.13, as its own comma-delimited item:
    // "எந்த, மகன், படம், பணம் (money), மகள், மரம், கல், கண், கள் (toddy),
    // நல்ல மரம், நல்ல பழம், என் கண், உன் மகள், என்ன பழம்? அந்த மரம், எந்த
    // மணல்?" Of that whole line it is the only phrase whose both halves this
    // curriculum already knows (tam-word-en, tam-word-kan) — the first Tamil
    // lesson here to put a taught noun behind a taught possessive.
    //
    // Unlike நான் யார், the gloss is COMPOSED, not quoted: the primer prints
    // this phrase unglossed, in a pronunciation drill. It is built from the
    // same lesson's two-lettered-words list, p.12 ("கண் (kaṇ) - an eye",
    // "என் (en) - my"), plus the book's own gloss of the identical என் +
    // body-part construction in Lesson Three's phrase list, p.15 ("என் கால்
    // - my leg"). Recorded explicitly because those drill lines are the
    // book's richest untapped seam, and every phrase mined out of them will
    // have this same property.
    //
    // Level 3, not 4, and that is the point rather than a compromise: this
    // is Lesson TWO drill material, printed EARLIER in the primer than நான்
    // யார், which this file holds at level 2. Shipping it at level 4 would
    // have made the manifest tell a learner that an alphabet-drill fragment
    // is graded reading. Level 3 is in any case the minimum legal level
    // here, since tam-word-en is itself level 3.
    {
      id: 'tam-sentence-en-kan',
      stage: 'sentences',
      level: 3,
      // Nothing happens at the junction — என் ends in a dead ன் and கண்
      // begins with a consonant, so none of Lesson Twelve's letter-junction
      // rules is triggered and the ordinary exact-match reconstruction
      // applies in full. No sandhiRule, deliberately.
      text: 'என் கண்',
      gloss: 'eṉ kaṇ — my eye',
      composedOf: ['tam-word-en', 'tam-word-kan'],
    },

    // ============ The செய் grid completed, five cells (level 3) ============
    // Extension, 2026-08-14 (tranche 23). Tranche 22 added five pronouns
    // (நாம், நாங்கள், நீங்கள், அது, அவை) but could conjugate them in the
    // PRESENT only, because ABC of Tamil Book One never reaches the other
    // tenses: its table of contents stops the sequence at "17.
    // Tenses--Present ... 38" and "18. Present Tense (contd.) ... 42", its
    // last lesson is TWENTYONE: CASES (Genitive), and Lesson Seventeen itself
    // opens "In this lesson we shall discuss the Present Tense symbols".
    // This tranche fills five of those nine empty cells from Andronov and
    // leaves four of them empty on purpose — see the NOT-shipped note at the
    // end of this block, which is as much of the tranche as what ships.
    // Zero new letters: all five words are already-taught letters
    // concatenated, which is what made this area worth doing now.
    //
    // The standing division of labour between the two sources applies to
    // every lesson below, and is why each one names both. Andronov romanises
    // throughout and never prints these forms in Tamil script — true of every
    // past/future form this file has taken from him since tranche 12 — so he
    // supplies the FORM and the English GLOSS, while the SPELLING of each
    // personal suffix is read in Tamil script off ABC of Tamil Book One's own
    // personal-suffix table, Lesson Seventeen, printed p.40, rendered at
    // 600 dpi and read visually this session: ஓம், ஈர்கள், அது and அன are all
    // printed there in script, which is also what fixes செய்தன's final letter
    // as the alveolar ன rather than ந.
    //
    // Pinpoints are § and printed page only, as tranche 22 established.
    // Andronov's printed page N is PDF page N+11, an offset re-derived this
    // session by rendering a page and reading its folio; his PDF has no text
    // layer at all, so every form below was read off a rendered page image,
    // and the OCR text was used only as a search index and for the negative
    // greps recorded in the NOT-shipped note. Both PDFs were re-downloaded
    // this session and are byte-identical by SHA-256 to the copies the
    // drafting pass read.

    // நாம்/நாங்கள்'s shared future — the future counterpart of the
    // already-shipped செய்கிறோம், one verb form for both pronouns exactly as
    // in the present.
    //
    // SPELLING: ABC of Tamil, Lesson Seventeen, p.40: "நாம் - ஓம் (I per.
    // Plural, inclusive)" and "நாங்கள் - ஓம் (I per. Plural, exclusive)". The
    // வோ grapheme spans the -வ்- / ஓம் morpheme boundary exactly as வே does
    // in the already-shipped செய்வேன் and தே does in செய்தேன்.
    //
    // FORM + GLOSS: Andronov, printed p.209 (= PDF p.220), which prints the
    // string verbatim inside a quoted Modern Tamil sentence: "appaal aavana
    // ceyvoom (RT, 205) 'Afterwards we shall do what is to be done'". The
    // word-level mapping is unambiguous — appaal "afterwards", aavana "what
    // is to be done", ceyvoom "we shall do".
    //
    // THE LIMITS OF THIS CITATION, recorded rather than smoothed over: this
    // is the weakest lesson in the tranche and the comment had better say so.
    // First, that is the SOLE occurrence of the string in the whole 390-page
    // book (exhaustive grep of the item's OCR text layer, used only as a
    // search index). Second, the section that actually TEACHES this cell does
    // not use this verb: §117, printed p.150, states the rule ("In the future
    // tense the suffix -oom is used in forms with the suffixes -v- / -p(p)-
    // or zero and is joined to them directly") but conjugates ceytal only in
    // the PRESENT (ceyki(n)Room / ceykiRpoom "we do"), switching to aRital →
    // aRivoom/aRikoom, ennutal → enpoom, naTattal → naTappoom for the future.
    // Third, the p.209 quotation is adduced under §216, which is about
    // participial nouns; the participial noun it illustrates is aavana (3rd
    // person neuter plural, matching §216's own remark that in Modern Tamil
    // these are used "for the most part in the 3rd person"), while ceyvoom is
    // the ordinary finite main verb of the clause. §216 also states that such
    // participial nouns "have the same suffixes as finite forms of the
    // indicative mood (cf. §§ 109-155) and do not differ in this respect from
    // the latter", so nothing in that section casts doubt on the spelling.
    //
    // What this lesson claims, and no more: the string ceyvoom is printed by
    // Andronov, attached to the verb cey-, with his own English "we shall
    // do". That is weaker footing than செய்வீர்கள்/செய்தீர்கள் below, where
    // §132 conjugates ceytal by name in all three tenses, and stronger than
    // செய்வார்/செய்தோம், where the string is never printed at all — which is
    // exactly why those two stay unshipped. A distractor checked and
    // excluded: printed p.22 prints "ceyvoon [seyvo:ⁿ] 'he who will do'" in
    // the phonetics chapter — that is செய்வோன், a masculine participial noun,
    // a different word from this one.
    {
      id: 'tam-word-seyvoom',
      stage: 'words',
      level: 3,
      // வோ (already an atomic letter, வ + the ō vowel sign, tranche 5) plays
      // the same role வே plays in செய்வேன் — plain concatenation of four
      // already-taught letters reaches the real spelling, no sandhiRule.
      text: 'செய்வோம்',
      gloss:
        'seyvōm — we shall do, we will do (1st person plural, future — one and the same form for inclusive நாம் and exclusive நாங்கள்)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-voo', 'tam-pulli-ma'],
    },
    // நீங்கள்'s future. This and செய்தீர்கள் below are the cleanest
    // citations in the tranche, and they share one source line.
    //
    // SPELLING: ABC of Tamil, Lesson Seventeen, p.40: "நீங்கள் - ஈர்கள் (II
    // person, plural and honorific)". The honorific-singular half of the
    // gloss is that table's own wording, reinforced by the same page's worked
    // example "நீங்கள் செய்கிறீர்கள் - You do (plural and as well honorific
    // singular)" — the very sentence this file already ships as
    // tam-sentence-niingal-seykirriirgal.
    //
    // FORM + GLOSS: Andronov §132, printed p.159, which conjugates ceytal by
    // name in this exact cell: "The suffix -iirkaL is for the most part used
    // in Modern Tamil. It is used in forms of all the three tenses and is
    // joined to the tense suffix similarly to the suffix -iir (cf. § 130);
    // e.g., ceytal 'to do' - ceykiRiirkaL 'you do', ceyviirkaL 'you will do',
    // ceytiirkaL 'you did'." The source names the verb and gives all three
    // tenses in one line, and its present-tense member ceykiRiirkaL IS the
    // already-shipped செய்கிறீர்கள் — so the derivation of the two new forms
    // is checkable against content this file already carries.
    {
      id: 'tam-word-seyviirgal',
      stage: 'words',
      level: 3,
      // வீ (already an atomic letter, வ + the ī vowel sign, tranche 5) spans
      // the -வ்- / ஈர்கள் boundary the same way வோ does above, and the ர்கள்
      // ending is the one செய்கிறீர்கள்/செய்வார்கள் already use — plain
      // concatenation, no sandhiRule.
      text: 'செய்வீர்கள்',
      gloss: 'seyvīrkaḷ — you will do (2nd person plural, future; also the honorific singular)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-vii',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-pulli-lla',
      ],
    },
    // நீங்கள்'s past — same two pinpoints as செய்வீர்கள் directly above, read
    // in the same session off the same renders. SPELLING of the suffix
    // ஈர்கள்: ABC of Tamil, Lesson Seventeen, p.40, "நீங்கள் - ஈர்கள் (II
    // person, plural and honorific)". FORM + GLOSS: Andronov §132, printed
    // p.159, "... e.g., ceytal 'to do' - ceykiRiirkaL 'you do', ceyviirkaL
    // 'you will do', ceytiirkaL 'you did'." The past marker is the same -த-
    // this file has used for செய்தேன்/செய்தான்/செய்தாள்/செய்தார்/
    // செய்தார்கள் since tranche 12; only the personal suffix differs.
    {
      id: 'tam-word-seythiirgal',
      stage: 'words',
      level: 3,
      // தீ is already an atomic letter, reused from the already-shipped
      // செய்யாதீர் — plain concatenation, no sandhiRule.
      text: 'செய்தீர்கள்',
      gloss: 'seytīrkaḷ — you did (2nd person plural, past; also the honorific singular)',
      composedOf: [
        'tam-letter-ce',
        'tam-pulli-ya',
        'tam-letter-tii',
        'tam-pulli-ra',
        'tam-letter-ka',
        'tam-pulli-lla',
      ],
    },
    // அது's past — the past counterpart of the already-shipped செய்கிறது.
    //
    // SPELLING: ABC of Tamil, Lesson Seventeen, p.40: "அது - அது (III person,
    // singular, neuter gender)" — the pronoun and its personal suffix are the
    // same string, which is exactly why the joined form doubles the த.
    //
    // FORM + GLOSS: Andronov §148, printed p.168, which conjugates ceytal by
    // name: "In the past tense the suffix -atu is used in forms derived by
    // the tense suffixes -t(t)-, -nt-, -i- and is joined to the first two of
    // them directly and to the last one by means of the increment -n- or -y-;
    // e.g., ceytal 'to do' - ceytatu 'it did', iruttal 'to be' - iruntatu 'it
    // was'." The same section's present-tense paragraph gives ceyki(n)Ratu
    // "it does", which is the already-shipped செய்கிறது — so this derivation
    // too is checkable against existing content.
    //
    // Not a duplicate of the already-shipped செய்யாதது (ceyyātatu, tranche
    // 16's NEGATIVE participial noun from §240): different form, different
    // section, different meaning. Worth noting for a later tranche that this
    // affirmative ceytatu is itself homonymous with a participial noun ("that
    // which has been done"), which Andronov declines elsewhere; §148 plainly
    // gives the finite "it did", which is all this lesson glosses, but the
    // file may eventually want the two senses distinguished the way it
    // already distinguishes the ceyyaata- family.
    {
      id: 'tam-word-seythathu',
      stage: 'words',
      level: 3,
      // The two adjacent த are real and are the point of the form: the first
      // is the past marker, the second (as து) is the head of the suffix அது,
      // whose அ is absorbed into the preceding dead consonant by ordinary
      // Tamil orthography — த் + அது = தது. That is spelling convention, not
      // a sound change the source states, so no sandhiRule: plain
      // concatenation of already-taught letters reaches the real spelling.
      text: 'செய்தது',
      gloss: 'seytatu — it did (3rd person singular, neuter gender, past)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ta', 'tam-letter-tu'],
    },
    // அவை's past — the past counterpart of the already-shipped செய்கின்றன.
    //
    // SPELLING: ABC of Tamil, Lesson Seventeen, p.40: "அவை, அவைகள் - அன (III
    // person, plural, neuter gender)" — note the alveolar ன, which is what
    // fixes the last letter as tam-letter-alveolar-na and not tam-letter-na.
    //
    // FORM + GLOSS: Andronov §155, printed p.172, which conjugates ceytal by
    // name: "In the past tense the suffix -a is used in forms derived by the
    // tense suffixes -t(t)-, -nt-, -i-. It is joined to the first two of them
    // either by means of the increment -an- (commonly) or directly (in
    // Classical Tamil rarely) and to the last one, by means of the increment
    // -n-; e.g., ceytal 'to do' - ceyt(an)a 'they did'." The -an- variant is
    // additionally attested verbatim in that section's own quoted sentence,
    // "mulaimukanh ceytana muLLeyi Rilamkina talaimuTi caanRa (A, 7)".
    //
    // WHY ceytana AND NOT ceyta — i.e. why this one departs from this file's
    // usual bracket-dropping habit. Elsewhere the bracketed material was the
    // optional CLASSICAL extra and dropping it produced the modern standard
    // (ceyyaatiir(kaL) → செய்யாதீர், cey(ku)vaan → செய்வான்). Here Andronov
    // labels it the other way round — the increment is the one used
    // "commonly", bare joining is "in Classical Tamil rarely" — so dropping
    // would have produced the rare classical form, the reverse of the
    // register choice those earlier drops were making. The habit is a proxy
    // for that choice, not the choice itself. Keeping the increment also
    // matches the already-shipped present-tense counterpart செய்கின்றன, which
    // carries the same -அன-.
    {
      id: 'tam-word-seythana',
      stage: 'words',
      level: 3,
      // The final letter is ன (tam-letter-alveolar-na, U+0BA9), not ந — as
      // printed in ABC's p.40 suffix அன and as in the already-shipped
      // செய்கின்றன. Plain concatenation, no sandhiRule.
      text: 'செய்தன',
      gloss: 'seytaṉa — they did (3rd person plural, neuter gender, past)',
      composedOf: ['tam-letter-ce', 'tam-pulli-ya', 'tam-letter-ta', 'tam-letter-alveolar-na'],
    },
    {
      id: 'tam-sentence-naam-seyvoom',
      stage: 'sentences',
      level: 3,
      // The future counterpart of the already-shipped
      // tam-sentence-naam-seykirroom, in the same pronoun + finite verb frame
      // ABC of Tamil p.40 uses for its own worked examples ("நாம்
      // செய்கிறோம் - We do (inclusive)"). The agreement asserted here — that
      // நாம் takes the suffix ஓம் — is that same page's own table entry,
      // "நாம் - ஓம் (I per. Plural, inclusive) - (This includes the II
      // person.)", stated for the personal suffixes as such ("Now we shall
      // see all the personal suffixes"), not for one tense; Andronov's §117
      // is likewise organised by person across all three tenses. Assembling
      // the tense counterpart of an existing sourced pairing is this file's
      // own established precedent (tam-sentence-avan-seythaan).
      //
      // The verb carries the caveat recorded on its own lesson above:
      // Andronov prints the string exactly once in the book, in a §216
      // quotation whose illustrated participial noun is aavana rather than
      // ceyvoom, and §117, which teaches this cell, conjugates ceytal in the
      // present only. This sentence is therefore assembled on a frame the
      // primer prints around a verb form attested once; it is the least
      // directly sourced item in this tranche and should be the first thing
      // revisited if a paradigm-table source (Arden) is ever fetched.
      text: 'நாம் செய்வோம்',
      gloss: 'nām seyvōm — we shall do (inclusive — "we" including you)',
      composedOf: ['tam-word-naam', 'tam-word-seyvoom'],
    },
    {
      id: 'tam-sentence-naangal-seyvoom',
      stage: 'sentences',
      level: 3,
      // The future counterpart of the already-shipped
      // tam-sentence-naangal-seykirroom. ABC of Tamil p.40 gives both the
      // table entry "நாங்கள் - ஓம் ((I per. Plural, exclusive) - (This
      // excludes the II person.)" (the doubled opening paren is the primer's
      // own typo, kept in the quote for fidelity) and the worked pairing
      // "நாங்கள் செய்கிறோம் - We do (exclusive)". Shipping this beside நாம்
      // செய்வோம் is the pedagogical point the primer itself makes on that
      // page: one and the same verb form serves the inclusive and the
      // exclusive pronoun, and only the pronoun distinguishes them — exactly
      // as the present-tense pair already in this file does.
      //
      // Same inherited caveat as the sentence above: the verb செய்வோம் is
      // attested once in Andronov (§216, printed p.209), and §117, which
      // teaches the 1st-plural future, does not conjugate ceytal in that
      // tense — see the verb's own lesson for the full record. The
      // pronoun/suffix agreement and the pronoun + verb frame, by contrast,
      // are ABC of Tamil p.40's own.
      text: 'நாங்கள் செய்வோம்',
      gloss: 'nāṅkaḷ seyvōm — we shall do (exclusive — "we" not including you)',
      composedOf: ['tam-word-naangal', 'tam-word-seyvoom'],
    },
    {
      id: 'tam-sentence-niingal-seyviirgal',
      stage: 'sentences',
      level: 3,
      // The future counterpart of the already-shipped
      // tam-sentence-niingal-seykirriirgal. The pronoun/suffix agreement is
      // ABC of Tamil p.40's own — "நீங்கள் - ஈர்கள் (II person, plural and
      // honorific)" — and that page prints the present-tense member of this
      // very frame, "நீங்கள் செய்கிறீர்கள் - You do (plural and as well
      // honorific singular)". The verb is Andronov §132, printed p.159's own
      // ceyviirkaL "you will do".
      text: 'நீங்கள் செய்வீர்கள்',
      gloss: 'nīṅkaḷ seyvīrkaḷ — you will do (plural, and honorific to one person)',
      composedOf: ['tam-word-niingal', 'tam-word-seyviirgal'],
    },
    {
      id: 'tam-sentence-niingal-seythiirgal',
      stage: 'sentences',
      level: 3,
      // Same frame and the same two pinpoints as நீங்கள் செய்வீர்கள் directly
      // above: agreement from ABC of Tamil p.40 ("நீங்கள் - ஈர்கள் (II
      // person, plural and honorific)", with its worked present-tense pairing
      // நீங்கள் செய்கிறீர்கள்), verb from Andronov §132, printed p.159
      // ("ceytiirkaL 'you did'"). Shipping the past beside the future
      // completes நீங்கள்'s three-tense row, the one row in this tranche
      // where a single source line supplies all three tenses of செய் by name.
      text: 'நீங்கள் செய்தீர்கள்',
      gloss: 'nīṅkaḷ seytīrkaḷ — you did (plural, and honorific to one person)',
      composedOf: ['tam-word-niingal', 'tam-word-seythiirgal'],
    },
    {
      id: 'tam-sentence-athu-seythathu',
      stage: 'sentences',
      level: 3,
      // The past counterpart of the already-shipped
      // tam-sentence-athu-seykirrathu. Agreement from ABC of Tamil p.40's
      // personal-suffix table, "அது - அது (III person, singular, neuter
      // gender)"; verb from Andronov §148, printed p.168, "ceytal 'to do' -
      // ceytatu 'it did'". The sentence is a striking one to read aloud
      // precisely because the pronoun and the verb's personal suffix are the
      // same word — which is what that table entry is saying.
      text: 'அது செய்தது',
      gloss: 'atu seytatu — it did',
      composedOf: ['tam-word-athu', 'tam-word-seythathu'],
    },
    {
      id: 'tam-sentence-avai-seythana',
      stage: 'sentences',
      level: 3,
      // The past counterpart of the already-shipped
      // tam-sentence-avai-seykinrrana, and its gloss follows that lesson's
      // own wording for the neuter/non-human restriction. Agreement from ABC
      // of Tamil p.40's personal-suffix table, "அவை, அவைகள் - அன (III person,
      // plural, neuter gender)"; verb from Andronov §155, printed p.172,
      // "ceytal 'to do' - ceyt(an)a 'they did'". Note the tense-marker
      // asymmetry this pair teaches, which the sources themselves force: the
      // present செய்கின்றன has to use the கின்று marker (the primer states
      // that rule outright, and §155's present paragraph derives the neuter
      // plural from -inR- specifically), while the past uses the ordinary -த-
      // shared with every other person in this file.
      text: 'அவை செய்தன',
      gloss: 'avai seytaṉa — they did (of things and animals, not human beings)',
      composedOf: ['tam-word-avai', 'tam-word-seythana'],
    },
    // NOT shipped, deliberately — four cells of the same grid, left as honest
    // gaps. All four fail the same way, and the pattern is now confirmed
    // often enough to be worth recording as a finding rather than as bad
    // luck: Andronov states the rule in the right section, conjugates செய் by
    // name in that section's OTHER tenses, then switches to a different verb
    // for exactly the cell wanted. He varies his illustrative verb by
    // paragraph, and this file has been mining one verb.
    //
    // செய்தோம் (1st plural PAST — நாம்/நாங்கள்'s missing cell, and the most
    // conspicuous asymmetry left here, since its future counterpart ships).
    // §117, printed p.150, is organised present / future / past, and only the
    // PRESENT paragraph conjugates ceytal (ceyki(n)Room / ceykiRpoom "we
    // do"). The past paragraph switches verbs entirely — uzhutal → uzhutoom,
    // paarttal → paarttoom, iruttal → iruntoom, ezhututal → ezhutinoom — and
    // its quoted sentence (RKT, 84-85) uses poonoom, paarttoom, cuzhaRRinoom,
    // still not ceytal. A grep of the whole text for "ceytoom" and its
    // OCR-plausible variants returns ZERO hits anywhere in the book. That is
    // the sharp line between the two 1st-plural cells: செய்வோம் is a string
    // Andronov prints with the gloss "we shall do"; செய்தோம் is a string he
    // never prints at all, and deriving it from ஓம் + -த- would be pure
    // paradigm arithmetic. Deliberately not papered over by withholding
    // செய்வோம் too — an honest asymmetry is better content than a symmetric
    // guess.
    //
    // செய்யும் (3rd singular neuter FUTURE — அது's missing cell). §150,
    // printed p.169, states the -um future rule and then illustrates it with
    // iruttal → irukkum, niRRal → niRkum, keeTTal → keeTkum, uNNutal →
    // uNNum/uNkum, varutal → var(uk)um, pootal → poo(ku)m, aatal → aa(ku)m:
    // seven verbs, none of them ceytal. The string "ceyyum" does occur
    // elsewhere in the book, and each hit was read rather than counted — a
    // Kural quotation cited to illustrate the interrogative evan and glossed
    // "can ... yield" ("vaanuyar tooRRa mevan ceyyum?", K, 272), relative
    // participles inside noun phrases (utavi ceyyum eNNam, toNTu ceyyum), the
    // temporal ceyyumpootu "while doing", a colloquial imperative ceyyumka, a
    // contracted ceym "(from ceyyum)", and an optative ceyyumaaka. None is
    // செய் conjugated in this cell with this meaning.
    //
    // செய்வன (3rd plural neuter FUTURE — அவை's missing cell). §155, printed
    // p.172, covers the neuter plural -a suffix in all three tenses and
    // conjugates ceytal BY NAME in the present (ceykinRana) and the past
    // (ceyt(an)a, shipped above) — but its future paragraph switches to
    // corital → coriv(an)a "they will drop down" and naTattal → naTapp(an)a
    // "they will walk", and its quoted sentences use takaippana, takaippa,
    // toonRuva. The one verb the section otherwise conjugates throughout is
    // the one verb it skips in this cell. That the shape would be trivially
    // predictable from the past form beside it is precisely why it must not
    // be written. ("ceyvana" does occur once in the book, "ceyvana tiruntac
    // cey" — a participial-noun object of an imperative, not a finite
    // 3rd-plural neuter future.)
    //
    // செய்வார் (3rd singular honorific FUTURE) stays dropped, re-verified
    // this session from the page image rather than from tranche 22's note:
    // §142, printed p.164, states the rule ("In the future tense the suffixes
    // -aar / -ar are used in forms derived by the tense suffixes -v- / -p(p)-
    // or -m-") and then switches verbs for every single example — ennutal →
    // enpa(a)r / enma(a)r / enmanaar, with running citations
    // koopittukkoLvaar, puRantarukuvar, mozhimanaar — even though the same
    // section conjugates ceytal by name for the present and the past two
    // paragraphs earlier. An exhaustive grep for ceyvaar/ceyvar in any
    // affixed form returns exactly one hit, and it is inside the plural
    // ceyvaarkaL of §143 that this file already ships.
    //
    // Also considered and NOT proposed, noted so the omissions are visibly
    // deliberate rather than overlooked. ceykiRpoom (§117's alternant for the
    // present 1st plural, beside ceyki(n)Room) and the ceyk- alternants
    // generally: this file made its register choice in tranche 14 — the
    // ceyv- / modern standard over the ceyk- classical alternant — and a
    // second present-tense "we do" would reopen a settled decision. And
    // செய்வோன் "he who will do", printed in the phonetics chapter at pp.22-23
    // beside vantoom: an active trap for anyone grepping for ceyvoom, since
    // the two strings differ by one letter and sit in the same neighbourhood,
    // but it is a masculine participial noun in -ஓன், not the 1st-plural
    // finite form shipped above.
    //
    // What would actually unblock the four gaps is a source that prints a
    // full paradigm TABLE for one verb rather than rule-plus-example prose.
    // Named but still not fetched: ABC of Tamil Books Two/Three (if
    // tamilvu.org hosts them, not checked here) and Arden's *A Progressive
    // Grammar of Common Tamil*, the likelier candidate — a teaching grammar
    // with conjugation tables, old enough to be on archive.org. Either would
    // also settle the register question this file keeps re-deciding case by
    // case (ceyv- versus ceyk-, bracketed increments in or out) by showing a
    // single coherent paradigm instead of scattered alternants. A tranche
    // working this area again should expect the remaining gaps to be
    // structural rather than searchable, and should not spend its budget
    // re-grepping.

    // ============ A second verb root: போ "to go" (level 2-3) ============
    // Extension, 2026-08-14 (tranche 24). Every finite verb in this file since
    // tranche 7 has been செய். That is a real weakness for a learner — the
    // present-tense pattern has only ever been seen on one root, so nothing
    // distinguishes what belongs to the tense from what belongs to the verb.
    // This tranche adds the primer's second root, போ ("to go"), and the three
    // persons ABC of Tamil actually prints it in. Zero new letters: போ, கி,
    // றே, றா, ன், ர் are all already taught, so nothing had to be inserted
    // ahead of the vocabulary block and the letters-ordering rule is untouched.
    //
    // ONE SOURCE, ONE METHOD, for every lesson below. ABC of Tamil Book One
    // supplies BOTH the Tamil spelling and the English gloss here — unlike the
    // tranche-23 block above, no Andronov material is involved and no form is
    // taken from a romanisation. The primer's TAB/TSCII text layer decodes
    // wrong and was used only as a locator: grepping it for the mis-decoded
    // போ byte-sequence returned pages 33, 39, 41, 45 and 55, and each of those
    // (plus p.40 for the personal-suffix table) was then rendered at 600 dpi
    // with pdftoppm and READ AS GLYPHS. Page-number drift was checked on every
    // page used by cropping and reading that page's own printed footer digit;
    // in this range the extracted page number and the printed one agree.
    //
    // The ற/ர and ன்/ண் confusions this area is prone to were settled without
    // relying on the eye. Each new form's rendered tail was set beside the
    // SAME PAGE's already-shipped செய் counterpart (p.41 prints "அவர்
    // செய்கிறார்" a few lines above the exercise line "அவர் போகிறார்"), and
    // the shipped forms' codepoints were dumped from this very manifest: ற is
    // U+0BB1 (inside tam-letter-rraa/rree), ர is U+0BB0 (tam-pulli-ra), and
    // போகிறார் is the one form containing both, in that order. Comparing a new
    // form against an already-verified form printed in the same font on the
    // same page is a stronger discriminator than any amount of magnification.
    //
    // No sandhiRule on any lesson here, for the reason already established at
    // tam-word-seykirren: the primer does state a real fusion on p.39 ("று =
    // ற் + உ; 'உ' is a short vowel and it gives room for the long vowel 'ஏ'"),
    // but றே is already an atomic letter in this curriculum, so the
    // concatenation is exact and there is no unexplained change for a rule to
    // name.
    {
      id: 'tam-word-poo',
      stage: 'words',
      level: 2,
      // SPELLING and GLOSS both ABC of Tamil, printed p.33 (footer digit
      // rendered and read), Lesson FOURTEEN's vocabulary list — the lesson
      // boundary was checked against the heading offsets, not eyeballed: on
      // the rendered page the LESSON FIFTEEN heading sits physically BELOW
      // this vocabulary block. The page prints "போ - pō = to go", and a few
      // lines above it builds the syllable itself: "ப் + ஓ = போ (pō)".
      // Corroborated on p.39: "நான் = I; போ = to go".
      //
      // Level 2 to sit beside tam-word-sey, the other bare root, which the
      // primer likewise introduces in a plain vocabulary list. A word whose
      // text is a single already-taught letter has precedent here in
      // tam-word-nii (நீ ← tam-letter-nii).
      text: 'போ',
      gloss: 'pō — to go (verb root)',
      composedOf: ['tam-letter-poo'],
    },
    {
      id: 'tam-word-pookirreen',
      stage: 'words',
      level: 3,
      // SPELLING and GLOSS both ABC of Tamil, printed p.39, Lesson Seventeen
      // (Tenses - Present), which prints its own worked derivation with the
      // English at the head of the equation: "I go = நான் போ+கிறு+ஏன் >
      // போகிறு+ஏன் = போகிறேன்". This is the primer's headline example of the
      // present tense, not an incidental mention. Person label from the same
      // lesson's personal-suffix table, printed p.40: "நான் - ஏன் (I person,
      // singular)". Corroborated on p.45, where the finished sentence is
      // re-printed and parsed.
      //
      // Same tense-symbol + personal-suffix fusion as tam-word-seykirren, on a
      // different root: போ + கிறு + ஏன் → போகிறேன், with றே (already atomic)
      // absorbing the fusion. Level 3, the tier its exact twin செய்கிறேன்
      // sits at — this is a verb form, which is what LEVELS calls tier 3, not
      // the graded reading of real text that tier 4 means. Tamil level 4 is
      // still empty after this tranche and is meant to stay that way until a
      // source with actual connected text is fetched.
      text: 'போகிறேன்',
      gloss: 'pōkiṟēṉ — I go (1st person singular, present)',
      composedOf: ['tam-letter-poo', 'tam-letter-ki', 'tam-letter-rree', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-sentence-naan-pookirreen',
      stage: 'sentences',
      level: 3,
      // The primer's own sentence, printed twice. On p.39 it is set on its own
      // line, "நான் போகிறேன்.", directly under the equation headed "I go =",
      // which is therefore the book's own English for exactly these two words.
      // On p.45 (Lesson Nineteen, Cases) the same sentence is re-printed as
      // the worked example of the nominative and parsed: "நான் போகிறேன். நான்
      // - I Person, singular". Read, not assembled from separately-sourced
      // words — the failure mode this file guards against.
      //
      // The printed full stop is dropped, following this file's own precedent
      // at tam-sentence-naan-seykirren.
      text: 'நான் போகிறேன்',
      gloss: 'nāṉ pōkiṟēṉ — I go',
      composedOf: ['tam-word-naan', 'tam-word-pookirreen'],
    },
    {
      id: 'tam-word-pookirraan',
      stage: 'words',
      level: 3,
      // SPELLING and GLOSS both ABC of Tamil, printed p.55 (Lesson Twenty,
      // Dative), whose worked sentence reads: "அவன் வீட்டுக்குப் போகிறான் = He
      // goes to (the) house." The verb is printed there and the "He goes" half
      // of the book's own English is its gloss; the rest of that English
      // belongs to வீட்டுக்குப், which is NOT shipped (see the note below).
      // Person label from the personal-suffix table, printed p.40: "அவன் - ஆன்
      // (III person, singular, masculine)" — the same table cell the
      // already-shipped செய்கிறான் is glossed from.
      //
      // ATTESTATION STRENGTH, recorded rather than smoothed over: this form
      // occurs ONCE in the whole book, embedded in a dative sentence. Every
      // occurrence of the போ byte-sequence in the text layer was enumerated
      // (eight: three bare போ, one derivation line, two நான் போகிறேன்., one
      // போகிறார், one போகிறான்) and each was rendered and read. The word is
      // printed and glossed, but on a single attestation — weaker footing than
      // போகிறேன் above, which the book prints in three places.
      text: 'போகிறான்',
      gloss: 'pōkiṟāṉ — he goes (3rd person singular masculine, present)',
      composedOf: ['tam-letter-poo', 'tam-letter-ki', 'tam-letter-rraa', 'tam-pulli-alveolar-na'],
    },
    {
      id: 'tam-word-pookirraar',
      stage: 'words',
      level: 3,
      // SPELLING from ABC of Tamil, printed p.41, the end-of-Lesson-Seventeen
      // exercise "II. Translate into English", item (4): "அவர் போகிறார்". The
      // surrounding item numbers were read too, to confirm (4) is exactly
      // these two words and not a line-wrap: "... ஓடுகின்றன (4) அவர் போகிறார்
      // (5) அவர்கள் பாடுகிறார்கள் (6) ...".
      //
      // GLOSS DERIVED, and flagged as such because this is the one place in
      // the tranche where the book withholds its English — translating the
      // line is the student's task. Nothing in the gloss is recalled: "goes"
      // is the book's own English for போ in a finite 3rd-person form (p.55,
      // "He goes"), and "III person, singular, honorific - masculine and
      // feminine" is the p.40 suffix table verbatim, which is also the exact
      // wording the same book prints for the identical paradigm cell of செய்
      // on p.41 ("அவர் செய்கிறார் - He (she) does (singular-honorific, both
      // masculine and feminine)"). This is the book's own English recombined
      // into the book's own paradigm cell, with the Tamil string itself read
      // off the page — not composition of a Tamil form, which is what the
      // skt-word-nayati precedent forbids. Deliberately distinguished from
      // that case: there is no avoidance signal here at all. The primer runs
      // its full person table on செய் because செய் is its model verb, and it
      // uses போ freely in its own headline derivation and in its exercises.
      text: 'போகிறார்',
      gloss: 'pōkiṟār — he/she goes (3rd person singular honorific, present, both masculine and feminine)',
      composedOf: ['tam-letter-poo', 'tam-letter-ki', 'tam-letter-rraa', 'tam-pulli-ra'],
    },
    {
      id: 'tam-sentence-avar-pookirraar',
      stage: 'sentences',
      level: 3,
      // The complete two-word sentence as ABC of Tamil prints it on p.41,
      // exercise item (4) — a sentence read off the page, not one assembled
      // here from separately-taught words. The gloss carries the same derived
      // status, and the same justification, as tam-word-pookirraar above, and
      // is worded parallel to this file's own tam-sentence-avar-seykirraar.
      text: 'அவர் போகிறார்',
      gloss: 'avar pōkiṟār — he/she goes (honorific)',
      composedOf: ['tam-word-avar', 'tam-word-pookirraar'],
    },
    // NOT shipped from this area, deliberately.
    //
    // அவன் வீட்டுக்குப் போகிறான் ("He goes to (the) house", printed p.55, read
    // at 600 dpi) — blocked on letters and on vocabulary at once.
    // வீட்டுக்குப் needs a dead ட் and a dead ப், neither of which this file
    // teaches, and it would also need the noun வீடு, which no vocabulary list
    // on any page rendered here gives. Bringing those two letters would mean
    // inserting them ahead of the entire Tamil vocabulary block (the
    // manifests.test.ts ordering rule), a much larger edit than this tranche
    // warrants, and the sentence would STILL be missing its noun afterwards.
    // Only its verb ships, glossed from the "He goes" half of the book's own
    // English.
    //
    // அவன் போகிறான் as a standalone sentence — NOT PRINTED anywhere. போகிறான்
    // occurs only inside that p.55 dative sentence. Both words are
    // individually attested and the join would reconstruct cleanly, which is
    // exactly why the temptation is worth naming: composing it here would be
    // this file writing Tamil rather than reading it.
    //
    // The other nine persons of போ's present paradigm (போகிறாய், போகிறோம்,
    // போகிறீர்கள், போகிறாள், போகிறார்கள், போகிறது, போகின்றன, ...) — the primer
    // runs its FULL person table on செய் only (p.40-41) and never prints போ
    // with any of these suffixes. Generating them from the suffix table is
    // paradigm arithmetic on forms the book does not print, the same line this
    // file drew at செய்வார் and செய்தோம். போ is attested in exactly three
    // persons, all present tense, and that partial paradigm is what ships.
    //
    // Past and future போ (போனேன், போவேன், ...) and negatives (போகாதே, ...) —
    // nothing to read. Every occurrence of the root in the book is one of the
    // eight enumerated above, and all are present tense or the bare root; the
    // past/future lessons use other verbs entirely.
    //
    // "You go" (p.33 exercise I item 5) and "I go" (p.41 exercise I item 1) —
    // these are ENGLISH prompts asking the student to produce Tamil, with no
    // Tamil printed for them. The p.41 "I go" prompt happens to have its
    // answer printed elsewhere (p.39), which is why the நான் sentence above
    // ships; the p.33 "You go" has no printed Tamil answer anywhere.
    //
    // Still blocked after this tranche: the dative-sentence family, which
    // needs a ட்/ப் letters tranche of its own plus sourced nouns (வீடு, நாய்)
    // — the p.55 doubling note, read at 600 dpi, is a genuine printed sandhi
    // rule this curriculum could eventually teach: "[Words beginning with க,
    // ச, த and ப get doubled after the dative case symbol 'கு'. This is for an
    // easy and continous pronunciation.]". And Tamil level 4, unchanged and
    // still empty for tranche 22's own enumerated reason. The obvious next
    // tranche on this same evidence standard is p.39's other roots — எழுது
    // (to write), ஓடு (to run), பாடு (to sing), ஆடு / விளையாடு (to play) —
    // each printed there in the identical "நான் X+கிறு+ஏன் = நான் Xகிறேன் =
    // I write/run/sing/play" frame with its English; three of them end in டு
    // and may run into the same dead-ட் problem.
  ],
};
