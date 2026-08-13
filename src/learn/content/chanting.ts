/**
 * Chanting-practice content: full verses (not the letters/words/sentences
 * shape `Curriculum.ts` uses for the alphabet-up curriculum — a verse is a
 * different kind of thing, so this gets its own shape, the same reasoning
 * `resources.ts` already uses for its own separate content type).
 *
 * As of 2026-08-13, one verse: Guru Gita, verse 1 — of the popular
 * ~182-verse Siddha Yoga/Muktananda recension specifically, NOT the
 * unrelated ~350-verse "long version" (whose own, textually different,
 * verse 1 — "acintyāvyaktarūpāya nirguṇāya guṇātmane..." — is a real verse
 * from a real recension, but a different one; an earlier draft of this
 * feature nearly shipped it mislabeled as "Guru Gita verse 1" unqualified,
 * which would have been true only for that other recension). The real
 * disambiguator between the two is verse count/opening verse content, NOT
 * a "Skanda Purāṇa" attribution — both recensions carry that same
 * attribution in circulation (confirmed: this file's own second source
 * below, veda.harekrsna.cz's transliteration of the ~182-verse short
 * version, is itself titled "(Skanda Purana)" on its own cover page), so
 * that label alone cannot tell the two apart. Operator decision,
 * 2026-08-13: teach the popular short version, since that's the one almost
 * anyone doing daily Guru Gita chanting practice actually means.
 *
 * Sourcing for verse 1: the Devanagari text is independently confirmed by
 * two sources that agree — sanskritdocuments.org's short-version HTML
 * (`https://sanskritdocuments.org/doc_giitaa/gurugiitaa.html`, fetched
 * 2026-08-13) and, in Harvard-Kyoto transliteration, a PDF hosted at
 * veda.harekrsna.cz (`Guru_Gita_HK_transliteration_translation_181_verses
 * _en.pdf`, also fetched 2026-08-13) — not verbatim-copied from either
 * transcriber's own specific edited edition (sanskritdocuments.org's own
 * terms restrict reuse of their specific transcription/edition to
 * "personal study and research," not redistribution; the verse itself,
 * an ancient traditional text, carries no such restriction — the same
 * distinction this app's own `resources.ts` already draws for Andronov's
 * grammar). The English meaning is independently derived — an adversarial
 * grammatical parse (word-by-word, checked against standard Sanskrit
 * declension/conjugation) cross-checked against the harekrsna.cz
 * published translation — with one honestly-disclosed ambiguity: "sandhāna"
 * in भक्तिसन्धाननायकम् most literally means "joining/union" ("master who
 * unites [devotees] through devotion"), the sense standard Monier-Williams/
 * Apte entries actually support (via "alliance, union, agreement" — checked
 * directly, not assumed). The one full published translation found instead
 * renders it as "who knows the secret of devotion" — a real, independently
 * confirmed published rendering (found at more than one site, not a single
 * outlier), but its "secret" gloss is a translator's choice, not a literal
 * dictionary sense the way "union" is. Both readings are presented rather
 * than picking one silently, with that distinction now stated accurately.
 */

export type ChantSyllableSourceLine = string;

export interface ChantWord {
  /** Devanagari, as it appears in the verse. */
  devanagari: string;
  /** IAST transliteration. */
  iast: string;
  /** English gloss for this word (or compound) alone. */
  gloss: string;
}

export interface ChantPada {
  /** Devanagari text of this verse-quarter (pāda) — fed directly to `splitIntoSyllables` for the syllable/weight breakdown. */
  text: string;
  iast: string;
  words: ChantWord[];
}

export interface ChantVerse {
  id: string;
  /** Which text this verse is from, named specifically enough to disambiguate recensions — see this file's own header comment for why that specificity matters. */
  source: string;
  verseNumber: number;
  /**
   * A prose speaker-tag ("Sūta said") that precedes the verse in the
   * source but is NOT part of the metrical verse itself — traditionally
   * printed adjacent to the śloka, not scanned as part of its 4 pādas.
   * Present, not absent, when the source has one; `null` otherwise.
   */
  speakerTag: string | null;
  /** Exactly 4 pādas for an anuṣṭubh śloka (this app's only metre so far); a future non-anuṣṭubh verse would have a different count, so this isn't hardcoded to 4 anywhere else in this file's own types. */
  padas: ChantPada[];
  /** Overall English rendering of the full verse, in reading order — not a strict word-for-word concatenation of the per-pāda word glosses, since natural English needs different word order than Sanskrit does. */
  meaning: string;
  /** Sourcing, license, and translation-confidence notes — see the file header for the fuller version of the same disclosure. */
  citation: string;
}

export const guruGitaVerses: readonly ChantVerse[] = [
  {
    id: 'guru-gita-1',
    source: 'Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)',
    verseNumber: 1,
    speakerTag: 'सूत उवाच',
    padas: [
      {
        text: 'कैलास शिखरे रम्ये',
        iast: 'kailāsa śikhare ramye',
        words: [
          { devanagari: 'कैलास शिखरे', iast: 'kailāsa śikhare', gloss: 'on the peak of Kailāsa (locative)' },
          { devanagari: 'रम्ये', iast: 'ramye', gloss: 'beautiful, lovely (locative adjective, describes śikhare)' },
        ],
      },
      {
        text: 'भक्तिसन्धाननायकम्',
        iast: 'bhaktisandhānanāyakam',
        words: [
          {
            devanagari: 'भक्तिसन्धाननायकम्',
            iast: 'bhaktisandhānanāyakam',
            gloss:
              'the leader/master of union-through-devotion (accusative, an epithet of Śaṅkara, three words ahead — literally bhakti "devotion" + sandhāna "joining, union" (the sense Monier-Williams/Apte actually support) + nāyaka "leader"; one published translation instead renders it "who knows the secret of devotion" — a real, independently-confirmed published choice, but a translator\'s interpretive gloss rather than a literal dictionary sense the way "union" is)',
          },
        ],
      },
      {
        text: 'प्रणम्य पार्वती भक्त्या',
        iast: 'praṇamya pārvatī bhaktyā',
        words: [
          { devanagari: 'प्रणम्य', iast: 'praṇamya', gloss: 'having bowed (gerund)' },
          { devanagari: 'पार्वती', iast: 'pārvatī', gloss: 'Pārvatī (nominative, subject of the sentence)' },
          { devanagari: 'भक्त्या', iast: 'bhaktyā', gloss: 'with devotion (instrumental)' },
        ],
      },
      {
        text: 'शङ्करं पर्यपृच्छत',
        iast: 'śaṅkaraṃ paryapṛcchata',
        words: [
          { devanagari: 'शङ्करं', iast: 'śaṅkaraṃ', gloss: 'Śaṅkara, i.e. Śiva (accusative, object)' },
          { devanagari: 'पर्यपृच्छत', iast: 'paryapṛcchata', gloss: 'asked, inquired of (imperfect verb)' },
        ],
      },
    ],
    meaning:
      'Sūta said: On the lovely peak of Mount Kailāsa, Pārvatī, having bowed with devotion to Śaṅkara — the master who unites devotees through devotion — asked him her question.',
    citation:
      'Devanagari independently confirmed against two sources (sanskritdocuments.org\'s short-version HTML and a Harvard-Kyoto transliteration hosted at veda.harekrsna.cz), not verbatim-copied from either transcriber\'s own restrictively-licensed edition. Meaning: independent word-by-word grammatical parse, cross-checked against the harekrsna.cz published English translation — "sandhāna" is genuinely ambiguous between "union" (the sense Monier-Williams/Apte directly support) and "secret" (not a standard dictionary sense, but a real, independently-confirmed published translator\'s choice); both are disclosed above rather than silently picking one.',
  },
];

export function verseById(id: string): ChantVerse | null {
  return guruGitaVerses.find((verse) => verse.id === id) ?? null;
}
