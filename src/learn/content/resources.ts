/**
 * Reading resources for the operator to work through outside the curriculum
 * itself — data, not code, the same reasoning as `sanskrit.ts`/`tamil.ts`.
 *
 * Every URL below was actually fetched and confirmed live on 2026-08-10, not
 * assumed — several plausible candidates were rejected during that pass for
 * failing a live check (dead audio links, 404s, a Cloudflare bot wall that
 * blocked verification entirely) rather than included on faith. `howToRead`
 * is deliberately concrete (what to read/skip/skim, in what order) rather
 * than generic, and `license` records what each source states about itself,
 * not a legal opinion.
 *
 * `embeddableExcerpt` is set only where BOTH a genuinely open license AND a
 * real excerpt exist (`skt-primer-perry`, `tam-wikibooks`, `tam-wiktionary`)
 * — never add one here without confirming the license yourself, and never
 * copy in copyrighted book text because it would be convenient to embed.
 *
 * `inAppNotes` is different: original commentary written for this app about
 * a resource whose content itself cannot be reproduced (copyright unclear,
 * or a live lookup tool with nothing fixed to quote). It teaches the same
 * ideas the resource covers without reproducing the resource's own text, so
 * a learner gets real in-app value even where an excerpt is off the table —
 * the external link stays as the secondary, click-through option.
 *
 * `embedUrl` is for a video resource whose uploader has not disabled
 * embedding — an actual inline player, not just a thumbnail link. Also
 * covers a whole PLAYLIST via YouTube's `/embed/videoseries?list=<id>` form
 * (e.g. `skt-varnamala-audio`, `skt-pravesha-course`, `tam-pronunciation-
 * playlist`) — same field, same iframe treatment in the UI, since a playlist
 * embed is just a different YouTube embed path, not a different mechanism.
 * A single video is confirmed via YouTube's oEmbed endpoint (a 401/404 there
 * means embedding is disabled); oEmbed does not itself validate a *playlist*
 * embed, so each playlist URL here was ALSO rendered in a real iframe served
 * from a real http origin and screenshotted before being added — an
 * `about:blank`/no-origin test page is not sufficient, it 153s even for a
 * perfectly embeddable playlist.
 *
 * `embeddableBookUrl` is the archive.org equivalent for a full public-domain
 * scan: their `/embed/<identifier>` BookReader, which archive.org itself
 * documents as an embed target (no X-Frame-Options/frame-ancestors block —
 * confirmed live, not assumed). Only set where the *whole* work is public
 * domain, not merely "free to read" — that is a much narrower bar than
 * `inAppNotes` or `embeddableExcerpt` and most resources here don't clear it.
 */

export type ResourceLanguage = 'sanskrit' | 'tamil';
export type ResourceType = 'article' | 'book' | 'video' | 'course' | 'dictionary' | 'audio' | 'primer';

export interface Resource {
  readonly id: string;
  readonly language: ResourceLanguage;
  readonly title: string;
  readonly author: string;
  readonly sourceUrl: string;
  readonly type: ResourceType;
  /** Concrete, resource-specific guidance: what to read, skip, or skim, and in what order. */
  readonly howToRead: string;
  /** What the source states about its own license/copyright status — not a legal opinion. */
  readonly license: string;
  /** Only set for a short, clearly openly-licensed excerpt. Absent for almost everything. */
  readonly embeddableExcerpt?: string;
  /** Original in-app teaching commentary written for this app. Not a reproduction of the source. */
  readonly inAppNotes?: string;
  /** A confirmed-embeddable YouTube `/embed/...` URL. Only set on `type: 'video'` resources. */
  readonly embedUrl?: string;
  /** A confirmed-embeddable archive.org `/embed/<identifier>` URL for a whole public-domain scan. */
  readonly embeddableBookUrl?: string;
}

export const resources: readonly Resource[] = [
  {
    id: 'skt-primer-perry',
    language: 'sanskrit',
    title: "A Sanskrit Primer (based on Bühler's Leitfaden)",
    author: 'Edward Delavan Perry',
    sourceUrl: 'https://archive.org/details/sanskritprimerba00perruoft',
    type: 'primer',
    howToRead:
      'Devanagari and the alphabet are covered in the unnumbered introductory material (§§1-91) before Lesson I begins on page 24 — read that first. Lesson I itself teaches the present indicative active of the unaccented a-class verb (वद् vad, "speak") and Lesson II continues with gunated stems; full sandhi comes later, not by Lesson II as often assumed. Treat the paradigm tables (noun/verb declension charts) in the appendix as a reference to flip back to, not something to read straight through. Skip the comparative-philology footnotes on a first pass — they compare Sanskrit to Greek/Latin and are not needed to learn the language. The romanization predates IAST (Perry\'s ç = IAST ś) — check the key on the early pages before assuming an unfamiliar diacritic is a typo.',
    license:
      'Public domain (Internet Archive metadata: "no visible notice of copyright; stated date 1885," catalogued NOT_IN_COPYRIGHT).',
    embeddableBookUrl: 'https://archive.org/embed/sanskritprimerba00perruoft',
    embeddableExcerpt: `Lesson I (Edward Delavan Perry, "A Sanskrit Primer," 1885, pp. 24-26)

92. Verbs. Present Indicative active. Unaccented a-class. A number of roots
conjugated in this class have medial short अ a. Inasmuch as "अ a is its own
guna", these roots merely add an अ a to form the present-stem; e. g., वद् vad,
present-stem वद vada. The final अ a of the stem is lengthened in the three
first persons.

        Sing.                Dual.                  Plural.
   1.   वदामि  vadami        वदावस्  vadavas        वदामस्  vadamas
   2.   वदसि   vadasi        वदथस्  vadathas       वदथ    vadatha
   3.   वदति   vadati        वदतस्  vadatas        वदन्ति  vadanti

93. The ending of the 3rd plur. is properly अन्ति anti; it suffers abbreviation,
however, by the loss of its अ a, in verbs whose stem ends in अ a.

94. As a heavy syllable ending in a consonant cannot be gunated, a root like
जीव् jiv makes its 3rd sing. जीवति jivati; निन्द् nind makes निन्दति nindati, etc.

95. Euphonic rule. At the end of a word standing in the final position of a
sentence, or alone, स् s and र् r always become visarga ः h; and generally also
before क् k, ख् kh, प् p, फ् ph, and before sibilants [श् s, ष् s, स् s], whether
these stand in the same word, or as initial in the following word; e. g.
वदतस् पुनर् vadatas punar becomes always वदतः पुनः vadatah punah.

96. Force of the present. The present indicative signifies 1. Present time.
2. Immediate futurity. 3. Past time, in lively narration ("historical present").

                            Vocabulary I.
Verbs to be conjugated like वद् vad:
  चर् car (intr.) go, wander, graze (of cattle); (tr.) perform, commit.
  जीव् jiv live.                त्यज् tyaj leave, abandon.
  दह् dah burn.                 धाव् dhav run.
  नम् nam (intr.) bow, bend one's self; (tr.) honor, reverence.
  पच् pac cook.                 पत् pat fall; fly.
  यज् yaj sacrifice (c. acc. pers. et instr. rei).
  रक्ष् raks protect.            वद् vad speak, say.
  वस् vas dwell.                वह् vah (tr.) carry, bear; (intr.) flow, blow, proceed.
  शंस् sans praise.

                      Adverbs and Conjunctions.
  अतस् atas, इतस् itas - hence.      ततस् tatas - thence, therefore, thereupon.
  यतस् yatas - whence, wherefore.
  अत्र atra, इह iha - here, hither.   तत्र tatra - there, thither.
  यत्र yatra - where, whither.
  इत्थम् ittham - in this way, so.    तथा tatha - in that way, so.
  यथा yatha - in which way, as.
  कुतस् kutas - whence? why?         कुत्र kutra, क्व kva - where? whither?
  कथम् katham - how?                 कदा kada - when?
  अधुना adhuna now.   तदा tada then.   यदा yada when, if.
  अद्य adya to-day.    सर्वत्र sarvatra everywhere.   सदा sada always.
  एवम् evam so, thus.  इति iti so, thus.   तु tu but, however.
  एव eva just, exactly.  च ca (postpos.) -que.   पुनर् punar again, but.

                             Exercise I.
अद्य जीवामः । १ । सदा पचथः । २ । अत्र रक्षति । ३ । अधुना रक्षामि । ४ ।
यदा धावथ तदा पतथ । ५ । क्व यजन्ति । ६ । तत्र चरथः । ७ । कुतः शंससि । ८ ।
त्यजामि कथम् । ९ । पुनः पतावः । १० । दहसि । ११ । पुनर्वदन्ति । १२ ।
तत्र वसावः । १३ । सर्वत्र जीवन्ति ॥ १४ ॥

Lesson II (p. 26)

97. Verbs. Unaccented a-class, cont'd. Roots of this class which end in a
vowel, and consonant-roots not forming heavy syllables, gunate their vowels in
forming their present-stems; e. g., जि ji and नी ni form जे je and ने ne;
द्रु dru and भू bhu form द्रो dro and भो bho; स्मृ smr forms स्मर् smar;
चित् cit and बुध् budh form चेत् cet and बोध् bodh; वृष् vrs forms वर्ष् vars.

98. With the class-sign अ a, a final ए e of the gunated root unites to form
अय aya; so ओ o with अ a becomes अव ava; अर् ar with अ a yields अर ara. Thus,
जि ji, 3rd sing. जयति jaya-ti; भू bhu भवति bhavati; स्मृ smr स्मरति smarati.

99. Roots in consonants: बुध् budh, 3rd sing. बोधति bodhati; चित् cit,
चेतति cetati; वृष् vrs, वर्षति varsati.

-- Public domain. Edward Delavan Perry, "A Sanskrit Primer; based on the
Leitfaden fur den Elementarcursus des Sanskrit of Georg Buhler," 1885,
pp. 24-26. Scan: archive.org/details/sanskritprimerba00perruoft (Internet
Archive: NOT_IN_COPYRIGHT). Devanagari transcribed from the page images;
romanization reproduced as printed (Perry's diacritics simplified here).`,
  },
  {
    id: 'skt-ncert-textbooks',
    language: 'sanskrit',
    title: 'NCERT Sanskrit School Textbooks (Ruchira, Shemushi, etc.)',
    author: 'National Council of Educational Research and Training (NCERT), Government of India',
    sourceUrl: 'https://ncert.nic.in/textbook.php',
    type: 'book',
    howToRead:
      "On the portal, pick a class and Subject = Sanskrit, then open chapters one at a time — they are separate small PDFs, not one combined book. Start with 'Ruchira Bhag 1' (Class 6) rather than the higher-class books (Shemushi, Vyakaranavithi are Class 9+ and assume fluent reading already). Read chapters in order — vocabulary is cumulative — and use the grammar appendix as a lookup table, not sequential reading. These are children's-school textbooks and assume you can already sound out Devanagari, so pair with a pronunciation/alphabet resource first.",
    license:
      'Copyright NCERT / Government of India. Free educational download, but not an open (CC) license — treat as free-to-read, not free-to-redistribute-modified.',
    inAppNotes:
      "India's school Sanskrit books are written for children who already read Devanagari and already speak an Indian language, so they teach by immersion rather than explanation — almost entirely in Sanskrit, with little metalanguage. Three things to know before opening one. First, the naming: \"Ruchira, Bhaga 1\" means volume 1 (bhaga = part), mapped one-to-one to a school year, so Class 6 -> 7 -> 8 is a genuine difficulty ladder — starting at Class 9-10 assumes years of prior study. Second, the pedagogy: each chapter is a short story or verse followed by abhyasah (exercises) — comprehension questions, fill-in-the-blank with the correct case ending, matching — and doing the exercises is the point, not reading the passage alone. Third, the back matter: shabdarupa (noun paradigm tables) and dhaturupa (verb paradigm tables) sit in an appendix and are meant to be chanted aloud (ramah ramau ramah, ramam ramau raman, ...) — the fastest route to recognising endings in running text. As an adult: read each passage aloud first purely to find word boundaries (Sanskrit prose fuses words at their edges), then look nouns up by their stem and verbs by their root — never by the inflected form on the page — then read it aloud once more. Vocabulary is cumulative chapter to chapter, so skipping around costs more than it saves.",
  },
  {
    id: 'skt-cdsl-mw',
    language: 'sanskrit',
    title: 'Cologne Digital Sanskrit Lexicon (incl. Monier-Williams 1899)',
    author: 'Institute of Indology and Tamil Studies, University of Cologne',
    sourceUrl: 'https://www.sanskrit-lexicon.uni-koeln.de/',
    type: 'dictionary',
    howToRead:
      "A lookup tool, not something to read cover-to-cover. Use 'Basic' search mode and restrict the dictionary dropdown to 'MW' (Monier-Williams, 1899) — the site hosts 43 lexicons total, but a beginner only needs that one. Type a word in Devanagari, IAST, or Harvard-Kyoto; ignore the XML/SLP1 export and the other 42 historical lexicons until doing serious philological work far down the line.",
    license:
      'No explicit open-content license stated; free to use, with a requested academic citation format.',
    inAppNotes:
      'A Sanskrit dictionary does not list the words you actually meet in a sentence — it lists stems, the bare uninflected shape before any ending is attached, and it is your job to strip the ending off before searching. For nouns/adjectives: नरः naraḥ ("the man", nominative) is not a headword; नर nara is — नरम्, नरेण, नराणाम्, नरे all reduce to that same entry. For verbs the headword is usually the root: गच्छति gacchati ("he goes") is filed under गम् gam, because gacchati is the present stem built from that root. This is the single most common reason a lookup fails — the word is in the dictionary, just not in the shape typed. Reading an entry: m./f./n. mark a noun\'s gender (which determines every ending it can take); mfn. means an adjective that takes all three genders; ind. means indeclinable (never changes form). For verbs, cl. 1/4/... is the present-class number, P. is parasmaipada ("active"), A. is atmanepada ("middle"). Senses are ordered by oldest attestation, not by frequency, so the first definition is often not the one wanted. Entries follow the Sanskrit alphabet order (a a i i u u r r l e ai o au, then k kh g gh ng, c ch j jh ny, ...), not the Latin one, so ka files before ca and siva is nowhere near siddha.',
  },
  {
    id: 'skt-spokensanskrit-dict',
    language: 'sanskrit',
    title: 'Spoken Sanskrit — English/Sanskrit Hypertext Dictionary',
    author: 'Independent volunteer project',
    sourceUrl: 'http://spokensanskrit.org/',
    type: 'dictionary',
    howToRead:
      "Use the search box for everyday English<->Sanskrit lookups alongside a primer — friendlier for a beginner than the scan-based CDSL, since it is built around modern spoken usage. Once past the alphabet, use its 'Fables' section (Panchatantra, Hitopadesha, Jataka stories) — every word links straight to its dictionary entry, a much gentler first reading experience than an unglossed classical text. Use plain http://, not https:// — the TLS endpoint fails to handshake.",
    license: 'No explicit license stated; free public access.',
    inAppNotes:
      'The browser warning is about the transport, not the content: the site is served over plain HTTP, and its HTTPS endpoint fails the TLS handshake, so a modern browser either warns or upgrades-and-fails. For a read-only lookup with no login and no personal data the practical risk is low, but it is a real reason to prefer reading material in this app when one exists. The linguistic point matters more: looking a word up from English is lossier than from Sanskrit. A Sanskrit-to-English entry gives one fixed meaning; an English-to-Sanskrit search hands back a list of near-synonyms with no guidance on which a real text would use — Sanskrit has unusually many words for "water", for "king", for "light", and choosing among them is a matter of register and tradition, not interchangeability. Treat an English->Sanskrit result as a shortlist to investigate: take the candidate, look it up in the reverse direction, and check whether the definitions land back where you started, noting its gender and stem form along the way. Once past the alphabet, its glossed fable collections (Panchatantra, Hitopadesha, Jataka stories) — where every word links to its own entry — are the gentlest first reading: simple prose, familiar plots, so you can guess and use the gloss to confirm rather than decode word by word.',
  },
  {
    id: 'skt-learnsanskrit-course',
    language: 'sanskrit',
    title: 'Learn Sanskrit Online (learnsanskrit.org)',
    author: 'learnsanskrit.org',
    sourceUrl: 'https://learnsanskrit.org/',
    type: 'course',
    howToRead:
      "Start at the 'Sounds' unit (learnsanskrit.org/sounds/) for pronunciation and both scripts, then follow the site's own 'next' links forward — written as a linear first-pass guide, not a reference to jump around in. Skip the Aṣṭādhyāyī/Paninian-grammar series entirely for now; that is a specialist, later-stage topic. The Sanscript script-converter tool and the Ambuda link are useful once past the basics, not day-one material.",
    license: 'CC BY 4.0 International (stated on the site) — free to reuse with attribution.',
    inAppNotes:
      "Sanskrit's alphabet is a table, not an arbitrary list — sorted by how the mouth makes each sound, and seeing the table makes the rest of the language predictable. Vowels first: a, a, i, i, u, u, r, r, l, then e, ai, o, au — most in short/long pairs where duration changes the word, plus r counted as a full vowel (the vowel at the centre of krsna). Then the 25 stops as a 5x5 grid: rows are five places of articulation back-to-front (velar k-row, palatal c-row, retroflex t-row, dental t-row, labial p-row); columns are manner (voiceless, voiceless-aspirated, voiced, voiced-aspirated, nasal). So ka kha ga gha nga is one row, and every other row follows the same pattern. Aspiration (the puff of air in kha, gha, tha, dha) is contrastive — it distinguishes real words. Retroflexes (t th d dh n) curl the tongue tip back; dentals (t th d dh n) touch the upper teeth — genuinely different sounds. After the grid: four semivowels y r l v, three sibilants s sh s, and h — 33 consonants total, plus anusvara (nasal resonance) and visarga (breathy echo), written as marks rather than letters. Why it matters: sandhi rules (\"a voiceless stop voices before a voiced sound\") are one-line generalisations on this grid, and become an unlearnable list of exceptions without it — learn the grid by row and column, aloud, before attempting a single sandhi rule.",
  },
  {
    id: 'skt-varnamala-audio',
    language: 'sanskrit',
    title: 'Sanskrit Alphabets for Beginners — Varnamala Series',
    author: 'Tattvam (YouTube channel)',
    sourceUrl: 'https://www.youtube.com/playlist?list=PLFLFOfuyaIHvExkYbtlMM_mS1m5yRZtO2',
    type: 'video',
    howToRead:
      'Watch episodes in playlist order — vowels, then consonants, then anusvara/nasal sounds by episode 9. Watch with sound on and pause after each letter to repeat it aloud; this is the one listening-and-repeating resource on the list, which no text-based primer or dictionary can substitute for. Do this alongside, not instead of, a primer’s alphabet chapter.',
    license:
      "Standard YouTube/creator copyright — free to view, and embeddable via YouTube's official iframe player (confirmed not embed-disabled via the oEmbed API). The video files themselves are not licensed for download or redistribution.",
    embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLFLFOfuyaIHvExkYbtlMM_mS1m5yRZtO2',
  },
  {
    id: 'skt-pravesha-course',
    language: 'sanskrit',
    title: 'Samskrita Bharati — Pravesha (spoken-Sanskrit beginner course, 88 episodes)',
    author: 'Learn Sanskrit Online : vyoma-samskrta-pathasala (Vyoma Labs)',
    sourceUrl: 'https://www.youtube.com/playlist?list=PLWV98cyTzbXzF0LyF8liA00e2JYcNtCTU',
    type: 'video',
    howToRead:
      "Samskrita Bharati's full beginner course, taught almost entirely IN Sanskrit (immersion-style — the point is to start understanding spoken Sanskrit directly, not to have every word glossed in English). Watch the main lecture episodes in playlist order; the interspersed 'Homework Solution' episodes are optional reinforcement from a different presenter, skippable on a first pass. This is a genuinely different skill from the app's letters/reading stages — pair it with, don't substitute it for, a primer's grammar.",
    license:
      "Standard YouTube/creator copyright — free to view, embeddable via YouTube's official iframe player (confirmed: playlist embed loads correctly; individual videos spot-checked not embed-disabled via the oEmbed API). Not licensed for download or redistribution.",
    embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLWV98cyTzbXzF0LyF8liA00e2JYcNtCTU',
  },
  {
    id: 'skt-sandhi-grammar-video',
    language: 'sanskrit',
    title: 'Samhita, Sandhi Class, Savarnadeergha — Sanskrit Grammar & Composition',
    author: 'Dr. Sowmya Krishnapur / Learn Sanskrit Online : vyoma-samskrta-pathasala',
    sourceUrl: 'https://www.youtube.com/watch?v=KaMyTphi37g',
    type: 'video',
    howToRead:
      "A grammar explainer on sandhi (word-fusion rules) from Vyoma's separate 'Sanskrit Grammar & Composition' course. Intermediate, not day-one — the same gating the catalogue already applies to Ambuda: come back once the alphabet and basic noun/verb forms are done, since sandhi is exactly the skill that closes the gap between a primer and reading real Sanskrit (see Ambuda's own inAppNotes below for why).",
    license:
      "Standard YouTube/creator copyright — free to view, embeddable via YouTube's official iframe player (confirmed not embed-disabled via the oEmbed API).",
    embedUrl: 'https://www.youtube.com/embed/KaMyTphi37g',
  },
  {
    id: 'skt-ambuda-library',
    language: 'sanskrit',
    title: 'Ambuda — free open library of Sanskrit texts and tools',
    author: 'Ambuda project (volunteer-run, open-source)',
    sourceUrl: 'https://ambuda.org/',
    type: 'article',
    howToRead:
      "Not for day one. Come back once the alphabet and basic noun/verb forms are done (roughly the first 10 lessons of the Perry primer, or the equivalent in learnsanskrit.org). Use the site's dictionary tool for quick lookups, and later its reader — short, mostly public-domain texts with click-to-see grammatical analysis word by word — as a bridge between finishing a primer and reading unglossed classical Sanskrit.",
    license:
      'Open source (public GitHub repo) for the platform itself; underlying texts are largely public domain, licensing not itemized per-text.',
    inAppNotes:
      'The gap between finishing a primer and reading real Sanskrit has two specific causes, and knowing them is what a reader tool like this is actually for. First, sandhi: Sanskrit fuses word edges rather than just placing words side by side — a final vowel and a following initial vowel merge into a third vowel, and final -ah shifts to -o before a voiced sound, so ramah gacchati is written ramo gacchati. A line of classical Sanskrit is often one unbroken string with no reliable spaces, so before looking a word up you must guess where it began and what shape it had before the fusion — a skill trained by seeing thousands of already-split examples, not by memorising rules in the abstract. Second, compounding (samasa): several stems strung together with internal case endings dropped and the relationship between parts left implicit — "X and Y", "the Y of X", "the Y which is X" — sometimes five or six members long. A reader tool closes both gaps by presenting text with sandhi already split, and for each word an analysis: its stem/root, part of speech, and — for a noun — case and number, or — for a verb — person, number, tense and voice, which is what turns a dictionary lookup into knowing that naranam is genitive plural and must attach to some other noun in the sentence. Use it honestly: read the line, guess its structure out loud, and only then reveal the analysis — revealing first turns reading into passive translation-watching.',
  },
  {
    id: 'skt-samskrita-bharati',
    language: 'sanskrit',
    title: 'Samskrita Bharati — Spoken Sanskrit Classes',
    author: 'Samskrita Bharati',
    sourceUrl: 'https://samskritabharati.in',
    type: 'course',
    howToRead:
      'Start with their free "Spoken Sanskrit Classes" — a 10-day course explicitly requiring no prior knowledge, taught immersion-style: mostly in Sanskrit itself, by mimicry and repetition rather than grammar rules first. Beyond that free tier, their correspondence course is a real, named four-level ladder — Pravesha, Parichaya, Shiksha, Kovida, six months each, roughly two years to reach reading the Gita and speaking/writing — but each level is a paid, certificate-granting program, not something this app tracks or needs; use it only if a formal, guided course alongside self-study appeals, not as a prerequisite for anything here.',
    license:
      '© Samskrita Bharati, all rights reserved (stated in the site footer). The free 10-day class is free to attend, not openly licensed content.',
  },
  {
    id: 'skt-ashtadhyayi',
    language: 'sanskrit',
    title: "Ashtadhyayi.com — Panini's grammar, with a derivation generator",
    author: 'Ashtadhyayi.com',
    sourceUrl: 'https://ashtadhyayi.com',
    type: 'course',
    howToRead:
      "Not for early stages — this is a specialist study platform for Panini's Ashtadhyayi itself (Sutrapatha, Dhatupatha, multiple traditional commentaries, a prakriya/derivation generator that shows the sutra-by-sutra derivation of any word form, offline mode, bookmarks). Come back once sandhi and noun/verb morphology are solid (the same gating this catalogue already applies to Ambuda) — its actual audience is someone already reading Sanskrit who wants to see WHY a form is what it is, rule by rule, not someone learning what the forms are in the first place.",
    license: 'No explicit license or copyright statement found on the site.',
  },
  {
    id: 'skt-whitney-grammar',
    language: 'sanskrit',
    title: 'Sanskrit Grammar',
    author: 'William Dwight Whitney',
    sourceUrl: 'https://en.wikisource.org/wiki/Sanskrit_Grammar_(Whitney)',
    type: 'book',
    howToRead:
      "Adopted as this app's second Sanskrit source (tranche 18) specifically because Wikner's Practical Sanskrit Introductory has no 2nd-person-pronoun lesson anywhere in its text — confirmed by two separate full-text greps, not assumed. This is a comprehensive reference grammar, not a graded course: don't read front-to-back. Chapter VII (\"Pronouns\") §491 has the personal-pronoun declension table this app draws from; the Wikisource transcription (proofread against the original page scans, not a raw OCR dump) renders it in clean Devanagari plus IAST side by side, unlike the same-era Perry primer's own cached OCR text of the equivalent table, which came through unreadable.",
    license:
      'Public domain (Whitney died 1894; 1st ed. 1879, 2nd ed. 1889 — both pre-1929 works with no copyright renewal on record). The Wikisource transcription/markup layer is separately offered under CC BY-SA 3.0/GFDL, but that only covers the wiki formatting, not the underlying 19th-century text.',
    inAppNotes:
      "Sanskrit's 1st/2nd person pronouns share no root with the noun declensions taught so far (नर, अश्व) — §491 calls them out as \"the most irregular and peculiar of all, being made up of fragments coming from various roots.\" Unlike 3rd person (expressed only through verb endings in this app's other source), 2nd person has its own dedicated word forms: त्वम् (tvam, singular) and यूयम् (yūyam, plural) both come directly from this table.",
  },

  {
    id: 'tam-abc-of-tamil',
    language: 'tamil',
    title: 'ABC of Tamil, Book One',
    author: 'T.B. Siddalingaiah',
    sourceUrl: 'https://www.tamilvu.org/coresite/download/ABC_Tamil.pdf',
    type: 'primer',
    howToRead:
      "This is already this app's primary curriculum source, so read it lesson-by-lesson in lockstep with the app's own stages rather than skimming. Skip the dedication and foreword (pages 1-3, context only). Lesson 1 teaches the 12 vowels alongside the 6 consonants the app's 'letters' stage currently covers with only their default inherent vowel — the app has not introduced any vowel yet, so treat that half of Lesson 1 as ahead of where the app is today, not already-covered ground. Lesson 2 introduces all 18 consonants and the pulli (dead-consonant) mark together, with the app's own first four vocabulary words (கண், கல், மண், பல்) as its own — read it in full before touching the app's pulli-stage lessons. Its publisher, Tamil Virtual Academy (tamilvu.org), also runs a much larger, formal Certificate-through-Degree program beyond this one free Book One PDF — worth knowing exists, not something this app tracks or needs.",
    license:
      "Unresolved / likely still under copyright. The scanned text itself states \"Selling right: PAARI NILAYAM, 59 Broadway, Madras-1\" (the original 1968 print publisher) with no CC or public-domain notice. Free-to-download hosting is not evidence of an open license — do not treat as safe to redistribute or quote at length.",
    inAppNotes:
      "Tamil writing is an abugida, and that explains most of its behaviour. A consonant letter already carries a built-in short-a sound — written plain, க already says \"ka\" — so making it say anything else takes one of two changes. Killing the vowel entirely is the pulli (புள்ளி), a single dot above the letter: க் is a bare k with no vowel. Changing it means attaching a vowel sign: கா ka, கி ki, கீ ki, கு ku, கூ ku, கெ ke, கே ke, கை kai, கொ ko, கோ ko, கௌ kau — and where those signs sit varies: ா ி ீ ு ூ attach to the right, ெ ே ை attach to the LEFT even though pronounced after the consonant, ொ ோ ௌ wrap around both sides. Tamil cannot be read strictly left-to-right one character at a time because of this — a cluster is taken in as a whole. The system: 12 vowels (uyir, \"life\" letters), 18 consonants (mey, \"body\" letters), each crossing to give 216 composite letters (uyirmey, \"living\" letters), plus the special ஃ (aytam) — the traditional total of 247 sounds alarming but is really just 30 shapes plus 11 vowel signs and their combinations. The consonants fall into three real grammatical groups, not a mnemonic: vallinam, the hard set (க ச ட த ப ற); mellinam, the nasals (ங ஞ ண ந ம ன); idaiyinam, the medium set (ய ர ல வ ழ ள) — sandhi rules, plural and case endings, and pronunciation rules are all stated in these terms.",
  },
  {
    id: 'tam-wiktionary',
    language: 'tamil',
    title: 'Tamil Wiktionary (விக்சனரி)',
    author: 'Tamil Wiktionary contributors (Wikimedia Foundation)',
    sourceUrl: 'https://ta.wiktionary.org/',
    type: 'dictionary',
    howToRead:
      "Use as a lookup tool for individual words met in a lesson, not something to read front-to-back — search directly for a word (~408,000 entries). Look up the app's own four pulli-final words (கண், கல், மண், பல்) to see how a real dictionary presents a dead-consonant-final word; the definition-list and etymology sections are the useful parts, the multi-language translation block at the bottom can be skipped.",
    license: 'CC BY-SA 4.0, stated in the page footer.',
    embeddableExcerpt:
      'தமிழ் (tamiḻ) — primary sense: the Tamil language. Source: Tamil Wiktionary, ta.wiktionary.org/wiki/தமிழ், CC BY-SA 4.0.',
  },
  {
    id: 'tam-audio-htla',
    language: 'tamil',
    title: 'Tamil Alphabet (with playable audio)',
    author: 'howtolearnalanguage.info',
    sourceUrl: 'https://www.howtolearnalanguage.info/languages/tamil/alphabet',
    type: 'audio',
    howToRead:
      "Go straight to the vowel and consonant tables and click every play button, repeating the sound aloud immediately rather than listening passively. Do the 13 vowels first, then the 18 consonants — the same order ABC of Tamil uses. The app's own letters stage currently teaches only 6 of those 18 consonants (plus 2 pulli marks) and no vowels yet, so use this resource to get ahead of the app on pronunciation, not to expect a lesson-for-lesson match against what's in the app today. Ignore the course/discount banners; the alphabet-and-audio table itself is free with no signup gate.",
    license:
      'No explicit license notice found. Treat as ordinary all-rights-reserved content: free for personal practice, not confirmed safe to redistribute.',
    inAppNotes:
      "Audio is not optional for Tamil, because its spelling deliberately underspecifies pronunciation: there is one letter per place of articulation for the hard consonants (க ச ட த ப ற) and no separate letters for voiced or aspirated versions the way Devanagari has. க் is written identically everywhere but sounds different depending on position: plain voiceless [k] word-initially (கல் kal); long voiceless [kː] when doubled (பக்கம் pakkam); voiced [g] after its matching nasal (தங்கம், heard as tangam); softened toward [x]/[gh]/[h] between vowels (பாகம் heard closer to paham than pakam). The same four-way pattern runs across the hard set, with two exceptions: ச is commonly [s] between vowels, and ற behaves as a trill/tap rather than a softened stop — none of this is written down. Three further contrasts are hard to learn from text alone and are the real reason to use audio: the l-type and n-type letters (ல ள ழ and ன ண ந) are genuinely distinct sounds, with ழ — the retroflex approximant in தமிழ் itself — having no English equivalent and being the sound learners most often flatten into a plain l; vowel length is phonemic (short/long differ roughly two-to-one in duration and swapping them changes the word, not just the style); and the retroflex series (ட ண ள ழ) curls the tongue tip back to a position English never uses. Play each letter, say it back immediately, and record yourself occasionally — passive listening trains recognition only, production trains the tongue positions that actually distinguish these sounds.",
  },
  {
    id: 'tam-pronunciation-playlist',
    language: 'tamil',
    title: 'Tamil Pronunciation (40-episode drill series)',
    author: 'Active Learning Foundation',
    sourceUrl: 'https://www.youtube.com/playlist?list=PLKMYkafPduYFDrYeOJeXBdzimfCI7kycI',
    type: 'video',
    howToRead:
      "Drills exactly the contrasts this app's own tam-audio-htla notes above flag as unlearnable from text alone — ல/ள/ழ, ண/ன/ந, ர/ற. Watch in playlist order and repeat each sound aloud immediately; this is production practice (making the sound), not a script-introduction sequence, so pair it with 'ABC of Tamil' for letter shapes first, not instead of it.",
    license:
      "Standard YouTube/creator copyright — free to view, embeddable via YouTube's official iframe player (confirmed: playlist embed loads correctly; individual videos spot-checked not embed-disabled via the oEmbed API).",
    embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLKMYkafPduYFDrYeOJeXBdzimfCI7kycI',
  },
  {
    id: 'tam-mellinam-drill-video',
    language: 'tamil',
    title: 'Teaching Tamil — ஙஞண நமன (mellinam/nasal consonant drill)',
    author: 'Active Learning Foundation',
    sourceUrl: 'https://www.youtube.com/watch?v=zHaG4HY3qtk',
    type: 'video',
    howToRead:
      "A reading drill for the mellinam (nasal) consonant set — ங ஞ ண ந ம ன. Use once the app's own letters stage has introduced pulli-final forms, as a listen-and-repeat companion, not a first introduction to the letters themselves.",
    license:
      "Standard YouTube/creator copyright — free to view, embeddable via YouTube's official iframe player (confirmed not embed-disabled via the oEmbed API).",
    embedUrl: 'https://www.youtube.com/embed/zHaG4HY3qtk',
  },
  {
    id: 'tam-vallinam-drill-video',
    language: 'tamil',
    title: 'Learn Tamil Easy — கசடதபற (vallinam/hard consonant drill)',
    author: 'Active Learning Foundation',
    sourceUrl: 'https://www.youtube.com/watch?v=1L7bnzcEKUw',
    type: 'video',
    howToRead:
      'A reading drill for the vallinam (hard) consonant set — க ச ட த ப ற. Pairs with the mellinam drill above to cover both consonant classes with real audio; the same set whose position-dependent pronunciation is explained in tam-audio-htla\'s inAppNotes above.',
    license:
      "Standard YouTube/creator copyright — free to view, embeddable via YouTube's official iframe player (confirmed not embed-disabled via the oEmbed API).",
    embedUrl: 'https://www.youtube.com/embed/1L7bnzcEKUw',
  },
  {
    id: 'tam-omniglot',
    language: 'tamil',
    title: 'Tamil script, pronunciation and language',
    author: 'Omniglot (Simon Ager)',
    sourceUrl: 'https://omniglot.com/writing/tamil.htm',
    type: 'article',
    howToRead:
      "A one-page reference chart and history primer, not a lesson sequence — covers the script's evolution plus visual charts of vowels, consonants and numerals. Its one audio clip (a native-speaker reading of UDHR Article 1) is connected fluent speech, not letter-by-letter pronunciation — save it for after finishing the app's letters stage. Its outbound links to other sites are a discovery list only; several failed independent verification, so re-check any of them before relying on them.",
    license:
      'Not independently re-confirmed. Omniglot has a long-standing all-rights-reserved policy — treat as read-only reference.',
    inAppNotes:
      "Tamil's writing descends from Brahmi through a local variant usually called Tamil-Brahmi, attested from around the Ashokan period. Over centuries the letters grew rounder, becoming by roughly the 5th-6th century the script called vattezhuthu, \"round writing\" — rounded largely because it was incised with a stylus on palm leaf, where a straight cut splits the fibre and a curve does not. Modern Tamil is not a direct descendant of vattezhuthu, though: in the 4th century the Pallava dynasty developed a separate script from which both Grantha and the Chola-Pallava line evolved, and that second line became today's Tamil script, displacing vattezhuthu in the north by about the 8th century (the south kept it until roughly the 11th). 20th-century reforms simplified things further — regularising vowel markers and eliminating most irregular ligatures — which is why older printed books show letter combinations a modern chart will not. On romanisation: Tamil has more contrasts than the Latin alphabet has letters, so any romanisation adds marks, and charts differ in which system they use. ISO 15919 treats ழ (zh), ள (l-retroflex) and ல (l) as three distinct l-type letters, ற (r-hard) against ர (r), and ண, ன, ந as three distinct n-type letters; popular non-scholarly spellings collapse these (\"zh\" for ழ, as in \"Tamizh\", or plain n/l for all variants). Neither convention is wrong, but they are not interchangeable — check a chart's own key before assuming an unfamiliar diacritic is a typo.",
  },
  {
    id: 'tam-wikibooks',
    language: 'tamil',
    title: 'Tamil (Wikibooks)',
    author: 'Wikibooks contributors (Wikimedia Foundation)',
    sourceUrl: 'https://en.wikibooks.org/wiki/Tamil',
    type: 'course',
    howToRead:
      "A supplementary course outline, not a finished textbook — several sub-chapters are stubs and the project is marked incomplete. Of the three links listed under \"Part II: Reading and Writing Tamil\", only \"Tamil Script\" actually exists — \"Basic grammar\" and \"Advanced topics\" are redlinks to pages that were never written, so don't go looking for them. Read \"Tamil Script\" as a second opinion on ABC of Tamil's ordering; move to \"Speaking Tamil\" only after finishing the app's letters and pulli stages; use the survival-phrases appendix last, for real-world phrase practice rather than literacy.",
    license: 'CC BY-SA 4.0, confirmed in the page footer — reuse and adaptation permitted with attribution.',
    embeddableExcerpt: `From the Wikibooks book "Tamil", Part II: Reading and Writing Tamil -> "Tamil Script".

In Tamil, there are 30 characters. The Tamil alphabet has 12 vowels and 18
consonants. The vowels are divided into short and long (five of each type) and
two dipthongs (ஐ and ஔ). The consonants are classified into three categories
with 6 in each category: vallinam - hard, mellinam - soft or nasal, and
idayinam - medium. Unlike Devanagari, Tamil has neither conjunct consonants nor
aspirated and voiced stops.

The script is sometimes called Vattezhuthu, literally "round writing". This
characterstic has partly to do with the fact that in ancient times, writing
involved carving with a sharp point on palm leaves (olaichuvadi) and it was
apparently easier to produce curves than straight lines by this method. The
script is syllabic, in the sense that each letter is a syllable. However, the
signs for the syllables are derived from that of the inherent consonant; thus
it is of the abugida type.

BASIC CONSONANTS ("body" letters)
  க ka   (vallinam)      ங nga  (mellinam)
  ச cha  (vallinam)      ஞ nja  (mellinam)
  ட tta  (vallinam)      ண nnna (mellinam)
  த tha  (vallinam)      ந na   (mellinam)
  ப pa   (vallinam)      ம ma   (mellinam)
  ய ya   (idaiyinam)     ர ra   (idaiyinam)
  ல la   (idaiyinam)     வ va   (idaiyinam)
  ழ zha  (idaiyinam)     ள lla  (idaiyinam)
  ற rra  (vallinam)      ன nna  (mellinam)

BORROWED CONSONANTS (Grantha letters, for Sanskrit/English loanwords)
  ஜ ja    ஷ sha    ஸ sa    ஹ ha

VOWELS ("life" or "soul" letters)
  Isolated form:
    அ a       ஆ aa      இ i       ஈ ii
    உ u       ஊ uu      எ e       ஏ ē
    ஐ ai (diphthong)     ஒ o       ஓ ō
    ஔ au (diphthong)

  Compound form (using consonant "k" as an example):
    க் k    க ka    கா kaa   கி ki   கீ kii   கு ku   கூ kuu
    கெ ke   கே kē   கை kai   கொ ko   கோ kō   கௌ kau

Special letter ஃ (pronounced "akh") is rarely used by itself - normally serves
a purely grammatical function.

The long ("nedil") vowels are about twice as long as the short ("kuRil")
vowels. The diphthongs are usually pronounced about 1.5 times as long as the
short vowels. The vowel sign can be added to the right, left or both sides of
the consonant, and can also form a ligature.

The Unicode range for Tamil is U+0B80 ... U+0BFF.

------------------------------------------------------------
Attribution (required by the licence): Excerpted from "Tamil/Tamil Script",
Wikibooks, en.wikibooks.org/wiki/Tamil/Tamil_Script, by Wikibooks contributors.
Licensed under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0/). Changes
made: passages omitted where the source's own wording overlapped or was
internally inconsistent; wiki-markup tables rendered as plain text. Note two
inherited quirks from the source itself, not silently fixed: its romanizations
"nnna"/"nna"/"lla"/"rra" are non-standard (ISO 15919 would give na/na/la/ra),
and it calls the borrowed consonants "digraphs" though they are consonant
clusters. Redistributing this excerpt, modified or not, requires keeping this
attribution and the CC BY-SA 4.0 license.`,
  },
  {
    id: 'tam-tamilcube-chart',
    language: 'tamil',
    title: 'Tamil Alphabets Chart',
    author: 'Tamilcube.com',
    sourceUrl: 'https://tamilcube.com/tamil-alphabets-chart/',
    type: 'article',
    howToRead:
      "Use only as a free visual reference for the 12 vowels + 18 consonants plus the four Sanskrit-derived Grantha letters (ஜ ஷ ஸ ஹ) that appear in loanwords — a good wall-chart companion once the app's letters stage is underway. Treat the English-word pronunciation hints as rough approximations only, not IPA; despite marketing copy about 'animations' the page has no real audio, so cross-check sound against the howtolearnalanguage.info resource instead.",
    license: 'No explicit license shown; ordinary commercial site content, copyrighted.',
    inAppNotes:
      "A full Tamil chart shows more than the 30 core letters, and the extras are where Tamil handles words it borrowed. Classical Tamil's sound inventory is small and self-consistent — 12 vowels, 18 consonants, no written voicing contrast, no aspirates, no sibilant beyond what ச can supply — which works for native vocabulary and not at all for Sanskrit, Persian, Portuguese or English loanwords. The fix was borrowing letters from Grantha, the script Tamil speakers already used for Sanskrit: ஜ ja, ஷ sha, ஸ sa, ஹ ha, sometimes ஶ sha, plus two composites printed as units of their own, க்ஷ ksha and ஸ்ரீ shri. These are taught in Tamil schools and are standard, but they never appear in a native Tamil word — meeting one is itself information: the word was borrowed. The other extra is ஃ, aytam, which Tamil grammar treats as neither vowel nor consonant. Historically it wrote an archaic Proto-Dravidian sound between a short vowel and a hard consonant (அஃது, எஃகு); in modern use it has been repurposed as a diacritic for foreign sounds, similar to a nuqta in Devanagari — ஃப் for [f], ஃஜ for [z], ஃக for [x] — turning up in transliterated names and religious texts. One general warning: charts that gloss pronunciation with an English keyword (\"as in cut\") are rough approximations, not a specification — they can't show the retroflex positions of ட ண ள ழ, the two-to-one length ratio between short and long vowels, or that க changes sound depending on where it sits in a word. Use a chart for the shapes; get the sounds from audio.",
  },
  {
    id: 'tam-andronov-grammar',
    language: 'tamil',
    title: 'A Grammar of Modern and Classical Tamil',
    author: 'M.S. Andronov',
    sourceUrl: 'https://archive.org/details/in.ernet.dli.2015.201870',
    type: 'book',
    howToRead:
      "Adopted as this app's second Tamil source (tranche 12) specifically because ABC of Tamil, Book One ends at Lesson Twenty-One (genitive case) and never reaches past or future tense, negation, or imperative mood — confirmed by reading its remaining pages, not assumed. This is a reference grammar, not a graded course: don't read front-to-back. The verb chapter (roughly pages 138-171 of the scan) is the relevant section for this app's own past-tense content — its personal-suffix table (shared across tenses; only the tense marker before it changes) is the fastest way to see why செய்கிறேன்/செய்தேன் share the same -ேன் ending. Past tense specifically is covered around pages 146-148, with the tense marker described as an underlying -த்- that surfaces as -த்த்-/-ன்ற்-/-இன்- depending on the verb's stem class — a genuine Tamil verb-class split, not a simplification this app is skipping.",
    license:
      'Unresolved / likely still under copyright (1989). Digital Library of India scan hosted on archive.org — free-to-read access, not evidence of an open license, the same caveat this app\'s ABC of Tamil entry already states for the same reasoning. Do not treat as safe to redistribute or quote at length.',
    inAppNotes:
      "Tamil marks tense with an inserted \"tense marker\" between the verb root and a personal-suffix set that stays largely the same across tenses — the same -ேன் that means \"I\" in செய்கிறேன் (\"I do\") also means \"I\" in செய்தேன் (\"I did\"); only the piece before it (-கிற்- for present, -த்- for past) changes. This is a cleaner, more regular system than English's own mix of suffixes and irregular stem changes (walk/walked vs. go/went) — Tamil's past-tense marker does have its own irregularity (which allomorph a given verb takes depends on its stem's final sound), but the personal-suffix half of the system, once learned for one tense, is already known for the rest.",
  },
];

export function resourcesFor(language: ResourceLanguage): readonly Resource[] {
  return resources.filter((resource) => resource.language === language);
}

export function resourceById(id: string): Resource | null {
  return resources.find((resource) => resource.id === id) ?? null;
}
