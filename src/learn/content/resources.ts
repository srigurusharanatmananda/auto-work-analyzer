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
 * `embeddableExcerpt` is set on at most a couple of entries, on purpose: it
 * requires BOTH a genuinely short excerpt AND a clearly open license, and
 * almost nothing here clears that bar — an app-hosted "reader" for most of
 * these resources is a link out with reading guidance, not embedded text.
 * Never add an excerpt here without confirming the license yourself; do not
 * copy in copyrighted book text because it would be convenient to embed.
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
      'Read Lessons I through roughly XX linearly — this is an 1880s grammar-primer, so it introduces Devanagari in Lesson I and full sandhi rules by Lesson II, earlier than a modern learner might expect; go with it rather than skipping ahead. Treat the paradigm tables (noun/verb declension charts) in the appendix as a reference to flip back to, not something to read straight through. Skip the comparative-philology footnotes on a first pass — they compare Sanskrit to Greek/Latin and are not needed to learn the language. The romanization predates IAST, so check the key on the early pages before assuming an unfamiliar diacritic is a typo.',
    license:
      'Public domain (Internet Archive metadata: "no visible notice of copyright; stated date 1885," catalogued NOT_IN_COPYRIGHT).',
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
      'Standard YouTube/creator copyright — free to view; not licensed for redistribution or re-embedding.',
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
  },

  {
    id: 'tam-abc-of-tamil',
    language: 'tamil',
    title: 'ABC of Tamil, Book One',
    author: 'T.B. Siddalingaiah',
    sourceUrl: 'https://www.tamilvu.org/coresite/download/ABC_Tamil.pdf',
    type: 'primer',
    howToRead:
      "This is already this app's primary curriculum source, so read it lesson-by-lesson in lockstep with the app's own stages rather than skimming. Skip the dedication and foreword (pages 1-3, context only). Lesson 1 teaches the 12 vowels alongside the 6 consonants the app's 'letters' stage currently covers with only their default inherent vowel — the app has not introduced any vowel yet, so treat that half of Lesson 1 as ahead of where the app is today, not already-covered ground. Lesson 2 introduces all 18 consonants and the pulli (dead-consonant) mark together, with the app's own first four vocabulary words (கண், கல், மண், பல்) as its own — read it in full before touching the app's pulli-stage lessons.",
    license:
      "Unresolved / likely still under copyright. The scanned text itself states \"Selling right: PAARI NILAYAM, 59 Broadway, Madras-1\" (the original 1968 print publisher) with no CC or public-domain notice. Free-to-download hosting is not evidence of an open license — do not treat as safe to redistribute or quote at length.",
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
  },
  {
    id: 'tam-wikibooks',
    language: 'tamil',
    title: 'Tamil (Wikibooks)',
    author: 'Wikibooks contributors (Wikimedia Foundation)',
    sourceUrl: 'https://en.wikibooks.org/wiki/Tamil',
    type: 'course',
    howToRead:
      "A supplementary course outline, not a finished textbook — several sub-chapters are stubs and the project is marked incomplete. Start with 'Reading and Writing Tamil' as a second opinion on ABC of Tamil's ordering; move to 'Speaking Tamil' only after finishing the app's letters and pulli stages; use the survival-phrases appendix last, for real-world phrase practice rather than literacy.",
    license: 'CC BY-SA 4.0, confirmed in the page footer — reuse and adaptation permitted with attribution.',
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
  },
];

export function resourcesFor(language: ResourceLanguage): readonly Resource[] {
  return resources.filter((resource) => resource.language === language);
}

export function resourceById(id: string): Resource | null {
  return resources.find((resource) => resource.id === id) ?? null;
}
