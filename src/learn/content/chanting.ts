/**
 * Chanting-practice content: full verses (not the letters/words/sentences
 * shape `Curriculum.ts` uses for the alphabet-up curriculum — a verse is a
 * different kind of thing, so this gets its own shape, the same reasoning
 * `resources.ts` already uses for its own separate content type).
 *
 * As of 2026-08-13, the complete Guru Gita — all 182 verses — of the popular
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
 *
 * Verses 2-182 (2026-08-13): same two-source methodology as verse 1, run at
 * scale via an orchestrated multi-agent `Workflow` — draft, then adversarial
 * verify, per batch of ~10 verses, each independently re-deriving word
 * segmentation and meaning from the Devanagari and cross-checking against
 * the harekrsna.cz translation (never copying its wording — see verse 1's
 * own note above on why). The verify stage caught and fixed 50 real
 * grammatical/citation errors across the batches (wrong case labelling,
 * transliteration typos, an under-split pāda, sandhi misread as a
 * compound) before any of it shipped.
 *
 * A genuine, confirmed (not assumed) edition variant: verse 182, the
 * closing benedictory verse ("saṃsārasāgara-samuddharaṇaika-mantram..."),
 * is present in the sanskritdocuments.org edition but absent from the
 * veda.harekrsna.cz edition, whose own numbering stops at 181 — both
 * editions' closing colophon ("iti śrī skanda purāṇe...guru gītā
 * samāptāḥ") is textually identical, it just follows verse 181 in one
 * edition and verse 182 in the other. Shipped per the sanskritdocuments.org
 * edition (this file's primary source throughout), with that verse's own
 * `citation` field noting the absence from the second source explicitly.
 *
 * Most verses are anuṣṭubh (4 pādas of 8 syllables); several longer verses
 * use other classical metres with different, but internally consistent,
 * pāda syllable counts (confirmed directly, not assumed — see
 * `chanting.test.ts`'s own total-syllable-count check). A pāda's word
 * segmentation always favours grammatical/lexical clarity over forcing an
 * exact syllable count: real Sanskrit verse composition sometimes lets a
 * word straddle a metrical pāda boundary, and this file never manufactures
 * a word-break a source doesn't actually have just to hit a syllable
 * target — confirmed per-verse before shipping, not assumed.
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
  /** 4 pādas for the anuṣṭubh ślokas most verses in this file use; several longer verses use other classical metres with a different pāda count (e.g. 4 pādas of 14, 17, or 19 syllables instead of 8) — never hardcoded to 4 anywhere else in this file's own types. */
  padas: ChantPada[];
  /** Overall English rendering of the full verse, in reading order — not a strict word-for-word concatenation of the per-pāda word glosses, since natural English needs different word order than Sanskrit does. */
  meaning: string;
  /** Sourcing, license, and translation-confidence notes — see the file header for the fuller version of the same disclosure. */
  citation: string;
}

export const guruGitaVerses: readonly ChantVerse[] = [
  {
    id: "guru-gita-1",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 1,
    speakerTag: "सूत उवाच",
    padas: [
      {
        text: "कैलास शिखरे रम्ये",
        iast: "kailāsa śikhare ramye",
        words: [
          {
            devanagari: "कैलास शिखरे",
            iast: "kailāsa śikhare",
            gloss: "on the peak of Kailāsa (locative)"
          },
          {
            devanagari: "रम्ये",
            iast: "ramye",
            gloss: "beautiful, lovely (locative adjective, describes śikhare)"
          }
        ]
      },
      {
        text: "भक्तिसन्धाननायकम्",
        iast: "bhaktisandhānanāyakam",
        words: [
          {
            devanagari: "भक्तिसन्धाननायकम्",
            iast: "bhaktisandhānanāyakam",
            gloss: "the leader/master of union-through-devotion (accusative, an epithet of Śaṅkara, three words ahead — literally bhakti \"devotion\" + sandhāna \"joining, union\" (the sense Monier-Williams/Apte actually support) + nāyaka \"leader\"; one published translation instead renders it \"who knows the secret of devotion\" — a real, independently-confirmed published choice, but a translator's interpretive gloss rather than a literal dictionary sense the way \"union\" is)"
          }
        ]
      },
      {
        text: "प्रणम्य पार्वती भक्त्या",
        iast: "praṇamya pārvatī bhaktyā",
        words: [
          {
            devanagari: "प्रणम्य",
            iast: "praṇamya",
            gloss: "having bowed (gerund)"
          },
          {
            devanagari: "पार्वती",
            iast: "pārvatī",
            gloss: "Pārvatī (nominative, subject of the sentence)"
          },
          {
            devanagari: "भक्त्या",
            iast: "bhaktyā",
            gloss: "with devotion (instrumental)"
          }
        ]
      },
      {
        text: "शङ्करं पर्यपृच्छत",
        iast: "śaṅkaraṃ paryapṛcchata",
        words: [
          {
            devanagari: "शङ्करं",
            iast: "śaṅkaraṃ",
            gloss: "Śaṅkara, i.e. Śiva (accusative, object)"
          },
          {
            devanagari: "पर्यपृच्छत",
            iast: "paryapṛcchata",
            gloss: "asked, inquired of (imperfect verb)"
          }
        ]
      }
    ],
    meaning: "Sūta said: On the lovely peak of Mount Kailāsa, Pārvatī, having bowed with devotion to Śaṅkara — the master who unites devotees through devotion — asked him her question.",
    citation: "Devanagari independently confirmed against two sources (sanskritdocuments.org's short-version HTML and a Harvard-Kyoto transliteration hosted at veda.harekrsna.cz), not verbatim-copied from either transcriber's own restrictively-licensed edition. Meaning: independent word-by-word grammatical parse, cross-checked against the harekrsna.cz published English translation — \"sandhāna\" is genuinely ambiguous between \"union\" (the sense Monier-Williams/Apte directly support) and \"secret\" (not a standard dictionary sense, but a real, independently-confirmed published translator's choice); both are disclosed above rather than silently picking one."
  },
  {
    id: "guru-gita-2",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 2,
    speakerTag: "श्री देव्युवाच",
    padas: [
      {
        text: "ॐ नमो देवदेवेश",
        iast: "oṃ namo devadeveśa",
        words: [
          {
            devanagari: "ॐ नमो",
            iast: "oṃ namo",
            gloss: "Oṃ, salutation/homage (to)"
          },
          {
            devanagari: "देवदेवेश",
            iast: "devadeveśa",
            gloss: "O Lord of the gods of gods (vocative epithet)"
          }
        ]
      },
      {
        text: "परात्परजगद्गुरो",
        iast: "parātparajagadguro",
        words: [
          {
            devanagari: "परात्परजगद्गुरो",
            iast: "parātparajagadguro",
            gloss: "O Teacher of the universe who is higher than the highest (vocative epithet — para-para + jagad-guru)"
          }
        ]
      },
      {
        text: "सदाशिव महादेव",
        iast: "sadāśiva mahādeva",
        words: [
          {
            devanagari: "सदाशिव",
            iast: "sadāśiva",
            gloss: "O ever-auspicious one, i.e. Sadāśiva (vocative)"
          },
          {
            devanagari: "महादेव",
            iast: "mahādeva",
            gloss: "O great God, i.e. Mahādeva (vocative)"
          }
        ]
      },
      {
        text: "गुरुदीक्षां प्रदेहि मे",
        iast: "gurudīkṣāṃ pradehi me",
        words: [
          {
            devanagari: "गुरुदीक्षां",
            iast: "gurudīkṣāṃ",
            gloss: "initiation into the Guru('s mystery) (accusative, object)"
          },
          {
            devanagari: "प्रदेहि",
            iast: "pradehi",
            gloss: "grant, give (imperative, 2nd person singular)"
          },
          {
            devanagari: "मे",
            iast: "me",
            gloss: "to me (dative/genitive enclitic)"
          }
        ]
      }
    ],
    meaning: "The Goddess said: Oṃ, salutations to you, O Lord of lords of the gods, O Teacher of the universe beyond the beyond, O Sadāśiva, O Mahādeva — grant me initiation into the mystery of the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-3",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 3,
    speakerTag: null,
    padas: [
      {
        text: "केन मार्गेण भो स्वामिन्",
        iast: "kena mārgeṇa bho svāmin",
        words: [
          {
            devanagari: "केन",
            iast: "kena",
            gloss: "by what (instrumental interrogative)"
          },
          {
            devanagari: "मार्गेण",
            iast: "mārgeṇa",
            gloss: "path, means (instrumental)"
          },
          {
            devanagari: "भो",
            iast: "bho",
            gloss: "oh (vocative particle of address)"
          },
          {
            devanagari: "स्वामिन्",
            iast: "svāmin",
            gloss: "O Lord, O master (vocative)"
          }
        ]
      },
      {
        text: "देहि ब्रह्ममयो भवेत्",
        iast: "dehi brahmamayo bhavet",
        words: [
          {
            devanagari: "देहि",
            iast: "dehi",
            gloss: "the embodied one, i.e. the soul (nominative subject; also read as an imperative \"give/tell\" in some editions)"
          },
          {
            devanagari: "ब्रह्ममयो",
            iast: "brahmamayo",
            gloss: "consisting of/identical with Brahman (nominative adjective)"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "may become (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "त्वं कृपां कुरु मे स्वामिन्",
        iast: "tvaṃ kṛpāṃ kuru me svāmin",
        words: [
          {
            devanagari: "त्वं",
            iast: "tvaṃ",
            gloss: "you (nominative)"
          },
          {
            devanagari: "कृपां",
            iast: "kṛpāṃ",
            gloss: "mercy, grace (accusative, object)"
          },
          {
            devanagari: "कुरु",
            iast: "kuru",
            gloss: "do, show (imperative, 2nd person singular)"
          },
          {
            devanagari: "मे",
            iast: "me",
            gloss: "to me (dative/genitive enclitic)"
          },
          {
            devanagari: "स्वामिन्",
            iast: "svāmin",
            gloss: "O Lord, O master (vocative)"
          }
        ]
      },
      {
        text: "नमामि चरणौ तव",
        iast: "namāmi caraṇau tava",
        words: [
          {
            devanagari: "नमामि",
            iast: "namāmi",
            gloss: "I bow, I salute (present verb, 1st person singular)"
          },
          {
            devanagari: "चरणौ",
            iast: "caraṇau",
            gloss: "the two feet (accusative dual, object)"
          },
          {
            devanagari: "तव",
            iast: "tava",
            gloss: "your (genitive)"
          }
        ]
      }
    ],
    meaning: "By what path, O Lord, can an embodied being become one with Brahman? Show me your grace, O Lord — I bow to your feet.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The word \"देहि\" is ambiguous between the noun dehī (\"the embodied soul,\" taken here as subject of bhavet) and the imperative \"give,\" a well-known variant reading among translators of this verse."
  },
  {
    id: "guru-gita-4",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 4,
    speakerTag: "ईश्वर उवाच",
    padas: [
      {
        text: "ममरूपासि देवि त्वं",
        iast: "mamarūpāsi devi tvaṃ",
        words: [
          {
            devanagari: "ममरूपासि",
            iast: "mamarūpāsi",
            gloss: "you are my (own) form/embodiment (mama + rūpā + asi, 2nd person singular verb \"you are\")"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          },
          {
            devanagari: "त्वं",
            iast: "tvaṃ",
            gloss: "you (nominative, emphatic)"
          }
        ]
      },
      {
        text: "त्वत्प्रीत्यर्थं वदाम्यहम्",
        iast: "tvatprītyarthaṃ vadāmyaham",
        words: [
          {
            devanagari: "त्वत्प्रीत्यर्थं",
            iast: "tvatprītyarthaṃ",
            gloss: "for the sake of (my) love for you (tvat-prīti-artham, accusative used adverbially)"
          },
          {
            devanagari: "वदाम्यहम्",
            iast: "vadāmyaham",
            gloss: "I speak (vadāmi + aham, present verb + \"I\")"
          }
        ]
      },
      {
        text: "लोकोपकारकः प्रश्नो",
        iast: "lokopakārakaḥ praśno",
        words: [
          {
            devanagari: "लोकोपकारकः",
            iast: "lokopakārakaḥ",
            gloss: "beneficial to the world (nominative adjective, describes praśnaḥ)"
          },
          {
            devanagari: "प्रश्नो",
            iast: "praśno",
            gloss: "question (nominative subject)"
          }
        ]
      },
      {
        text: "न केनापि कृतः पुरा",
        iast: "na kenāpi kṛtaḥ purā",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "केनापि",
            iast: "kenāpi",
            gloss: "by anyone (instrumental)"
          },
          {
            devanagari: "कृतः",
            iast: "kṛtaḥ",
            gloss: "asked, made (past participle, nominative)"
          },
          {
            devanagari: "पुरा",
            iast: "purā",
            gloss: "before, previously (adverb)"
          }
        ]
      }
    ],
    meaning: "Īśvara said: O Goddess, you are my very own form — I speak this for love of you. This question, which benefits the whole world, has never before been asked by anyone.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-5",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 5,
    speakerTag: null,
    padas: [
      {
        text: "दुर्लभं त्रिषु लोकेषु",
        iast: "durlabhaṃ triṣu lokeṣu",
        words: [
          {
            devanagari: "दुर्लभं",
            iast: "durlabhaṃ",
            gloss: "rare, hard to obtain (accusative, object)"
          },
          {
            devanagari: "त्रिषु",
            iast: "triṣu",
            gloss: "in the three (locative)"
          },
          {
            devanagari: "लोकेषु",
            iast: "lokeṣu",
            gloss: "worlds (locative)"
          }
        ]
      },
      {
        text: "तच्छृणुष्व वदाम्यहम्",
        iast: "tacchṛṇuṣva vadāmyaham",
        words: [
          {
            devanagari: "तच्छृणुष्व",
            iast: "tacchṛṇuṣva",
            gloss: "listen to that (tat + śṛṇuṣva, imperative 2nd person singular)"
          },
          {
            devanagari: "वदाम्यहम्",
            iast: "vadāmyaham",
            gloss: "I speak (vadāmi + aham, present verb + \"I\")"
          }
        ]
      },
      {
        text: "गुरुं विना ब्रह्म नान्यत्सत्यं",
        iast: "guruṃ vinā brahma nānyatsatyaṃ",
        words: [
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative)"
          },
          {
            devanagari: "विना",
            iast: "vinā",
            gloss: "without (postposition)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "the Absolute, Brahman (nominative)"
          },
          {
            devanagari: "नान्यत्सत्यं",
            iast: "nānyatsatyaṃ",
            gloss: "is not other; is true (na + anyat + satyam, negation + \"other\" + \"true\")"
          }
        ]
      },
      {
        text: "सत्यं वरानने",
        iast: "satyaṃ varānane",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true, real (nominative, repeated for emphasis)"
          },
          {
            devanagari: "वरानने",
            iast: "varānane",
            gloss: "O one with a beautiful face (vocative epithet)"
          }
        ]
      }
    ],
    meaning: "Listen — I will tell you of that which is rare in all three worlds: apart from the Guru there is no other Brahman. This is the truth, this is the truth, O beautiful-faced one.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-6",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 6,
    speakerTag: null,
    padas: [
      {
        text: "वेदशास्त्रपुराणानि",
        iast: "vedaśāstrapurāṇāni",
        words: [
          {
            devanagari: "वेदशास्त्रपुराणानि",
            iast: "vedaśāstrapurāṇāni",
            gloss: "the Vedas, the Śāstras, and the Purāṇas (nominative plural, subject of the sentence completed in verse 7)"
          }
        ]
      },
      {
        text: "इतिहासादिकानि च",
        iast: "itihāsādikāni ca",
        words: [
          {
            devanagari: "इतिहासादिकानि",
            iast: "itihāsādikāni",
            gloss: "the Itihāsas and so forth (nominative plural)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "मन्त्रयन्त्रादिविद्याश्च",
        iast: "mantrayantrādividyāśca",
        words: [
          {
            devanagari: "मन्त्रयन्त्रादिविद्याश्च",
            iast: "mantrayantrādividyāśca",
            gloss: "and the sciences of mantra, yantra, and the like (nominative plural + \"and\")"
          }
        ]
      },
      {
        text: "स्मृतिरुच्चाटनादिकम्",
        iast: "smṛtiruccāṭanādikam",
        words: [
          {
            devanagari: "स्मृतिरुच्चाटनादिकम्",
            iast: "smṛtiruccāṭanādikam",
            gloss: "the Smṛti(-corpus), and (texts on) exorcism/expulsion-rites and so forth (nominative singular — smṛtiḥ + uccāṭana-ādikam; the visarga sandhi smṛtiḥ+uccāṭana→smṛtir uccāṭana confirms the nominative, not accusative, ending)"
          }
        ]
      }
    ],
    meaning: "The Vedas, the Śāstras, the Purāṇas, the Itihāsas and such texts; the sciences of mantra, yantra and the like; the Smṛtis and treatises on exorcism-rites and so forth —",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-7",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 7,
    speakerTag: null,
    padas: [
      {
        text: "शैवशाक्तागमादीनि",
        iast: "śaivaśāktāgamādīni",
        words: [
          {
            devanagari: "शैवशाक्तागमादीनि",
            iast: "śaivaśāktāgamādīni",
            gloss: "the Śaiva, Śākta and other Āgamas (nominative plural, continuing the subject list from verse 6)"
          }
        ]
      },
      {
        text: "अन्यानि विविधानि च",
        iast: "anyāni vividhāni ca",
        words: [
          {
            devanagari: "अन्यानि",
            iast: "anyāni",
            gloss: "other (nominative plural)"
          },
          {
            devanagari: "विविधानि",
            iast: "vividhāni",
            gloss: "various (nominative plural)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "अपभ्रंशकराणीह",
        iast: "apabhraṃśakarāṇīha",
        words: [
          {
            devanagari: "अपभ्रंशकराणीह",
            iast: "apabhraṃśakarāṇīha",
            gloss: "cause corruption/delusion here, in this world (apabhraṃśa-karāṇi + iha, nominative plural adjective — predicate of the whole list from verse 6)"
          }
        ]
      },
      {
        text: "जीवानां भ्रान्तचेतसाम्",
        iast: "jīvānāṃ bhrāntacetasām",
        words: [
          {
            devanagari: "जीवानां",
            iast: "jīvānāṃ",
            gloss: "of living beings (genitive plural)"
          },
          {
            devanagari: "भ्रान्तचेतसाम्",
            iast: "bhrāntacetasām",
            gloss: "whose minds are (already) confused (genitive plural adjective)"
          }
        ]
      }
    ],
    meaning: "— the Śaiva and Śākta Āgamas, and various other scriptures besides — all these, in this world, only further confound living beings whose minds are already bewildered.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-8",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 8,
    speakerTag: null,
    padas: [
      {
        text: "यज्ञो व्रतं तपो दानं",
        iast: "yajño vrataṃ tapo dānaṃ",
        words: [
          {
            devanagari: "यज्ञो",
            iast: "yajño",
            gloss: "sacrifice (nominative)"
          },
          {
            devanagari: "व्रतं",
            iast: "vrataṃ",
            gloss: "vow (nominative)"
          },
          {
            devanagari: "तपो",
            iast: "tapo",
            gloss: "austerity (nominative)"
          },
          {
            devanagari: "दानं",
            iast: "dānaṃ",
            gloss: "charity, gift-giving (nominative)"
          }
        ]
      },
      {
        text: "जपस्तीर्थं तथैव च",
        iast: "japastīrthaṃ tathaiva ca",
        words: [
          {
            devanagari: "जपस्तीर्थं",
            iast: "japastīrthaṃ",
            gloss: "recitation (of mantra) and pilgrimage (japaḥ + tīrtham, nominative)"
          },
          {
            devanagari: "तथैव",
            iast: "tathaiva",
            gloss: "likewise, in the same way"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "गुरुतत्त्वमविज्ञाय",
        iast: "gurutattvamavijñāya",
        words: [
          {
            devanagari: "गुरुतत्त्वमविज्ञाय",
            iast: "gurutattvamavijñāya",
            gloss: "without truly knowing the reality/truth of the Guru (gerund of negation — a-vijñāya)"
          }
        ]
      },
      {
        text: "मूढास्ते चरते जनाः",
        iast: "mūḍhāste carate janāḥ",
        words: [
          {
            devanagari: "मूढास्ते",
            iast: "mūḍhāste",
            gloss: "those deluded ones (mūḍhāḥ + te, nominative plural)"
          },
          {
            devanagari: "चरते",
            iast: "carate",
            gloss: "wander, roam, practice (verb, used here with plural subject)"
          },
          {
            devanagari: "जनाः",
            iast: "janāḥ",
            gloss: "people (nominative plural, subject)"
          }
        ]
      }
    ],
    meaning: "Sacrifice, vows, austerity, charity, mantra-recitation and pilgrimage likewise — people who practice these without truly knowing the reality of the Guru are but deluded fools going through the motions.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-9",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 9,
    speakerTag: null,
    padas: [
      {
        text: "गुरुर्बुद्ध्यात्मनो नान्यत्",
        iast: "gururbuddhyātmano nānyat",
        words: [
          {
            devanagari: "गुरुर्बुद्ध्यात्मनो",
            iast: "gururbuddhyātmano",
            gloss: "than the intelligence/inner self (guruḥ... buddhi-ātmanaḥ, ablative — \"the Guru is not other than the intellect-self\")"
          },
          {
            devanagari: "नान्यत्",
            iast: "nānyat",
            gloss: "is not other (na + anyat)"
          }
        ]
      },
      {
        text: "सत्यं सत्यं न संशयः",
        iast: "satyaṃ satyaṃ na saṃśayaḥ",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true (nominative)"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true (repeated for emphasis)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative)"
          }
        ]
      },
      {
        text: "तल्लाभार्थं प्रयत्नस्तु",
        iast: "tallābhārthaṃ prayatnastu",
        words: [
          {
            devanagari: "तल्लाभार्थं",
            iast: "tallābhārthaṃ",
            gloss: "for the sake of attaining that (tat + lābha + artham, accusative used adverbially)"
          },
          {
            devanagari: "प्रयत्नस्तु",
            iast: "prayatnastu",
            gloss: "effort, indeed (prayatnaḥ + tu, nominative subject + emphatic particle)"
          }
        ]
      },
      {
        text: "कर्तव्यो हि मनीषिभिः",
        iast: "kartavyo hi manīṣibhiḥ",
        words: [
          {
            devanagari: "कर्तव्यो",
            iast: "kartavyo",
            gloss: "must be made, is to be done (gerundive, nominative)"
          },
          {
            devanagari: "हि",
            iast: "hi",
            gloss: "indeed, certainly (emphatic particle)"
          },
          {
            devanagari: "मनीषिभिः",
            iast: "manīṣibhiḥ",
            gloss: "by the wise (instrumental plural)"
          }
        ]
      }
    ],
    meaning: "The Guru is nothing other than the intelligence of the self — this is true, this is true, beyond doubt. Therefore the wise must make every effort to attain that.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-10",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 10,
    speakerTag: null,
    padas: [
      {
        text: "गूढ विद्या जगन्माया",
        iast: "gūḍha vidyā jaganmāyā",
        words: [
          {
            devanagari: "गूढ",
            iast: "gūḍha",
            gloss: "hidden, secret (adjective)"
          },
          {
            devanagari: "विद्या",
            iast: "vidyā",
            gloss: "knowledge, wisdom (nominative)"
          },
          {
            devanagari: "जगन्माया",
            iast: "jaganmāyā",
            gloss: "the māyā of the universe, i.e. the World-Mother/cosmic illusion (nominative, in apposition)"
          }
        ]
      },
      {
        text: "देहे चाज्ञानसंभवा",
        iast: "dehe cājñānasaṃbhavā",
        words: [
          {
            devanagari: "देहे",
            iast: "dehe",
            gloss: "in the body (locative)"
          },
          {
            devanagari: "चाज्ञानसंभवा",
            iast: "cājñānasaṃbhavā",
            gloss: "and arising from ignorance (ca + ajñāna-sambhavā, nominative adjective)"
          }
        ]
      },
      {
        text: "उदयो यत्प्रकाशेन",
        iast: "udayo yatprakāśena",
        words: [
          {
            devanagari: "उदयो",
            iast: "udayo",
            gloss: "arising, dawning, rise (nominative)"
          },
          {
            devanagari: "यत्प्रकाशेन",
            iast: "yatprakāśena",
            gloss: "by whose light/illumination (yat + prakāśena, instrumental)"
          }
        ]
      },
      {
        text: "गुरुशब्देन कथ्यते",
        iast: "guruśabdena kathyate",
        words: [
          {
            devanagari: "गुरुशब्देन",
            iast: "guruśabdena",
            gloss: "by the word \"guru\" (instrumental)"
          },
          {
            devanagari: "कथ्यते",
            iast: "kathyate",
            gloss: "is called, is expressed (passive verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "The secret wisdom that is the world's māyā arises in the body out of ignorance; its rising, through whose light it dawns, is what is spoken of by the word \"guru.\"",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse's syntax is notably compressed, and translators differ on whether jagan-māyā and guru-śabda both refer to the same hidden power arising as the Guru's light or describe two related but distinct things; the rendering here follows the more literal reading of the words as printed (some editions read sva-prakāśena, \"by its own light,\" in place of yat-prakāśena)."
  },
  {
    id: "guru-gita-11",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 11,
    speakerTag: null,
    padas: [
      {
        text: "सर्वपापविशुद्धात्मा",
        iast: "sarvapāpaviśuddhātmā",
        words: [
          {
            devanagari: "सर्वपापविशुद्धात्मा",
            iast: "sarvapāpaviśuddhātmā",
            gloss: "one whose self/soul is purified of all sins (nominative — sarva-pāpa-viśuddha-ātmā)"
          }
        ]
      },
      {
        text: "श्रीगुरोः पादसेवनात्",
        iast: "śrīguroḥ pādasevanāt",
        words: [
          {
            devanagari: "श्रीगुरोः",
            iast: "śrīguroḥ",
            gloss: "of the revered Guru (genitive)"
          },
          {
            devanagari: "पादसेवनात्",
            iast: "pādasevanāt",
            gloss: "from service to the feet (ablative)"
          }
        ]
      },
      {
        text: "देही ब्रह्म भवेद्यस्मात्त्वत्कृपार्थं",
        iast: "dehī brahma bhavedyasmāttvatkṛpārthaṃ",
        words: [
          {
            devanagari: "देही",
            iast: "dehī",
            gloss: "the embodied one, the soul (nominative subject)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman (nominative/predicate)"
          },
          {
            devanagari: "भवेद्यस्मात्त्वत्कृपार्थं",
            iast: "bhavedyasmāttvatkṛpārthaṃ",
            gloss: "since/because [it] may become [Brahman] — for the sake of grace toward you (bhavet + yasmāt + tvat-kṛpā-artham: optative verb + causal particle + accusative used adverbially)"
          }
        ]
      },
      {
        text: "वदामि ते",
        iast: "vadāmi te",
        words: [
          {
            devanagari: "वदामि",
            iast: "vadāmi",
            gloss: "I speak, I tell (present verb, 1st person singular)"
          },
          {
            devanagari: "ते",
            iast: "te",
            gloss: "to you (dative enclitic)"
          }
        ]
      }
    ],
    meaning: "Because the embodied soul, its self purified of all sin through service at the revered Guru's feet, may become Brahman itself — I tell you this out of compassion for you.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-12",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 12,
    speakerTag: null,
    padas: [
      {
        text: "गुरुपादांबुजं स्मृत्वा",
        iast: "gurupādāṃbujaṃ smṛtvā",
        words: [
          {
            devanagari: "गुरुपादांबुजं",
            iast: "gurupādāṃbujaṃ",
            gloss: "the lotus feet of the Guru (accusative, object of smṛtvā)"
          },
          {
            devanagari: "स्मृत्वा",
            iast: "smṛtvā",
            gloss: "having remembered, having called to mind (gerund)"
          }
        ]
      },
      {
        text: "जलं शिरसि धारयेत्",
        iast: "jalaṃ śirasi dhārayet",
        words: [
          {
            devanagari: "जलं",
            iast: "jalaṃ",
            gloss: "water (accusative, object)"
          },
          {
            devanagari: "शिरसि",
            iast: "śirasi",
            gloss: "on the head (locative)"
          },
          {
            devanagari: "धारयेत्",
            iast: "dhārayet",
            gloss: "one should hold, pour (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "सर्वतीर्थावगाहस्य",
        iast: "sarvatīrthāvagāhasya",
        words: [
          {
            devanagari: "सर्वतीर्थावगाहस्य",
            iast: "sarvatīrthāvagāhasya",
            gloss: "of bathing in all sacred waters (genitive, modifying फलं — sarva \"all\" + tīrtha \"holy ford\" + avagāha \"immersion\")"
          }
        ]
      },
      {
        text: "सम्प्राप्नोति फलं नरः",
        iast: "samprāpnoti phalaṃ naraḥ",
        words: [
          {
            devanagari: "सम्प्राप्नोति",
            iast: "samprāpnoti",
            gloss: "obtains, attains fully (present verb, 3rd person singular)"
          },
          {
            devanagari: "फलं",
            iast: "phalaṃ",
            gloss: "the fruit, the result (accusative, object)"
          },
          {
            devanagari: "नरः",
            iast: "naraḥ",
            gloss: "a man (nominative, subject)"
          }
        ]
      }
    ],
    meaning: "If a man calls to mind the lotus feet of the Guru and pours that water over his head, he obtains the very fruit of bathing in all the sacred waters of pilgrimage.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-13",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 13,
    speakerTag: null,
    padas: [
      {
        text: "शोषणं पापपङ्कस्य",
        iast: "śoṣaṇaṃ pāpapaṅkasya",
        words: [
          {
            devanagari: "शोषणं",
            iast: "śoṣaṇaṃ",
            gloss: "the drying up, desiccation (nominative, in apposition describing the water's power)"
          },
          {
            devanagari: "पापपङ्कस्य",
            iast: "pāpapaṅkasya",
            gloss: "of the mire of sin (genitive, pāpa \"sin\" + paṅka \"mud, mire\")"
          }
        ]
      },
      {
        text: "दीपनं ज्ञानतेजसाम्",
        iast: "dīpanaṃ jñānatejasām",
        words: [
          {
            devanagari: "दीपनं",
            iast: "dīpanaṃ",
            gloss: "the kindling, lighting (nominative, in apposition)"
          },
          {
            devanagari: "ज्ञानतेजसाम्",
            iast: "jñānatejasām",
            gloss: "of the radiances/flames of knowledge (genitive plural)"
          }
        ]
      },
      {
        text: "गुरुपादोदकं सम्यक्",
        iast: "gurupādodakaṃ samyak",
        words: [
          {
            devanagari: "गुरुपादोदकं",
            iast: "gurupādodakaṃ",
            gloss: "the water of the Guru's feet (nominative, subject — guru + pāda + udaka)"
          },
          {
            devanagari: "सम्यक्",
            iast: "samyak",
            gloss: "properly, thoroughly (adverb)"
          }
        ]
      },
      {
        text: "संसारार्णवतारकम्",
        iast: "saṃsārārṇavatārakam",
        words: [
          {
            devanagari: "संसारार्णवतारकम्",
            iast: "saṃsārārṇavatārakam",
            gloss: "that which ferries one across the ocean of worldly existence (nominative, adjective describing guru-pādodakam — saṃsāra \"transmigration\" + arṇava \"ocean\" + tāraka \"crossing, ferrying\")"
          }
        ]
      }
    ],
    meaning: "The water of the Guru's feet thoroughly dries up the mire of sin, kindles the flames of knowledge, and truly carries one across the ocean of worldly existence.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-14",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 14,
    speakerTag: null,
    padas: [
      {
        text: "अज्ञानमूलहरणं",
        iast: "ajñānamūlaharaṇaṃ",
        words: [
          {
            devanagari: "अज्ञानमूलहरणं",
            iast: "ajñānamūlaharaṇaṃ",
            gloss: "that which removes/uproots the root of ignorance (accusative, in apposition to गुरुपादोदकं — ajñāna \"ignorance\" + mūla \"root\" + haraṇa \"removing\")"
          }
        ]
      },
      {
        text: "जन्म कर्म निवारणम्",
        iast: "janma karma nivāraṇam",
        words: [
          {
            devanagari: "जन्म",
            iast: "janma",
            gloss: "birth (accusative; first member of the compound जन्म-कर्म-निवारणम् \"warder-off of birth and karma,\" in apposition to गुरुपादोदकं)"
          },
          {
            devanagari: "कर्म",
            iast: "karma",
            gloss: "action, karma (accusative; second member of the same compound)"
          },
          {
            devanagari: "निवारणम्",
            iast: "nivāraṇam",
            gloss: "that which wards off, prevents (accusative, head of the compound जन्मकर्मनिवारणम्, in apposition to गुरुपादोदकं — the object of पिबेत् in the next line)"
          }
        ]
      },
      {
        text: "ज्ञानवैराग्यसिद्ध्यर्थं",
        iast: "jñānavairāgyasiddhyarthaṃ",
        words: [
          {
            devanagari: "ज्ञानवैराग्यसिद्ध्यर्थं",
            iast: "jñānavairāgyasiddhyarthaṃ",
            gloss: "for the accomplishment of knowledge and dispassion (accusative used adverbially, purpose — jñāna \"knowledge\" + vairāgya \"dispassion\" + siddhi \"attainment\" + artham \"for the sake of\")"
          }
        ]
      },
      {
        text: "गुरुपादोदकं पिबेत्",
        iast: "gurupādodakaṃ pibet",
        words: [
          {
            devanagari: "गुरुपादोदकं",
            iast: "gurupādodakaṃ",
            gloss: "the water of the Guru's feet (accusative, object of पिबेत्)"
          },
          {
            devanagari: "पिबेत्",
            iast: "pibet",
            gloss: "one should drink (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "It uproots the very foundation of ignorance and wards off birth and the karma that causes it; one should drink the water of the Guru's feet in order to attain knowledge and dispassion.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-15",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 15,
    speakerTag: null,
    padas: [
      {
        text: "गुरोः पादोदकं पीत्वा",
        iast: "guroḥ pādodakaṃ pītvā",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "of the Guru (genitive)"
          },
          {
            devanagari: "पादोदकं",
            iast: "pādodakaṃ",
            gloss: "the foot-water (accusative, object of पीत्वा)"
          },
          {
            devanagari: "पीत्वा",
            iast: "pītvā",
            gloss: "having drunk (gerund)"
          }
        ]
      },
      {
        text: "गुरोरुच्छिष्टभोजनम्",
        iast: "gurorucchiṣṭabhojanam",
        words: [
          {
            devanagari: "गुरोरुच्छिष्टभोजनम्",
            iast: "gurorucchiṣṭabhojanam",
            gloss: "the eating of the Guru's leftover food (accusative, with an elided optative verb such as kuryāt \"one should do\" — guru + ucchiṣṭa \"remnant, leftover\" + bhojana \"eating\")"
          }
        ]
      },
      {
        text: "गुरुमूर्तेः सदा ध्यानं",
        iast: "gurumūrteḥ sadā dhyānaṃ",
        words: [
          {
            devanagari: "गुरुमूर्तेः",
            iast: "gurumūrteḥ",
            gloss: "of the Guru's form/image (genitive, object of ध्यानं)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always, constantly (adverb)"
          },
          {
            devanagari: "ध्यानं",
            iast: "dhyānaṃ",
            gloss: "meditation (accusative, another prescribed act with an elided optative verb)"
          }
        ]
      },
      {
        text: "गुरुमन्त्रं सदा जपेत्",
        iast: "gurumantraṃ sadā japet",
        words: [
          {
            devanagari: "गुरुमन्त्रं",
            iast: "gurumantraṃ",
            gloss: "the mantra given by the Guru (accusative, object)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always, constantly (adverb)"
          },
          {
            devanagari: "जपेत्",
            iast: "japet",
            gloss: "one should repeat, recite (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "Having drunk the water of the Guru's feet, and eating the food left over by the Guru, one should constantly meditate on the Guru's form and always repeat the Guru's mantra.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-16",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 16,
    speakerTag: null,
    padas: [
      {
        text: "काशी क्षेत्रं तन्निवासो",
        iast: "kāśī kṣetraṃ tannivāso",
        words: [
          {
            devanagari: "काशी",
            iast: "kāśī",
            gloss: "Kāśī, i.e. Vārāṇasī (nominative, in apposition)"
          },
          {
            devanagari: "क्षेत्रं",
            iast: "kṣetraṃ",
            gloss: "the sacred field, holy site (nominative, predicate)"
          },
          {
            devanagari: "तन्निवासो",
            iast: "tannivāso",
            gloss: "the place of his (the Guru's) dwelling (nominative, subject — tad \"his\" + nivāsa \"abode\")"
          }
        ]
      },
      {
        text: "जाह्नवी चरणोदकम्",
        iast: "jāhnavī caraṇodakam",
        words: [
          {
            devanagari: "जाह्नवी",
            iast: "jāhnavī",
            gloss: "the Gaṅgā, daughter of Jahnu (nominative, predicate)"
          },
          {
            devanagari: "चरणोदकम्",
            iast: "caraṇodakam",
            gloss: "the water of the [Guru's] feet (nominative, subject)"
          }
        ]
      },
      {
        text: "गुरुर्विश्वेश्वरः साक्षात्",
        iast: "gururviśveśvaraḥ sākṣāt",
        words: [
          {
            devanagari: "गुरुर्विश्वेश्वरः",
            iast: "gururviśveśvaraḥ",
            gloss: "the Guru is the Lord of the universe (nominative — guru + viśveśvara \"lord of all\")"
          },
          {
            devanagari: "साक्षात्",
            iast: "sākṣāt",
            gloss: "directly, in person, actually (adverb)"
          }
        ]
      },
      {
        text: "तारकं ब्रह्म निश्चितम्",
        iast: "tārakaṃ brahma niścitam",
        words: [
          {
            devanagari: "तारकं",
            iast: "tārakaṃ",
            gloss: "that which saves/liberates (nominative, predicate adjective)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "the Absolute, Brahman (nominative, predicate)"
          },
          {
            devanagari: "निश्चितम्",
            iast: "niścitam",
            gloss: "certain, ascertained (nominative, predicate adjective)"
          }
        ]
      }
    ],
    meaning: "The place where the Guru dwells is Kāśī itself; the water of his feet is the Gaṅgā. The Guru is directly the Lord of the universe — it is certain that he is Brahman, the liberator.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-17",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 17,
    speakerTag: null,
    padas: [
      {
        text: "गुरोः पादोदकं यत्तु",
        iast: "guroḥ pādodakaṃ yattu",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "of the Guru (genitive)"
          },
          {
            devanagari: "पादोदकं",
            iast: "pādodakaṃ",
            gloss: "the foot-water (nominative, subject)"
          },
          {
            devanagari: "यत्तु",
            iast: "yattu",
            gloss: "which indeed, and that which (relative pronoun + emphatic particle)"
          }
        ]
      },
      {
        text: "गयाऽसौ सोऽक्षयो वटः",
        iast: "gayā'sau so'kṣayo vaṭaḥ",
        words: [
          {
            devanagari: "गयाऽसौ",
            iast: "gayā'sau",
            gloss: "that is Gayā (gayā \"Gayā\" + asau \"that\", nominative)"
          },
          {
            devanagari: "सोऽक्षयो",
            iast: "so'kṣayo",
            gloss: "that is the imperishable [banyan tree] (saḥ \"that\" + akṣayaḥ \"imperishable\", nominative)"
          },
          {
            devanagari: "वटः",
            iast: "vaṭaḥ",
            gloss: "banyan tree (nominative, predicate)"
          }
        ]
      },
      {
        text: "तीर्थराजः प्रयागश्च",
        iast: "tīrtharājaḥ prayāgaśca",
        words: [
          {
            devanagari: "तीर्थराजः",
            iast: "tīrtharājaḥ",
            gloss: "the king of sacred fords, i.e. Prayāga (nominative, predicate)"
          },
          {
            devanagari: "प्रयागश्च",
            iast: "prayāgaśca",
            gloss: "and Prayāga (nominative, predicate + conjunction)"
          }
        ]
      },
      {
        text: "गुरुमूर्त्यै नमो नमः",
        iast: "gurumūrtyai namo namaḥ",
        words: [
          {
            devanagari: "गुरुमूर्त्यै",
            iast: "gurumūrtyai",
            gloss: "to the Guru's embodied form (dative, object of homage)"
          },
          {
            devanagari: "नमो",
            iast: "namo",
            gloss: "salutation, obeisance (nominative/exclamatory)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, repeated for emphasis (nominative/exclamatory)"
          }
        ]
      }
    ],
    meaning: "The water of the Guru's feet — that indeed is Gayā, that is the imperishable banyan tree, that is Prayāga, the king of holy places. Salutations, again and again, to the embodied form of the Guru!",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-18",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 18,
    speakerTag: null,
    padas: [
      {
        text: "गुरुमूर्तिं स्मरेन्नित्यं",
        iast: "gurumūrtiṃ smarennityaṃ",
        words: [
          {
            devanagari: "गुरुमूर्तिं",
            iast: "gurumūrtiṃ",
            gloss: "the Guru's form (accusative, object)"
          },
          {
            devanagari: "स्मरेन्नित्यं",
            iast: "smarennityaṃ",
            gloss: "one should constantly remember (smaret \"should remember\", optative + nityam \"constantly\")"
          }
        ]
      },
      {
        text: "गुरुनाम सदा जपेत्",
        iast: "gurunāma sadā japet",
        words: [
          {
            devanagari: "गुरुनाम",
            iast: "gurunāma",
            gloss: "the Guru's name (accusative, object)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always (adverb)"
          },
          {
            devanagari: "जपेत्",
            iast: "japet",
            gloss: "one should repeat (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "गुरोराज्ञां प्रकुर्वीत",
        iast: "gurorājñāṃ prakurvīta",
        words: [
          {
            devanagari: "गुरोराज्ञां",
            iast: "gurorājñāṃ",
            gloss: "the Guru's command (accusative, object)"
          },
          {
            devanagari: "प्रकुर्वीत",
            iast: "prakurvīta",
            gloss: "one should carry out, perform (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "गुरोरन्यन्न भावयेत्",
        iast: "guroranyanna bhāvayet",
        words: [
          {
            devanagari: "गुरोरन्यन्न",
            iast: "guroranyanna",
            gloss: "nothing other than the Guru (guroḥ \"than the Guru\" + anyat \"other\" + na \"not\")"
          },
          {
            devanagari: "भावयेत्",
            iast: "bhāvayet",
            gloss: "one should dwell upon, contemplate (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "One should constantly remember the Guru's form, always repeat the Guru's name, carry out the Guru's command, and contemplate nothing other than the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-19",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 19,
    speakerTag: null,
    padas: [
      {
        text: "गुरुवक्त्रस्थितं ब्रह्म",
        iast: "guruvaktrasthitaṃ brahma",
        words: [
          {
            devanagari: "गुरुवक्त्रस्थितं",
            iast: "guruvaktrasthitaṃ",
            gloss: "situated in the Guru's mouth (nominative adjective agreeing with ब्रह्म — guru + vaktra \"mouth\" + sthita \"situated\")"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "the Absolute, Brahman (nominative, subject)"
          }
        ]
      },
      {
        text: "प्राप्यते तत्प्रसादतः",
        iast: "prāpyate tatprasādataḥ",
        words: [
          {
            devanagari: "प्राप्यते",
            iast: "prāpyate",
            gloss: "is attained (present passive verb, 3rd person singular)"
          },
          {
            devanagari: "तत्प्रसादतः",
            iast: "tatprasādataḥ",
            gloss: "through his (the Guru's) grace (ablative — tat \"his\" + prasāda \"grace\" + -taḥ ablative suffix)"
          }
        ]
      },
      {
        text: "गुरोर्ध्यानं सदा कुर्यात्",
        iast: "gurordhyānaṃ sadā kuryāt",
        words: [
          {
            devanagari: "गुरोर्ध्यानं",
            iast: "gurordhyānaṃ",
            gloss: "meditation on the Guru (accusative, object — guroḥ \"of the Guru\" + dhyānam \"meditation\")"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always (adverb)"
          },
          {
            devanagari: "कुर्यात्",
            iast: "kuryāt",
            gloss: "one should do, perform (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "कुलस्त्री स्वपतेर्यथा",
        iast: "kulastrī svapateryathā",
        words: [
          {
            devanagari: "कुलस्त्री",
            iast: "kulastrī",
            gloss: "a woman of good family, a chaste wife (nominative, subject of comparison)"
          },
          {
            devanagari: "स्वपतेर्यथा",
            iast: "svapateryathā",
            gloss: "as [she thinks] of her own husband (sva-pati \"own husband\", genitive + yathā \"as, just as\")"
          }
        ]
      }
    ],
    meaning: "The Absolute abiding on the Guru's lips is attained only through his grace; one should meditate on the Guru always, just as a devoted wife constantly thinks of her own husband.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-20",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 20,
    speakerTag: null,
    padas: [
      {
        text: "स्वाश्रमं च स्वजातिं च",
        iast: "svāśramaṃ ca svajātiṃ ca",
        words: [
          {
            devanagari: "स्वाश्रमं",
            iast: "svāśramaṃ",
            gloss: "one's own stage of life (accusative, object — sva \"own\" + āśrama \"life-stage\")"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (conjunction)"
          },
          {
            devanagari: "स्वजातिं",
            iast: "svajātiṃ",
            gloss: "one's own caste/birth-status (accusative, object)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (conjunction)"
          }
        ]
      },
      {
        text: "स्वकीर्तिपुष्टिवर्धनम्",
        iast: "svakīrtipuṣṭivardhanam",
        words: [
          {
            devanagari: "स्वकीर्तिपुष्टिवर्धनम्",
            iast: "svakīrtipuṣṭivardhanam",
            gloss: "the increase of one's own fame and prosperity (accusative, object — sva \"own\" + kīrti \"fame\" + puṣṭi \"prosperity\" + vardhana \"increasing\")"
          }
        ]
      },
      {
        text: "एतत्सर्वं परित्यज्य",
        iast: "etatsarvaṃ parityajya",
        words: [
          {
            devanagari: "एतत्सर्वं",
            iast: "etatsarvaṃ",
            gloss: "all this (accusative, object — etat \"this\" + sarvam \"all\")"
          },
          {
            devanagari: "परित्यज्य",
            iast: "parityajya",
            gloss: "having abandoned, forsaken (gerund)"
          }
        ]
      },
      {
        text: "गुरोरन्यन्न भावयेत्",
        iast: "guroranyanna bhāvayet",
        words: [
          {
            devanagari: "गुरोरन्यन्न",
            iast: "guroranyanna",
            gloss: "nothing other than the Guru (guroḥ \"than the Guru\" + anyat \"other\" + na \"not\")"
          },
          {
            devanagari: "भावयेत्",
            iast: "bhāvayet",
            gloss: "one should dwell upon, contemplate (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "Having given up one's own station in life, one's own caste, and the growth of one's own fame and prosperity — abandoning all of this — one should think of nothing but the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-21",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 21,
    speakerTag: null,
    padas: [
      {
        text: "अनन्याश्चिन्तयन्तो मां",
        iast: "ananyāścintayanto māṃ",
        words: [
          {
            devanagari: "अनन्याश्चिन्तयन्तो",
            iast: "ananyāścintayanto",
            gloss: "those who think without deviation, exclusively (nominative plural participle — ananyāḥ \"having no other [object]\" + cintayantaḥ \"thinking\")"
          },
          {
            devanagari: "मां",
            iast: "māṃ",
            gloss: "me (accusative, object of cintayantaḥ — \"thinking of me\")"
          }
        ]
      },
      {
        text: "सुलभं परमं पदम्",
        iast: "sulabhaṃ paramaṃ padam",
        words: [
          {
            devanagari: "सुलभं",
            iast: "sulabhaṃ",
            gloss: "easily attained (nominative/accusative adjective)"
          },
          {
            devanagari: "परमं",
            iast: "paramaṃ",
            gloss: "supreme (nominative/accusative adjective)"
          },
          {
            devanagari: "पदम्",
            iast: "padam",
            gloss: "the state, the goal (nominative/accusative, object attained)"
          }
        ]
      },
      {
        text: "तस्मात् सर्वप्रयत्नेन",
        iast: "tasmāt sarvaprayatnena",
        words: [
          {
            devanagari: "तस्मात्",
            iast: "tasmāt",
            gloss: "therefore (adverb)"
          },
          {
            devanagari: "सर्वप्रयत्नेन",
            iast: "sarvaprayatnena",
            gloss: "with all effort, with every endeavor (instrumental — sarva \"all\" + prayatna \"effort\")"
          }
        ]
      },
      {
        text: "गुरोराराधनं कुरु",
        iast: "gurorārādhanaṃ kuru",
        words: [
          {
            devanagari: "गुरोराराधनं",
            iast: "gurorārādhanaṃ",
            gloss: "the worship/propitiation of the Guru (accusative, object — guroḥ \"of the Guru\" + ārādhana \"worship\")"
          },
          {
            devanagari: "कुरु",
            iast: "kuru",
            gloss: "do! perform! (imperative verb, 2nd person singular)"
          }
        ]
      }
    ],
    meaning: "For those who think of Me with undivided attention, the supreme state is easily attained; therefore strive with all your effort to worship the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-22",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 22,
    speakerTag: null,
    padas: [
      {
        text: "त्रैलोक्ये स्फुटवक्तारो",
        iast: "trailokye sphuṭavaktāro",
        words: [
          {
            devanagari: "त्रैलोक्ये",
            iast: "trailokye",
            gloss: "in the three worlds (locative)"
          },
          {
            devanagari: "स्फुटवक्तारो",
            iast: "sphuṭavaktāro",
            gloss: "clear, eloquent speakers (nominative plural masculine)"
          }
        ]
      },
      {
        text: "देवाद्यसुरपन्नगाः",
        iast: "devādyasurapannagāḥ",
        words: [
          {
            devanagari: "देवाद्यसुरपन्नगाः",
            iast: "devādyasurapannagāḥ",
            gloss: "gods and others, asuras, and serpents (nominative plural, compound: deva + ādi + asura + pannagāḥ, in apposition to the speakers)"
          }
        ]
      },
      {
        text: "गुरुवक्त्रस्थिता विद्या",
        iast: "guruvaktrasthitā vidyā",
        words: [
          {
            devanagari: "गुरुवक्त्रस्थिता",
            iast: "guruvaktrasthitā",
            gloss: "situated on the Guru's lips (nominative feminine adjective, describes vidyā)"
          },
          {
            devanagari: "विद्या",
            iast: "vidyā",
            gloss: "the knowledge (nominative, subject)"
          }
        ]
      },
      {
        text: "गुरुभक्त्या तु लभ्यते",
        iast: "gurubhaktyā tu labhyate",
        words: [
          {
            devanagari: "गुरुभक्त्या",
            iast: "gurubhaktyā",
            gloss: "through devotion to the Guru (instrumental)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "but, indeed (particle)"
          },
          {
            devanagari: "लभ्यते",
            iast: "labhyate",
            gloss: "is obtained (passive verb, present)"
          }
        ]
      }
    ],
    meaning: "Throughout the three worlds, the gods, the asuras, and the serpents may all be eloquent speakers, yet the knowledge that lives on the Guru's own lips is attained only through devotion to the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). स्फुटवक्तारः reads grammatically as an affirmative description ('are clear speakers'), so this rendering keeps the devas/asuras/nāgas as eloquent yet still unable to convey the Guru-knowledge itself; the widely circulated published translation instead supplies an implied negation ('cannot instruct clearly') that the given Sanskrit does not explicitly contain."
  },
  {
    id: "guru-gita-23",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 23,
    speakerTag: null,
    padas: [
      {
        text: "गुकारस्त्वन्धकारश्च",
        iast: "gukārastvandhakāraśca",
        words: [
          {
            devanagari: "गुकारस्त्वन्धकारश्च",
            iast: "gukārastvandhakāraśca",
            gloss: "the syllable 'gu' is indeed darkness, and (nominative; gukāraḥ 'the syllable gu' + tu 'indeed' + andhakāraḥ 'darkness' + ca 'and', joined by sandhi)"
          }
        ]
      },
      {
        text: "रुकारस्तेज उच्यते",
        iast: "rukārasteja ucyate",
        words: [
          {
            devanagari: "रुकारस्तेज",
            iast: "rukārasteja",
            gloss: "the syllable 'ru' [is] light (nominative; rukāraḥ + tejaḥ, joined by sandhi)"
          },
          {
            devanagari: "उच्यते",
            iast: "ucyate",
            gloss: "is said, is called (passive verb, present)"
          }
        ]
      },
      {
        text: "अज्ञानग्रासकं ब्रह्म",
        iast: "ajñānagrāsakaṃ brahma",
        words: [
          {
            devanagari: "अज्ञानग्रासकं",
            iast: "ajñānagrāsakaṃ",
            gloss: "devourer of ignorance (nominative neuter compound adjective, agrees with brahma)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman, the Absolute (nominative neuter, in apposition to the Guru)"
          }
        ]
      },
      {
        text: "गुरुरेव न संशयः",
        iast: "gurureva na saṃśayaḥ",
        words: [
          {
            devanagari: "गुरुरेव",
            iast: "gurureva",
            gloss: "the Guru, indeed (nominative + eva 'indeed, verily')"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not (negation)"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative)"
          }
        ]
      }
    ],
    meaning: "The syllable 'gu' means darkness, and the syllable 'ru' means light; the Guru is verily that Brahman which devours ignorance — of this there is no doubt.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-24",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 24,
    speakerTag: null,
    padas: [
      {
        text: "गुकारः प्रथमो वर्णो",
        iast: "gukāraḥ prathamo varṇo",
        words: [
          {
            devanagari: "गुकारः",
            iast: "gukāraḥ",
            gloss: "the syllable 'gu' (nominative)"
          },
          {
            devanagari: "प्रथमो",
            iast: "prathamo",
            gloss: "first (nominative adjective)"
          },
          {
            devanagari: "वर्णो",
            iast: "varṇo",
            gloss: "syllable, letter (nominative)"
          }
        ]
      },
      {
        text: "मायादिगुणभासकः",
        iast: "māyādiguṇabhāsakaḥ",
        words: [
          {
            devanagari: "मायादिगुणभासकः",
            iast: "māyādiguṇabhāsakaḥ",
            gloss: "illuminator of the qualities beginning with māyā (nominative masculine compound adjective: māyā + ādi + guṇa + bhāsakaḥ)"
          }
        ]
      },
      {
        text: "रुकारो द्वितीयो ब्रह्म",
        iast: "rukāro dvitīyo brahma",
        words: [
          {
            devanagari: "रुकारो",
            iast: "rukāro",
            gloss: "the syllable 'ru' (nominative)"
          },
          {
            devanagari: "द्वितीयो",
            iast: "dvitīyo",
            gloss: "second (nominative adjective)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman (nominative neuter, in apposition)"
          }
        ]
      },
      {
        text: "माया भ्रान्ति विनाशनम्",
        iast: "māyā bhrānti vināśanam",
        words: [
          {
            devanagari: "माया",
            iast: "māyā",
            gloss: "māyā, illusion (first member of the descriptive compound)"
          },
          {
            devanagari: "भ्रान्ति",
            iast: "bhrānti",
            gloss: "delusion, confusion (second member of the compound)"
          },
          {
            devanagari: "विनाशनम्",
            iast: "vināśanam",
            gloss: "the destroyer of (nominative neuter, agrees with brahma)"
          }
        ]
      }
    ],
    meaning: "The first syllable, 'gu', illuminates the qualities that begin with māyā; the second syllable, 'ru', is Brahman itself, the destroyer of the delusion born of māyā.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-25",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 25,
    speakerTag: null,
    padas: [
      {
        text: "एवं गुरुपदं श्रेष्ठं",
        iast: "evaṃ gurupadaṃ śreṣṭhaṃ",
        words: [
          {
            devanagari: "एवं",
            iast: "evaṃ",
            gloss: "thus (adverb)"
          },
          {
            devanagari: "गुरुपदं",
            iast: "gurupadaṃ",
            gloss: "the state, the station of the Guru (nominative neuter, subject)"
          },
          {
            devanagari: "श्रेष्ठं",
            iast: "śreṣṭhaṃ",
            gloss: "most excellent, supreme (nominative neuter adjective)"
          }
        ]
      },
      {
        text: "देवानामपि दुर्लभम्",
        iast: "devānāmapi durlabham",
        words: [
          {
            devanagari: "देवानामपि",
            iast: "devānāmapi",
            gloss: "even for the gods (genitive plural devānām + api 'even')"
          },
          {
            devanagari: "दुर्लभम्",
            iast: "durlabham",
            gloss: "hard to attain (nominative neuter predicate adjective)"
          }
        ]
      },
      {
        text: "हाहा हूहू गणैश्चैव",
        iast: "hāhā hūhū gaṇaiścaiva",
        words: [
          {
            devanagari: "हाहा",
            iast: "hāhā",
            gloss: "Hāhā (proper name, nominative, a class of gandharva)"
          },
          {
            devanagari: "हूहू",
            iast: "hūhū",
            gloss: "Hūhū (proper name, nominative, a class of gandharva)"
          },
          {
            devanagari: "गणैश्चैव",
            iast: "gaṇaiścaiva",
            gloss: "and indeed by the hosts/troops (instrumental plural gaṇaiḥ + ca + eva)"
          }
        ]
      },
      {
        text: "गन्धर्वैश्च प्रपूज्यते",
        iast: "gandharvaiśca prapūjyate",
        words: [
          {
            devanagari: "गन्धर्वैश्च",
            iast: "gandharvaiśca",
            gloss: "and by the gandharvas (instrumental plural + ca)"
          },
          {
            devanagari: "प्रपूज्यते",
            iast: "prapūjyate",
            gloss: "is devotedly worshipped (passive verb, present)"
          }
        ]
      }
    ],
    meaning: "Thus the state of the Guru is supreme, difficult to attain even for the gods; it is devotedly worshipped by the hosts of Hāhā and Hūhū, and by the gandharvas.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). गुरुपदं is genuinely ambiguous: it can mean 'the Guru's feet' (the reading behind the widely circulated published translation's 'lotus feet of the Guru', fitting the devotional sense of प्रपूज्यते) or 'the word/rank \"Guru\"' (continuing the gu+ru etymology just given in vv.23-24, which एवं 'thus' logically points back to). This rendering follows the latter, position/status sense."
  },
  {
    id: "guru-gita-26",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 26,
    speakerTag: null,
    padas: [
      {
        text: "ध्रुवं तेषां च सर्वेषां",
        iast: "dhruvaṃ teṣāṃ ca sarveṣāṃ",
        words: [
          {
            devanagari: "ध्रुवं",
            iast: "dhruvaṃ",
            gloss: "certain, fixed (adverbial predicate, 'it is certain')"
          },
          {
            devanagari: "तेषां",
            iast: "teṣāṃ",
            gloss: "of/for them (genitive plural)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (conjunction)"
          },
          {
            devanagari: "सर्वेषां",
            iast: "sarveṣāṃ",
            gloss: "of/for all (genitive plural)"
          }
        ]
      },
      {
        text: "नास्ति तत्त्वं गुरोः परम्",
        iast: "nāsti tattvaṃ guroḥ param",
        words: [
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not (na + asti)"
          },
          {
            devanagari: "तत्त्वं",
            iast: "tattvaṃ",
            gloss: "a truth, a reality (nominative neuter, subject)"
          },
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "than the Guru (genitive/ablative of comparison)"
          },
          {
            devanagari: "परम्",
            iast: "param",
            gloss: "higher, beyond (nominative neuter adjective)"
          }
        ]
      },
      {
        text: "आसनं शयनं वस्त्रं",
        iast: "āsanaṃ śayanaṃ vastraṃ",
        words: [
          {
            devanagari: "आसनं",
            iast: "āsanaṃ",
            gloss: "a seat (nominative/accusative neuter)"
          },
          {
            devanagari: "शयनं",
            iast: "śayanaṃ",
            gloss: "a bed, a couch (nominative/accusative neuter)"
          },
          {
            devanagari: "वस्त्रं",
            iast: "vastraṃ",
            gloss: "clothing (nominative/accusative neuter)"
          }
        ]
      },
      {
        text: "भूषणं वाहनादिकम्",
        iast: "bhūṣaṇaṃ vāhanādikam",
        words: [
          {
            devanagari: "भूषणं",
            iast: "bhūṣaṇaṃ",
            gloss: "an ornament (nominative/accusative neuter)"
          },
          {
            devanagari: "वाहनादिकम्",
            iast: "vāhanādikam",
            gloss: "a vehicle and so forth (nominative/accusative neuter compound, vāhana + ādikam)"
          }
        ]
      }
    ],
    meaning: "It is a settled conviction for all of them that there is no truth higher than the Guru — to him one should offer a seat, a bed, clothing, ornaments, a vehicle, and the like...",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The list 'āsanaṃ śayanaṃ vastraṃ bhūṣaṇaṃ vāhanādikam' is grammatically the object of 'pradātavyam' ('is to be given') in the next verse, so this verse's second half is a sentence fragment completed only in verse 27; the closing ellipsis marks that continuation rather than a self-contained clause."
  },
  {
    id: "guru-gita-27",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 27,
    speakerTag: null,
    padas: [
      {
        text: "साधकेन प्रदातव्यं",
        iast: "sādhakena pradātavyaṃ",
        words: [
          {
            devanagari: "साधकेन",
            iast: "sādhakena",
            gloss: "by the practitioner, the seeker (instrumental)"
          },
          {
            devanagari: "प्रदातव्यं",
            iast: "pradātavyaṃ",
            gloss: "is to be given, should be offered (nominative neuter gerundive)"
          }
        ]
      },
      {
        text: "गुरुसंतोषकारकम्",
        iast: "gurusaṃtoṣakārakam",
        words: [
          {
            devanagari: "गुरुसंतोषकारकम्",
            iast: "gurusaṃtoṣakārakam",
            gloss: "that which brings satisfaction to the Guru (nominative neuter compound adjective: guru + santoṣa + kārakam)"
          }
        ]
      },
      {
        text: "गुरोराराधनं कार्यं",
        iast: "gurorārādhanaṃ kāryaṃ",
        words: [
          {
            devanagari: "गुरोराराधनं",
            iast: "gurorārādhanaṃ",
            gloss: "the worship, the propitiation of the Guru (nominative/accusative neuter, guroḥ + ārādhanam)"
          },
          {
            devanagari: "कार्यं",
            iast: "kāryaṃ",
            gloss: "is to be performed, is a duty (nominative neuter gerundive)"
          }
        ]
      },
      {
        text: "स्वजीवित्वं निवेदयेत्",
        iast: "svajīvitvaṃ nivedayet",
        words: [
          {
            devanagari: "स्वजीवित्वं",
            iast: "svajīvitvaṃ",
            gloss: "one's own life (accusative neuter)"
          },
          {
            devanagari: "निवेदयेत्",
            iast: "nivedayet",
            gloss: "one should offer up, dedicate (optative verb)"
          }
        ]
      }
    ],
    meaning: "Such things, pleasing to the Guru, should be offered by the practitioner; worship of the Guru must be performed, and one should dedicate one's very life to him.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The opening continues the offering-list begun in the previous verse (seat, bed, clothing, ornaments, vehicle); 'such things' is supplied here for readability since this verse alone does not restate the list."
  },
  {
    id: "guru-gita-28",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 28,
    speakerTag: null,
    padas: [
      {
        text: "कर्मणा मनसा वाचा",
        iast: "karmaṇā manasā vācā",
        words: [
          {
            devanagari: "कर्मणा",
            iast: "karmaṇā",
            gloss: "with action, with deed (instrumental)"
          },
          {
            devanagari: "मनसा",
            iast: "manasā",
            gloss: "with mind (instrumental)"
          },
          {
            devanagari: "वाचा",
            iast: "vācā",
            gloss: "with speech (instrumental)"
          }
        ]
      },
      {
        text: "नित्यमाराधयेद्गुरुम्",
        iast: "nityamārādhayedgurum",
        words: [
          {
            devanagari: "नित्यमाराधयेद्गुरुम्",
            iast: "nityamārādhayedgurum",
            gloss: "one should constantly worship the Guru (nityam 'always' + ārādhayet 'should worship, propitiate', optative + gurum 'the Guru', accusative object, joined by sandhi)"
          }
        ]
      },
      {
        text: "दीर्घदण्डं नमस्कृत्य",
        iast: "dīrghadaṇḍaṃ namaskṛtya",
        words: [
          {
            devanagari: "दीर्घदण्डं",
            iast: "dīrghadaṇḍaṃ",
            gloss: "like a long staff, i.e. full-length prostration (accusative, adverbial of manner)"
          },
          {
            devanagari: "नमस्कृत्य",
            iast: "namaskṛtya",
            gloss: "having bowed, having prostrated (gerund)"
          }
        ]
      },
      {
        text: "निर्लज्जो गुरुसन्निधौ",
        iast: "nirlajjo gurusannidhau",
        words: [
          {
            devanagari: "निर्लज्जो",
            iast: "nirlajjo",
            gloss: "without shame, unreservedly (nominative adjective describing the worshipper)"
          },
          {
            devanagari: "गुरुसन्निधौ",
            iast: "gurusannidhau",
            gloss: "in the Guru's presence (locative)"
          }
        ]
      }
    ],
    meaning: "With action, mind, and speech, one should worship the Guru at all times; prostrating full-length like a rod before him, without any reserve, right in his presence.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-29",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 29,
    speakerTag: null,
    padas: [
      {
        text: "शरीरमिन्द्रियं प्राणां",
        iast: "śarīramindriyaṃ prāṇāṃ",
        words: [
          {
            devanagari: "शरीरमिन्द्रियं",
            iast: "śarīramindriyaṃ",
            gloss: "the body and the senses (accusative neuter compound, śarīram + indriyam, joined by sandhi)"
          },
          {
            devanagari: "प्राणां",
            iast: "prāṇāṃ",
            gloss: "the vital breath, the life-force (accusative)"
          }
        ]
      },
      {
        text: "सद्गुरुभ्यो निवेदयेत्",
        iast: "sadgurubhyo nivedayet",
        words: [
          {
            devanagari: "सद्गुरुभ्यो",
            iast: "sadgurubhyo",
            gloss: "to the true Guru (dative plural, sat + gurubhyaḥ)"
          },
          {
            devanagari: "निवेदयेत्",
            iast: "nivedayet",
            gloss: "one should offer, dedicate (optative verb)"
          }
        ]
      },
      {
        text: "आत्मदारादिकं सर्वं",
        iast: "ātmadārādikaṃ sarvaṃ",
        words: [
          {
            devanagari: "आत्मदारादिकं",
            iast: "ātmadārādikaṃ",
            gloss: "the self, one's spouse, and so on (accusative neuter compound, ātma + dāra + ādikam)"
          },
          {
            devanagari: "सर्वं",
            iast: "sarvaṃ",
            gloss: "everything (accusative neuter)"
          }
        ]
      },
      {
        text: "सद्गुरुभ्यो निवेदयेत्",
        iast: "sadgurubhyo nivedayet",
        words: [
          {
            devanagari: "सद्गुरुभ्यो",
            iast: "sadgurubhyo",
            gloss: "to the true Guru (dative plural)"
          },
          {
            devanagari: "निवेदयेत्",
            iast: "nivedayet",
            gloss: "one should offer, dedicate (optative verb)"
          }
        ]
      }
    ],
    meaning: "One should offer up the body, the senses, and the life-breath to the true Guru; one should offer up everything to the true Guru — one's very self, one's spouse, and all else.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-30",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 30,
    speakerTag: null,
    padas: [
      {
        text: "कृमिकीटभस्मविष्ठा",
        iast: "kṛmikīṭabhasmaviṣṭhā",
        words: [
          {
            devanagari: "कृमिकीटभस्मविष्ठा",
            iast: "kṛmikīṭabhasmaviṣṭhā",
            gloss: "full of worms, insects, ashes, and excrement (nominative feminine compound adjective describing the body: kṛmi + kīṭa + bhasma + viṣṭhā)"
          }
        ]
      },
      {
        text: "दुर्गन्धिमलमूत्रकम्",
        iast: "durgandhimalamūtrakam",
        words: [
          {
            devanagari: "दुर्गन्धिमलमूत्रकम्",
            iast: "durgandhimalamūtrakam",
            gloss: "foul-smelling filth and urine (nominative/accusative neuter compound: durgandhi + mala + mūtrakam)"
          }
        ]
      },
      {
        text: "श्लेष्मरक्तं त्वचा मांसं",
        iast: "śleṣmaraktaṃ tvacā māṃsaṃ",
        words: [
          {
            devanagari: "श्लेष्मरक्तं",
            iast: "śleṣmaraktaṃ",
            gloss: "phlegm and blood (nominative/accusative neuter compound)"
          },
          {
            devanagari: "त्वचा",
            iast: "tvacā",
            gloss: "skin (nominative/instrumental)"
          },
          {
            devanagari: "मांसं",
            iast: "māṃsaṃ",
            gloss: "flesh (nominative/accusative neuter)"
          }
        ]
      },
      {
        text: "वञ्चयेन्न वरानने",
        iast: "vañcayenna varānane",
        words: [
          {
            devanagari: "वञ्चयेन्न",
            iast: "vañcayenna",
            gloss: "should not withhold, should not fail to offer (vañcayet 'should deprive, cheat' + na 'not', joined by sandhi)"
          },
          {
            devanagari: "वरानने",
            iast: "varānane",
            gloss: "O fair-faced one (vocative, addressing the Goddess)"
          }
        ]
      }
    ],
    meaning: "O fair-faced one, do not hold back from offering to the Guru this body — full of worms, insects, ashes, and excrement, foul-smelling filth and urine, phlegm, blood, skin, and flesh.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse continues the construction of verse 29 (...sadgurubhyo nivedayet, 'one should offer to the true Guru'); the Sanskrit of this verse alone does not restate 'Guru', so 'to the Guru' is supplied here for readability."
  },
  {
    id: "guru-gita-31",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 31,
    speakerTag: null,
    padas: [
      {
        text: "संसारवृक्षमारूढाः",
        iast: "saṃsāravṛkṣamārūḍhāḥ",
        words: [
          {
            devanagari: "संसारवृक्षमारूढाः",
            iast: "saṃsāravṛkṣamārūḍhāḥ",
            gloss: "those who have climbed the tree of worldly existence (nominative plural masculine compound: saṃsāra + vṛkṣam + ārūḍhāḥ)"
          }
        ]
      },
      {
        text: "पतन्तो नरकार्णवे",
        iast: "patanto narakārṇave",
        words: [
          {
            devanagari: "पतन्तो",
            iast: "patanto",
            gloss: "falling (nominative plural present participle)"
          },
          {
            devanagari: "नरकार्णवे",
            iast: "narakārṇave",
            gloss: "into the ocean of hell (locative)"
          }
        ]
      },
      {
        text: "येन चैवोद्धृताः सर्वे",
        iast: "yena caivoddhṛtāḥ sarve",
        words: [
          {
            devanagari: "येन",
            iast: "yena",
            gloss: "by whom (instrumental)"
          },
          {
            devanagari: "चैवोद्धृताः",
            iast: "caivoddhṛtāḥ",
            gloss: "and indeed are rescued, lifted up (ca + eva + uddhṛtāḥ, nominative plural past participle)"
          },
          {
            devanagari: "सर्वे",
            iast: "sarve",
            gloss: "all (nominative plural)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the revered Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage (indeclinable)"
          }
        ]
      }
    ],
    meaning: "Salutations to that revered Guru by whom all those who, having climbed the tree of worldly existence, are falling into the ocean of hell, are rescued and lifted up.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-32",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 32,
    speakerTag: null,
    padas: [
      {
        text: "गुरुर्ब्रह्मा",
        iast: "gururbrahmā",
        words: [
          {
            devanagari: "गुरुर्ब्रह्मा",
            iast: "gururbrahmā",
            gloss: "the Guru (is) Brahmā (nominative predicate; guru + brahmā, sandhi)"
          }
        ]
      },
      {
        text: "गुरुर्विष्णुर्गुरुर्देवो महेश्वरः",
        iast: "gururviṣṇurgururdevo maheśvaraḥ",
        words: [
          {
            devanagari: "गुरुर्विष्णुर्गुरुर्देवो",
            iast: "gururviṣṇurgururdevo",
            gloss: "the Guru (is) Viṣṇu, the Guru (is) the god (nominative predicates joined by sandhi; deva \"god\" is in apposition with maheśvara next)"
          },
          {
            devanagari: "महेश्वरः",
            iast: "maheśvaraḥ",
            gloss: "the Great Lord, i.e. Śiva (nominative predicate)"
          }
        ]
      },
      {
        text: "गुरुरेव परब्रह्म",
        iast: "gurureva parabrahma",
        words: [
          {
            devanagari: "गुरुरेव",
            iast: "gurureva",
            gloss: "the Guru alone/indeed (guru + eva, emphatic)"
          },
          {
            devanagari: "परब्रह्म",
            iast: "parabrahma",
            gloss: "the Supreme Absolute (nominative predicate)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "The Guru is Brahmā, the Guru is Viṣṇu, the Guru is the god Śiva; the Guru alone is the Supreme Absolute. Salutation to that venerable Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-33",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 33,
    speakerTag: null,
    padas: [
      {
        text: "हेतवे जगतामेव",
        iast: "hetave jagatāmeva",
        words: [
          {
            devanagari: "हेतवे",
            iast: "hetave",
            gloss: "to the cause (dative, in apposition with gurave)"
          },
          {
            devanagari: "जगतामेव",
            iast: "jagatāmeva",
            gloss: "of the worlds indeed (jagatām, genitive plural + eva, emphatic)"
          }
        ]
      },
      {
        text: "संसारार्णवसेतवे",
        iast: "saṃsārārṇavasetave",
        words: [
          {
            devanagari: "संसारार्णवसेतवे",
            iast: "saṃsārārṇavasetave",
            gloss: "to the bridge over the ocean of transmigration (dative; saṃsāra + arṇava \"ocean\" + setu \"bridge\")"
          }
        ]
      },
      {
        text: "प्रभवे सर्वविद्यानां",
        iast: "prabhave sarvavidyānāṃ",
        words: [
          {
            devanagari: "प्रभवे",
            iast: "prabhave",
            gloss: "to the source (dative)"
          },
          {
            devanagari: "सर्वविद्यानां",
            iast: "sarvavidyānāṃ",
            gloss: "of all forms of knowledge (genitive plural)"
          }
        ]
      },
      {
        text: "शम्भवे गुरवे नमः",
        iast: "śambhave gurave namaḥ",
        words: [
          {
            devanagari: "शम्भवे",
            iast: "śambhave",
            gloss: "to Śambhu, i.e. Śiva (dative, in apposition)"
          },
          {
            devanagari: "गुरवे",
            iast: "gurave",
            gloss: "to the Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to the Guru, who is Śambhu (Śiva) himself — the cause of the worlds, the bridge over the ocean of transmigration, and the source of all knowledge.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-34",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 34,
    speakerTag: null,
    padas: [
      {
        text: "अज्ञानतिमिरान्धस्य",
        iast: "ajñānatimirāndhasya",
        words: [
          {
            devanagari: "अज्ञानतिमिरान्धस्य",
            iast: "ajñānatimirāndhasya",
            gloss: "of one blinded by the darkness of ignorance (genitive; ajñāna + timira \"darkness\" + andha \"blind\")"
          }
        ]
      },
      {
        text: "ज्ञानाञ्जनशलाकया",
        iast: "jñānāñjanaśalākayā",
        words: [
          {
            devanagari: "ज्ञानाञ्जनशलाकया",
            iast: "jñānāñjanaśalākayā",
            gloss: "with the collyrium-stick of knowledge (instrumental; jñāna + añjana \"eye-salve\" + śalākā \"stick, probe\")"
          }
        ]
      },
      {
        text: "चक्षुरुन्मीलितं येन",
        iast: "cakṣurunmīlitaṃ yena",
        words: [
          {
            devanagari: "चक्षुरुन्मीलितं",
            iast: "cakṣurunmīlitaṃ",
            gloss: "the eye (that has been) opened (nominative neuter past participle; cakṣur + unmīlita, subject of the passive construction)"
          },
          {
            devanagari: "येन",
            iast: "yena",
            gloss: "by whom (instrumental relative pronoun)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru by whom the eye of one blinded by the darkness of ignorance is opened with the collyrium-stick of knowledge.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-35",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 35,
    speakerTag: null,
    padas: [
      {
        text: "त्वं पिता त्वं च मे माता",
        iast: "tvaṃ pitā tvaṃ ca me mātā",
        words: [
          {
            devanagari: "त्वं",
            iast: "tvaṃ",
            gloss: "you (nominative)"
          },
          {
            devanagari: "पिता",
            iast: "pitā",
            gloss: "father (nominative predicate)"
          },
          {
            devanagari: "त्वं",
            iast: "tvaṃ",
            gloss: "you (nominative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "मे",
            iast: "me",
            gloss: "my (genitive)"
          },
          {
            devanagari: "माता",
            iast: "mātā",
            gloss: "mother (nominative predicate)"
          }
        ]
      },
      {
        text: "त्वं बन्धुस्त्वं च देवता",
        iast: "tvaṃ bandhustvaṃ ca devatā",
        words: [
          {
            devanagari: "त्वं",
            iast: "tvaṃ",
            gloss: "you (nominative)"
          },
          {
            devanagari: "बन्धुस्त्वं",
            iast: "bandhustvaṃ",
            gloss: "(you are the) kinsman, and you (bandhur + tvaṃ, sandhi)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "देवता",
            iast: "devatā",
            gloss: "deity, God (nominative predicate)"
          }
        ]
      },
      {
        text: "संसारप्रतिबोधार्थं",
        iast: "saṃsārapratibodhārthaṃ",
        words: [
          {
            devanagari: "संसारप्रतिबोधार्थं",
            iast: "saṃsārapratibodhārthaṃ",
            gloss: "for the sake of awakening from transmigratory existence (accusative used adverbially; saṃsāra + prati-bodha \"awakening\" + artha \"purpose\")"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "You are my father, and you are my mother; you are my kinsman, and you are my deity. Salutation to that venerable Guru, for the sake of awakening from this transmigratory existence.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-36",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 36,
    speakerTag: null,
    padas: [
      {
        text: "यत्सत्येन जगत्सत्यं",
        iast: "yatsatyena jagatsatyaṃ",
        words: [
          {
            devanagari: "यत्सत्येन",
            iast: "yatsatyena",
            gloss: "by whose truth/reality (instrumental relative; yat + satyena)"
          },
          {
            devanagari: "जगत्सत्यं",
            iast: "jagatsatyaṃ",
            gloss: "the world (is) real (nominative; jagat + satyam)"
          }
        ]
      },
      {
        text: "यत्प्रकाशेन भाति तत्",
        iast: "yatprakāśena bhāti tat",
        words: [
          {
            devanagari: "यत्प्रकाशेन",
            iast: "yatprakāśena",
            gloss: "by whose light/illumination (instrumental relative)"
          },
          {
            devanagari: "भाति",
            iast: "bhāti",
            gloss: "shines, appears (present verb)"
          },
          {
            devanagari: "तत्",
            iast: "tat",
            gloss: "that, i.e. the world (nominative)"
          }
        ]
      },
      {
        text: "यदानन्देन नन्दन्ति",
        iast: "yadānandena nandanti",
        words: [
          {
            devanagari: "यदानन्देन",
            iast: "yadānandena",
            gloss: "by whose bliss (instrumental relative; yat + ānandena)"
          },
          {
            devanagari: "नन्दन्ति",
            iast: "nandanti",
            gloss: "(beings) rejoice, delight (present verb, plural)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru by whose reality the world is real, by whose light it shines forth, and by whose bliss all beings rejoice.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-37",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 37,
    speakerTag: null,
    padas: [
      {
        text: "यस्य स्थित्या सत्यमिदं",
        iast: "yasya sthityā satyamidaṃ",
        words: [
          {
            devanagari: "यस्य",
            iast: "yasya",
            gloss: "of whom, whose (genitive relative)"
          },
          {
            devanagari: "स्थित्या",
            iast: "sthityā",
            gloss: "by the existence/steadiness (instrumental)"
          },
          {
            devanagari: "सत्यमिदं",
            iast: "satyamidaṃ",
            gloss: "this (is) real (nominative; satyam + idam)"
          }
        ]
      },
      {
        text: "यद्भाति भानुरूपतः",
        iast: "yadbhāti bhānurūpataḥ",
        words: [
          {
            devanagari: "यद्भाति",
            iast: "yadbhāti",
            gloss: "which shines (yat + bhāti, present verb)"
          },
          {
            devanagari: "भानुरूपतः",
            iast: "bhānurūpataḥ",
            gloss: "in the form of the sun (ablative used adverbially; bhānu + rūpa + taḥ)"
          }
        ]
      },
      {
        text: "प्रियं पुत्रदि यत्प्रीत्या",
        iast: "priyaṃ putradi yatprītyā",
        words: [
          {
            devanagari: "प्रियं",
            iast: "priyaṃ",
            gloss: "dear, beloved (nominative predicate)"
          },
          {
            devanagari: "पुत्रदि",
            iast: "putradi",
            gloss: "sons and so forth (nominative; putra-ādi)"
          },
          {
            devanagari: "यत्प्रीत्या",
            iast: "yatprītyā",
            gloss: "by whose love/affection (instrumental relative)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru by whose steadiness this world is real, who shines in the form of the sun, and by whose love even sons and the like become dear.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The reference translation renders bhānurūpataḥ as \"he is the sun whose light illuminates it,\" treating the ablative as describing the Guru's own form; it can equally be read as describing how the world shines forth, i.e. \"in the manner/form of the sun\" — both readings preserve the same overall sense."
  },
  {
    id: "guru-gita-38",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 38,
    speakerTag: null,
    padas: [
      {
        text: "येन चेतयते हीदं",
        iast: "yena cetayate hīdaṃ",
        words: [
          {
            devanagari: "येन",
            iast: "yena",
            gloss: "by whom (instrumental relative)"
          },
          {
            devanagari: "चेतयते",
            iast: "cetayate",
            gloss: "is made conscious, is perceived (passive/causative present verb)"
          },
          {
            devanagari: "हीदं",
            iast: "hīdaṃ",
            gloss: "indeed this (hi + idam, emphatic)"
          }
        ]
      },
      {
        text: "चित्तं चेतयते न यम्",
        iast: "cittaṃ cetayate na yam",
        words: [
          {
            devanagari: "चित्तं",
            iast: "cittaṃ",
            gloss: "the mind (nominative)"
          },
          {
            devanagari: "चेतयते",
            iast: "cetayate",
            gloss: "perceives, is conscious of (present verb)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "यम्",
            iast: "yam",
            gloss: "whom (accusative relative, i.e. the Guru)"
          }
        ]
      },
      {
        text: "जाग्रत्स्वप्नसुषुप्त्यादि",
        iast: "jāgratsvapnasuṣuptyādi",
        words: [
          {
            devanagari: "जाग्रत्स्वप्नसुषुप्त्यादि",
            iast: "jāgratsvapnasuṣuptyādi",
            gloss: "waking, dream, deep sleep, and so on (nominative; jāgrat + svapna + suṣupti + ādi)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru by whom this world is indeed made conscious, but whom the mind cannot perceive — who is the witness of waking, dream, deep sleep, and the like.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-39",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 39,
    speakerTag: null,
    padas: [
      {
        text: "यस्य ज्ञानादिदं विश्वं",
        iast: "yasya jñānādidaṃ viśvaṃ",
        words: [
          {
            devanagari: "यस्य",
            iast: "yasya",
            gloss: "of whom, whose (genitive relative)"
          },
          {
            devanagari: "ज्ञानादिदं",
            iast: "jñānādidaṃ",
            gloss: "from the knowledge, this (ablative; jñānāt + idam)"
          },
          {
            devanagari: "विश्वं",
            iast: "viśvaṃ",
            gloss: "the universe (nominative)"
          }
        ]
      },
      {
        text: "न दृश्यं भिन्नभेदतः",
        iast: "na dṛśyaṃ bhinnabhedataḥ",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "दृश्यं",
            iast: "dṛśyaṃ",
            gloss: "(is) to be seen, visible (nominative gerundive predicate)"
          },
          {
            devanagari: "भिन्नभेदतः",
            iast: "bhinnabhedataḥ",
            gloss: "as a separate, differentiated thing (ablative used adverbially; bhinna + bheda + taḥ)"
          }
        ]
      },
      {
        text: "सदेकरूपरूपाय",
        iast: "sadekarūparūpāya",
        words: [
          {
            devanagari: "सदेकरूपरूपाय",
            iast: "sadekarūparūpāya",
            gloss: "to the one whose form is the single form of Being (dative; sat + eka-rūpa + rūpāya)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru, whose very form is the single form of Being, and by whose knowledge this universe is no longer seen as something separate and differentiated.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-40",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 40,
    speakerTag: null,
    padas: [
      {
        text: "यस्यामतं तस्य मतं",
        iast: "yasyāmataṃ tasya mataṃ",
        words: [
          {
            devanagari: "यस्यामतं",
            iast: "yasyāmataṃ",
            gloss: "of whom (it is) not considered known (yasya, genitive relative + amataṃ, nominative predicate)"
          },
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "of him, his (genitive)"
          },
          {
            devanagari: "मतं",
            iast: "mataṃ",
            gloss: "(is the true) opinion/understanding (nominative predicate)"
          }
        ]
      },
      {
        text: "मतं यस्य न वेद सः",
        iast: "mataṃ yasya na veda saḥ",
        words: [
          {
            devanagari: "मतं",
            iast: "mataṃ",
            gloss: "opinion, thought of knowing (nominative)"
          },
          {
            devanagari: "यस्य",
            iast: "yasya",
            gloss: "of whom (genitive)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "वेद",
            iast: "veda",
            gloss: "knows (perfect verb, used as present)"
          },
          {
            devanagari: "सः",
            iast: "saḥ",
            gloss: "he (nominative)"
          }
        ]
      },
      {
        text: "अनन्यभाव भावाय",
        iast: "ananyabhāva bhāvāya",
        words: [
          {
            devanagari: "अनन्यभाव",
            iast: "ananyabhāva",
            gloss: "of undivided/non-dual state (compound stem, qualifying bhāvāya)"
          },
          {
            devanagari: "भावाय",
            iast: "bhāvāya",
            gloss: "to the (one whose) nature/state (dative)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru, whose nature is undivided oneness — he to whom it is not a matter of claiming to know truly understands, while he who claims to know him does not really know him.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse's syntax (yasya amataṃ tasya mataṃ, mataṃ yasya na veda saḥ) is a well-known paradox construction; translators render the double negatives with some variance, though the overall sense — that claiming to know the Guru betrays not knowing him — is consistent."
  },
  {
    id: "guru-gita-41",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 41,
    speakerTag: null,
    padas: [
      {
        text: "यस्य कारणरूपस्य",
        iast: "yasya kāraṇarūpasya",
        words: [
          {
            devanagari: "यस्य",
            iast: "yasya",
            gloss: "of whom, whose (genitive relative)"
          },
          {
            devanagari: "कारणरूपस्य",
            iast: "kāraṇarūpasya",
            gloss: "whose form is the cause (genitive; kāraṇa + rūpasya)"
          }
        ]
      },
      {
        text: "कार्यरूपेण भाति यत्",
        iast: "kāryarūpeṇa bhāti yat",
        words: [
          {
            devanagari: "कार्यरूपेण",
            iast: "kāryarūpeṇa",
            gloss: "in the form of the effect (instrumental; kārya + rūpeṇa)"
          },
          {
            devanagari: "भाति",
            iast: "bhāti",
            gloss: "appears, shines (present verb)"
          },
          {
            devanagari: "यत्",
            iast: "yat",
            gloss: "which, that which (nominative relative, i.e. the world)"
          }
        ]
      },
      {
        text: "कार्यकारणरूपाय",
        iast: "kāryakāraṇarūpāya",
        words: [
          {
            devanagari: "कार्यकारणरूपाय",
            iast: "kāryakāraṇarūpāya",
            gloss: "to the one whose form is (both) cause and effect (dative; kārya + kāraṇa + rūpāya)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation (nominative, exclamatory)"
          }
        ]
      }
    ],
    meaning: "Salutation to that venerable Guru who, being the cause, appears in the form of the effect — to him whose form is both cause and effect.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-42",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 42,
    speakerTag: null,
    padas: [
      {
        text: "नानारूपमिदं सर्वं",
        iast: "nānārūpamidaṃ sarvaṃ",
        words: [
          {
            devanagari: "नानारूपमिदं",
            iast: "nānārūpamidaṃ",
            gloss: "this, in its manifold/various forms (nominative neuter, nānā-rūpam idam, describing sarvam)"
          },
          {
            devanagari: "सर्वं",
            iast: "sarvaṃ",
            gloss: "all, everything (nominative, subject)"
          }
        ]
      },
      {
        text: "न केनाप्यस्ति भिन्नता",
        iast: "na kenāpyasti bhinnatā",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "केनाप्यस्ति",
            iast: "kenāpyasti",
            gloss: "is by anything (sandhi of kenāpi 'by any means' [instrumental] + asti 'is')"
          },
          {
            devanagari: "भिन्नता",
            iast: "bhinnatā",
            gloss: "difference, distinctness (nominative, subject of asti)"
          }
        ]
      },
      {
        text: "कार्यकारणता चैव",
        iast: "kāryakāraṇatā caiva",
        words: [
          {
            devanagari: "कार्यकारणता",
            iast: "kāryakāraṇatā",
            gloss: "the relation of cause and effect (nominative abstract noun, kārya-kāraṇatā)"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed (ca + eva)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, obeisance"
          }
        ]
      }
    ],
    meaning: "All this, though it appears in countless forms, is nowhere actually differentiated by anything at all — and the same holds for the relation of cause and effect. Salutations to that venerable Guru who reveals this.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-43",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 43,
    speakerTag: null,
    padas: [
      {
        text: "यदङ्घ्रिकमलद्वन्द्वं",
        iast: "yadaṅghrikamaladvandvaṃ",
        words: [
          {
            devanagari: "यदङ्घ्रिकमलद्वन्द्वं",
            iast: "yadaṅghrikamaladvandvaṃ",
            gloss: "whose pair of lotus feet (relative compound, accusative — yad + aṅghri-kamala-dvandvam)"
          }
        ]
      },
      {
        text: "द्वन्द्वतापनिवारकम्",
        iast: "dvandvatāpanivārakam",
        words: [
          {
            devanagari: "द्वन्द्वतापनिवारकम्",
            iast: "dvandvatāpanivārakam",
            gloss: "which removes the torment of dualities (accusative adjective modifying dvandvam, dvandva-tāpa-nivārakam)"
          }
        ]
      },
      {
        text: "तारकं सर्वदाऽपद्भ्यः",
        iast: "tārakaṃ sarvadā'padbhyaḥ",
        words: [
          {
            devanagari: "तारकं",
            iast: "tārakaṃ",
            gloss: "one who ferries/saves across (accusative adjective modifying gurum)"
          },
          {
            devanagari: "सर्वदाऽपद्भ्यः",
            iast: "sarvadā'padbhyaḥ",
            gloss: "always, from misfortunes (sandhi of sarvadā 'always' + āpadbhyaḥ 'from calamities', ablative plural)"
          }
        ]
      },
      {
        text: "श्रीगुरुं प्रणमाम्यहम्",
        iast: "śrīguruṃ praṇamāmyaham",
        words: [
          {
            devanagari: "श्रीगुरुं",
            iast: "śrīguruṃ",
            gloss: "the venerable Guru (accusative, object)"
          },
          {
            devanagari: "प्रणमाम्यहम्",
            iast: "praṇamāmyaham",
            gloss: "I bow down (sandhi of praṇamāmi 'I salute' + aham 'I')"
          }
        ]
      }
    ],
    meaning: "I bow to the venerable Guru whose pair of lotus feet removes the torment of all dualities, and who always saves his devotees from misfortunes.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-44",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 44,
    speakerTag: null,
    padas: [
      {
        text: "शिवे क्रुद्धे गुरुस्त्राता",
        iast: "śive kruddhe gurustrātā",
        words: [
          {
            devanagari: "शिवे",
            iast: "śive",
            gloss: "when Śiva (locative, circumstantial)"
          },
          {
            devanagari: "क्रुद्धे",
            iast: "kruddhe",
            gloss: "is angered (locative past participle, agreeing with śive)"
          },
          {
            devanagari: "गुरुस्त्राता",
            iast: "gurustrātā",
            gloss: "the Guru is the protector (sandhi of guruḥ 'the Guru' [nominative subject] + trātā 'protector' [nominative predicate]; two separate words joined by visarga sandhi, not a compound)"
          }
        ]
      },
      {
        text: "गुरौ क्रुद्धे शिवो न हि",
        iast: "gurau kruddhe śivo na hi",
        words: [
          {
            devanagari: "गुरौ",
            iast: "gurau",
            gloss: "when the Guru (locative)"
          },
          {
            devanagari: "क्रुद्धे",
            iast: "kruddhe",
            gloss: "is angered (locative past participle)"
          },
          {
            devanagari: "शिवो",
            iast: "śivo",
            gloss: "Śiva (nominative, subject)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "हि",
            iast: "hi",
            gloss: "indeed, certainly (emphatic particle)"
          }
        ]
      },
      {
        text: "तस्मात् सर्वप्रयत्नेन",
        iast: "tasmāt sarvaprayatnena",
        words: [
          {
            devanagari: "तस्मात्",
            iast: "tasmāt",
            gloss: "therefore (ablative, 'from that')"
          },
          {
            devanagari: "सर्वप्रयत्नेन",
            iast: "sarvaprayatnena",
            gloss: "with every effort (instrumental, sarva-prayatna)"
          }
        ]
      },
      {
        text: "श्रीगुरुं शरणं व्रजेत्",
        iast: "śrīguruṃ śaraṇaṃ vrajet",
        words: [
          {
            devanagari: "श्रीगुरुं",
            iast: "śrīguruṃ",
            gloss: "to the venerable Guru (accusative, goal)"
          },
          {
            devanagari: "शरणं",
            iast: "śaraṇaṃ",
            gloss: "refuge (accusative, object of vrajet)"
          },
          {
            devanagari: "व्रजेत्",
            iast: "vrajet",
            gloss: "one should go (optative verb, 3rd singular)"
          }
        ]
      }
    ],
    meaning: "If Śiva becomes angry, the Guru can protect you; but if the Guru becomes angry, Śiva indeed cannot. Therefore one should go for refuge to the venerable Guru with all one's effort.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-45",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 45,
    speakerTag: null,
    padas: [
      {
        text: "वन्दे गुरुपदद्वन्द्वं",
        iast: "vande gurupadadvandvaṃ",
        words: [
          {
            devanagari: "वन्दे",
            iast: "vande",
            gloss: "I salute, I venerate (present verb, 1st person)"
          },
          {
            devanagari: "गुरुपदद्वन्द्वं",
            iast: "gurupadadvandvaṃ",
            gloss: "the pair of the Guru's feet (accusative compound, guru-pada-dvandva)"
          }
        ]
      },
      {
        text: "वाङ्मनश्चित्तगोचरम्",
        iast: "vāṅmanaścittagocaram",
        words: [
          {
            devanagari: "वाङ्मनश्चित्तगोचरम्",
            iast: "vāṅmanaścittagocaram",
            gloss: "the object reached by speech, mind, and thought (accusative compound, vāk-manaḥ-citta-gocaram, sandhi-joined)"
          }
        ]
      },
      {
        text: "श्वेतरक्तप्रभाभिन्नं",
        iast: "śvetaraktaprabhābhinnaṃ",
        words: [
          {
            devanagari: "श्वेतरक्तप्रभाभिन्नं",
            iast: "śvetaraktaprabhābhinnaṃ",
            gloss: "marked/distinguished by white and red radiance (accusative adjective, śveta-rakta-prabhā-bhinnam)"
          }
        ]
      },
      {
        text: "शिवशक्त्यात्मकं परम्",
        iast: "śivaśaktyātmakaṃ param",
        words: [
          {
            devanagari: "शिवशक्त्यात्मकं",
            iast: "śivaśaktyātmakaṃ",
            gloss: "having the nature of Śiva and Śakti (accusative adjective, śiva-śakti-ātmaka)"
          },
          {
            devanagari: "परम्",
            iast: "param",
            gloss: "supreme (accusative adjective)"
          }
        ]
      }
    ],
    meaning: "I salute the pair of the Guru's feet, the goal toward which speech, mind, and thought reach, marked by a radiance of white and red, supreme, embodying the very nature of Śiva and Śakti.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The compound वाङ्मनश्चित्तगोचरम् literally means 'the object attained by speech, mind, and thought' (gocara, 'within range of'), with no negating prefix; some circulated English versions render it as 'beyond the grasp of' speech, mind and senses, which reverses the literal sense rather than translating it."
  },
  {
    id: "guru-gita-46",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 46,
    speakerTag: null,
    padas: [
      {
        text: "गुकारं च गुणातीतं",
        iast: "gukāraṃ ca guṇātītaṃ",
        words: [
          {
            devanagari: "गुकारं",
            iast: "gukāraṃ",
            gloss: "the syllable 'gu' (accusative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "गुणातीतं",
            iast: "guṇātītaṃ",
            gloss: "transcending the guṇas/qualities (accusative adjective, guṇa-atīta)"
          }
        ]
      },
      {
        text: "रुकारं रूपवर्जितम्",
        iast: "rukāraṃ rūpavarjitam",
        words: [
          {
            devanagari: "रुकारं",
            iast: "rukāraṃ",
            gloss: "the syllable 'ru' (accusative)"
          },
          {
            devanagari: "रूपवर्जितम्",
            iast: "rūpavarjitam",
            gloss: "devoid of form (accusative adjective, rūpa-varjita)"
          }
        ]
      },
      {
        text: "गुणातीतस्वरूपं च",
        iast: "guṇātītasvarūpaṃ ca",
        words: [
          {
            devanagari: "गुणातीतस्वरूपं",
            iast: "guṇātītasvarūpaṃ",
            gloss: "the true nature that transcends the guṇas (accusative, guṇātīta-svarūpa, object bestowed)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "यो दद्यात्स गुरुः स्मृतः",
        iast: "yo dadyātsa guruḥ smṛtaḥ",
        words: [
          {
            devanagari: "यो",
            iast: "yo",
            gloss: "who (nominative relative pronoun, yaḥ)"
          },
          {
            devanagari: "दद्यात्स",
            iast: "dadyātsa",
            gloss: "would grant — he (sandhi of dadyāt 'would give' [optative] + sa 'he')"
          },
          {
            devanagari: "गुरुः",
            iast: "guruḥ",
            gloss: "Guru (nominative predicate)"
          },
          {
            devanagari: "स्मृतः",
            iast: "smṛtaḥ",
            gloss: "is remembered, is known as (past passive participle, nominative)"
          }
        ]
      }
    ],
    meaning: "The syllable 'gu' denotes that which transcends the guṇas, and 'ru' denotes that which is free of form. One who bestows [realization of] that formless, guṇa-transcending true nature is known as the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-47",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 47,
    speakerTag: null,
    padas: [
      {
        text: "अत्रिनेत्रः सर्वसाक्षी",
        iast: "atrinetraḥ sarvasākṣī",
        words: [
          {
            devanagari: "अत्रिनेत्रः",
            iast: "atrinetraḥ",
            gloss: "without three eyes (nominative, a-tri-netra, 'not three-eyed')"
          },
          {
            devanagari: "सर्वसाक्षी",
            iast: "sarvasākṣī",
            gloss: "the witness of all (nominative, sarva-sākṣī)"
          }
        ]
      },
      {
        text: "अचतुर्बाहुरच्युतः",
        iast: "acaturbāhuracyutaḥ",
        words: [
          {
            devanagari: "अचतुर्बाहुरच्युतः",
            iast: "acaturbāhuracyutaḥ",
            gloss: "without four arms, yet the Unfallen One (nominative compound, sandhi of a-catur-bāhuḥ + acyutaḥ, an epithet of Viṣṇu)"
          }
        ]
      },
      {
        text: "अचतुर्वदनो ब्रह्मा",
        iast: "acaturvadano brahmā",
        words: [
          {
            devanagari: "अचतुर्वदनो",
            iast: "acaturvadano",
            gloss: "without four faces (nominative, a-catur-vadana)"
          },
          {
            devanagari: "ब्रह्मा",
            iast: "brahmā",
            gloss: "yet is Brahmā (nominative)"
          }
        ]
      },
      {
        text: "श्रीगुरुः कथितः प्रिये",
        iast: "śrīguruḥ kathitaḥ priye",
        words: [
          {
            devanagari: "श्रीगुरुः",
            iast: "śrīguruḥ",
            gloss: "the venerable Guru (nominative, subject)"
          },
          {
            devanagari: "कथितः",
            iast: "kathitaḥ",
            gloss: "is declared, is said to be (past passive participle)"
          },
          {
            devanagari: "प्रिये",
            iast: "priye",
            gloss: "O beloved one (vocative, addressing the Goddess)"
          }
        ]
      }
    ],
    meaning: "O beloved, the venerable Guru is declared to be the all-witnessing one though without three eyes, the imperishable one though without four arms, and Brahmā though without four faces.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-48",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 48,
    speakerTag: null,
    padas: [
      {
        text: "अयं मयाञ्जलिर्बद्धो",
        iast: "ayaṃ mayāñjalirbaddho",
        words: [
          {
            devanagari: "अयं",
            iast: "ayaṃ",
            gloss: "this (nominative, referring to añjali)"
          },
          {
            devanagari: "मयाञ्जलिर्बद्धो",
            iast: "mayāñjalirbaddho",
            gloss: "by me this añjali (folded-hands gesture) is formed (sandhi of mayā 'by me' + añjaliḥ 'folded hands' + baddhaḥ 'bound, formed')"
          }
        ]
      },
      {
        text: "दया सागरवृद्धये",
        iast: "dayā sāgaravṛddhaye",
        words: [
          {
            devanagari: "दया",
            iast: "dayā",
            gloss: "compassion, mercy (in construct with sāgara, 'ocean of compassion')"
          },
          {
            devanagari: "सागरवृद्धये",
            iast: "sāgaravṛddhaye",
            gloss: "for the increase/swelling of the ocean (dative, sāgara-vṛddhi, purpose clause)"
          }
        ]
      },
      {
        text: "यदनुग्रहतो",
        iast: "yadanugrahato",
        words: [
          {
            devanagari: "यदनुग्रहतो",
            iast: "yadanugrahato",
            gloss: "by whose grace (sandhi of yat 'by which' + anugrahataḥ 'from grace', ablative)"
          }
        ]
      },
      {
        text: "जन्तुश्चित्रसंसारमुक्तिभाक्",
        iast: "jantuścitrasaṃsāramuktibhāk",
        words: [
          {
            devanagari: "जन्तुश्चित्रसंसारमुक्तिभाक्",
            iast: "jantuścitrasaṃsāramuktibhāk",
            gloss: "the creature becomes a partaker of liberation from the wondrous round of existence (sandhi-joined: jantuḥ 'creature/being' [nominative] + citra-saṃsāra-mukti-bhāk 'partaking of freedom from the manifold worldly cycle')"
          }
        ]
      }
    ],
    meaning: "With folded hands I make this añjali for the swelling of your ocean of compassion, by whose grace the creature attains liberation from this wondrous round of transmigration.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). जन्तुः and चित्रसंसारमुक्तिभाक् are two separate grammatical words joined by sandhi with no space in the printed source (visarga + c → ś), so — since a pāda's word list must reconstruct its source text exactly — they are kept as one word entry rather than split apart."
  },
  {
    id: "guru-gita-49",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 49,
    speakerTag: null,
    padas: [
      {
        text: "श्रीगुरोः परमं रूपं",
        iast: "śrīguroḥ paramaṃ rūpaṃ",
        words: [
          {
            devanagari: "श्रीगुरोः",
            iast: "śrīguroḥ",
            gloss: "of the venerable Guru (genitive)"
          },
          {
            devanagari: "परमं",
            iast: "paramaṃ",
            gloss: "supreme (adjective)"
          },
          {
            devanagari: "रूपं",
            iast: "rūpaṃ",
            gloss: "form (nominative, subject)"
          }
        ]
      },
      {
        text: "विवेकचक्षुषोऽमृतम्",
        iast: "vivekacakṣuṣo'mṛtam",
        words: [
          {
            devanagari: "विवेकचक्षुषोऽमृतम्",
            iast: "vivekacakṣuṣo'mṛtam",
            gloss: "is nectar to the eye of discrimination (sandhi of viveka-cakṣuṣaḥ 'of the eye of discernment' [genitive, functioning idiomatically as 'to the eye'] + amṛtam 'nectar' [nominative predicate])"
          }
        ]
      },
      {
        text: "मन्दभाग्या न पश्यन्ति",
        iast: "mandabhāgyā na paśyanti",
        words: [
          {
            devanagari: "मन्दभाग्या",
            iast: "mandabhāgyā",
            gloss: "those of poor fortune (nominative plural, manda-bhāgyāḥ, 'ill-fated ones')"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "पश्यन्ति",
            iast: "paśyanti",
            gloss: "they see (present verb, 3rd plural)"
          }
        ]
      },
      {
        text: "अन्धाः सूर्योदयं यथा",
        iast: "andhāḥ sūryodayaṃ yathā",
        words: [
          {
            devanagari: "अन्धाः",
            iast: "andhāḥ",
            gloss: "blind people (nominative plural)"
          },
          {
            devanagari: "सूर्योदयं",
            iast: "sūryodayaṃ",
            gloss: "the sunrise (accusative)"
          },
          {
            devanagari: "यथा",
            iast: "yathā",
            gloss: "just as, like"
          }
        ]
      }
    ],
    meaning: "The supreme form of the venerable Guru is nectar to the eye of discrimination; but the unfortunate do not perceive it, just as the blind cannot see the sunrise.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-50",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 50,
    speakerTag: null,
    padas: [
      {
        text: "श्रीनाथचरणद्वन्द्वं",
        iast: "śrīnāthacaraṇadvandvaṃ",
        words: [
          {
            devanagari: "श्रीनाथचरणद्वन्द्वं",
            iast: "śrīnāthacaraṇadvandvaṃ",
            gloss: "the pair of feet of the venerable Lord (nominative compound, śrī-nātha-caraṇa-dvandva)"
          }
        ]
      },
      {
        text: "यस्यां दिशि विराजते",
        iast: "yasyāṃ diśi virājate",
        words: [
          {
            devanagari: "यस्यां",
            iast: "yasyāṃ",
            gloss: "in which (locative relative pronoun, feminine)"
          },
          {
            devanagari: "दिशि",
            iast: "diśi",
            gloss: "direction (locative)"
          },
          {
            devanagari: "विराजते",
            iast: "virājate",
            gloss: "shines forth, resides (present verb, 3rd singular)"
          }
        ]
      },
      {
        text: "तस्यै दिशे नमस्कुर्याद्",
        iast: "tasyai diśe namaskuryād",
        words: [
          {
            devanagari: "तस्यै",
            iast: "tasyai",
            gloss: "to that (dative, feminine demonstrative)"
          },
          {
            devanagari: "दिशे",
            iast: "diśe",
            gloss: "direction (dative)"
          },
          {
            devanagari: "नमस्कुर्याद्",
            iast: "namaskuryād",
            gloss: "one should bow, pay homage (optative verb, 3rd singular)"
          }
        ]
      },
      {
        text: "भक्त्या प्रतिदिनं प्रिये",
        iast: "bhaktyā pratidinaṃ priye",
        words: [
          {
            devanagari: "भक्त्या",
            iast: "bhaktyā",
            gloss: "with devotion (instrumental)"
          },
          {
            devanagari: "प्रतिदिनं",
            iast: "pratidinaṃ",
            gloss: "every day, daily (adverbial accusative)"
          },
          {
            devanagari: "प्रिये",
            iast: "priye",
            gloss: "O beloved one (vocative)"
          }
        ]
      }
    ],
    meaning: "O beloved, in whatever direction the pair of feet of the venerable Lord resides, one should bow toward that direction with devotion every day.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-51",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 51,
    speakerTag: null,
    padas: [
      {
        text: "तस्यै दिशे सततमञ्जलिरेष आर्ये",
        iast: "tasyai diśe satatamañjalireṣa ārye",
        words: [
          {
            devanagari: "तस्यै",
            iast: "tasyai",
            gloss: "to that (dative, feminine demonstrative)"
          },
          {
            devanagari: "दिशे",
            iast: "diśe",
            gloss: "direction (dative)"
          },
          {
            devanagari: "सततमञ्जलिरेष",
            iast: "satatamañjalireṣa",
            gloss: "this continual añjali (sandhi of satatam 'continually' + añjaliḥ 'folded-hands gesture' [nominative] + eṣaḥ 'this')"
          },
          {
            devanagari: "आर्ये",
            iast: "ārye",
            gloss: "O noble/venerable lady (vocative, addressing the Goddess)"
          }
        ]
      },
      {
        text: "प्रक्षिप्यते मुखरितो मधुपैर्बुधैश्च",
        iast: "prakṣipyate mukharito madhupairbudhaiśca",
        words: [
          {
            devanagari: "प्रक्षिप्यते",
            iast: "prakṣipyate",
            gloss: "is cast, is offered (passive present verb, 3rd singular)"
          },
          {
            devanagari: "मुखरितो",
            iast: "mukharito",
            gloss: "made resonant, humming (nominative adjective, mukharitaḥ)"
          },
          {
            devanagari: "मधुपैर्बुधैश्च",
            iast: "madhupairbudhaiśca",
            gloss: "by bees and by the wise, and (sandhi of madhupaiḥ 'by bees' + budhaiḥ 'by the wise' + ca 'and', instrumental plural)"
          }
        ]
      },
      {
        text: "जागर्ति यत्र भगवान्गुरुचक्रवर्ती",
        iast: "jāgarti yatra bhagavāngurucakravartī",
        words: [
          {
            devanagari: "जागर्ति",
            iast: "jāgarti",
            gloss: "remains awake, keeps watch (present verb, 3rd singular)"
          },
          {
            devanagari: "यत्र",
            iast: "yatra",
            gloss: "where (relative adverb)"
          },
          {
            devanagari: "भगवान्गुरुचक्रवर्ती",
            iast: "bhagavāngurucakravartī",
            gloss: "the divine sovereign Guru (sandhi of bhagavān 'the divine lord' + guru-cakravartī 'the emperor/sovereign Guru')"
          }
        ]
      },
      {
        text: "विश्वोदय प्रलयनाटकनित्यसाक्षी",
        iast: "viśvodaya pralayanāṭakanityasākṣī",
        words: [
          {
            devanagari: "विश्वोदय",
            iast: "viśvodaya",
            gloss: "of the universe's arising (compound-initial member, viśva-udaya, 'the rise of the universe')"
          },
          {
            devanagari: "प्रलयनाटकनित्यसाक्षी",
            iast: "pralayanāṭakanityasākṣī",
            gloss: "the eternal witness of the drama of dissolution (nominative compound, pralaya-nāṭaka-nitya-sākṣī, describing the guru-cakravartī of the previous pāda)"
          }
        ]
      }
    ],
    meaning: "O noble one, this continual offering of folded hands is cast toward that direction, made resonant with the humming of bees and the voices of the wise, where the divine sovereign Guru keeps eternal watch as witness to the cosmic drama of the universe's rise and dissolution.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse departs from the anuṣṭubh meter used throughout the surrounding verses (its four printed lines scan as a longer meter, likely Vasantatilaka), so each printed line is treated as a single pāda rather than split into two 8-syllable halves. Also, विश्वोदय and प्रलयनाटकनित्यसाक्षी are grammatically one compound that the printed source breaks with a space; they are kept as separate word entries to match the source exactly, but are best read together as a single descriptive phrase."
  },
  {
    id: "guru-gita-52",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 52,
    speakerTag: null,
    padas: [
      {
        text: "श्रीनाथादि गुरुत्रयं गणपतिं पीठत्रयं भैरवं",
        iast: "śrīnāthādi gurutrayaṃ gaṇapatiṃ pīṭhatrayaṃ bhairavaṃ",
        words: [
          {
            devanagari: "श्रीनाथादि",
            iast: "śrīnāthādi",
            gloss: "beginning with (the Guru called) Śrīnātha (compound adjective, modifies guru-trayam — 'ādi' means 'etc./starting with')"
          },
          {
            devanagari: "गुरुत्रयं",
            iast: "gurutrayaṃ",
            gloss: "the triad/set of three Gurus (accusative, object of वन्दे 'I salute')"
          },
          {
            devanagari: "गणपतिं",
            iast: "gaṇapatiṃ",
            gloss: "Gaṇapati (accusative, object of वन्दे)"
          },
          {
            devanagari: "पीठत्रयं",
            iast: "pīṭhatrayaṃ",
            gloss: "the three seats/pīṭhas (of the Goddess) (accusative)"
          },
          {
            devanagari: "भैरवं",
            iast: "bhairavaṃ",
            gloss: "Bhairava (accusative)"
          }
        ]
      },
      {
        text: "सिद्धौघं बटुकत्रयं पदयुगं दूतीक्रमं मण्डलम्",
        iast: "siddhaughaṃ baṭukatrayaṃ padayugaṃ dūtīkramaṃ maṇḍalam",
        words: [
          {
            devanagari: "सिद्धौघं",
            iast: "siddhaughaṃ",
            gloss: "the host/multitude of Siddhas (accusative)"
          },
          {
            devanagari: "बटुकत्रयं",
            iast: "baṭukatrayaṃ",
            gloss: "the three Baṭukas, child-forms of Bhairava (accusative)"
          },
          {
            devanagari: "पदयुगं",
            iast: "padayugaṃ",
            gloss: "the pair of feet (of Śiva-Śakti) (accusative)"
          },
          {
            devanagari: "दूतीक्रमं",
            iast: "dūtīkramaṃ",
            gloss: "the succession/sequence of Dūtīs, messenger-goddesses (accusative)"
          },
          {
            devanagari: "मण्डलम्",
            iast: "maṇḍalam",
            gloss: "the (inner) circle, maṇḍala (accusative)"
          }
        ]
      },
      {
        text: "वीरान्द्व्यष्टचतुष्क षष्टि नवकं वीरावली पञ्चकं",
        iast: "vīrāndvyaṣṭacatuṣka ṣaṣṭi navakaṃ vīrāvalī pañcakaṃ",
        words: [
          {
            devanagari: "वीरान्द्व्यष्टचतुष्क",
            iast: "vīrāndvyaṣṭacatuṣka",
            gloss: "the Vīras (heroes), sixteen and four (accusative compound: vīrān 'heroes' + dvi-aṣṭa 'twice-eight' + catuṣka 'group of four')"
          },
          {
            devanagari: "षष्टि",
            iast: "ṣaṣṭi",
            gloss: "sixty (referring to a further group of sixty)"
          },
          {
            devanagari: "नवकं",
            iast: "navakaṃ",
            gloss: "the group of nine (accusative)"
          },
          {
            devanagari: "वीरावली",
            iast: "vīrāvalī",
            gloss: "the row/series of Vīras (accusative)"
          },
          {
            devanagari: "पञ्चकं",
            iast: "pañcakaṃ",
            gloss: "the group of five (accusative)"
          }
        ]
      },
      {
        text: "श्रीमन्मालिनिमन्त्रराजसहितं वन्दे गुरोर्मण्डलम्",
        iast: "śrīmanmālinimantrarājasahitaṃ vande gurormaṇḍalam",
        words: [
          {
            devanagari: "श्रीमन्मालिनिमन्त्रराजसहितं",
            iast: "śrīmanmālinimantrarājasahitaṃ",
            gloss: "together with the revered Mālinī (the mystic garland of letters) and the King of Mantras (accusative, describing गुरोर्मण्डलम्)"
          },
          {
            devanagari: "वन्दे",
            iast: "vande",
            gloss: "I salute, I venerate (1st person singular present)"
          },
          {
            devanagari: "गुरोर्मण्डलम्",
            iast: "gurormaṇḍalam",
            gloss: "the maṇḍala, the mystic assembly, of the Guru (accusative, object of वन्दे)"
          }
        ]
      }
    ],
    meaning: "I salute the Guru's mystic assembly — the triad of Gurus beginning with Śrīnātha, Gaṇapati, the three seats, Bhairava, the host of Siddhas, the three Baṭukas, the pair of feet, the succession of Dūtīs, and the circle itself; the Vīras in their groups of sixteen, four, sixty and nine, the row of five special Vīras, together with the revered Mālinī and the supreme King of Mantras.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The phrase 'दूतीक्रमं मण्डलम्' (the sequence of Dūtīs, the maṇḍala) differs from a variant reading found in some editions, 'दूती त्रयं शाम्भवम्' (three Dūtīs, the Śāmbhava circle); the numerical groupings named here (sixteen, four, sixty, nine, five) also refer to specific Śrīvidyā tāntric categories that this condensed enumeration verse does not itself spell out."
  },
  {
    id: "guru-gita-53",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 53,
    speakerTag: null,
    padas: [
      {
        text: "अभ्यस्तैः सकलैः सुदीर्घमनिलैर्व्याधिप्रदैर्दुष्करैः",
        iast: "abhyastaiḥ sakalaiḥ sudīrghamanilairvyādhipradairduṣkaraiḥ",
        words: [
          {
            devanagari: "अभ्यस्तैः",
            iast: "abhyastaiḥ",
            gloss: "practiced, repeatedly performed (instrumental plural adjective)"
          },
          {
            devanagari: "सकलैः",
            iast: "sakalaiḥ",
            gloss: "all (instrumental plural)"
          },
          {
            devanagari: "सुदीर्घमनिलैर्व्याधिप्रदैर्दुष्करैः",
            iast: "sudīrghamanilairvyādhipradairduṣkaraiḥ",
            gloss: "the very long, disease-causing, difficult breath-retentions (instrumental plural compound: sudīrgham + anilaiḥ + vyādhipradaiḥ + duṣkaraiḥ)"
          }
        ]
      },
      {
        text: "प्राणायामशतैरनेककरणैर्दुःखात्मकैर्दुर्जयैः",
        iast: "prāṇāyāmaśatairanekakaraṇairduḥkhātmakairdurjayaiḥ",
        words: [
          {
            devanagari: "प्राणायामशतैरनेककरणैर्दुःखात्मकैर्दुर्जयैः",
            iast: "prāṇāyāmaśatairanekakaraṇairduḥkhātmakairdurjayaiḥ",
            gloss: "the hundreds of prāṇāyāmas, done by numerous methods, painful by nature, and hard to master (instrumental plural compound)"
          }
        ]
      },
      {
        text: "यस्मिन्नभ्युदिते विनश्यति बली वायुः स्वयं तत्क्षणात्",
        iast: "yasminnabhyudite vinaśyati balī vāyuḥ svayaṃ tatkṣaṇāt",
        words: [
          {
            devanagari: "यस्मिन्नभ्युदिते",
            iast: "yasminnabhyudite",
            gloss: "when this (Guru) has arisen/appeared (locative absolute: यस्मिन् 'in whom' + अभ्युदिते 'having arisen')"
          },
          {
            devanagari: "विनश्यति",
            iast: "vinaśyati",
            gloss: "perishes, subsides, is destroyed (present tense verb)"
          },
          {
            devanagari: "बली",
            iast: "balī",
            gloss: "powerful, mighty (nominative adjective, describes वायुः)"
          },
          {
            devanagari: "वायुः",
            iast: "vāyuḥ",
            gloss: "the breath, the vital air (nominative subject)"
          },
          {
            devanagari: "स्वयं",
            iast: "svayaṃ",
            gloss: "by itself, spontaneously (adverb)"
          },
          {
            devanagari: "तत्क्षणात्",
            iast: "tatkṣaṇāt",
            gloss: "at that very instant (ablative)"
          }
        ]
      },
      {
        text: "प्राप्तुं तत्सहजं स्वभावमनिशं सेवध्वमेकं गुरुम्",
        iast: "prāptuṃ tatsahajaṃ svabhāvamaniśaṃ sevadhvamekaṃ gurum",
        words: [
          {
            devanagari: "प्राप्तुं",
            iast: "prāptuṃ",
            gloss: "to attain, to reach (infinitive)"
          },
          {
            devanagari: "तत्सहजं",
            iast: "tatsahajaṃ",
            gloss: "that which is its own innate/natural (accusative, describes स्वभावम्)"
          },
          {
            devanagari: "स्वभावमनिशं",
            iast: "svabhāvamaniśaṃ",
            gloss: "its own inherent nature (accusative, object of प्राप्तुम्) — unceasingly (adverb, modifies the verb that follows)"
          },
          {
            devanagari: "सेवध्वमेकं",
            iast: "sevadhvamekaṃ",
            gloss: "serve! (2nd person plural imperative) — the one, the sole (accusative, describes गुरुम्)"
          },
          {
            devanagari: "गुरुम्",
            iast: "gurum",
            gloss: "the Guru (accusative, object of सेवध्वम्)"
          }
        ]
      }
    ],
    meaning: "What is the good of practicing all those long and grueling forms of prāṇāyāma — hundreds of breath-retentions performed through countless painful and hard-to-master methods — when, the very moment he has arisen within, the powerful breath itself instantly falls still on its own? To attain that effortless, natural state, serve the one Guru without ceasing.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-54",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 54,
    speakerTag: null,
    padas: [
      {
        text: "स्वदेशिकस्यैव शरीरचिन्तनं",
        iast: "svadeśikasyaiva śarīracintanaṃ",
        words: [
          {
            devanagari: "स्वदेशिकस्यैव",
            iast: "svadeśikasyaiva",
            gloss: "of one's own Guru, indeed (genitive + emphatic particle एव, sandhi-joined)"
          },
          {
            devanagari: "शरीरचिन्तनं",
            iast: "śarīracintanaṃ",
            gloss: "contemplation of the (bodily) form (nominative subject)"
          }
        ]
      },
      {
        text: "भवेदनन्तस्य शिवस्य चिन्तनम्",
        iast: "bhavedanantasya śivasya cintanam",
        words: [
          {
            devanagari: "भवेदनन्तस्य",
            iast: "bhavedanantasya",
            gloss: "would be — of the infinite/limitless (optative verb भवेत् sandhi-joined with the genitive अनन्तस्य that follows)"
          },
          {
            devanagari: "शिवस्य",
            iast: "śivasya",
            gloss: "of Śiva (genitive)"
          },
          {
            devanagari: "चिन्तनम्",
            iast: "cintanam",
            gloss: "contemplation (nominative predicate)"
          }
        ]
      },
      {
        text: "स्वदेशिकस्यैव च नामकीर्तनं",
        iast: "svadeśikasyaiva ca nāmakīrtanaṃ",
        words: [
          {
            devanagari: "स्वदेशिकस्यैव",
            iast: "svadeśikasyaiva",
            gloss: "of one's own Guru, indeed (genitive + emphatic particle)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "नामकीर्तनं",
            iast: "nāmakīrtanaṃ",
            gloss: "the chanting/utterance of the name (nominative subject)"
          }
        ]
      },
      {
        text: "भवेदनन्तस्य शिवस्य कीर्तनम्",
        iast: "bhavedanantasya śivasya kīrtanam",
        words: [
          {
            devanagari: "भवेदनन्तस्य",
            iast: "bhavedanantasya",
            gloss: "would be — of the infinite/limitless (optative verb + genitive, sandhi-joined)"
          },
          {
            devanagari: "शिवस्य",
            iast: "śivasya",
            gloss: "of Śiva (genitive)"
          },
          {
            devanagari: "कीर्तनम्",
            iast: "kīrtanam",
            gloss: "chanting, glorification (nominative predicate)"
          }
        ]
      }
    ],
    meaning: "To contemplate the very form of one's own Guru is indeed to contemplate the infinite Śiva; and to chant the very name of one's own Guru is indeed to chant the name of the infinite Śiva.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-55",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 55,
    speakerTag: null,
    padas: [
      {
        text: "यत्पादरेणुकणिका",
        iast: "yatpādareṇukaṇikā",
        words: [
          {
            devanagari: "यत्पादरेणुकणिका",
            iast: "yatpādareṇukaṇikā",
            gloss: "a tiny speck of the dust of whose feet (nominative relative compound: yat 'whose' + pāda 'foot' + reṇu 'dust' + kaṇikā 'tiny particle')"
          }
        ]
      },
      {
        text: "कापि संसारवारिधेः",
        iast: "kāpi saṃsāravāridheḥ",
        words: [
          {
            devanagari: "कापि",
            iast: "kāpi",
            gloss: "some, a certain, indefinite (nominative feminine, modifies कणिका)"
          },
          {
            devanagari: "संसारवारिधेः",
            iast: "saṃsāravāridheḥ",
            gloss: "of the ocean of worldly existence (genitive)"
          }
        ]
      },
      {
        text: "सेतुबन्धायते नाथं",
        iast: "setubandhāyate nāthaṃ",
        words: [
          {
            devanagari: "सेतुबन्धायते",
            iast: "setubandhāyate",
            gloss: "acts as, becomes like a bridge (denominative verb, present tense)"
          },
          {
            devanagari: "नाथं",
            iast: "nāthaṃ",
            gloss: "the Lord, Master (accusative, object of the verb उपास्महे that follows)"
          }
        ]
      },
      {
        text: "देशिकं तमुपास्महे",
        iast: "deśikaṃ tamupāsmahe",
        words: [
          {
            devanagari: "देशिकं",
            iast: "deśikaṃ",
            gloss: "the Guru, teacher (accusative, in apposition to नाथं)"
          },
          {
            devanagari: "तमुपास्महे",
            iast: "tamupāsmahe",
            gloss: "him (accusative pronoun) — we worship, we venerate (1st person plural present)"
          }
        ]
      }
    ],
    meaning: "We venerate that Lord and Guru — even a single tiny speck of the dust of whose feet becomes a bridge across the ocean of worldly existence.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-56",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 56,
    speakerTag: null,
    padas: [
      {
        text: "यस्मादनुग्रहं लब्ध्वा",
        iast: "yasmādanugrahaṃ labdhvā",
        words: [
          {
            devanagari: "यस्मादनुग्रहं",
            iast: "yasmādanugrahaṃ",
            gloss: "from whom — grace (ablative + accusative, sandhi-joined; the accusative is object of लब्ध्वा that follows)"
          },
          {
            devanagari: "लब्ध्वा",
            iast: "labdhvā",
            gloss: "having obtained, having received (gerund)"
          }
        ]
      },
      {
        text: "महदज्ञानमुत्सृजेत्",
        iast: "mahadajñānamutsṛjet",
        words: [
          {
            devanagari: "महदज्ञानमुत्सृजेत्",
            iast: "mahadajñānamutsṛjet",
            gloss: "casts off the great ignorance (optative verb with its accusative object, महत् + अज्ञानम् + उत्सृजेत्)"
          }
        ]
      },
      {
        text: "तस्मै श्रीदेशिकेन्द्राय",
        iast: "tasmai śrīdeśikendrāya",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीदेशिकेन्द्राय",
            iast: "śrīdeśikendrāya",
            gloss: "to the glorious foremost among Gurus (dative — śrī + deśika + indra, 'lord of teachers')"
          }
        ]
      },
      {
        text: "नमश्चाभीष्टसिद्धये",
        iast: "namaścābhīṣṭasiddhaye",
        words: [
          {
            devanagari: "नमश्चाभीष्टसिद्धये",
            iast: "namaścābhīṣṭasiddhaye",
            gloss: "salutation — and, for the attainment of one's cherished goal (dative)"
          }
        ]
      }
    ],
    meaning: "Having received grace from him, one casts off great ignorance — to that glorious foremost of Gurus, homage, for the fulfillment of my heart's desire.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The optative उत्सृजेत् ('would cast off') has no explicit subject in the Sanskrit; some translations shift the agency to the Guru's grace itself ('his grace destroys ignorance'), though grammatically it is the aspirant who, upon receiving that grace, casts off the ignorance."
  },
  {
    id: "guru-gita-57",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 57,
    speakerTag: null,
    padas: [
      {
        text: "पादाब्जं",
        iast: "pādābjaṃ",
        words: [
          {
            devanagari: "पादाब्जं",
            iast: "pādābjaṃ",
            gloss: "the lotus-feet (of the Guru) (accusative, object of the meditation-instruction begun here and completed with स्मरेत् in the next verse)"
          }
        ]
      },
      {
        text: "सर्वसंसारदावानलविनाशकम्",
        iast: "sarvasaṃsāradāvānalavināśakam",
        words: [
          {
            devanagari: "सर्वसंसारदावानलविनाशकम्",
            iast: "sarvasaṃsāradāvānalavināśakam",
            gloss: "the destroyer of the wildfire of all worldly existence (accusative, describes पादाब्जं)"
          }
        ]
      },
      {
        text: "ब्रह्मरन्ध्रे सिताम्भोजमध्यस्थं",
        iast: "brahmarandhre sitāmbhojamadhyasthaṃ",
        words: [
          {
            devanagari: "ब्रह्मरन्ध्रे",
            iast: "brahmarandhre",
            gloss: "in the brahmarandhra, the aperture at the crown of the head (locative)"
          },
          {
            devanagari: "सिताम्भोजमध्यस्थं",
            iast: "sitāmbhojamadhyasthaṃ",
            gloss: "situated in the middle of the white lotus (accusative adjective, further describes पादाब्जं)"
          }
        ]
      },
      {
        text: "चन्द्रमण्डले",
        iast: "candramaṇḍale",
        words: [
          {
            devanagari: "चन्द्रमण्डले",
            iast: "candramaṇḍale",
            gloss: "in the orb/circle of the moon (locative)"
          }
        ]
      }
    ],
    meaning: "One should meditate on the Guru's lotus feet, the destroyer of the wildfire of all worldly existence, resting in the middle of the white lotus within the orb of the moon, in the brahmarandhra.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse's syntax is left open: the accusative description of the Guru's feet receives its governing verb (स्मरेत्, 'one should meditate') only at the end of the following verse, so verses 57 and 58 form a single continuous sentence; each printed line is also kept as one pāda here rather than split into two 8-syllable quarters, since the metrical half-line boundary falls inside an unbroken compound with no natural word-space."
  },
  {
    id: "guru-gita-58",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 58,
    speakerTag: null,
    padas: [
      {
        text: "अकथादित्रिरेखाब्जे",
        iast: "akathāditrirekhābje",
        words: [
          {
            devanagari: "अकथादित्रिरेखाब्जे",
            iast: "akathāditrirekhābje",
            gloss: "in the lotus marked by the three lines beginning with A, KA, THA (locative — a technical tāntric visualization)"
          }
        ]
      },
      {
        text: "सहस्रदलमण्डले",
        iast: "sahasradalamaṇḍale",
        words: [
          {
            devanagari: "सहस्रदलमण्डले",
            iast: "sahasradalamaṇḍale",
            gloss: "in the thousand-petaled circle (locative, i.e. the sahasrāra)"
          }
        ]
      },
      {
        text: "हंसपार्श्वत्रिकोणे च",
        iast: "haṃsapārśvatrikoṇe ca",
        words: [
          {
            devanagari: "हंसपार्श्वत्रिकोणे",
            iast: "haṃsapārśvatrikoṇe",
            gloss: "in the triangle beside haṃsa, the swan-syllable/mantra (locative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "स्मरेत्तन्मध्यगं गुरुम्",
        iast: "smarettanmadhyagaṃ gurum",
        words: [
          {
            devanagari: "स्मरेत्तन्मध्यगं",
            iast: "smarettanmadhyagaṃ",
            gloss: "one should meditate on (optative verb) — the one situated in the very middle of that (accusative, describes गुरुम्)"
          },
          {
            devanagari: "गुरुम्",
            iast: "gurum",
            gloss: "the Guru (accusative, object of स्मरेत्)"
          }
        ]
      }
    ],
    meaning: "In the lotus marked by the three lines beginning with A-KA-THA, within the thousand-petaled circle, and in the triangle beside haṃsa — one should meditate on the Guru who dwells in the very middle of it all.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). Continues the single sentence begun in verse 57, whose main verb (स्मरेत्) appears only here; the triangle marked with the syllables A-KA-THA is a specific tāntric visualization whose precise form is filled in by oral/commentarial tradition rather than by the verse itself."
  },
  {
    id: "guru-gita-59",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 59,
    speakerTag: null,
    padas: [
      {
        text: "सकलभुवनसृष्टिः कल्पिताशेषपुष्टिः",
        iast: "sakalabhuvanasṛṣṭiḥ kalpitāśeṣapuṣṭiḥ",
        words: [
          {
            devanagari: "सकलभुवनसृष्टिः",
            iast: "sakalabhuvanasṛṣṭiḥ",
            gloss: "the creation of all the worlds (nominative, an epithet of the Guru's gaze)"
          },
          {
            devanagari: "कल्पिताशेषपुष्टिः",
            iast: "kalpitāśeṣapuṣṭiḥ",
            gloss: "the one who ordains the nourishment of all things without exception (nominative)"
          }
        ]
      },
      {
        text: "निखिलनिगमदृष्टिः सम्पदां व्यर्थदृष्टिः",
        iast: "nikhilanigamadṛṣṭiḥ sampadāṃ vyarthadṛṣṭiḥ",
        words: [
          {
            devanagari: "निखिलनिगमदृष्टिः",
            iast: "nikhilanigamadṛṣṭiḥ",
            gloss: "whose sight encompasses the whole of scripture/the Veda (nominative)"
          },
          {
            devanagari: "सम्पदां",
            iast: "sampadāṃ",
            gloss: "of riches, of wealth (genitive plural)"
          },
          {
            devanagari: "व्यर्थदृष्टिः",
            iast: "vyarthadṛṣṭiḥ",
            gloss: "who regards (them) as worthless (nominative — vyartha 'futile' + dṛṣṭiḥ 'regard')"
          }
        ]
      },
      {
        text: "अवगुणपरिमार्ष्टिस्तत्पदार्थैकदृष्टिः",
        iast: "avaguṇaparimārṣṭistatpadārthaikadṛṣṭiḥ",
        words: [
          {
            devanagari: "अवगुणपरिमार्ष्टिस्तत्पदार्थैकदृष्टिः",
            iast: "avaguṇaparimārṣṭistatpadārthaikadṛṣṭiḥ",
            gloss: "the wiper-away of faults, whose sight rests solely on the meaning of That, the Absolute (nominative compound: avaguṇa-parimārṣṭiḥ + tat-padārtha-eka-dṛṣṭiḥ)"
          }
        ]
      },
      {
        text: "भव गुणपरमेष्टिर्मोक्षमार्गैकदृष्टिः",
        iast: "bhava guṇaparameṣṭirmokṣamārgaikadṛṣṭiḥ",
        words: [
          {
            devanagari: "भव",
            iast: "bhava",
            gloss: "of worldly becoming/existence (stem, continues into the compound that follows)"
          },
          {
            devanagari: "गुणपरमेष्टिर्मोक्षमार्गैकदृष्टिः",
            iast: "guṇaparameṣṭirmokṣamārgaikadṛṣṭiḥ",
            gloss: "the supreme goal amid (worldly) qualities, whose sight rests solely on the path of liberation (nominative compound: guṇa-parameṣṭiḥ + mokṣa-mārga-eka-dṛṣṭiḥ)"
          }
        ]
      }
    ],
    meaning: "The Guru's gaze gives rise to all the worlds, brings about the nourishment of everything, takes in the whole of scripture, looks upon riches as worthless, wipes away every fault, and rests solely on the meaning of the Absolute — remaining, even amid the qualities of worldly becoming, fixed solely on the path to liberation.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). Verses 59 and 60 form one continuous sentence: every nominative epithet listed across both verses describes 'श्रीगुरोर्दिव्यदृष्टिः', 'the Guru's divine gaze,' the subject named only in the final line of verse 60, where the governing verb निवसतु ('may it dwell') finally appears."
  },
  {
    id: "guru-gita-60",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 60,
    speakerTag: null,
    padas: [
      {
        text: "सकलभुवनरङ्गस्थापना स्तम्भयष्टिः",
        iast: "sakalabhuvanaraṅgasthāpanā stambhayaṣṭiḥ",
        words: [
          {
            devanagari: "सकलभुवनरङ्गस्थापना",
            iast: "sakalabhuvanaraṅgasthāpanā",
            gloss: "the establisher/founder of the stage of all the worlds (nominative feminine, describes स्तम्भयष्टिः)"
          },
          {
            devanagari: "स्तम्भयष्टिः",
            iast: "stambhayaṣṭiḥ",
            gloss: "the pillar-post, the main supporting column (nominative)"
          }
        ]
      },
      {
        text: "सकरुणरसवृष्टिस्तत्त्वमालासमष्टिः",
        iast: "sakaruṇarasavṛṣṭistattvamālāsamaṣṭiḥ",
        words: [
          {
            devanagari: "सकरुणरसवृष्टिस्तत्त्वमालासमष्टिः",
            iast: "sakaruṇarasavṛṣṭistattvamālāsamaṣṭiḥ",
            gloss: "the shower of compassionate nectar, the very sum of the garland of true principles (nominative compound: sa-karuṇa-rasa-vṛṣṭiḥ + tattva-mālā-samaṣṭiḥ)"
          }
        ]
      },
      {
        text: "सकलसमयसृष्टिः सच्चिदानन्ददृष्टिः",
        iast: "sakalasamayasṛṣṭiḥ saccidānandadṛṣṭiḥ",
        words: [
          {
            devanagari: "सकलसमयसृष्टिः",
            iast: "sakalasamayasṛṣṭiḥ",
            gloss: "the creator of all time (nominative — parallels सकलभुवनसृष्टिः 'creator of all worlds' in the preceding verse)"
          },
          {
            devanagari: "सच्चिदानन्ददृष्टिः",
            iast: "saccidānandadṛṣṭiḥ",
            // The primary source (sanskritdocuments.org) prints this word as
            // "सच्चिदानन्ददृष्टिर्-", a literal trailing hyphen marking that
            // it continues via visarga sandhi (-iḥ + n- → -ir) into निवसतु
            // at the next printed line. Restored to its own plain nominative
            // form here — every other cross-pāda sandhi in this file is
            // explained in prose (as this gloss already does), never by
            // embedding the source's own line-continuation punctuation into
            // a field that feeds this app's syllable/weight display and TTS.
            gloss: "whose nature is being-consciousness-bliss (nominative; the source's own visarga sandhi links this to निवसतु at the line break — see this word's own comment)"
          }
        ]
      },
      {
        text: "निवसतु मयि नित्यं श्रीगुरोर्दिव्यदृष्टिः",
        iast: "nivasatu mayi nityaṃ śrīgurordivyadṛṣṭiḥ",
        words: [
          {
            devanagari: "निवसतु",
            iast: "nivasatu",
            gloss: "may it dwell, may it abide (3rd person singular imperative)"
          },
          {
            devanagari: "मयि",
            iast: "mayi",
            gloss: "in me (locative)"
          },
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternally, always (adverb)"
          },
          {
            devanagari: "श्रीगुरोर्दिव्यदृष्टिः",
            iast: "śrīgurordivyadṛṣṭiḥ",
            gloss: "the divine gaze of the glorious Guru (nominative, the subject of the whole two-verse sentence)"
          }
        ]
      }
    ],
    meaning: "It is the very pillar that sets up the stage of all the worlds, a shower of compassionate nectar, the sum total of the garland of true principles, the creator of all time, whose nature is being-consciousness-bliss — may that divine gaze of the glorious Guru dwell in me forever.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). Continues the single sentence begun in verse 59; निवसतु here is the one finite verb governing every epithet listed across both verses."
  },
  {
    id: "guru-gita-61",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 61,
    speakerTag: null,
    padas: [
      {
        text: "अग्निशुद्धसमं तात",
        iast: "agniśuddhasamaṃ tāta",
        words: [
          {
            devanagari: "अग्निशुद्धसमं",
            iast: "agniśuddhasamaṃ",
            gloss: "equal to that which is purified by fire (accusative, describes मन्त्रराजम्, 'the king of mantras')"
          },
          {
            devanagari: "तात",
            iast: "tāta",
            gloss: "dear one, dear child (vocative, an affectionate term of address)"
          }
        ]
      },
      {
        text: "ज्वाला परिचकाधिया",
        iast: "jvālā paricakādhiyā",
        words: [
          {
            devanagari: "ज्वाला",
            iast: "jvālā",
            gloss: "flame (stem/nominative, used adjectivally with the word that follows)"
          },
          {
            devanagari: "परिचकाधिया",
            iast: "paricakādhiyā",
            gloss: "with a thoroughly testing, discerning intellect (instrumental compound: pari-cakā 'that which examines all around' + dhiyā 'by the intellect')"
          }
        ]
      },
      {
        text: "मन्त्रराजमिमं",
        iast: "mantrarājamimaṃ",
        words: [
          {
            devanagari: "मन्त्रराजमिमं",
            iast: "mantrarājamimaṃ",
            gloss: "this king of mantras (accusative)"
          }
        ]
      },
      {
        text: "मन्येऽहर्निशं पातु मृत्युतः",
        iast: "manye'harniśaṃ pātu mṛtyutaḥ",
        words: [
          {
            devanagari: "मन्येऽहर्निशं",
            iast: "manye'harniśaṃ",
            gloss: "I consider (1st person singular present, मन्ये) — day and night (accusative adverb, अहर्निशम्, joined by sandhi elision)"
          },
          {
            devanagari: "पातु",
            iast: "pātu",
            gloss: "may it protect (3rd person singular imperative)"
          },
          {
            devanagari: "मृत्युतः",
            iast: "mṛtyutaḥ",
            gloss: "from death (ablative)"
          }
        ]
      }
    ],
    meaning: "O dear one, I hold this king of mantras — as pure as gold refined by fire, tested by the flame of a discerning intellect — to be one that protects, day and night, from death.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). तात is literally a term of affectionate address ('dear child' or 'dear one', traditionally used between parent and child) rather than a gendered title, so the common rendering 'O Goddess' for this word is interpretive rather than literal; also, the second line's natural 8-syllable metrical half falls in the middle of the sandhi-elided word-group मन्ये+अहर्निशम् ('मन्येऽहर्निशं'), so that line is kept here as a single undivided pāda rather than split mid-word."
  },
  {
    id: "guru-gita-62",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 62,
    speakerTag: null,
    padas: [
      {
        text: "तदेजति तन्नैजति",
        iast: "tadejati tannaijati",
        words: [
          {
            devanagari: "तदेजति",
            iast: "tadejati",
            gloss: "that (tat) moves, trembles (ejati, present tense verb)"
          },
          {
            devanagari: "तन्नैजति",
            iast: "tannaijati",
            gloss: "and that does not move (sandhi-fused: tat + na + ejati)"
          }
        ]
      },
      {
        text: "तद्दूरे तत्समीपके",
        iast: "taddūre tatsamīpake",
        words: [
          {
            devanagari: "तद्दूरे",
            iast: "taddūre",
            gloss: "that is far off (tat + dūre, 'far away')"
          },
          {
            devanagari: "तत्समीपके",
            iast: "tatsamīpake",
            gloss: "that is near, in the vicinity (tat + samīpake, locative adverbial)"
          }
        ]
      },
      {
        text: "तदन्तरस्य सर्वस्य",
        iast: "tadantarasya sarvasya",
        words: [
          {
            devanagari: "तदन्तरस्य",
            iast: "tadantarasya",
            gloss: "that is within, inside (tat + antarasya, 'the interior of')"
          },
          {
            devanagari: "सर्वस्य",
            iast: "sarvasya",
            gloss: "of everything, of all (genitive)"
          }
        ]
      },
      {
        text: "तदु सर्वस्य बाह्यतः",
        iast: "tadu sarvasya bāhyataḥ",
        words: [
          {
            devanagari: "तदु",
            iast: "tadu",
            gloss: "and that (tat + emphatic particle u)"
          },
          {
            devanagari: "सर्वस्य",
            iast: "sarvasya",
            gloss: "of everything, of all (genitive)"
          },
          {
            devanagari: "बाह्यतः",
            iast: "bāhyataḥ",
            gloss: "from outside, externally (ablative adverb)"
          }
        ]
      }
    ],
    meaning: "He (the Guru) moves, and yet moves not; he is far away, and yet near; he dwells within all things, and he is also outside of all things.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse closely echoes Īśā Upaniṣad 5 ('tad ejati tan naijati...'), which originally describes Brahman/the Self impersonally; here the same neuter 'tad' ('that') is applied to the Guru, which is why some translations render it as 'he' even though the Sanskrit pronoun itself is grammatically neuter."
  },
  {
    id: "guru-gita-63",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 63,
    speakerTag: null,
    padas: [
      {
        text: "अजोऽहमजरोऽहं च",
        iast: "ajo'hamajaro'haṃ ca",
        words: [
          {
            devanagari: "अजोऽहमजरोऽहं",
            iast: "ajo'hamajaro'haṃ",
            gloss: "I am unborn, I am ageless (sandhi-fused pair of clauses: ajaḤ aham 'I am unborn' + ajaraḤ ahaṃ 'I am ageless')"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "अनादिनिधनः स्वयम्",
        iast: "anādinidhanaḥ svayam",
        words: [
          {
            devanagari: "अनादिनिधनः",
            iast: "anādinidhanaḥ",
            gloss: "without beginning or end (bahuvrīhi compound: an-ādi-nidhanaḤ, nominative, describing the Self)"
          },
          {
            devanagari: "स्वयम्",
            iast: "svayam",
            gloss: "by itself, spontaneously, of its own nature"
          }
        ]
      },
      {
        text: "अविकारश्चिदानन्द",
        iast: "avikāraścidānanda",
        words: [
          {
            devanagari: "अविकारश्चिदानन्द",
            iast: "avikāraścidānanda",
            gloss: "changeless, [whose nature is] the bliss of consciousness (sandhi-fused: avikāraḤ 'unchanging' + cidānanda 'consciousness-bliss')"
          }
        ]
      },
      {
        text: "अणीयान्महतो महान्",
        iast: "aṇīyānmahato mahān",
        words: [
          {
            devanagari: "अणीयान्महतो",
            iast: "aṇīyānmahato",
            gloss: "smaller, more minute than the great (comparative: aṇīyān 'smaller, more minute' + mahataḤ 'than the great, than the large', ablative of comparison)"
          },
          {
            devanagari: "महान्",
            iast: "mahān",
            gloss: "great, mighty (nominative of mahat; paired with the preceding ablative to form the traditional paradox — literally '[more minute] than the great, [yet itself] great' — often rendered idiomatically as 'greater than the greatest')"
          }
        ]
      }
    ],
    meaning: "I am unborn, I am ageless, and of my own nature without beginning or end; I am unchanging, the very bliss of consciousness — smaller than the smallest, and greater than the greatest.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-64",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 64,
    speakerTag: null,
    padas: [
      {
        text: "अपूर्वाणां परं नित्यं",
        iast: "apūrvāṇāṃ paraṃ nityaṃ",
        words: [
          {
            devanagari: "अपूर्वाणां",
            iast: "apūrvāṇāṃ",
            gloss: "of things having no antecedent cause, of the beginningless (genitive plural)"
          },
          {
            devanagari: "परं",
            iast: "paraṃ",
            gloss: "supreme, beyond"
          },
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternal, permanent"
          }
        ]
      },
      {
        text: "स्वयंज्योतिर्निरामयम्",
        iast: "svayaṃjyotirnirāmayam",
        words: [
          {
            devanagari: "स्वयंज्योतिर्निरामयम्",
            iast: "svayaṃjyotirnirāmayam",
            gloss: "self-luminous and free from affliction (sandhi-fused: svayaṃ-jyotiḤ 'self-luminous' + nirāmayam 'free from disease/blemish')"
          }
        ]
      },
      {
        text: "विरजं परमाकाशं",
        iast: "virajaṃ paramākāśaṃ",
        words: [
          {
            devanagari: "विरजं",
            iast: "virajaṃ",
            gloss: "free from taint, spotless"
          },
          {
            devanagari: "परमाकाशं",
            iast: "paramākāśaṃ",
            gloss: "the supreme ether/space (parama + ākāśa)"
          }
        ]
      },
      {
        text: "ध्रुवमानन्दमव्ययम्",
        iast: "dhruvamānandamavyayam",
        words: [
          {
            devanagari: "ध्रुवमानन्दमव्ययम्",
            iast: "dhruvamānandamavyayam",
            gloss: "fixed, blissful, and imperishable (sandhi-fused: dhruvam 'steadfast' + ānandam 'blissful' + avyayam 'undecaying')"
          }
        ]
      }
    ],
    meaning: "Supreme and eternal, beyond even the things that have no prior cause; self-luminous, free from all affliction; untainted, the supreme ether — ever-steadfast, blissful, and imperishable.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The compact phrase 'apūrvāṇāṃ param' does not spell out its exact referent, and translators differ on whether it means 'beyond all things without an antecedent cause' or something closer to 'supreme among primeval things'; this rendering follows the more literal first sense."
  },
  {
    id: "guru-gita-65",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 65,
    speakerTag: null,
    padas: [
      {
        text: "श्रुतिः",
        iast: "śrutiḥ",
        words: [
          {
            devanagari: "श्रुतिः",
            iast: "śrutiḥ",
            gloss: "scripture, revealed text (nominative — one of the four pramāṇas named in this verse)"
          }
        ]
      },
      {
        text: "प्रत्यक्षमैतिह्यमनुमानश्चतुष्टयम्",
        iast: "pratyakṣamaitihyamanumānaścatuṣṭayam",
        words: [
          {
            devanagari: "प्रत्यक्षमैतिह्यमनुमानश्चतुष्टयम्",
            iast: "pratyakṣamaitihyamanumānaścatuṣṭayam",
            gloss: "direct perception, traditional testimony, and inference — the group of four (sandhi-fused: pratyakṣam 'direct perception' + aitihyam 'itihāsa/traditional account' + anumānaḤ 'inference' + catuṣṭayam 'the fourfold group'; together with śrutiḤ in the preceding pāda these form the four classical means of valid knowledge)"
          }
        ]
      },
      {
        text: "यस्य चात्मतपो वेद",
        iast: "yasya cātmatapo veda",
        words: [
          {
            devanagari: "यस्य",
            iast: "yasya",
            gloss: "whose (genitive relative pronoun)"
          },
          {
            devanagari: "चात्मतपो",
            iast: "cātmatapo",
            gloss: "and [whose] self-power/inner austerity (sandhi: ca 'and' + ātma-tapaḤ 'the tapas of the self', with visarga realized as -o before vedā)"
          },
          {
            devanagari: "वेद",
            iast: "veda",
            gloss: "one knows (perfect-tense verb, 3rd person)"
          }
        ]
      },
      {
        text: "देशिकं च सदा स्मरेत्",
        iast: "deśikaṃ ca sadā smaret",
        words: [
          {
            devanagari: "देशिकं",
            iast: "deśikaṃ",
            gloss: "the teacher, guide (accusative — an epithet of the Guru)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          },
          {
            devanagari: "स्मरेत्",
            iast: "smaret",
            gloss: "one should remember (optative verb)"
          }
        ]
      }
    ],
    meaning: "By the four means of valid knowledge — scripture, direct perception, tradition, and inference — one discerns whose inner spiritual power is genuine; such a teacher one should always remember.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-66",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 66,
    speakerTag: null,
    padas: [
      {
        text: "मनुञ्च यद्भवं कार्यं",
        iast: "manuñca yadbhavaṃ kāryaṃ",
        words: [
          {
            devanagari: "मनुञ्च",
            iast: "manuñca",
            gloss: "that which is to be contemplated, and... (the printed reading here is uncertain — see citationNote)"
          },
          {
            devanagari: "यद्भवं",
            iast: "yadbhavaṃ",
            gloss: "that which is/arises (relative pronoun yad + bhavam)"
          },
          {
            devanagari: "कार्यं",
            iast: "kāryaṃ",
            gloss: "the task, that which is to be done (nominative gerundive)"
          }
        ]
      },
      {
        text: "तद्वदामि महामते",
        iast: "tadvadāmi mahāmate",
        words: [
          {
            devanagari: "तद्वदामि",
            iast: "tadvadāmi",
            gloss: "that I declare, I tell (tad + vadāmi)"
          },
          {
            devanagari: "महामते",
            iast: "mahāmate",
            gloss: "O great-minded one (vocative, addressing the Goddess)"
          }
        ]
      },
      {
        text: "साधुत्वं च मया दृष्ट्वा",
        iast: "sādhutvaṃ ca mayā dṛṣṭvā",
        words: [
          {
            devanagari: "साधुत्वं",
            iast: "sādhutvaṃ",
            gloss: "goodness, virtue, receptivity (nominative abstract noun)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "मया",
            iast: "mayā",
            gloss: "by me (instrumental)"
          },
          {
            devanagari: "दृष्ट्वा",
            iast: "dṛṣṭvā",
            gloss: "having seen (gerund)"
          }
        ]
      },
      {
        text: "त्वयि तिष्ठति सांप्रतम्",
        iast: "tvayi tiṣṭhati sāṃpratam",
        words: [
          {
            devanagari: "त्वयि",
            iast: "tvayi",
            gloss: "in you (locative)"
          },
          {
            devanagari: "तिष्ठति",
            iast: "tiṣṭhati",
            gloss: "abides, remains (present tense verb)"
          },
          {
            devanagari: "सांप्रतम्",
            iast: "sāṃpratam",
            gloss: "now, at present (adverb)"
          }
        ]
      }
    ],
    meaning: "That which is to be reflected upon and undertaken, O great-minded one — this I now declare to you, having seen that goodness presently abides in you.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The printed Devanagari word 'मनुञ्च' does not parse straightforwardly; the cited published translation implies an underlying reading closer to 'mānanam/mananam' ('that which is to be contemplated'), and this rendering follows that likely sense while flagging the textual uncertainty."
  },
  {
    id: "guru-gita-67",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 67,
    speakerTag: null,
    padas: [
      {
        text: "अखण्डमण्डलाकारं",
        iast: "akhaṇḍamaṇḍalākāraṃ",
        words: [
          {
            devanagari: "अखण्डमण्डलाकारं",
            iast: "akhaṇḍamaṇḍalākāraṃ",
            gloss: "having the form of an undivided sphere (accusative compound: akhaṇḍa 'undivided' + maṇḍala 'sphere' + ākāra 'form', describing the cosmic whole)"
          }
        ]
      },
      {
        text: "व्याप्तं येन चराचरम्",
        iast: "vyāptaṃ yena carācaram",
        words: [
          {
            devanagari: "व्याप्तं",
            iast: "vyāptaṃ",
            gloss: "pervaded (past participle, accusative)"
          },
          {
            devanagari: "येन",
            iast: "yena",
            gloss: "by whom (instrumental relative pronoun)"
          },
          {
            devanagari: "चराचरम्",
            iast: "carācaram",
            gloss: "the moving and the unmoving, all creation (accusative — cara + acara)"
          }
        ]
      },
      {
        text: "तत्पदं दर्शितं येन",
        iast: "tatpadaṃ darśitaṃ yena",
        words: [
          {
            devanagari: "तत्पदं",
            iast: "tatpadaṃ",
            gloss: "that [supreme] state (accusative — tat + padam)"
          },
          {
            devanagari: "दर्शितं",
            iast: "darśitaṃ",
            gloss: "revealed, shown (past participle, accusative)"
          },
          {
            devanagari: "येन",
            iast: "yena",
            gloss: "by whom (instrumental)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the revered Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "Salutations to the revered Guru, by whom this undivided cosmic sphere — comprising all that moves and moves not — is pervaded, and by whom that Supreme State is revealed.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-68",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 68,
    speakerTag: null,
    padas: [
      {
        text: "सर्वश्रुतिशिरोरत्न",
        iast: "sarvaśrutiśiroratna",
        words: [
          {
            devanagari: "सर्वश्रुतिशिरोरत्न",
            iast: "sarvaśrutiśiroratna",
            gloss: "the crest-jewels of all the Vedas (compound: sarva 'all' + śruti 'scripture' + śiraḤ 'head, crest' + ratna 'jewel')"
          }
        ]
      },
      {
        text: "विराजितपदाम्बुजः",
        iast: "virājitapadāmbujaḥ",
        words: [
          {
            devanagari: "विराजितपदाम्बुजः",
            iast: "virājitapadāmbujaḥ",
            gloss: "[whose] lotus feet are resplendent, adorned (compound: virājita 'adorned' + pada-ambujaḤ 'lotus feet', nominative — completing the bahuvrīhi: 'he whose lotus feet are adorned by the crest-jewels of all the Vedas')"
          }
        ]
      },
      {
        text: "वेदान्ताम्बुजसूर्यो यस्तस्मै",
        iast: "vedāntāmbujasūryo yastasmai",
        words: [
          {
            devanagari: "वेदान्ताम्बुजसूर्यो",
            iast: "vedāntāmbujasūryo",
            gloss: "the sun to the lotus of Vedānta (compound: vedānta 'the culminating wisdom of the Vedas' + ambuja 'lotus' + sūryaḤ 'sun', sandhi-linked to the following relative pronoun)"
          },
          {
            devanagari: "यस्तस्मै",
            iast: "yastasmai",
            gloss: "who [is]; to him (sandhi-fused: yaḤ 'who' + tasmai 'to that one')"
          }
        ]
      },
      {
        text: "श्रीगुरवे नमः",
        iast: "śrīgurave namaḥ",
        words: [
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the revered Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "Salutations to the revered Guru whose lotus feet are adorned by the crest-jewels of all the Vedas, and who is the sun that opens the lotus of Vedānta wisdom.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-69",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 69,
    speakerTag: null,
    padas: [
      {
        text: "यस्य स्मरणमात्रेण",
        iast: "yasya smaraṇamātreṇa",
        words: [
          {
            devanagari: "यस्य",
            iast: "yasya",
            gloss: "of whom, whose (genitive)"
          },
          {
            devanagari: "स्मरणमात्रेण",
            iast: "smaraṇamātreṇa",
            gloss: "by mere remembrance (instrumental: smaraṇa 'remembrance' + mātra 'mere')"
          }
        ]
      },
      {
        text: "ज्ञानमुत्पद्यते स्वयम्",
        iast: "jñānamutpadyate svayam",
        words: [
          {
            devanagari: "ज्ञानमुत्पद्यते",
            iast: "jñānamutpadyate",
            gloss: "knowledge arises (sandhi-fused: jñānam 'knowledge' + utpadyate 'arises')"
          },
          {
            devanagari: "स्वयम्",
            iast: "svayam",
            gloss: "spontaneously, by itself"
          }
        ]
      },
      {
        text: "य एव सर्व सम्प्राप्तिस्तस्मै",
        iast: "ya eva sarva samprāptistasmai",
        words: [
          {
            devanagari: "य",
            iast: "ya",
            gloss: "who (nominative relative pronoun yaḤ, with visarga elided before the following vowel)"
          },
          {
            devanagari: "एव",
            iast: "eva",
            gloss: "indeed, alone (emphatic particle)"
          },
          {
            devanagari: "सर्व सम्प्राप्तिस्तस्मै",
            iast: "sarva samprāptistasmai",
            gloss: "is the attainment of everything; to him (sandhi-fused: sarva 'all' + samprāptiḤ 'attainment' + tasmai 'to that one' — 'by attaining whom, everything is attained')"
          }
        ]
      },
      {
        text: "श्रीगुरवे नमः",
        iast: "śrīgurave namaḥ",
        words: [
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the revered Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "Salutations to the revered Guru: by merely remembering whom, knowledge arises of itself, and by attaining whom, everything is attained.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-70",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 70,
    speakerTag: null,
    padas: [
      {
        text: "चैतन्यं शाश्वतं शान्तं",
        iast: "caitanyaṃ śāśvataṃ śāntaṃ",
        words: [
          {
            devanagari: "चैतन्यं",
            iast: "caitanyaṃ",
            gloss: "consciousness (nominative/accusative abstract noun)"
          },
          {
            devanagari: "शाश्वतं",
            iast: "śāśvataṃ",
            gloss: "eternal, everlasting"
          },
          {
            devanagari: "शान्तं",
            iast: "śāntaṃ",
            gloss: "peaceful, tranquil"
          }
        ]
      },
      {
        text: "व्योमातीतं निरञ्जनम्",
        iast: "vyomātītaṃ nirañjanam",
        words: [
          {
            devanagari: "व्योमातीतं",
            iast: "vyomātītaṃ",
            gloss: "beyond the sky/ether (compound: vyoma 'sky, ether' + atīta 'transcended')"
          },
          {
            devanagari: "निरञ्जनम्",
            iast: "nirañjanam",
            gloss: "stainless, without blemish"
          }
        ]
      },
      {
        text: "नादबिन्दुकलातीतं",
        iast: "nādabindukalātītaṃ",
        words: [
          {
            devanagari: "नादबिन्दुकलातीतं",
            iast: "nādabindukalātītaṃ",
            gloss: "beyond nāda [subtle sound], bindu [subtle point], and kalā [emanation] (compound: nāda + bindu + kalā + atīta 'transcended' — subtle stages in tantric/yogic cosmology)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the revered Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "Salutations to the revered Guru, who is consciousness itself — eternal, peaceful, beyond the ether, stainless, and transcending nāda, bindu, and kalā.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-71",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 71,
    speakerTag: null,
    padas: [
      {
        text: "स्थावरं जङ्गमं चैव",
        iast: "sthāvaraṃ jaṅgamaṃ caiva",
        words: [
          {
            devanagari: "स्थावरं",
            iast: "sthāvaraṃ",
            gloss: "the stationary, immobile [things] (accusative)"
          },
          {
            devanagari: "जङ्गमं",
            iast: "jaṅgamaṃ",
            gloss: "the moving, mobile [things] (accusative)"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed (ca + eva)"
          }
        ]
      },
      {
        text: "तथा चैव चराचरम्",
        iast: "tathā caiva carācaram",
        words: [
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "likewise, similarly"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed"
          },
          {
            devanagari: "चराचरम्",
            iast: "carācaram",
            gloss: "the moving and the unmoving, all creation (accusative)"
          }
        ]
      },
      {
        text: "व्याप्तं येन जगत्सर्वं",
        iast: "vyāptaṃ yena jagatsarvaṃ",
        words: [
          {
            devanagari: "व्याप्तं",
            iast: "vyāptaṃ",
            gloss: "pervaded (past participle)"
          },
          {
            devanagari: "येन",
            iast: "yena",
            gloss: "by whom (instrumental)"
          },
          {
            devanagari: "जगत्सर्वं",
            iast: "jagatsarvaṃ",
            gloss: "the entire world/universe (compound: jagat 'world' + sarvam 'all')"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to him (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the revered Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "Salutations to the revered Guru, by whom this entire universe — the stationary and the moving, and likewise all that moves and moves not — is pervaded.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-72",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 72,
    speakerTag: null,
    padas: [
      {
        text: "ज्ञानशक्तिसमारूढस्तत्त्वमाला",
        iast: "jñānaśaktisamārūḍhastattvamālā",
        words: [
          {
            devanagari: "ज्ञानशक्तिसमारूढस्तत्त्वमाला",
            iast: "jñānaśaktisamārūḍhastattvamālā",
            gloss: "mounted/ascended upon the power of knowledge, [bearing] the garland of principles (nominative; sandhi-fused from jñāna-śakti-samārūḍhaḥ 'one who has mounted the power of knowledge' + tattva-mālā 'garland of principles' — the latter serves as the implicit basis for the adornment named in the next word)"
          }
        ]
      },
      {
        text: "विभूषितः",
        iast: "vibhūṣitaḥ",
        words: [
          {
            devanagari: "विभूषितः",
            iast: "vibhūṣitaḥ",
            gloss: "adorned [with it] (nominative predicate adjective describing the Guru; completes the sense 'adorned with the garland of principles')"
          }
        ]
      },
      {
        text: "भुक्तिमुक्तिप्रदाता",
        iast: "bhuktimuktipradātā",
        words: [
          {
            devanagari: "भुक्तिमुक्तिप्रदाता",
            iast: "bhuktimuktipradātā",
            gloss: "the bestower of both worldly enjoyment and liberation (nominative, an epithet of the Guru — bhukti 'enjoyment' + mukti 'liberation' + pradātā 'giver, bestower')"
          }
        ]
      },
      {
        text: "यस्तस्मै श्रीगुरवे नमः",
        iast: "yastasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "यस्तस्मै",
            iast: "yastasmai",
            gloss: "who — to that one (sandhi-fused relative pronoun यः 'who', nominative, + तस्मै 'to that', dative, opening the closing salutation)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage (indeclinable)"
          }
        ]
      }
    ],
    meaning: "Salutations to that venerable Guru who, mounted upon the power of knowledge and adorned with the garland of spiritual principles, bestows both worldly enjoyment and liberation.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-73",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 73,
    speakerTag: null,
    padas: [
      {
        text: "अनेकजन्मसम्प्राप्तसर्वकर्म",
        iast: "anekajanmasamprāptasarvakarma",
        words: [
          {
            devanagari: "अनेकजन्मसम्प्राप्तसर्वकर्म",
            iast: "anekajanmasamprāptasarvakarma",
            gloss: "all the karma accumulated through many births (compound modifying विदाहिने below — aneka 'many' + janma 'births' + samprāpta 'obtained, accumulated' + sarva 'all' + karma 'action, karma')"
          }
        ]
      },
      {
        text: "विदाहिने",
        iast: "vidāhine",
        words: [
          {
            devanagari: "विदाहिने",
            iast: "vidāhine",
            gloss: "to [him who is] the thorough burner/consumer of — dative epithet of the Guru, completing the compound begun in the previous word (vi + dāh 'burn' + -ine dative)"
          }
        ]
      },
      {
        text: "स्वात्मज्ञानप्रभावेण",
        iast: "svātmajñānaprabhāveṇa",
        words: [
          {
            devanagari: "स्वात्मज्ञानप्रभावेण",
            iast: "svātmajñānaprabhāveṇa",
            gloss: "by the power of knowledge of one's own Self (instrumental — sva-ātma-jñāna 'knowledge of the Self' + prabhāveṇa 'by the power/influence of')"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to that one (dative demonstrative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "Salutations to that venerable Guru who, by the power of knowledge of one's own Self, burns away all the karma accumulated through countless births.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-74",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 74,
    speakerTag: null,
    padas: [
      {
        text: "न गुरोरधिकं तत्त्वं",
        iast: "na guroradhikaṃ tattvaṃ",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not (negation)"
          },
          {
            devanagari: "गुरोरधिकं",
            iast: "guroradhikaṃ",
            gloss: "greater than the Guru (sandhi of guroḥ 'than the Guru', ablative, + adhikam 'greater, higher')"
          },
          {
            devanagari: "तत्त्वं",
            iast: "tattvaṃ",
            gloss: "[any] truth, reality (nominative, subject of the negation)"
          }
        ]
      },
      {
        text: "न गुरोरधिकं तपः",
        iast: "na guroradhikaṃ tapaḥ",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "गुरोरधिकं",
            iast: "guroradhikaṃ",
            gloss: "greater than the Guru (ablative + comparative, repeated)"
          },
          {
            devanagari: "तपः",
            iast: "tapaḥ",
            gloss: "austerity, penance (nominative)"
          }
        ]
      },
      {
        text: "तत्त्वं ज्ञानात्परं नास्ति",
        iast: "tattvaṃ jñānātparaṃ nāsti",
        words: [
          {
            devanagari: "तत्त्वं",
            iast: "tattvaṃ",
            gloss: "the Truth, Reality (nominative subject)"
          },
          {
            devanagari: "ज्ञानात्परं",
            iast: "jñānātparaṃ",
            gloss: "higher than [mere] knowledge (sandhi of jñānāt 'than knowledge', ablative, + param 'higher, beyond')"
          },
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not (negative verb, na + asti)"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to that one (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "There is no truth higher than the Guru, no austerity greater than the Guru, and no reality beyond this knowledge — salutations to that venerable Guru!",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-75",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 75,
    speakerTag: null,
    padas: [
      {
        text: "मन्नाथः श्रीजगन्नाथो",
        iast: "mannāthaḥ śrījagannātho",
        words: [
          {
            devanagari: "मन्नाथः",
            iast: "mannāthaḥ",
            gloss: "my Lord, my master (nominative; sandhi of mad 'my' + nāthaḥ 'lord')"
          },
          {
            devanagari: "श्रीजगन्नाथो",
            iast: "śrījagannātho",
            gloss: "[is] the venerable Lord of the universe (nominative; śrī + jagat 'world' + nāthaḥ 'lord', shown here in its sandhi form before a following voiced consonant)"
          }
        ]
      },
      {
        text: "मद्गुरुस्त्रिजगद्गुरुः",
        iast: "madgurustrijagadguruḥ",
        words: [
          {
            devanagari: "मद्गुरुस्त्रिजगद्गुरुः",
            iast: "madgurustrijagadguruḥ",
            gloss: "my Guru [is] the Guru of the three worlds (nominative, sandhi-fused — mad-guruḥ 'my Guru' + tri-jagad-guruḥ 'Guru of the three worlds')"
          }
        ]
      },
      {
        text: "ममात्मा सर्वभूतात्मा",
        iast: "mamātmā sarvabhūtātmā",
        words: [
          {
            devanagari: "ममात्मा",
            iast: "mamātmā",
            gloss: "my [own] Self (nominative; mama 'my' + ātmā 'Self')"
          },
          {
            devanagari: "सर्वभूतात्मा",
            iast: "sarvabhūtātmā",
            gloss: "[is] the Self of all beings (nominative; sarva-bhūta-ātmā 'Self of all creatures')"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to that one (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "My Lord is the venerable Lord of the universe; my Guru is the Guru of the three worlds. My own Self is the Self of all beings — salutations to that venerable Guru!",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-76",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 76,
    speakerTag: null,
    padas: [
      {
        text: "ध्यानमूलं गुरोर्मूर्तिः",
        iast: "dhyānamūlaṃ gurormūrtiḥ",
        words: [
          {
            devanagari: "ध्यानमूलं",
            iast: "dhyānamūlaṃ",
            gloss: "the root of meditation (nominative; dhyāna 'meditation' + mūlam 'root')"
          },
          {
            devanagari: "गुरोर्मूर्तिः",
            iast: "gurormūrtiḥ",
            gloss: "[is] the Guru's form (nominative; guroḥ 'of the Guru', genitive, + mūrtiḥ 'form, image')"
          }
        ]
      },
      {
        text: "पूजामूलं गुरोः पदम्",
        iast: "pūjāmūlaṃ guroḥ padam",
        words: [
          {
            devanagari: "पूजामूलं",
            iast: "pūjāmūlaṃ",
            gloss: "the root of worship (nominative)"
          },
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "of the Guru (genitive)"
          },
          {
            devanagari: "पदम्",
            iast: "padam",
            gloss: "[is his] foot (nominative predicate, neuter; honorific singular, often rendered 'feet')"
          }
        ]
      },
      {
        text: "मन्त्रमूलं गुरोर्वाक्यं",
        iast: "mantramūlaṃ gurorvākyaṃ",
        words: [
          {
            devanagari: "मन्त्रमूलं",
            iast: "mantramūlaṃ",
            gloss: "the root of mantra (nominative)"
          },
          {
            devanagari: "गुरोर्वाक्यं",
            iast: "gurorvākyaṃ",
            gloss: "[is] the Guru's word (nominative; guroḥ 'of the Guru' + vākyam 'word, utterance')"
          }
        ]
      },
      {
        text: "मोक्षमूलं गुरोः कृपा",
        iast: "mokṣamūlaṃ guroḥ kṛpā",
        words: [
          {
            devanagari: "मोक्षमूलं",
            iast: "mokṣamūlaṃ",
            gloss: "the root of liberation (nominative)"
          },
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "of the Guru (genitive)"
          },
          {
            devanagari: "कृपा",
            iast: "kṛpā",
            gloss: "[is his] grace (nominative feminine)"
          }
        ]
      }
    ],
    meaning: "The root of meditation is the Guru's form; the root of worship is the Guru's feet; the root of mantra is the Guru's word; and the root of liberation is the Guru's grace.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-77",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 77,
    speakerTag: null,
    padas: [
      {
        text: "गुरुरादिरनादिश्च",
        iast: "gururādiranādiśca",
        words: [
          {
            devanagari: "गुरुरादिरनादिश्च",
            iast: "gururādiranādiśca",
            gloss: "the Guru is [both] the origin and without origin (sandhi-fused nominative predicate — guruḥ 'the Guru' + ādiḥ 'the beginning' + anādiḥ 'beginningless' + ca 'and')"
          }
        ]
      },
      {
        text: "गुरुः परमदैवतम्",
        iast: "guruḥ paramadaivatam",
        words: [
          {
            devanagari: "गुरुः",
            iast: "guruḥ",
            gloss: "the Guru (nominative subject)"
          },
          {
            devanagari: "परमदैवतम्",
            iast: "paramadaivatam",
            gloss: "[is] the supreme deity (nominative predicate; parama 'supreme' + daivatam 'deity')"
          }
        ]
      },
      {
        text: "गुरोः परतरं नास्ति",
        iast: "guroḥ parataraṃ nāsti",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "than the Guru (ablative)"
          },
          {
            devanagari: "परतरं",
            iast: "parataraṃ",
            gloss: "higher, greater (comparative)"
          },
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not"
          }
        ]
      },
      {
        text: "तस्मै श्रीगुरवे नमः",
        iast: "tasmai śrīgurave namaḥ",
        words: [
          {
            devanagari: "तस्मै",
            iast: "tasmai",
            gloss: "to that one (dative)"
          },
          {
            devanagari: "श्रीगुरवे",
            iast: "śrīgurave",
            gloss: "to the venerable Guru (dative)"
          },
          {
            devanagari: "नमः",
            iast: "namaḥ",
            gloss: "salutation, homage"
          }
        ]
      }
    ],
    meaning: "The Guru is the origin, and yet also without origin; the Guru is the supreme deity. There is nothing higher than the Guru — salutations to that venerable Guru!",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-78",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 78,
    speakerTag: null,
    padas: [
      {
        text: "सप्तसागरपर्यन्त",
        iast: "saptasāgaraparyanta",
        words: [
          {
            devanagari: "सप्तसागरपर्यन्त",
            iast: "saptasāgaraparyanta",
            gloss: "extending as far as the seven oceans (compound adverbial — sapta 'seven' + sāgara 'ocean' + paryanta 'up to, extending to')"
          }
        ]
      },
      {
        text: "तीर्थस्नानादिकं फलम्",
        iast: "tīrthasnānādikaṃ phalam",
        words: [
          {
            devanagari: "तीर्थस्नानादिकं",
            iast: "tīrthasnānādikaṃ",
            gloss: "[consisting of] bathing in sacred waters and the like (nominative/accusative neuter; tīrtha 'sacred waters, pilgrimage site' + snāna 'bathing' + ādikam 'and so forth')"
          },
          {
            devanagari: "फलम्",
            iast: "phalam",
            gloss: "the fruit, merit (nominative/accusative neuter, subject)"
          }
        ]
      },
      {
        text: "गुरोरङ्घ्रिपयोबिन्दुसहस्रांशे",
        iast: "guroraṅghripayobindusahasrāṃśe",
        words: [
          {
            devanagari: "गुरोरङ्घ्रिपयोबिन्दुसहस्रांशे",
            iast: "guroraṅghripayobindusahasrāṃśe",
            gloss: "in the thousandth part of a drop of water from the Guru's foot (locative compound — guroḥ 'of the Guru' + aṅghri 'foot' + payaḥ 'water' + bindu 'drop' + sahasra 'thousand' + aṃśe 'in the part')"
          }
        ]
      },
      {
        text: "न दुर्लभम्",
        iast: "na durlabham",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "दुर्लभम्",
            iast: "durlabham",
            gloss: "hard to attain, rare (nominative/accusative neuter predicate)"
          }
        ]
      }
    ],
    meaning: "The merit gained from bathing in every sacred water as far as the seven oceans is no rarity — it is easily matched by merely a thousandth part of a single drop of water from the Guru's foot.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-79",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 79,
    speakerTag: null,
    padas: [
      {
        text: "हरौ रुष्टे गुरुस्त्राता",
        iast: "harau ruṣṭe gurustrātā",
        words: [
          {
            devanagari: "हरौ",
            iast: "harau",
            gloss: "Hari, i.e. Viṣṇu (locative, in a locative-absolute construction)"
          },
          {
            devanagari: "रुष्टे",
            iast: "ruṣṭe",
            gloss: "being angered (locative absolute participle, with हरौ)"
          },
          {
            devanagari: "गुरुस्त्राता",
            iast: "gurustrātā",
            gloss: "the Guru [is] the protector (nominative, sandhi-fused — guruḥ 'the Guru' + trātā 'protector, savior')"
          }
        ]
      },
      {
        text: "गुरौ रुष्टे न कश्चन",
        iast: "gurau ruṣṭe na kaścana",
        words: [
          {
            devanagari: "गुरौ",
            iast: "gurau",
            gloss: "the Guru (locative, in a locative-absolute construction)"
          },
          {
            devanagari: "रुष्टे",
            iast: "ruṣṭe",
            gloss: "being angered (locative absolute participle)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not, no"
          },
          {
            devanagari: "कश्चन",
            iast: "kaścana",
            gloss: "anyone at all (indefinite pronoun, nominative)"
          }
        ]
      },
      {
        text: "तस्मात्सर्वप्रयत्नेन",
        iast: "tasmātsarvaprayatnena",
        words: [
          {
            devanagari: "तस्मात्सर्वप्रयत्नेन",
            iast: "tasmātsarvaprayatnena",
            gloss: "therefore, with every effort (instrumental compound — tasmāt 'therefore' + sarva 'all' + prayatnena 'with effort')"
          }
        ]
      },
      {
        text: "श्रीगुरुं शरणं व्रजेत्",
        iast: "śrīguruṃ śaraṇaṃ vrajet",
        words: [
          {
            devanagari: "श्रीगुरुं",
            iast: "śrīguruṃ",
            gloss: "to the venerable Guru (accusative)"
          },
          {
            devanagari: "शरणं",
            iast: "śaraṇaṃ",
            gloss: "refuge (accusative)"
          },
          {
            devanagari: "व्रजेत्",
            iast: "vrajet",
            gloss: "one should go, take (optative verb)"
          }
        ]
      }
    ],
    meaning: "If Hari (Viṣṇu) becomes angry, the Guru can still protect you, but if the Guru becomes angry, no one at all can save you. Therefore, with every effort, one should take refuge in the venerable Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). हरौ literally means 'Hari' = Viṣṇu; some published translations of this verse (including the SYDA/Muktananda rendering referenced here) render it contextually as 'Śiva' instead, since Śiva is the speaker of the Guru Gita. Both readings preserve the verse's point that even a great deity's anger is survivable, but the Guru's is not."
  },
  {
    id: "guru-gita-80",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 80,
    speakerTag: null,
    padas: [
      {
        text: "गुरुरेव जगत्सर्वं",
        iast: "gurureva jagatsarvaṃ",
        words: [
          {
            devanagari: "गुरुरेव",
            iast: "gurureva",
            gloss: "the Guru alone, indeed (nominative, sandhi-fused — guruḥ 'the Guru' + eva 'alone, indeed')"
          },
          {
            devanagari: "जगत्सर्वं",
            iast: "jagatsarvaṃ",
            gloss: "[is] this entire universe (nominative/accusative neuter; jagat 'world' + sarvam 'all, entire')"
          }
        ]
      },
      {
        text: "ब्रह्मविष्णुशिवात्मकम्",
        iast: "brahmaviṣṇuśivātmakam",
        words: [
          {
            devanagari: "ब्रह्मविष्णुशिवात्मकम्",
            iast: "brahmaviṣṇuśivātmakam",
            gloss: "having the nature of Brahmā, Viṣṇu, and Śiva (nominative/accusative neuter compound describing jagat — brahma-viṣṇu-śiva-ātmakam)"
          }
        ]
      },
      {
        text: "गुरोः परतरं नास्ति",
        iast: "guroḥ parataraṃ nāsti",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "than the Guru (ablative)"
          },
          {
            devanagari: "परतरं",
            iast: "parataraṃ",
            gloss: "higher, greater"
          },
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not"
          }
        ]
      },
      {
        text: "तस्मात्सम्पूजयेद्गुरुम्",
        iast: "tasmātsampūjayedgurum",
        words: [
          {
            devanagari: "तस्मात्सम्पूजयेद्गुरुम्",
            iast: "tasmātsampūjayedgurum",
            gloss: "therefore one should worship the Guru (sandhi-fused — tasmāt 'therefore' + sampūjayet 'one should worship', optative, + gurum 'the Guru', accusative)"
          }
        ]
      }
    ],
    meaning: "The Guru alone is this entire universe, which has the nature of Brahmā, Viṣṇu, and Śiva. There is nothing higher than the Guru — therefore one should worship the Guru with devotion.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-81",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 81,
    speakerTag: null,
    padas: [
      {
        text: "ज्ञानं विज्ञानसहितं",
        iast: "jñānaṃ vijñānasahitaṃ",
        words: [
          {
            devanagari: "ज्ञानं",
            iast: "jñānaṃ",
            gloss: "knowledge (nominative subject)"
          },
          {
            devanagari: "विज्ञानसहितं",
            iast: "vijñānasahitaṃ",
            gloss: "accompanied by [direct, realized] wisdom (nominative neuter adjective; vijñāna 'realized knowledge, discernment' + sahitam 'accompanied by, together with')"
          }
        ]
      },
      {
        text: "लभ्यते गुरुभक्तितः",
        iast: "labhyate gurubhaktitaḥ",
        words: [
          {
            devanagari: "लभ्यते",
            iast: "labhyate",
            gloss: "is obtained (passive verb, present tense)"
          },
          {
            devanagari: "गुरुभक्तितः",
            iast: "gurubhaktitaḥ",
            gloss: "through devotion to the Guru (ablative; guru-bhaktitaḥ 'from devotion to the Guru')"
          }
        ]
      },
      {
        text: "गुरोः परतरं नास्ति",
        iast: "guroḥ parataraṃ nāsti",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "than the Guru (ablative)"
          },
          {
            devanagari: "परतरं",
            iast: "parataraṃ",
            gloss: "higher, greater"
          },
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not"
          }
        ]
      },
      {
        text: "ध्येयोऽसौ गुरुमार्गिभिः",
        iast: "dhyeyo'sau gurumārgibhiḥ",
        words: [
          {
            devanagari: "ध्येयोऽसौ",
            iast: "dhyeyo'sau",
            gloss: "he is to be meditated upon (sandhi-fused — dhyeyaḥ 'to be meditated upon', gerundive nominative, + asau 'he, this one', nominative pronoun)"
          },
          {
            devanagari: "गुरुमार्गिभिः",
            iast: "gurumārgibhiḥ",
            gloss: "by those who follow the path of the Guru (instrumental plural; guru-mārgibhiḥ 'by Guru-path-followers')"
          }
        ]
      }
    ],
    meaning: "Knowledge together with direct realization is attained through devotion to the Guru. There is nothing higher than the Guru — he alone is to be meditated upon by those who follow the path of the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-82",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 82,
    speakerTag: null,
    padas: [
      {
        text: "यस्मात्परतरं नास्ति",
        iast: "yasmātparataraṃ nāsti",
        words: [
          {
            devanagari: "यस्मात्परतरं",
            iast: "yasmātparataraṃ",
            gloss: "than whom there is nothing higher (ablative + comparative adjective, compound: yasmāt \"than which/whom\" + parataram \"more supreme\"; the relative refers forward to gurum in the final pada)"
          },
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not (present tense verb, na + asti)"
          }
        ]
      },
      {
        text: "नेति नेतीति वै श्रुतिः",
        iast: "neti netīti vai śrutiḥ",
        words: [
          {
            devanagari: "नेति",
            iast: "neti",
            gloss: "\"not this\" (na + iti, the negative Upaniṣadic formula)"
          },
          {
            devanagari: "नेतीति",
            iast: "netīti",
            gloss: "\"not this\" — again, closed with iti marking the quotation (neti + iti, sandhi)"
          },
          {
            devanagari: "वै",
            iast: "vai",
            gloss: "indeed, verily (emphatic particle)"
          },
          {
            devanagari: "श्रुतिः",
            iast: "śrutiḥ",
            gloss: "the Śruti, the Veda (nominative, subject — \"thus says the Veda\")"
          }
        ]
      },
      {
        text: "मनसा वचसा चैव",
        iast: "manasā vacasā caiva",
        words: [
          {
            devanagari: "मनसा",
            iast: "manasā",
            gloss: "with the mind (instrumental)"
          },
          {
            devanagari: "वचसा",
            iast: "vacasā",
            gloss: "with speech (instrumental)"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed (ca + eva)"
          }
        ]
      },
      {
        text: "नित्यमाराधयेद्गुरुम्",
        iast: "nityamārādhayedgurum",
        words: [
          {
            devanagari: "नित्यमाराधयेद्गुरुम्",
            iast: "nityamārādhayedgurum",
            gloss: "one should constantly worship the Guru (nityam \"constantly\" + ārādhayet \"should worship/serve\", optative verb + gurum \"the Guru\", accusative object)"
          }
        ]
      }
    ],
    meaning: "One should constantly worship the Guru — with mind and with speech alike — than whom there is nothing higher, and of whom, indeed, the Veda declares 'not this, not this.'",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The relative pronoun yasmāt has no separate correlative in the sentence; since the main clause is nityam ārādhayed gurum, yasmāt is read here as referring to the Guru himself — identifying him with the ultimate reality of which the Veda's 'neti neti' speaks — rather than as a detached statement about an abstract 'Absolute.'"
  },
  {
    id: "guru-gita-83",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 83,
    speakerTag: null,
    padas: [
      {
        text: "गुरोः कृपा प्रसादेन",
        iast: "guroḥ kṛpā prasādena",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "of the Guru (genitive)"
          },
          {
            devanagari: "कृपा",
            iast: "kṛpā",
            gloss: "grace, favor (forms a compound sense with prasādena: \"gracious favor\")"
          },
          {
            devanagari: "प्रसादेन",
            iast: "prasādena",
            gloss: "by the gift/favor (instrumental)"
          }
        ]
      },
      {
        text: "ब्रह्मविष्णुसदाशिवाः",
        iast: "brahmaviṣṇusadāśivāḥ",
        words: [
          {
            devanagari: "ब्रह्मविष्णुसदाशिवाः",
            iast: "brahmaviṣṇusadāśivāḥ",
            gloss: "Brahmā, Viṣṇu, and Sadāśiva (nominative plural compound, subjects of the sentence)"
          }
        ]
      },
      {
        text: "समर्थाः प्रभवादौ च",
        iast: "samarthāḥ prabhavādau ca",
        words: [
          {
            devanagari: "समर्थाः",
            iast: "samarthāḥ",
            gloss: "capable, competent (nominative plural adjective, predicate)"
          },
          {
            devanagari: "प्रभवादौ",
            iast: "prabhavādau",
            gloss: "in creation and so on (locative, prabhava \"origination\" + ādi \"etc.\" — i.e. creation, sustaining, dissolution)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "केवलं गुरुसेवया",
        iast: "kevalaṃ gurusevayā",
        words: [
          {
            devanagari: "केवलं",
            iast: "kevalaṃ",
            gloss: "only, solely (adverb, modifies gurusevayā specifically)"
          },
          {
            devanagari: "गुरुसेवया",
            iast: "gurusevayā",
            gloss: "through service to the Guru (instrumental)"
          }
        ]
      }
    ],
    meaning: "By the Guru's grace and favor, Brahmā, Viṣṇu, and Sadāśiva became capable of creation and the rest — and this comes solely through service to the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-84",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 84,
    speakerTag: null,
    padas: [
      {
        text: "देवकिन्नरगन्धर्वाः",
        iast: "devakinnaragandharvāḥ",
        words: [
          {
            devanagari: "देवकिन्नरगन्धर्वाः",
            iast: "devakinnaragandharvāḥ",
            gloss: "gods, kinnaras, and gandharvas (nominative plural compound, subjects)"
          }
        ]
      },
      {
        text: "पितरो यक्षचारणाः",
        iast: "pitaro yakṣacāraṇāḥ",
        words: [
          {
            devanagari: "पितरो",
            iast: "pitaro",
            gloss: "the ancestors, manes (nominative plural, pitaraḥ by sandhi)"
          },
          {
            devanagari: "यक्षचारणाः",
            iast: "yakṣacāraṇāḥ",
            gloss: "yakṣas and cāraṇas (nominative plural compound)"
          }
        ]
      },
      {
        text: "मुनयोऽपि न जानन्ति",
        iast: "munayo'pi na jānanti",
        words: [
          {
            devanagari: "मुनयोऽपि",
            iast: "munayo'pi",
            gloss: "even the sages (nominative plural munayaḥ + api \"even\")"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "जानन्ति",
            iast: "jānanti",
            gloss: "know (present tense verb, 3rd person plural)"
          }
        ]
      },
      {
        text: "गुरुशुश्रूषणे विधिम्",
        iast: "guruśuśrūṣaṇe vidhim",
        words: [
          {
            devanagari: "गुरुशुश्रूषणे",
            iast: "guruśuśrūṣaṇe",
            gloss: "in the service/attendance upon the Guru (locative, guru + śuśrūṣaṇa)"
          },
          {
            devanagari: "विधिम्",
            iast: "vidhim",
            gloss: "the proper method, procedure (accusative, object of jānanti)"
          }
        ]
      }
    ],
    meaning: "Gods, kinnaras, and gandharvas, the ancestors, yakṣas and cāraṇas — even the sages themselves — do not know the proper way of serving the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-85",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 85,
    speakerTag: null,
    padas: [
      {
        text: "महाहङ्कारगर्वेण",
        iast: "mahāhaṅkāragarveṇa",
        words: [
          {
            devanagari: "महाहङ्कारगर्वेण",
            iast: "mahāhaṅkāragarveṇa",
            gloss: "through great egotism and pride (instrumental compound, mahā + ahaṅkāra + garva)"
          }
        ]
      },
      {
        text: "तपोविद्याबलान्विताः",
        iast: "tapovidyābalānvitāḥ",
        words: [
          {
            devanagari: "तपोविद्याबलान्विताः",
            iast: "tapovidyābalānvitāḥ",
            gloss: "endowed with the power of austerity and learning (nominative plural compound adjective, tapas + vidyā + bala + anvitāḥ)"
          }
        ]
      },
      {
        text: "संसारकुहरावर्ते",
        iast: "saṃsārakuharāvarte",
        words: [
          {
            devanagari: "संसारकुहरावर्ते",
            iast: "saṃsārakuharāvarte",
            gloss: "in the whirlpool-cave of worldly existence (locative compound, saṃsāra + kuhara + āvarta)"
          }
        ]
      },
      {
        text: "घटयन्त्रे यथा घटाः",
        iast: "ghaṭayantre yathā ghaṭāḥ",
        words: [
          {
            devanagari: "घटयन्त्रे",
            iast: "ghaṭayantre",
            gloss: "on the pot-wheel, the water-drawing apparatus of pots (locative)"
          },
          {
            devanagari: "यथा",
            iast: "yathā",
            gloss: "just as, like"
          },
          {
            devanagari: "घटाः",
            iast: "ghaṭāḥ",
            gloss: "pots (nominative plural)"
          }
        ]
      }
    ],
    meaning: "Even those endowed with the power of austerity and learning, out of great egotism and pride, keep turning in the whirlpool of worldly existence — like pots on a water-wheel.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The verse has no explicit finite verb for 'revolve/turn'; translators supply it from the simile of pots on a water-wheel (ghaṭayantra), so the exact action implied is inferred rather than stated."
  },
  {
    id: "guru-gita-86",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 86,
    speakerTag: null,
    padas: [
      {
        text: "न मुक्ता देवगन्धर्वाः",
        iast: "na muktā devagandharvāḥ",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "मुक्ता",
            iast: "muktā",
            gloss: "liberated, freed (nominative plural past participle)"
          },
          {
            devanagari: "देवगन्धर्वाः",
            iast: "devagandharvāḥ",
            gloss: "gods and gandharvas (nominative plural compound)"
          }
        ]
      },
      {
        text: "पितरो यक्षकिन्नराः",
        iast: "pitaro yakṣakinnarāḥ",
        words: [
          {
            devanagari: "पितरो",
            iast: "pitaro",
            gloss: "the ancestors (nominative plural)"
          },
          {
            devanagari: "यक्षकिन्नराः",
            iast: "yakṣakinnarāḥ",
            gloss: "yakṣas and kinnaras (nominative plural compound)"
          }
        ]
      },
      {
        text: "ऋषयः सर्वसिद्धाश्च",
        iast: "ṛṣayaḥ sarvasiddhāśca",
        words: [
          {
            devanagari: "ऋषयः",
            iast: "ṛṣayaḥ",
            gloss: "the sages (nominative plural)"
          },
          {
            devanagari: "सर्वसिद्धाश्च",
            iast: "sarvasiddhāśca",
            gloss: "and all the siddhas, perfected ones (nominative plural compound + ca)"
          }
        ]
      },
      {
        text: "गुरुसेवा पराङ्मुखाः",
        iast: "gurusevā parāṅmukhāḥ",
        words: [
          {
            devanagari: "गुरुसेवा",
            iast: "gurusevā",
            gloss: "service to the Guru (nominative, forms compound sense with the following adjective)"
          },
          {
            devanagari: "पराङ्मुखाः",
            iast: "parāṅmukhāḥ",
            gloss: "with faces turned away, averse (nominative plural adjective — i.e. those who turn away from guru-sevā)"
          }
        ]
      }
    ],
    meaning: "Gods and gandharvas, ancestors, yakṣas and kinnaras, sages, and even all the siddhas remain unliberated as long as they turn their faces away from service to the Guru.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-87",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 87,
    speakerTag: null,
    padas: [
      {
        text: "ध्यानं शृणु महादेवि",
        iast: "dhyānaṃ śṛṇu mahādevi",
        words: [
          {
            devanagari: "ध्यानं",
            iast: "dhyānaṃ",
            gloss: "meditation (accusative, object of śṛṇu)"
          },
          {
            devanagari: "शृणु",
            iast: "śṛṇu",
            gloss: "listen! (imperative verb, 2nd person singular)"
          },
          {
            devanagari: "महादेवि",
            iast: "mahādevi",
            gloss: "O great Goddess (vocative)"
          }
        ]
      },
      {
        text: "सर्वानन्दप्रदायकम्",
        iast: "sarvānandapradāyakam",
        words: [
          {
            devanagari: "सर्वानन्दप्रदायकम्",
            iast: "sarvānandapradāyakam",
            gloss: "which bestows all bliss (accusative adjective modifying dhyānam, sarva + ānanda + pradāyaka)"
          }
        ]
      },
      {
        text: "सर्वसौख्यकरं नित्यं",
        iast: "sarvasaukhyakaraṃ nityaṃ",
        words: [
          {
            devanagari: "सर्वसौख्यकरं",
            iast: "sarvasaukhyakaraṃ",
            gloss: "which produces all happiness (accusative adjective, sarva + saukhya + kara)"
          },
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternal, constant / continually (accusative adjective or adverb modifying the granting of bhukti-mukti)"
          }
        ]
      },
      {
        text: "भुक्तिमुक्तिविधायकम्",
        iast: "bhuktimuktividhāyakam",
        words: [
          {
            devanagari: "भुक्तिमुक्तिविधायकम्",
            iast: "bhuktimuktividhāyakam",
            gloss: "which grants both enjoyment and liberation (accusative adjective, bhukti + mukti + vidhāyaka)"
          }
        ]
      }
    ],
    meaning: "Listen, O great Goddess, to this meditation, which bestows all bliss, which produces every happiness, and which perpetually grants both worldly enjoyment and liberation.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-88",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 88,
    speakerTag: null,
    padas: [
      {
        text: "श्रीमत्परब्रह्म गुरुं स्मरामि",
        iast: "śrīmatparabrahma guruṃ smarāmi",
        words: [
          {
            devanagari: "श्रीमत्परब्रह्म",
            iast: "śrīmatparabrahma",
            gloss: "the glorious Supreme Brahman (accusative compound epithet of the Guru, śrīmat \"venerable\" + parabrahma)"
          },
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "स्मरामि",
            iast: "smarāmi",
            gloss: "I remember, call to mind (present tense verb, 1st person)"
          }
        ]
      },
      {
        text: "श्रीमत्परब्रह्म गुरुं वदामि",
        iast: "śrīmatparabrahma guruṃ vadāmi",
        words: [
          {
            devanagari: "श्रीमत्परब्रह्म",
            iast: "śrīmatparabrahma",
            gloss: "the glorious Supreme Brahman (accusative compound epithet)"
          },
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "वदामि",
            iast: "vadāmi",
            gloss: "I speak of, declare (present tense verb, 1st person)"
          }
        ]
      },
      {
        text: "श्रीमत्परब्रह्म गुरुं नमामि",
        iast: "śrīmatparabrahma guruṃ namāmi",
        words: [
          {
            devanagari: "श्रीमत्परब्रह्म",
            iast: "śrīmatparabrahma",
            gloss: "the glorious Supreme Brahman (accusative compound epithet)"
          },
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "नमामि",
            iast: "namāmi",
            gloss: "I bow to (present tense verb, 1st person)"
          }
        ]
      },
      {
        text: "श्रीमत्परब्रह्म गुरुं भजामि",
        iast: "śrīmatparabrahma guruṃ bhajāmi",
        words: [
          {
            devanagari: "श्रीमत्परब्रह्म",
            iast: "śrīmatparabrahma",
            gloss: "the glorious Supreme Brahman (accusative compound epithet)"
          },
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "भजामि",
            iast: "bhajāmi",
            gloss: "I worship, adore, serve (present tense verb, 1st person)"
          }
        ]
      }
    ],
    meaning: "I call to mind the Guru who is the glorious Supreme Brahman; I speak of the Guru who is the glorious Supreme Brahman; I bow to the Guru who is the glorious Supreme Brahman; I worship the Guru who is the glorious Supreme Brahman.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-89",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 89,
    speakerTag: null,
    padas: [
      {
        text: "ब्रह्मानन्दं परमसुखदं केवलं ज्ञानमूर्तिं",
        iast: "brahmānandaṃ paramasukhadaṃ kevalaṃ jñānamūrtiṃ",
        words: [
          {
            devanagari: "ब्रह्मानन्दं",
            iast: "brahmānandaṃ",
            gloss: "the bliss of Brahman (accusative epithet of the Guru, brahma + ānanda)"
          },
          {
            devanagari: "परमसुखदं",
            iast: "paramasukhadaṃ",
            gloss: "the giver of supreme happiness (accusative adjective, parama + sukha + da)"
          },
          {
            devanagari: "केवलं",
            iast: "kevalaṃ",
            gloss: "sole, absolute, alone (accusative adjective)"
          },
          {
            devanagari: "ज्ञानमूर्तिं",
            iast: "jñānamūrtiṃ",
            gloss: "the embodiment of knowledge (accusative, jñāna + mūrti)"
          }
        ]
      },
      {
        text: "द्वन्द्वातीतं गगनसदृशं तत्त्वमस्यादिलक्ष्यम्",
        iast: "dvandvātītaṃ gaganasadṛśaṃ tattvamasyādilakṣyam",
        words: [
          {
            devanagari: "द्वन्द्वातीतं",
            iast: "dvandvātītaṃ",
            gloss: "beyond the pairs of opposites (accusative adjective, dvandva + atīta)"
          },
          {
            devanagari: "गगनसदृशं",
            iast: "gaganasadṛśaṃ",
            gloss: "resembling the sky, space-like (accusative adjective, gagana + sadṛśa)"
          },
          {
            devanagari: "तत्त्वमस्यादिलक्ष्यम्",
            iast: "tattvamasyādilakṣyam",
            gloss: "the object pointed to by [teachings] beginning with 'Tat tvam asi' (accusative, tattvamasi + ādi + lakṣya)"
          }
        ]
      },
      {
        text: "एकं नित्यं विमलमचलं सर्वधीसाक्षिभूतं",
        iast: "ekaṃ nityaṃ vimalamacalaṃ sarvadhīsākṣibhūtaṃ",
        words: [
          {
            devanagari: "एकं",
            iast: "ekaṃ",
            gloss: "one, singular (accusative adjective)"
          },
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternal (accusative adjective)"
          },
          {
            devanagari: "विमलमचलं",
            iast: "vimalamacalaṃ",
            gloss: "stainless and unmoving (accusative adjective compound, vimala + acala)"
          },
          {
            devanagari: "सर्वधीसाक्षिभूतं",
            iast: "sarvadhīsākṣibhūtaṃ",
            gloss: "having become the witness of every mind/intellect (accusative adjective, sarva + dhī + sākṣi + bhūta)"
          }
        ]
      },
      {
        text: "भावातीतं त्रिगुणरहितं सद्गुरुं तं नमामि",
        iast: "bhāvātītaṃ triguṇarahitaṃ sadguruṃ taṃ namāmi",
        words: [
          {
            devanagari: "भावातीतं",
            iast: "bhāvātītaṃ",
            gloss: "beyond all states of becoming (accusative adjective, bhāva + atīta)"
          },
          {
            devanagari: "त्रिगुणरहितं",
            iast: "triguṇarahitaṃ",
            gloss: "devoid of the three guṇas (accusative adjective, tri + guṇa + rahita)"
          },
          {
            devanagari: "सद्गुरुं",
            iast: "sadguruṃ",
            gloss: "the true Guru (accusative, object)"
          },
          {
            devanagari: "तं",
            iast: "taṃ",
            gloss: "him, that (accusative demonstrative pronoun)"
          },
          {
            devanagari: "नमामि",
            iast: "namāmi",
            gloss: "I bow to (present tense verb, 1st person)"
          }
        ]
      }
    ],
    meaning: "I bow to that true Guru — the very bliss of Brahman, the giver of supreme happiness, sole and absolute, the embodiment of knowledge itself; beyond all pairs of opposites, boundless like the sky, the reality pointed to by teachings such as 'Tat tvam asi'; one, eternal, stainless, unmoving, the witness of every mind; beyond all becoming, and free of the three guṇas.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-90",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 90,
    speakerTag: null,
    padas: [
      {
        text: "नित्यं शुद्धं निराभासं",
        iast: "nityaṃ śuddhaṃ nirābhāsaṃ",
        words: [
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternal (accusative adjective)"
          },
          {
            devanagari: "शुद्धं",
            iast: "śuddhaṃ",
            gloss: "pure (accusative adjective)"
          },
          {
            devanagari: "निराभासं",
            iast: "nirābhāsaṃ",
            gloss: "without semblance, unmanifest (accusative adjective, nir + ābhāsa)"
          }
        ]
      },
      {
        text: "निराकारं निरञ्जनम्",
        iast: "nirākāraṃ nirañjanam",
        words: [
          {
            devanagari: "निराकारं",
            iast: "nirākāraṃ",
            gloss: "formless (accusative adjective, nir + ākāra)"
          },
          {
            devanagari: "निरञ्जनम्",
            iast: "nirañjanam",
            gloss: "unstained, spotless (accusative adjective, nir + añjana)"
          }
        ]
      },
      {
        text: "नित्यबोधं चिदानन्दं",
        iast: "nityabodhaṃ cidānandaṃ",
        words: [
          {
            devanagari: "नित्यबोधं",
            iast: "nityabodhaṃ",
            gloss: "of eternal awareness (accusative adjective, nitya + bodha)"
          },
          {
            devanagari: "चिदानन्दं",
            iast: "cidānandaṃ",
            gloss: "consciousness-bliss (accusative epithet, cit + ānanda)"
          }
        ]
      },
      {
        text: "गुरुं ब्रह्म नमाम्यहम्",
        iast: "guruṃ brahma namāmyaham",
        words: [
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman, the Absolute (accusative, in apposition to gurum)"
          },
          {
            devanagari: "नमाम्यहम्",
            iast: "namāmyaham",
            gloss: "I bow (namāmi \"I bow\", present tense verb + aham \"I\", sandhi-joined)"
          }
        ]
      }
    ],
    meaning: "I bow to the Guru, who is Brahman itself — eternal, pure, unmanifest, formless, spotless, of ever-awake awareness, and of the nature of consciousness and bliss.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-91",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 91,
    speakerTag: null,
    padas: [
      {
        text: "हृदम्बुजे कर्णिकमध्यसंस्थे",
        iast: "hṛdambuje karṇikamadhyasaṃsthe",
        words: [
          {
            devanagari: "हृदम्बुजे",
            iast: "hṛdambuje",
            gloss: "in the heart-lotus (locative, hṛd + ambuja)"
          },
          {
            devanagari: "कर्णिकमध्यसंस्थे",
            iast: "karṇikamadhyasaṃsthe",
            gloss: "situated in the middle of the pericarp/whorl (locative adjective, karṇika + madhya + saṃsthā)"
          }
        ]
      },
      {
        text: "सिंहासने संस्थितदिव्यमूर्तिम्",
        iast: "siṃhāsane saṃsthitadivyamūrtim",
        words: [
          {
            devanagari: "सिंहासने",
            iast: "siṃhāsane",
            gloss: "on the throne, lion-seat (locative)"
          },
          {
            devanagari: "संस्थितदिव्यमूर्तिम्",
            iast: "saṃsthitadivyamūrtim",
            gloss: "whose divine form is seated (accusative compound adjective describing the Guru, saṃsthita + divya + mūrti)"
          }
        ]
      },
      {
        text: "ध्यायेद्गुरुं चन्द्रकलाप्रकाशं",
        iast: "dhyāyedguruṃ candrakalāprakāśaṃ",
        words: [
          {
            devanagari: "ध्यायेद्गुरुं",
            iast: "dhyāyedguruṃ",
            gloss: "one should meditate on the Guru (dhyāyet \"should meditate\", optative verb + gurum \"the Guru\", accusative object, sandhi-joined)"
          },
          {
            devanagari: "चन्द्रकलाप्रकाशं",
            iast: "candrakalāprakāśaṃ",
            gloss: "shining like a digit of the moon (accusative adjective, candra + kalā + prakāśa)"
          }
        ]
      },
      {
        text: "चित्पुस्तकाभीष्टवरं दधानम्",
        iast: "citpustakābhīṣṭavaraṃ dadhānam",
        words: [
          {
            devanagari: "चित्पुस्तकाभीष्टवरं",
            iast: "citpustakābhīṣṭavaraṃ",
            gloss: "the book of knowledge and the desired boon (accusative noun-compound, cit + pustaka + abhīṣṭa + vara — the two objects held/bestowed, taken as the direct object of dadhānam)"
          },
          {
            devanagari: "दधानम्",
            iast: "dadhānam",
            gloss: "holding, bearing (accusative present participle; governs the preceding compound as its object, modifies gurum)"
          }
        ]
      }
    ],
    meaning: "One should meditate on the Guru's divine form, seated on a throne in the middle of the pericarp of the heart-lotus, shining like a crescent of the moon, holding the book of consciousness and bestowing the desired boon.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-92",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 92,
    speakerTag: null,
    padas: [
      {
        text: "श्वेताम्बरं श्वेतविलेपपुष्पं",
        iast: "śvetāmbaraṃ śvetavilepapuṣpaṃ",
        words: [
          {
            devanagari: "श्वेताम्बरं",
            iast: "śvetāmbaraṃ",
            gloss: "clad in white garments (accusative adjective, śveta 'white' + ambara 'garment', describing the Guru)"
          },
          {
            devanagari: "श्वेतविलेपपुष्पं",
            iast: "śvetavilepapuṣpaṃ",
            gloss: "anointed with white unguent and adorned with flowers (accusative compound, śveta 'white' + vilepa 'paste, unguent' + puṣpa 'flower')"
          }
        ]
      },
      {
        text: "मुक्ताविभूषं मुदितं द्विनेत्रम्",
        iast: "muktāvibhūṣaṃ muditaṃ dvinetram",
        words: [
          {
            devanagari: "मुक्ताविभूषं",
            iast: "muktāvibhūṣaṃ",
            gloss: "adorned with pearls (accusative compound, muktā 'pearl' + vibhūṣa 'ornament')"
          },
          {
            devanagari: "मुदितं",
            iast: "muditaṃ",
            gloss: "joyful, delighted (accusative adjective)"
          },
          {
            devanagari: "द्विनेत्रम्",
            iast: "dvinetram",
            gloss: "two-eyed (accusative adjective)"
          }
        ]
      },
      {
        text: "वामाङ्कपीठस्थितदिव्यशक्तिं",
        iast: "vāmāṅkapīṭhasthitadivyaśaktiṃ",
        words: [
          {
            devanagari: "वामाङ्कपीठस्थितदिव्यशक्तिं",
            iast: "vāmāṅkapīṭhasthitadivyaśaktiṃ",
            gloss: "having the divine Śakti seated on the seat of his left lap (accusative compound: vāma 'left' + aṅka 'lap, side' + pīṭha 'seat' + sthita 'seated' + divya 'divine' + śakti 'Power, Goddess')"
          }
        ]
      },
      {
        text: "मन्दस्मितं सान्द्रकृपानिधानम्",
        iast: "mandasmitaṃ sāndrakṛpānidhānam",
        words: [
          {
            devanagari: "मन्दस्मितं",
            iast: "mandasmitaṃ",
            gloss: "gently smiling (accusative compound, manda 'gentle' + smita 'smile')"
          },
          {
            devanagari: "सान्द्रकृपानिधानम्",
            iast: "sāndrakṛpānidhānam",
            gloss: "a treasury of dense, abundant compassion (accusative compound, sāndra 'dense, profuse' + kṛpā 'compassion' + nidhāna 'treasure-house')"
          }
        ]
      }
    ],
    meaning: "Clad in white garments, anointed with white unguent and flowers, adorned with pearls, joyful and two-eyed, with the divine Śakti seated at his left side, wearing a gentle smile — he is a very treasury of deep compassion.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse has no finite verb of its own; its chain of accusative epithets describing the Guru's form runs straight into the next verse's 'नमामि' (\"I bow\"), so verses 92 and 93 form one continuous sentence."
  },
  {
    id: "guru-gita-93",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 93,
    speakerTag: null,
    padas: [
      {
        text: "आनन्दमानन्दकरं प्रसन्नं",
        iast: "ānandamānandakaraṃ prasannaṃ",
        words: [
          {
            devanagari: "आनन्दमानन्दकरं",
            iast: "ānandamānandakaraṃ",
            gloss: "bliss itself and the bestower of bliss (two accusative epithets written together, ānandam 'bliss' + ānandakaram 'bliss-giving', joined only by the unchanged final -m before the following vowel)"
          },
          {
            devanagari: "प्रसन्नं",
            iast: "prasannaṃ",
            gloss: "serene, gracious (accusative adjective)"
          }
        ]
      },
      {
        text: "ज्ञानस्वरूपं निजबोधयुक्तम्",
        iast: "jñānasvarūpaṃ nijabodhayuktam",
        words: [
          {
            devanagari: "ज्ञानस्वरूपं",
            iast: "jñānasvarūpaṃ",
            gloss: "whose very essence is knowledge (accusative compound, jñāna 'knowledge' + svarūpa 'own-nature')"
          },
          {
            devanagari: "निजबोधयुक्तम्",
            iast: "nijabodhayuktam",
            gloss: "endowed with awareness of his own true Self (accusative compound, nija 'own' + bodha 'awareness' + yukta 'endowed with')"
          }
        ]
      },
      {
        text: "योगीन्द्रमीड्यं भवरोगवैद्यं",
        iast: "yogīndramīḍyaṃ bhavarogavaidyaṃ",
        words: [
          {
            devanagari: "योगीन्द्रमीड्यं",
            iast: "yogīndramīḍyaṃ",
            gloss: "the chief of yogis, worthy of praise (two independent accusative words in apposition — yogīndram 'lord/chief of yogis' + īḍyam 'praiseworthy, adorable' — joined only by the unchanged final -m of yogīndram before the following vowel ī-; not a true compound, since a genuine compound would show a+ī→e sandhi here)"
          },
          {
            devanagari: "भवरोगवैद्यं",
            iast: "bhavarogavaidyaṃ",
            gloss: "the physician for the disease of worldly existence (accusative compound, bhava 'worldly existence' + roga 'disease' + vaidya 'physician')"
          }
        ]
      },
      {
        text: "श्रीमद्गुरुं नित्यमहं नमामि",
        iast: "śrīmadguruṃ nityamahaṃ namāmi",
        words: [
          {
            devanagari: "श्रीमद्गुरुं",
            iast: "śrīmadguruṃ",
            gloss: "the glorious Guru (accusative, object of namāmi)"
          },
          {
            devanagari: "नित्यमहं",
            iast: "nityamahaṃ",
            gloss: "always, I (sandhi-joined nityam 'always' + aham 'I')"
          },
          {
            devanagari: "नमामि",
            iast: "namāmi",
            gloss: "bow, salute (1st person singular present verb)"
          }
        ]
      }
    ],
    meaning: "I always bow to the glorious Guru — bliss itself and the giver of bliss, ever serene, whose very nature is knowledge, ever aware of his own true Self, the venerable chief of yogis, the physician who heals the sickness of worldly existence.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-94",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 94,
    speakerTag: null,
    padas: [
      {
        text: "यस्मिन्सृष्टिस्थितिध्वंस",
        iast: "yasminsṛṣṭisthitidhvaṃsa",
        words: [
          {
            devanagari: "यस्मिन्सृष्टिस्थितिध्वंस",
            iast: "yasminsṛṣṭisthitidhvaṃsa",
            gloss: "in whom [there is] creation, preservation, [and] destruction (locative relative pronoun yasmin 'in whom', fused with no space to the compound sṛṣṭi-sthiti-dhvaṃsa 'creation-maintenance-destruction'; the compound continues into the next pāda)"
          }
        ]
      },
      {
        text: "निग्रहानुग्रहात्मकम्",
        iast: "nigrahānugrahātmakam",
        words: [
          {
            devanagari: "निग्रहानुग्रहात्मकम्",
            iast: "nigrahānugrahātmakam",
            gloss: "consisting of concealment and grace (nominative neuter compound, nigraha 'withholding, concealment' + anugraha 'grace' + ātmakam 'having the nature of'; completes the fivefold-act compound begun in the previous pāda, describing kṛtyam)"
          }
        ]
      },
      {
        text: "कृत्यं पञ्चविधं शश्वद्",
        iast: "kṛtyaṃ pañcavidhaṃ śaśvad",
        words: [
          {
            devanagari: "कृत्यं",
            iast: "kṛtyaṃ",
            gloss: "the act, function (nominative neuter, subject)"
          },
          {
            devanagari: "पञ्चविधं",
            iast: "pañcavidhaṃ",
            gloss: "fivefold (nominative adjective, describes kṛtyam)"
          },
          {
            devanagari: "शश्वद्",
            iast: "śaśvad",
            gloss: "eternally, perpetually (adverb; final t voices to d by sandhi before the following bhāsate)"
          }
        ]
      },
      {
        text: "भासते तं नमाम्यहम्",
        iast: "bhāsate taṃ namāmyaham",
        words: [
          {
            devanagari: "भासते",
            iast: "bhāsate",
            gloss: "shines forth, appears (3rd person singular present, ātmanepada)"
          },
          {
            devanagari: "तं",
            iast: "taṃ",
            gloss: "him (accusative pronoun, referring to the Guru)"
          },
          {
            devanagari: "नमाम्यहम्",
            iast: "namāmyaham",
            gloss: "I bow (sandhi-joined namāmi 'I bow' + aham 'I')"
          }
        ]
      }
    ],
    meaning: "I bow to him in whom eternally shines forth the fivefold act made up of creation, preservation, destruction, concealment, and grace.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The printed Devanagari runs the entire first line together with no internal spaces at all, and likewise fuses śaśvat with bhāsate in the second line; the pāda division given here follows syllable count and sense rather than any printed gap."
  },
  {
    id: "guru-gita-95",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 95,
    speakerTag: null,
    padas: [
      {
        text: "प्रातः शिरसि शुक्लाब्जे",
        iast: "prātaḥ śirasi śuklābje",
        words: [
          {
            devanagari: "प्रातः",
            iast: "prātaḥ",
            gloss: "at dawn, in the morning (adverb)"
          },
          {
            devanagari: "शिरसि",
            iast: "śirasi",
            gloss: "in the head (locative)"
          },
          {
            devanagari: "शुक्लाब्जे",
            iast: "śuklābje",
            gloss: "in the white lotus (locative compound, śukla 'white' + abja 'lotus')"
          }
        ]
      },
      {
        text: "द्विनेत्रं द्विभुजं गुरुम्",
        iast: "dvinetraṃ dvibhujaṃ gurum",
        words: [
          {
            devanagari: "द्विनेत्रं",
            iast: "dvinetraṃ",
            gloss: "two-eyed (accusative adjective, describes gurum)"
          },
          {
            devanagari: "द्विभुजं",
            iast: "dvibhujaṃ",
            gloss: "two-armed (accusative adjective)"
          },
          {
            devanagari: "गुरुम्",
            iast: "gurum",
            gloss: "the Guru (accusative, in apposition with tam, object of smaret)"
          }
        ]
      },
      {
        text: "वराभययुतं शान्तं",
        iast: "varābhayayutaṃ śāntaṃ",
        words: [
          {
            devanagari: "वराभययुतं",
            iast: "varābhayayutaṃ",
            gloss: "endowed with [the gestures of] boon-granting and fearlessness (accusative compound, vara 'boon' + abhaya 'fearlessness' + yuta 'endowed with')"
          },
          {
            devanagari: "शान्तं",
            iast: "śāntaṃ",
            gloss: "peaceful, serene (accusative adjective)"
          }
        ]
      },
      {
        text: "स्मरेत्तं नामपूर्वकम्",
        iast: "smarettaṃ nāmapūrvakam",
        words: [
          {
            devanagari: "स्मरेत्तं",
            iast: "smarettaṃ",
            gloss: "should remember him (sandhi-joined smaret 'one should remember' [optative] + tam 'him')"
          },
          {
            devanagari: "नामपूर्वकम्",
            iast: "nāmapūrvakam",
            gloss: "preceded by [his] name (accusative adverbial compound, nāma 'name' + pūrvakam 'preceded by')"
          }
        ]
      }
    ],
    meaning: "At dawn one should remember the Guru — two-eyed and two-armed, seated in the white lotus in the head, granting boons and freedom from fear, utterly peaceful — remembering him by first uttering his name.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-96",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 96,
    speakerTag: null,
    padas: [
      {
        text: "न गुरोरधिकं न गुरोरधिकं",
        iast: "na guroradhikaṃ na guroradhikaṃ",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not (negation)"
          },
          {
            devanagari: "गुरोरधिकं",
            iast: "guroradhikaṃ",
            gloss: "greater, higher than the Guru (sandhi-joined guroḥ 'than the Guru' [ablative] + adhikam 'greater' [neuter])"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not (negation, repeated for emphasis)"
          },
          {
            devanagari: "गुरोरधिकं",
            iast: "guroradhikaṃ",
            gloss: "greater, higher than the Guru (same phrase repeated)"
          }
        ]
      },
      {
        text: "न गुरोरधिकं न गुरोरधिकम्",
        iast: "na guroradhikaṃ na guroradhikam",
        words: [
          {
            devanagari: "न",
            iast: "na",
            gloss: "not (negation, repeated)"
          },
          {
            devanagari: "गुरोरधिकं",
            iast: "guroradhikaṃ",
            gloss: "greater, higher than the Guru (repeated)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not (negation, repeated)"
          },
          {
            devanagari: "गुरोरधिकम्",
            iast: "guroradhikam",
            gloss: "greater, higher than the Guru (repeated; final anusvāra written as m here, same word)"
          }
        ]
      },
      {
        text: "शिवशासनतः शिवशासनतः",
        iast: "śivaśāsanataḥ śivaśāsanataḥ",
        words: [
          {
            devanagari: "शिवशासनतः",
            iast: "śivaśāsanataḥ",
            gloss: "by the ordinance of Śiva (compound, śiva 'Śiva' + śāsanataḥ 'by the decree, command'; ablative-sense -taḥ suffix)"
          },
          {
            devanagari: "शिवशासनतः",
            iast: "śivaśāsanataḥ",
            gloss: "by the ordinance of Śiva (repeated for emphasis)"
          }
        ]
      },
      {
        text: "शिवशासनतः शिवशासनतः",
        iast: "śivaśāsanataḥ śivaśāsanataḥ",
        words: [
          {
            devanagari: "शिवशासनतः",
            iast: "śivaśāsanataḥ",
            gloss: "by the ordinance of Śiva (repeated)"
          },
          {
            devanagari: "शिवशासनतः",
            iast: "śivaśāsanataḥ",
            gloss: "by the ordinance of Śiva (repeated)"
          }
        ]
      }
    ],
    meaning: "There is nothing, nothing, nothing, nothing greater than the Guru — so it is decreed, decreed, decreed, decreed by Śiva himself.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). Unlike most verses here, this one is not in anuṣṭubh metre but a fourfold rhythmic refrain — each line is a single short phrase repeated twice — used for emphatic effect rather than narrative content."
  },
  {
    id: "guru-gita-97",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 97,
    speakerTag: null,
    padas: [
      {
        text: "इदमेव शिवं त्विदमेव शिवं",
        iast: "idameva śivaṃ tvidameva śivaṃ",
        words: [
          {
            devanagari: "इदमेव",
            iast: "idameva",
            gloss: "this indeed, this alone (idam 'this' + eva 'indeed, only')"
          },
          {
            devanagari: "शिवं",
            iast: "śivaṃ",
            gloss: "auspicious, good — [is] Śiva (accusative/nominative neuter predicate; also evokes the divine name Śiva)"
          },
          {
            devanagari: "त्विदमेव",
            iast: "tvidameva",
            gloss: "and this indeed (sandhi-joined tu 'and, but' + idam 'this' + eva 'indeed')"
          },
          {
            devanagari: "शिवं",
            iast: "śivaṃ",
            gloss: "auspicious, good — [is] Śiva (repeated)"
          }
        ]
      },
      {
        text: "त्विदमेव शिवं त्विदमेव शिवम्",
        iast: "tvidameva śivaṃ tvidameva śivam",
        words: [
          {
            devanagari: "त्विदमेव",
            iast: "tvidameva",
            gloss: "and this indeed (repeated)"
          },
          {
            devanagari: "शिवं",
            iast: "śivaṃ",
            gloss: "auspicious, good — [is] Śiva (repeated)"
          },
          {
            devanagari: "त्विदमेव",
            iast: "tvidameva",
            gloss: "and this indeed (repeated)"
          },
          {
            devanagari: "शिवम्",
            iast: "śivam",
            gloss: "auspicious, good — [is] Śiva (repeated; final anusvāra written as m here, same word)"
          }
        ]
      },
      {
        text: "मम शासनतो मम शासनतो",
        iast: "mama śāsanato mama śāsanato",
        words: [
          {
            devanagari: "मम",
            iast: "mama",
            gloss: "my, mine (genitive pronoun)"
          },
          {
            devanagari: "शासनतो",
            iast: "śāsanato",
            gloss: "by the decree, by the command (sandhi form of śāsanataḥ before a following voiced sound)"
          },
          {
            devanagari: "मम",
            iast: "mama",
            gloss: "my, mine (repeated)"
          },
          {
            devanagari: "शासनतो",
            iast: "śāsanato",
            gloss: "by the decree, by the command (repeated)"
          }
        ]
      },
      {
        text: "मम शासनतो मम शासनतः",
        iast: "mama śāsanato mama śāsanataḥ",
        words: [
          {
            devanagari: "मम",
            iast: "mama",
            gloss: "my, mine (repeated)"
          },
          {
            devanagari: "शासनतो",
            iast: "śāsanato",
            gloss: "by the decree, by the command (repeated)"
          },
          {
            devanagari: "मम",
            iast: "mama",
            gloss: "my, mine (repeated)"
          },
          {
            devanagari: "शासनतः",
            iast: "śāsanataḥ",
            gloss: "by the decree, by the command (unsandhied form, at verse end)"
          }
        ]
      }
    ],
    meaning: "This alone, this alone, this alone, this alone is the auspicious truth — so I myself have decreed, decreed, decreed, decreed it.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse mirrors verse 96's refrain but shifts from third person ('by Śiva's command') to first person ('by MY command'), since Śiva/Īśvara is the speaker throughout this text; 'śivam' plays on both the ordinary sense 'auspicious, good' and the divine name."
  },
  {
    id: "guru-gita-98",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 98,
    speakerTag: null,
    padas: [
      {
        text: "एवंविधं गुरुं ध्यात्वा",
        iast: "evaṃvidhaṃ guruṃ dhyātvā",
        words: [
          {
            devanagari: "एवंविधं",
            iast: "evaṃvidhaṃ",
            gloss: "of this kind, such (accusative adjective, evam 'thus' + vidham 'kind, sort')"
          },
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object of dhyātvā)"
          },
          {
            devanagari: "ध्यात्वा",
            iast: "dhyātvā",
            gloss: "having meditated (gerund)"
          }
        ]
      },
      {
        text: "ज्ञानमुत्पद्यते स्वयम्",
        iast: "jñānamutpadyate svayam",
        words: [
          {
            devanagari: "ज्ञानमुत्पद्यते",
            iast: "jñānamutpadyate",
            gloss: "knowledge arises (sandhi-joined jñānam 'knowledge' [nominative subject] + utpadyate 'arises' [present middle verb])"
          },
          {
            devanagari: "स्वयम्",
            iast: "svayam",
            gloss: "spontaneously, of itself (adverb)"
          }
        ]
      },
      {
        text: "तत्सद्गुरुप्रसादेन",
        iast: "tatsadguruprasādena",
        words: [
          {
            devanagari: "तत्सद्गुरुप्रसादेन",
            iast: "tatsadguruprasādena",
            gloss: "by the grace of that true Guru (instrumental compound, tat 'that' + sadguru 'true Guru' + prasādena 'by the grace')"
          }
        ]
      },
      {
        text: "मुक्तोऽहमिति भावयेत्",
        iast: "mukto'hamiti bhāvayet",
        words: [
          {
            devanagari: "मुक्तोऽहमिति",
            iast: "mukto'hamiti",
            gloss: "'I am liberated' — [thinking] thus (sandhi-joined muktaḥ 'liberated' [nominative predicate] + aham 'I' + iti 'thus, quotation marker')"
          },
          {
            devanagari: "भावयेत्",
            iast: "bhāvayet",
            gloss: "one should contemplate, should reflect (optative verb)"
          }
        ]
      }
    ],
    meaning: "Having meditated on such a Guru, knowledge arises of itself; by the grace of that true Guru, one should hold the thought, 'I am liberated.'",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-99",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 99,
    speakerTag: null,
    padas: [
      {
        text: "गुरुदर्शितमार्गेण",
        iast: "gurudarśitamārgeṇa",
        words: [
          {
            devanagari: "गुरुदर्शितमार्गेण",
            iast: "gurudarśitamārgeṇa",
            gloss: "by the path shown by the Guru (instrumental compound, guru 'Guru' + darśita 'shown, revealed' + mārgeṇa 'by the path')"
          }
        ]
      },
      {
        text: "मनःशुद्धिं तु कारयेत्",
        iast: "manaḥśuddhiṃ tu kārayet",
        words: [
          {
            devanagari: "मनःशुद्धिं",
            iast: "manaḥśuddhiṃ",
            gloss: "purity of mind (accusative object, manaḥ 'mind' + śuddhim 'purity')"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed, but (particle)"
          },
          {
            devanagari: "कारयेत्",
            iast: "kārayet",
            gloss: "one should cause, should bring about (causative optative verb)"
          }
        ]
      },
      {
        text: "अनित्यं खण्डयेत्सर्वं",
        iast: "anityaṃ khaṇḍayetsarvaṃ",
        words: [
          {
            devanagari: "अनित्यं",
            iast: "anityaṃ",
            gloss: "impermanent, transient (accusative adjective)"
          },
          {
            devanagari: "खण्डयेत्सर्वं",
            iast: "khaṇḍayetsarvaṃ",
            gloss: "should cut off entirely (sandhi-joined khaṇḍayet 'should cut off, sever' [causative optative] + sarvam 'all, entirely' [accusative])"
          }
        ]
      },
      {
        text: "यत्किञ्चिदात्मगोचरम्",
        iast: "yatkiñcidātmagocaram",
        words: [
          {
            devanagari: "यत्किञ्चिदात्मगोचरम्",
            iast: "yatkiñcidātmagocaram",
            gloss: "whatever falls within the range of the self's perception (compound, yat kiñcit 'whatever, anything' + ātmagocaram 'within the scope of the self/mind')"
          }
        ]
      }
    ],
    meaning: "By the path the Guru has shown, one should purify the mind, and cut away entirely whatever impermanent thing falls within the range of the mind's perception.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-100",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 100,
    speakerTag: null,
    padas: [
      {
        text: "ज्ञेयं सर्वस्वरूपं च",
        iast: "jñeyaṃ sarvasvarūpaṃ ca",
        words: [
          {
            devanagari: "ज्ञेयं",
            iast: "jñeyaṃ",
            gloss: "the object of knowledge, that which is to be known (nominative)"
          },
          {
            devanagari: "सर्वस्वरूपं",
            iast: "sarvasvarūpaṃ",
            gloss: "the essential nature of everything (nominative predicate compound, sarva 'all, everything' + svarūpam 'own-nature')"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (conjunction)"
          }
        ]
      },
      {
        text: "ज्ञानं च मन उच्यते",
        iast: "jñānaṃ ca mana ucyate",
        words: [
          {
            devanagari: "ज्ञानं",
            iast: "jñānaṃ",
            gloss: "knowledge (nominative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (conjunction)"
          },
          {
            devanagari: "मन",
            iast: "mana",
            gloss: "the mind (nominative, manaḥ with visarga elided by sandhi before the following vowel)"
          },
          {
            devanagari: "उच्यते",
            iast: "ucyate",
            gloss: "is called, is termed (present passive verb)"
          }
        ]
      },
      {
        text: "ज्ञानं ज्ञेयसमं कुर्यान्",
        iast: "jñānaṃ jñeyasamaṃ kuryān",
        words: [
          {
            devanagari: "ज्ञानं",
            iast: "jñānaṃ",
            gloss: "knowledge (accusative, object of kuryāt)"
          },
          {
            devanagari: "ज्ञेयसमं",
            iast: "jñeyasamaṃ",
            gloss: "equal to, identical with the object of knowledge (accusative adjective, jñeya 'the knowable' + samam 'equal to')"
          },
          {
            devanagari: "कुर्यान्",
            iast: "kuryān",
            gloss: "one should make (optative verb; sandhi form kuryān before a following n-)"
          }
        ]
      },
      {
        text: "नान्यः पन्था द्वितीयकः",
        iast: "nānyaḥ panthā dvitīyakaḥ",
        words: [
          {
            devanagari: "नान्यः",
            iast: "nānyaḥ",
            gloss: "there is no other (sandhi-joined na 'not' + anyaḥ 'other')"
          },
          {
            devanagari: "पन्था",
            iast: "panthā",
            gloss: "path (nominative, panthāḥ with elided visarga)"
          },
          {
            devanagari: "द्वितीयकः",
            iast: "dvitīyakaḥ",
            gloss: "a second one (nominative adjective, 'second, other')"
          }
        ]
      }
    ],
    meaning: "The knowable is the true nature of all things, and knowledge is what we call the mind; one should make that knowledge one with its object — there is no other, second path to liberation.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-101",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 101,
    speakerTag: null,
    padas: [
      {
        text: "एवं श्रुत्वा महादेवि",
        iast: "evaṃ śrutvā mahādevi",
        words: [
          {
            devanagari: "एवं",
            iast: "evaṃ",
            gloss: "thus, in this way (adverb)"
          },
          {
            devanagari: "श्रुत्वा",
            iast: "śrutvā",
            gloss: "having heard (gerund)"
          },
          {
            devanagari: "महादेवि",
            iast: "mahādevi",
            gloss: "O great Goddess (vocative)"
          }
        ]
      },
      {
        text: "गुरुनिन्दां करोति यः",
        iast: "gurunindāṃ karoti yaḥ",
        words: [
          {
            devanagari: "गुरुनिन्दां",
            iast: "gurunindāṃ",
            gloss: "reviling, slander of the Guru (accusative object, guru + nindām 'blame, censure')"
          },
          {
            devanagari: "करोति",
            iast: "karoti",
            gloss: "does, commits (3rd person singular present verb)"
          },
          {
            devanagari: "यः",
            iast: "yaḥ",
            gloss: "who (nominative relative pronoun)"
          }
        ]
      },
      {
        text: "स याति नरकं घोरं",
        iast: "sa yāti narakaṃ ghoraṃ",
        words: [
          {
            devanagari: "स",
            iast: "sa",
            gloss: "he (nominative pronoun)"
          },
          {
            devanagari: "याति",
            iast: "yāti",
            gloss: "goes (3rd person singular present verb)"
          },
          {
            devanagari: "नरकं",
            iast: "narakaṃ",
            gloss: "to hell (accusative)"
          },
          {
            devanagari: "घोरं",
            iast: "ghoraṃ",
            gloss: "terrible, dreadful (accusative adjective)"
          }
        ]
      },
      {
        text: "यावच्चन्द्रदिवाकरौ",
        iast: "yāvaccandradivākarau",
        words: [
          {
            devanagari: "यावच्चन्द्रदिवाकरौ",
            iast: "yāvaccandradivākarau",
            gloss: "for as long as the moon and sun [endure] (sandhi-joined yāvat 'as long as' + candra 'moon' + divākarau 'the two suns', dual dvandva compound meaning 'sun and moon')"
          }
        ]
      }
    ],
    meaning: "Having heard all this, O Great Goddess, whoever reviles the Guru goes to a dreadful hell, and remains there for as long as the sun and moon endure.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-102",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 102,
    speakerTag: null,
    padas: [
      {
        text: "यावत्कल्पान्तको देहः",
        iast: "yāvatkalpāntako dehaḥ",
        words: [
          {
            devanagari: "यावत्कल्पान्तको",
            iast: "yāvatkalpāntako",
            gloss: "as long as [it] has its end at the dissolution of a kalpa (यावत् 'as long as' + कल्पान्तकः 'having the end of an age/kalpa as its terminus', nominative, describing देहः)"
          },
          {
            devanagari: "देहः",
            iast: "dehaḥ",
            gloss: "the body (nominative, subject; restored here from the sandhi-fused form देहस्, since the printed line glues it to the next pāda's तावदेव)"
          }
        ]
      },
      {
        text: "तावदेव गुरुं स्मरेत्",
        iast: "tāvadeva guruṃ smaret",
        words: [
          {
            devanagari: "तावदेव",
            iast: "tāvadeva",
            gloss: "for exactly that long, that very long (तावत् 'so long' + एव emphatic 'indeed')"
          },
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "स्मरेत्",
            iast: "smaret",
            gloss: "one should remember, keep in mind (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "गुरुलोपो न कर्तव्यः",
        iast: "gurulopo na kartavyaḥ",
        words: [
          {
            devanagari: "गुरुलोपो",
            iast: "gurulopo",
            gloss: "neglect/abandonment of the Guru (nominative subject; sandhi form of गुरुलोपः before न)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "कर्तव्यः",
            iast: "kartavyaḥ",
            gloss: "is to be done (gerundive, nominative masculine singular, agreeing with गुरुलोपः)"
          }
        ]
      },
      {
        text: "स्वच्छन्दो यदि वा भवेत्",
        iast: "svacchando yadi vā bhavet",
        words: [
          {
            devanagari: "स्वच्छन्दो",
            iast: "svacchando",
            gloss: "a sense of independence, acting by one's own will (nominative; sandhi form of स्वच्छन्दः before यदि)"
          },
          {
            devanagari: "यदि",
            iast: "yadi",
            gloss: "if"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "should arise, should come about (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "One should keep the Guru in mind for as long as the body lasts — right up to the dissolution of the world-age. Neglect of the Guru should never be done, even should a sense of complete independence arise.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The printed line fuses देहस्तावदेव across the pāda boundary; it is restored here as देहः + तावदेव so each pāda's text is grammatically intact. Translators also differ on स्वच्छन्दः: some take it as the disciple's own sense of free will/independence, others as the Guru's dismissal of the disciple — the verse itself does not disambiguate which is meant."
  },
  {
    id: "guru-gita-103",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 103,
    speakerTag: null,
    padas: [
      {
        text: "हुङ्कारेण न वक्तव्यं",
        iast: "huṅkāreṇa na vaktavyaṃ",
        words: [
          {
            devanagari: "हुङ्कारेण",
            iast: "huṅkāreṇa",
            gloss: "with a scornful grunt/exclamation of contempt (instrumental; हुंकार, a dismissive 'hum' sound)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "वक्तव्यं",
            iast: "vaktavyaṃ",
            gloss: "is to be spoken (gerundive, neuter, impersonal 'one should not speak')"
          }
        ]
      },
      {
        text: "प्राज्ञैः शिष्यैः कथञ्चन",
        iast: "prājñaiḥ śiṣyaiḥ kathañcana",
        words: [
          {
            devanagari: "प्राज्ञैः",
            iast: "prājñaiḥ",
            gloss: "by the wise, by the discerning (instrumental plural)"
          },
          {
            devanagari: "शिष्यैः",
            iast: "śiṣyaiḥ",
            gloss: "by disciples (instrumental plural)"
          },
          {
            devanagari: "कथञ्चन",
            iast: "kathañcana",
            gloss: "in any way whatsoever, on any account"
          }
        ]
      },
      {
        text: "गुरोरग्रे न वक्तव्यम्",
        iast: "guroragre na vaktavyam",
        words: [
          {
            devanagari: "गुरोरग्रे",
            iast: "guroragre",
            gloss: "in front of the Guru (गुरोः 'of the Guru' genitive + अग्रे 'before, in front of')"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "वक्तव्यम्",
            iast: "vaktavyam",
            gloss: "is to be spoken (gerundive, neuter; restored from the sandhi-fused form वक्तव्यम् before असत्यं)"
          }
        ]
      },
      {
        text: "असत्यं च कदाचन",
        iast: "asatyaṃ ca kadācana",
        words: [
          {
            devanagari: "असत्यं",
            iast: "asatyaṃ",
            gloss: "an untruth, a lie (accusative neuter; restored initial अ, elided in the printed sandhi-fusion वक्तव्यमसत्यं)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "कदाचन",
            iast: "kadācana",
            gloss: "ever, at any time"
          }
        ]
      }
    ],
    meaning: "Discerning disciples should never speak with a scornful grunt of contempt, on any account. Nor should an untruth ever be spoken in the Guru's presence.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The printed text fuses वक्तव्यमसत्यं across the pāda boundary (the sandhi elides असत्यं's initial अ); it is restored here as वक्तव्यम् + असत्यं so each pāda stands as a complete 8-syllable, grammatically intact unit."
  },
  {
    id: "guru-gita-104",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 104,
    speakerTag: null,
    padas: [
      {
        text: "गुरुं त्वंकृत्य हुंकृत्य",
        iast: "guruṃ tvaṃkṛtya huṃkṛtya",
        words: [
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object)"
          },
          {
            devanagari: "त्वंकृत्य",
            iast: "tvaṃkṛtya",
            gloss: "having addressed [him] with the disrespectful 'you' (त्वं 'you', familiar/contemptuous form + कृत्य gerund 'having made/done')"
          },
          {
            devanagari: "हुंकृत्य",
            iast: "huṃkṛtya",
            gloss: "having made a scornful 'hum' sound at [him] (हुं contemptuous exclamation + कृत्य gerund)"
          }
        ]
      },
      {
        text: "गुरुं निर्जित्य वादतः",
        iast: "guruṃ nirjitya vādataḥ",
        words: [
          {
            devanagari: "गुरुं",
            iast: "guruṃ",
            gloss: "the Guru (accusative, object, repeated)"
          },
          {
            devanagari: "निर्जित्य",
            iast: "nirjitya",
            gloss: "having tried to defeat/overcome (gerund, from निर्+जि 'to conquer')"
          },
          {
            devanagari: "वादतः",
            iast: "vādataḥ",
            gloss: "while disputing, in argument (adverbial form, 'in the course of debate')"
          }
        ]
      },
      {
        text: "अरण्ये निर्जले देशे",
        iast: "araṇye nirjale deśe",
        words: [
          {
            devanagari: "अरण्ये",
            iast: "araṇye",
            gloss: "in a forest (locative)"
          },
          {
            devanagari: "निर्जले",
            iast: "nirjale",
            gloss: "waterless (locative adjective, describing देशे)"
          },
          {
            devanagari: "देशे",
            iast: "deśe",
            gloss: "in a region, place (locative)"
          }
        ]
      },
      {
        text: "स भवेद्ब्रह्मराक्षसः",
        iast: "sa bhavedbrahmarākṣasaḥ",
        words: [
          {
            devanagari: "स",
            iast: "sa",
            gloss: "he (nominative pronoun, subject)"
          },
          {
            devanagari: "भवेद्ब्रह्मराक्षसः",
            iast: "bhavedbrahmarākṣasaḥ",
            gloss: "would become a brahma-rākṣasa, a malevolent spirit born of misused sacred learning (optative verb भवेत् + predicate compound ब्रह्मराक्षसः, sandhi-fused; nominative predicate)"
          }
        ]
      }
    ],
    meaning: "One who addresses the Guru with the contemptuous 'you', makes scornful sounds at him, or tries to out-argue and defeat him in debate — such a person becomes a brahma-rākṣasa, dwelling in a waterless forest region.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-105",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 105,
    speakerTag: null,
    padas: [
      {
        text: "मुनिभिः पन्नगैर्वाऽपि",
        iast: "munibhiḥ pannagairvā'pi",
        words: [
          {
            devanagari: "मुनिभिः",
            iast: "munibhiḥ",
            gloss: "by sages, by munis (instrumental plural)"
          },
          {
            devanagari: "पन्नगैर्वाऽपि",
            iast: "pannagairvā'pi",
            gloss: "or even by serpents/nāgas (पन्नगैः instrumental plural + वा 'or' + अपि 'even', sandhi-fused, avagraha marking the elided अ)"
          }
        ]
      },
      {
        text: "सुरैर्वा शापितो यदि",
        iast: "surairvā śāpito yadi",
        words: [
          {
            devanagari: "सुरैर्वा",
            iast: "surairvā",
            gloss: "or by gods, by devas (सुरैः instrumental plural + वा 'or')"
          },
          {
            devanagari: "शापितो",
            iast: "śāpito",
            gloss: "cursed (past passive participle, nominative masculine singular; sandhi form of शापितः before यदि)"
          },
          {
            devanagari: "यदि",
            iast: "yadi",
            gloss: "if"
          }
        ]
      },
      {
        text: "कालमृत्युभयाद्वापि",
        iast: "kālamṛtyubhayādvāpi",
        words: [
          {
            devanagari: "कालमृत्युभयाद्वापि",
            iast: "kālamṛtyubhayādvāpi",
            gloss: "or even from fear of time [fate] and death (काल 'time' + मृत्यु 'death' + भयात् 'from fear of' ablative + वा 'or' + अपि 'even', all sandhi-fused)"
          }
        ]
      },
      {
        text: "गुरू रक्षति पार्वति",
        iast: "gurū rakṣati pārvati",
        words: [
          {
            devanagari: "गुरू",
            iast: "gurū",
            gloss: "the Guru (nominative subject; printed with a long ū where the expected nominative form is गुरुः)"
          },
          {
            devanagari: "रक्षति",
            iast: "rakṣati",
            gloss: "protects (present tense verb, 3rd person singular)"
          },
          {
            devanagari: "पार्वति",
            iast: "pārvati",
            gloss: "O Pārvatī (vocative)"
          }
        ]
      }
    ],
    meaning: "O Pārvatī, if one is cursed by sages, by serpents, or even by gods — or even threatened by fear of fate and death — the Guru protects that person.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). गुरू appears in place of the expected nominative गुरुः (visarga dropped, उ lengthened to ऊ). This is most plausibly a textual/metrical variant rather than a distinct grammatical form — both readings scan identically as a heavy syllable, and गुरू is understood here as the subject ('the Guru') of रक्षति."
  },
  {
    id: "guru-gita-106",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 106,
    speakerTag: null,
    padas: [
      {
        text: "अशक्ता हि सुराद्याश्च",
        iast: "aśaktā hi surādyāśca",
        words: [
          {
            devanagari: "अशक्ता",
            iast: "aśaktā",
            gloss: "powerless, unable (nominative plural, describing सुराद्याः)"
          },
          {
            devanagari: "हि",
            iast: "hi",
            gloss: "indeed, verily"
          },
          {
            devanagari: "सुराद्याश्च",
            iast: "surādyāśca",
            gloss: "and the gods and others (सुर-आद्याः 'gods, etc.' nominative plural + च 'and', sandhi-fused)"
          }
        ]
      },
      {
        text: "अशक्ता मुनयस्तथा",
        iast: "aśaktā munayastathā",
        words: [
          {
            devanagari: "अशक्ता",
            iast: "aśaktā",
            gloss: "powerless, unable (nominative plural, describing मुनयः)"
          },
          {
            devanagari: "मुनयस्तथा",
            iast: "munayastathā",
            gloss: "and likewise the sages (मुनयः 'sages' nominative plural + तथा 'likewise', sandhi-fused)"
          }
        ]
      },
      {
        text: "गुरुशापेन ते शीघ्रं",
        iast: "guruśāpena te śīghraṃ",
        words: [
          {
            devanagari: "गुरुशापेन",
            iast: "guruśāpena",
            gloss: "by the curse of the Guru (instrumental compound)"
          },
          {
            devanagari: "ते",
            iast: "te",
            gloss: "they (nominative plural, subject — referring to the one cursed, not to the gods/sages just mentioned)"
          },
          {
            devanagari: "शीघ्रं",
            iast: "śīghraṃ",
            gloss: "quickly, swiftly"
          }
        ]
      },
      {
        text: "क्षयं यान्ति न संशयः",
        iast: "kṣayaṃ yānti na saṃśayaḥ",
        words: [
          {
            devanagari: "क्षयं",
            iast: "kṣayaṃ",
            gloss: "destruction, ruin (accusative)"
          },
          {
            devanagari: "यान्ति",
            iast: "yānti",
            gloss: "go to, attain (present tense verb, 3rd person plural)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative; न संशयः, 'there is no doubt')"
          }
        ]
      }
    ],
    meaning: "Indeed, the gods and other celestial beings are powerless [to help], and so likewise are the sages — one cursed by the Guru swiftly comes to ruin through that very curse; of this there is no doubt.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-107",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 107,
    speakerTag: null,
    padas: [
      {
        text: "मन्त्रराजमिदं देवि",
        iast: "mantrarājamidaṃ devi",
        words: [
          {
            devanagari: "मन्त्रराजमिदं",
            iast: "mantrarājamidaṃ",
            gloss: "this is the king of mantras (मन्त्रराजम् 'king of mantras' nominative predicate + इदं 'this', sandhi-fused)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "गुरुरित्यक्षरद्वयम्",
        iast: "gururityakṣaradvayam",
        words: [
          {
            devanagari: "गुरुरित्यक्षरद्वयम्",
            iast: "gururityakṣaradvayam",
            gloss: "the pair of syllables [that make up the word] 'Guru' (गुरुः 'Guru' + इति 'thus, [called]' + अक्षर-द्वयम् 'the two syllables', in apposition to मन्त्रराजम्, all sandhi-fused)"
          }
        ]
      },
      {
        text: "स्मृतिवेदार्थवाक्येन",
        iast: "smṛtivedārthavākyena",
        words: [
          {
            devanagari: "स्मृतिवेदार्थवाक्येन",
            iast: "smṛtivedārthavākyena",
            gloss: "by the statement of the meaning of the Smṛtis and Vedas (compound in the instrumental: स्मृति 'Smṛti' + वेद 'Veda' + अर्थ 'meaning' + वाक्येन 'by the statement')"
          }
        ]
      },
      {
        text: "गुरुः साक्षात्परं पदम्",
        iast: "guruḥ sākṣātparaṃ padam",
        words: [
          {
            devanagari: "गुरुः",
            iast: "guruḥ",
            gloss: "the Guru (nominative subject)"
          },
          {
            devanagari: "साक्षात्परं",
            iast: "sākṣātparaṃ",
            gloss: "verily/directly the supreme (साक्षात् 'directly, in person' + परं 'supreme', describing पदम्)"
          },
          {
            devanagari: "पदम्",
            iast: "padam",
            gloss: "state, station (nominative predicate, 'the supreme state')"
          }
        ]
      }
    ],
    meaning: "O Goddess, this — the two syllables 'gu' and 'ru' — is the king of all mantras. By the testimony of the Smṛtis and the sense of the Vedas, the Guru is, in truth, the supreme state itself.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-108",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 108,
    speakerTag: null,
    padas: [
      {
        text: "श्रुतिस्मृती अविज्ञाय",
        iast: "śrutismṛtī avijñāya",
        words: [
          {
            devanagari: "श्रुतिस्मृती",
            iast: "śrutismṛtī",
            gloss: "the Śruti and the Smṛti [scriptures] (accusative dual, object of अविज्ञाय)"
          },
          {
            devanagari: "अविज्ञाय",
            iast: "avijñāya",
            gloss: "without knowing, not having understood (negative gerund)"
          }
        ]
      },
      {
        text: "केवलं गुरुसेवकाः",
        iast: "kevalaṃ gurusevakāḥ",
        words: [
          {
            devanagari: "केवलं",
            iast: "kevalaṃ",
            gloss: "only, merely"
          },
          {
            devanagari: "गुरुसेवकाः",
            iast: "gurusevakāḥ",
            gloss: "servants of the Guru (nominative plural; the subject of the sentence, resumed by ते in the next pāda)"
          }
        ]
      },
      {
        text: "ते वै संन्यासिनः प्रोक्ता",
        iast: "te vai saṃnyāsinaḥ proktā",
        words: [
          {
            devanagari: "ते",
            iast: "te",
            gloss: "they (nominative plural, subject)"
          },
          {
            devanagari: "वै",
            iast: "vai",
            gloss: "indeed, truly (emphatic particle)"
          },
          {
            devanagari: "संन्यासिनः",
            iast: "saṃnyāsinaḥ",
            gloss: "renunciates, sannyāsins (nominative plural, predicate)"
          },
          {
            devanagari: "प्रोक्ता",
            iast: "proktā",
            gloss: "are declared, are called (past participle, nominative plural)"
          }
        ]
      },
      {
        text: "इतरे वेषधारिणः",
        iast: "itare veṣadhāriṇaḥ",
        words: [
          {
            devanagari: "इतरे",
            iast: "itare",
            gloss: "the others (nominative plural)"
          },
          {
            devanagari: "वेषधारिणः",
            iast: "veṣadhāriṇaḥ",
            gloss: "mere wearers of the [ascetic's] garb (वेष 'costume, garb' + धारिणः 'bearers of', nominative plural)"
          }
        ]
      }
    ],
    meaning: "Even without knowing the Śruti and the Smṛti, those who are merely servants of the Guru are indeed truly called renunciates; all others are merely wearers of the ascetic's garb.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-109",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 109,
    speakerTag: null,
    padas: [
      {
        text: "नित्यं ब्रह्म निराकारं",
        iast: "nityaṃ brahma nirākāraṃ",
        words: [
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternal (accusative neuter, describing ब्रह्म)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman, the Absolute (accusative neuter, object of बोधयेत्)"
          },
          {
            devanagari: "निराकारं",
            iast: "nirākāraṃ",
            gloss: "formless (accusative neuter adjective)"
          }
        ]
      },
      {
        text: "निर्गुणं बोधयेत् परम्",
        iast: "nirguṇaṃ bodhayet param",
        words: [
          {
            devanagari: "निर्गुणं",
            iast: "nirguṇaṃ",
            gloss: "without qualities/attributes (accusative neuter adjective)"
          },
          {
            devanagari: "बोधयेत्",
            iast: "bodhayet",
            gloss: "should cause to know, should awaken understanding of (causative optative verb, 3rd person singular)"
          },
          {
            devanagari: "परम्",
            iast: "param",
            gloss: "the Supreme (accusative neuter, in apposition to ब्रह्म)"
          }
        ]
      },
      {
        text: "सर्वं ब्रह्म निराभासं",
        iast: "sarvaṃ brahma nirābhāsaṃ",
        words: [
          {
            devanagari: "सर्वं",
            iast: "sarvaṃ",
            gloss: "all, everything (nominative/accusative neuter — 'all is Brahman')"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman (nominative predicate)"
          },
          {
            devanagari: "निराभासं",
            iast: "nirābhāsaṃ",
            gloss: "without [distinguishing] appearance, undifferentiated (nominative/accusative neuter adjective)"
          }
        ]
      },
      {
        text: "दीपो दीपान्तरं यथा",
        iast: "dīpo dīpāntaraṃ yathā",
        words: [
          {
            devanagari: "दीपो",
            iast: "dīpo",
            gloss: "a lamp (nominative; sandhi form of दीपः before दीपान्तरं)"
          },
          {
            devanagari: "दीपान्तरं",
            iast: "dīpāntaraṃ",
            gloss: "another lamp (accusative)"
          },
          {
            devanagari: "यथा",
            iast: "yathā",
            gloss: "just as, in the way that"
          }
        ]
      }
    ],
    meaning: "The Guru awakens the disciple to the eternal, formless, attributeless, supreme Brahman — to the truth that all is Brahman, without distinguishing appearance — just as one lamp kindles another lamp.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-110",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 110,
    speakerTag: null,
    padas: [
      {
        text: "गुरोः कृपाप्रसादेन",
        iast: "guroḥ kṛpāprasādena",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "of the Guru (genitive)"
          },
          {
            devanagari: "कृपाप्रसादेन",
            iast: "kṛpāprasādena",
            gloss: "through the grace and favor (कृपा 'compassion, grace' + प्रसादेन 'through the favor/blessing', instrumental compound)"
          }
        ]
      },
      {
        text: "आत्मारामं निरीक्षयेत्",
        iast: "ātmārāmaṃ nirīkṣayet",
        words: [
          {
            devanagari: "आत्मारामं",
            iast: "ātmārāmaṃ",
            gloss: "the Self that delights within itself (accusative — आत्म + आराम 'one who rejoices [in the Self]', an epithet of the ātman)"
          },
          {
            devanagari: "निरीक्षयेत्",
            iast: "nirīkṣayet",
            gloss: "one should behold, perceive (causative optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "अनेन गुरुमार्गेण",
        iast: "anena gurumārgeṇa",
        words: [
          {
            devanagari: "अनेन",
            iast: "anena",
            gloss: "by this (instrumental demonstrative pronoun)"
          },
          {
            devanagari: "गुरुमार्गेण",
            iast: "gurumārgeṇa",
            gloss: "by the path of the Guru (instrumental compound)"
          }
        ]
      },
      {
        text: "स्वात्मज्ञानं प्रवर्तते",
        iast: "svātmajñānaṃ pravartate",
        words: [
          {
            devanagari: "स्वात्मज्ञानं",
            iast: "svātmajñānaṃ",
            gloss: "knowledge of one's own Self (nominative/accusative compound — स्व-आत्म-ज्ञानम्)"
          },
          {
            devanagari: "प्रवर्तते",
            iast: "pravartate",
            gloss: "arises, comes forth (present tense verb, 3rd person singular, middle voice)"
          }
        ]
      }
    ],
    meaning: "By the Guru's grace and favor, one should behold the Self that rejoices within itself. Through this path shown by the Guru, knowledge of one's own Self arises.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-111",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 111,
    speakerTag: null,
    padas: [
      {
        text: "आब्रह्म स्तंबपर्यन्तं",
        iast: "ābrahma staṃbaparyantaṃ",
        words: [
          {
            devanagari: "आब्रह्म",
            iast: "ābrahma",
            gloss: "up to, as far as Brahmā (आ...पर्यन्तं forms an 'from...to...' bracketing construction; आ here marks the upper bound)"
          },
          {
            devanagari: "स्तंबपर्यन्तं",
            iast: "staṃbaparyantaṃ",
            gloss: "down to a mere clump of grass (स्तंब 'tuft/clump of grass' + पर्यन्तं 'ending at, up to', accusative, completing the आ...पर्यन्तं construction)"
          }
        ]
      },
      {
        text: "परमात्मस्वरूपकम्",
        iast: "paramātmasvarūpakam",
        words: [
          {
            devanagari: "परमात्मस्वरूपकम्",
            iast: "paramātmasvarūpakam",
            gloss: "whose true nature is the Supreme Self (accusative compound — परम-आत्म-स्वरूपकम्, describing the object of प्रणमामि)"
          }
        ]
      },
      {
        text: "स्थावरं जङ्गमं चैव",
        iast: "sthāvaraṃ jaṅgamaṃ caiva",
        words: [
          {
            devanagari: "स्थावरं",
            iast: "sthāvaraṃ",
            gloss: "the unmoving, stationary [beings] (accusative neuter)"
          },
          {
            devanagari: "जङ्गमं",
            iast: "jaṅgamaṃ",
            gloss: "the moving [beings] (accusative neuter)"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed, and also (च + एव, sandhi-fused)"
          }
        ]
      },
      {
        text: "प्रणमामि जगन्मयम्",
        iast: "praṇamāmi jaganmayam",
        words: [
          {
            devanagari: "प्रणमामि",
            iast: "praṇamāmi",
            gloss: "I bow down, I pay homage (present tense verb, 1st person singular)"
          },
          {
            devanagari: "जगन्मयम्",
            iast: "jaganmayam",
            gloss: "who consists of/pervades the universe (accusative — जगत्+मयम्, 'made of the world')"
          }
        ]
      }
    ],
    meaning: "I bow to that whose true nature is the Supreme Self, pervading the entire universe — from Brahmā down to a mere clump of grass, encompassing all beings both moving and unmoving.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-112",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 112,
    speakerTag: null,
    padas: [
      {
        text: "वन्देऽहं सच्चिदानन्दं",
        iast: "vande'haṃ saccidānandaṃ",
        words: [
          {
            devanagari: "वन्देऽहं",
            iast: "vande'haṃ",
            gloss: "I bow / salute (vande, 1st person present verb + aham 'I', sandhi-joined)"
          },
          {
            devanagari: "सच्चिदानन्दं",
            iast: "saccidānandaṃ",
            gloss: "the one who is Being-Consciousness-Bliss (accusative adjective, epithet of the Guru — sat + cit + ānanda)"
          }
        ]
      },
      {
        text: "भेदातीतं सदा गुरुम्",
        iast: "bhedātītaṃ sadā gurum",
        words: [
          {
            devanagari: "भेदातीतं",
            iast: "bhedātītaṃ",
            gloss: "beyond all distinctions/differences (accusative adjective, describes guru)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always, constantly (adverb)"
          },
          {
            devanagari: "गुरुम्",
            iast: "gurum",
            gloss: "the Guru (accusative, object of vande)"
          }
        ]
      },
      {
        text: "नित्यं पूर्णं निराकारं",
        iast: "nityaṃ pūrṇaṃ nirākāraṃ",
        words: [
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "eternal, everlasting (accusative adjective)"
          },
          {
            devanagari: "पूर्णं",
            iast: "pūrṇaṃ",
            gloss: "complete, whole (accusative adjective)"
          },
          {
            devanagari: "निराकारं",
            iast: "nirākāraṃ",
            gloss: "formless, without shape (accusative adjective)"
          }
        ]
      },
      {
        text: "निर्गुणं स्वात्मसंस्थितम्",
        iast: "nirguṇaṃ svātmasaṃsthitam",
        words: [
          {
            devanagari: "निर्गुणं",
            iast: "nirguṇaṃ",
            gloss: "without qualities/attributes (accusative adjective)"
          },
          {
            devanagari: "स्वात्मसंस्थितम्",
            iast: "svātmasaṃsthitam",
            gloss: "established/abiding in his own Self (accusative adjective compound)"
          }
        ]
      }
    ],
    meaning: "I always bow to the Guru who is Being-Consciousness-Bliss, who transcends all distinctions, who is eternal, complete, formless, without attributes, and established in his own Self.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-113",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 113,
    speakerTag: null,
    padas: [
      {
        text: "परात्परतरं ध्येयं",
        iast: "parātparataraṃ dhyeyaṃ",
        words: [
          {
            devanagari: "परात्परतरं",
            iast: "parātparataraṃ",
            gloss: "higher than the highest, beyond the very beyond (accusative adjective, continues describing the Guru)"
          },
          {
            devanagari: "ध्येयं",
            iast: "dhyeyaṃ",
            gloss: "to be meditated upon, the object of meditation (accusative gerundive)"
          }
        ]
      },
      {
        text: "नित्यमानन्दकारकम्",
        iast: "nityamānandakārakam",
        words: [
          {
            devanagari: "नित्यमानन्दकारकम्",
            iast: "nityamānandakārakam",
            gloss: "the eternal bestower/cause of bliss (accusative compound: nitya + ānanda + kāraka)"
          }
        ]
      },
      {
        text: "हृदयाकाशमध्यस्थं",
        iast: "hṛdayākāśamadhyasthaṃ",
        words: [
          {
            devanagari: "हृदयाकाशमध्यस्थं",
            iast: "hṛdayākāśamadhyasthaṃ",
            gloss: "situated in the midst of the space/ether of the heart (accusative compound)"
          }
        ]
      },
      {
        text: "शुद्धस्फटिकसन्निभम्",
        iast: "śuddhasphaṭikasannibham",
        words: [
          {
            devanagari: "शुद्धस्फटिकसन्निभम्",
            iast: "śuddhasphaṭikasannibham",
            gloss: "resembling pure, clear crystal (accusative compound adjective)"
          }
        ]
      }
    ],
    meaning: "He is beyond the very beyond, the object of meditation, the eternal source of bliss, dwelling in the midst of the space of the heart, resembling a clear, pure crystal.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-114",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 114,
    speakerTag: null,
    padas: [
      {
        text: "स्फटिकप्रतिमारूपं",
        iast: "sphaṭikapratimārūpaṃ",
        words: [
          {
            devanagari: "स्फटिकप्रतिमारूपं",
            iast: "sphaṭikapratimārūpaṃ",
            gloss: "the form of a reflected image of crystal (nominative subject compound: sphaṭika + pratimā + rūpa)"
          }
        ]
      },
      {
        text: "दृश्यते दर्पणे यथा",
        iast: "dṛśyate darpaṇe yathā",
        words: [
          {
            devanagari: "दृश्यते",
            iast: "dṛśyate",
            gloss: "is seen, appears (passive present verb)"
          },
          {
            devanagari: "दर्पणे",
            iast: "darpaṇe",
            gloss: "in a mirror (locative)"
          },
          {
            devanagari: "यथा",
            iast: "yathā",
            gloss: "just as, in the way that (comparative particle)"
          }
        ]
      },
      {
        text: "तथात्मनि चिदाकारमानन्दं",
        iast: "tathātmani cidākāramānandaṃ",
        words: [
          {
            devanagari: "तथात्मनि",
            iast: "tathātmani",
            gloss: "so too, in the Self (locative; tathā 'likewise' + ātmani 'in the self')"
          },
          {
            devanagari: "चिदाकारमानन्दं",
            iast: "cidākāramānandaṃ",
            gloss: "the form of consciousness, [and] bliss (accusative; cidākāram + ānandam, two predicate terms joined by sandhi in the printed text)"
          }
        ]
      },
      {
        text: "सोऽहमित्युत",
        iast: "so'hamityuta",
        words: [
          {
            devanagari: "सोऽहमित्युत",
            iast: "so'hamityuta",
            gloss: "'That I am' — indeed, thus (saḥ + aham + iti + uta, sandhi-joined; the realization of identity with the Absolute)"
          }
        ]
      }
    ],
    meaning: "Just as the reflected image of a crystal appears in a mirror, so too, within the Self, there shines the form of consciousness and bliss — the realization 'I am That,' indeed.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The printed text runs चिदाकारम् and आनन्दं together by sandhi (and likewise सः, अहम्, इति, उत), so this line's word-boundary does not fall at a clean 8-syllable midpoint; the pāda break here follows sense rather than an even syllable split."
  },
  {
    id: "guru-gita-115",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 115,
    speakerTag: null,
    padas: [
      {
        text: "अङ्गुष्ठमात्रपुरुषं",
        iast: "aṅguṣṭhamātrapuruṣaṃ",
        words: [
          {
            devanagari: "अङ्गुष्ठमात्रपुरुषं",
            iast: "aṅguṣṭhamātrapuruṣaṃ",
            gloss: "the Person the size of a thumb (accusative compound: aṅguṣṭha + mātra + puruṣa, object of meditation)"
          }
        ]
      },
      {
        text: "ध्यायतश्चिन्मयं हृदि",
        iast: "dhyāyataścinmayaṃ hṛdi",
        words: [
          {
            devanagari: "ध्यायतश्चिन्मयं",
            iast: "dhyāyataścinmayaṃ",
            gloss: "of one who meditates (dhyāyataḥ, genitive participle) upon [the Person] made of consciousness (cinmayam, accusative adjective) — sandhi-joined"
          },
          {
            devanagari: "हृदि",
            iast: "hṛdi",
            gloss: "in the heart (locative)"
          }
        ]
      },
      {
        text: "तत्र स्फुरति भावो यः",
        iast: "tatra sphurati bhāvo yaḥ",
        words: [
          {
            devanagari: "तत्र",
            iast: "tatra",
            gloss: "there, in that place (adverb)"
          },
          {
            devanagari: "स्फुरति",
            iast: "sphurati",
            gloss: "arises, shines forth (3rd person present verb)"
          },
          {
            devanagari: "भावो",
            iast: "bhāvo",
            gloss: "the state, feeling (nominative subject; sandhi form of bhāvaḥ)"
          },
          {
            devanagari: "यः",
            iast: "yaḥ",
            gloss: "which (relative pronoun, nominative, refers to bhāvaḥ)"
          }
        ]
      },
      {
        text: "शृणु तं कथयाम्यहम्",
        iast: "śṛṇu taṃ kathayāmyaham",
        words: [
          {
            devanagari: "शृणु",
            iast: "śṛṇu",
            gloss: "listen! (2nd person imperative)"
          },
          {
            devanagari: "तं",
            iast: "taṃ",
            gloss: "that (accusative, refers to the bhāva)"
          },
          {
            devanagari: "कथयाम्यहम्",
            iast: "kathayāmyaham",
            gloss: "I shall tell/relate (kathayāmi + aham, sandhi-joined verb + pronoun)"
          }
        ]
      }
    ],
    meaning: "For one who meditates in the heart on that thumb-sized Person made of consciousness, listen — I shall now tell you of the state that then arises there.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-116",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 116,
    speakerTag: null,
    padas: [
      {
        text: "अगोचरं तथाऽगम्यं",
        iast: "agocaraṃ tathā'gamyaṃ",
        words: [
          {
            devanagari: "अगोचरं",
            iast: "agocaraṃ",
            gloss: "beyond the range of the senses, imperceptible (accusative adjective)"
          },
          {
            devanagari: "तथाऽगम्यं",
            iast: "tathā'gamyaṃ",
            gloss: "and likewise unattainable, inaccessible (accusative adjective; tathā + agamyam, sandhi-joined)"
          }
        ]
      },
      {
        text: "नामरूपविवर्जितम्",
        iast: "nāmarūpavivarjitam",
        words: [
          {
            devanagari: "नामरूपविवर्जितम्",
            iast: "nāmarūpavivarjitam",
            gloss: "devoid of name and form (accusative compound adjective)"
          }
        ]
      },
      {
        text: "निःशब्दं तद्विजानीयात्",
        iast: "niḥśabdaṃ tadvijānīyāt",
        words: [
          {
            devanagari: "निःशब्दं",
            iast: "niḥśabdaṃ",
            gloss: "soundless, beyond speech/sound (accusative adjective)"
          },
          {
            devanagari: "तद्विजानीयात्",
            iast: "tadvijānīyāt",
            gloss: "one should know that (tad + vijānīyāt, optative verb + pronoun, sandhi-joined)"
          }
        ]
      },
      {
        text: "स्वभावं ब्रह्म पार्वति",
        iast: "svabhāvaṃ brahma pārvati",
        words: [
          {
            devanagari: "स्वभावं",
            iast: "svabhāvaṃ",
            gloss: "[as one's own] true nature (accusative, object complement)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman, the Absolute Reality (accusative, object of vijānīyāt)"
          },
          {
            devanagari: "पार्वति",
            iast: "pārvati",
            gloss: "O Pārvatī (vocative)"
          }
        ]
      }
    ],
    meaning: "O Pārvatī, know that Brahman — imperceptible, unattainable, free of name and form, and beyond sound — is your own true nature.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-117",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 117,
    speakerTag: null,
    padas: [
      {
        text: "यथा गन्धः स्वभावेन",
        iast: "yathā gandhaḥ svabhāvena",
        words: [
          {
            devanagari: "यथा",
            iast: "yathā",
            gloss: "just as (comparative particle)"
          },
          {
            devanagari: "गन्धः",
            iast: "gandhaḥ",
            gloss: "fragrance, scent (nominative subject)"
          },
          {
            devanagari: "स्वभावेन",
            iast: "svabhāvena",
            gloss: "by [its own] nature (instrumental)"
          }
        ]
      },
      {
        text: "कर्पूरकुसुमादिषु",
        iast: "karpūrakusumādiṣu",
        words: [
          {
            devanagari: "कर्पूरकुसुमादिषु",
            iast: "karpūrakusumādiṣu",
            gloss: "in camphor, flowers, and the like (locative compound: karpūra + kusuma + ādi)"
          }
        ]
      },
      {
        text: "शीतोष्णादि स्वभावेन",
        iast: "śītoṣṇādi svabhāvena",
        words: [
          {
            devanagari: "शीतोष्णादि",
            iast: "śītoṣṇādi",
            gloss: "coolness, heat, and so on (nominative compound subject)"
          },
          {
            devanagari: "स्वभावेन",
            iast: "svabhāvena",
            gloss: "by [their own] nature (instrumental)"
          }
        ]
      },
      {
        text: "तथा ब्रह्म च शाश्वतम्",
        iast: "tathā brahma ca śāśvatam",
        words: [
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "so too, likewise (adverb)"
          },
          {
            devanagari: "ब्रह्म",
            iast: "brahma",
            gloss: "Brahman (nominative subject)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and, also (conjunction)"
          },
          {
            devanagari: "शाश्वतम्",
            iast: "śāśvatam",
            gloss: "eternal, everlasting (nominative adjective)"
          }
        ]
      }
    ],
    meaning: "Just as fragrance is inherent by nature in camphor, flowers, and the like, and just as coolness, heat, and so on are natural to their causes, so too is Brahman eternal by its own nature.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-118",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 118,
    speakerTag: null,
    padas: [
      {
        text: "स्वयं तथाविधो भूत्वा",
        iast: "svayaṃ tathāvidho bhūtvā",
        words: [
          {
            devanagari: "स्वयं",
            iast: "svayaṃ",
            gloss: "oneself (reflexive adverb/pronoun)"
          },
          {
            devanagari: "तथाविधो",
            iast: "tathāvidho",
            gloss: "of that same nature/kind (nominative adjective; sandhi form of tathāvidhaḥ)"
          },
          {
            devanagari: "भूत्वा",
            iast: "bhūtvā",
            gloss: "having become (gerund)"
          }
        ]
      },
      {
        text: "स्थातव्यं यत्रकुत्रचित्",
        iast: "sthātavyaṃ yatrakutracit",
        words: [
          {
            devanagari: "स्थातव्यं",
            iast: "sthātavyaṃ",
            gloss: "one should abide/remain (impersonal gerundive)"
          },
          {
            devanagari: "यत्रकुत्रचित्",
            iast: "yatrakutracit",
            gloss: "anywhere whatsoever (indeclinable compound: yatra + kutra + cit)"
          }
        ]
      },
      {
        text: "कीटभ्रमरवत्तत्र",
        iast: "kīṭabhramaravattatra",
        words: [
          {
            devanagari: "कीटभ्रमरवत्तत्र",
            iast: "kīṭabhramaravattatra",
            gloss: "there, in the manner of the grub[-becoming]-wasp (adverbial compound: kīṭa 'grub' + bhramara 'wasp' + vat 'like' + tatra 'there')"
          }
        ]
      },
      {
        text: "ध्यानं भवति तादृशम्",
        iast: "dhyānaṃ bhavati tādṛśam",
        words: [
          {
            devanagari: "ध्यानं",
            iast: "dhyānaṃ",
            gloss: "meditation (nominative subject)"
          },
          {
            devanagari: "भवति",
            iast: "bhavati",
            gloss: "becomes, occurs (3rd person present verb)"
          },
          {
            devanagari: "तादृशम्",
            iast: "tādṛśam",
            gloss: "of that same kind, such (nominative adjective)"
          }
        ]
      }
    ],
    meaning: "Having oneself become of that same nature, one may then abide anywhere; like the grub that turns into a wasp, such is the meditation that arises there.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). कीटभ्रमरवत् alludes to the traditional simile of a grub that, from constantly dwelling in fear on a wasp, itself becomes a wasp — a classic figure here for meditation transforming the meditator into the object contemplated."
  },
  {
    id: "guru-gita-119",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 119,
    speakerTag: null,
    padas: [
      {
        text: "गुरुध्यानं तथा कृत्वा",
        iast: "gurudhyānaṃ tathā kṛtvā",
        words: [
          {
            devanagari: "गुरुध्यानं",
            iast: "gurudhyānaṃ",
            gloss: "meditation on the Guru (accusative, object of kṛtvā)"
          },
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "thus, in this way (adverb)"
          },
          {
            devanagari: "कृत्वा",
            iast: "kṛtvā",
            gloss: "having done, having performed (gerund)"
          }
        ]
      },
      {
        text: "स्वयं ब्रह्ममयो भवेत्",
        iast: "svayaṃ brahmamayo bhavet",
        words: [
          {
            devanagari: "स्वयं",
            iast: "svayaṃ",
            gloss: "oneself (adverb)"
          },
          {
            devanagari: "ब्रह्ममयो",
            iast: "brahmamayo",
            gloss: "full of / consisting of Brahman (nominative predicate adjective; sandhi form of brahmamayaḥ)"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "would/should become (optative verb)"
          }
        ]
      },
      {
        text: "पिण्डे पदे तथा रूपे",
        iast: "piṇḍe pade tathā rūpe",
        words: [
          {
            devanagari: "पिण्डे",
            iast: "piṇḍe",
            gloss: "in piṇḍa (locative)"
          },
          {
            devanagari: "पदे",
            iast: "pade",
            gloss: "in pada (locative)"
          },
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "and, likewise (conjunction)"
          },
          {
            devanagari: "रूपे",
            iast: "rūpe",
            gloss: "in rūpa (locative)"
          }
        ]
      },
      {
        text: "मुक्तोऽसौ नात्र संशयः",
        iast: "mukto'sau nātra saṃśayaḥ",
        words: [
          {
            devanagari: "मुक्तोऽसौ",
            iast: "mukto'sau",
            gloss: "that one is liberated (muktaḥ + asau, sandhi-joined)"
          },
          {
            devanagari: "नात्र",
            iast: "nātra",
            gloss: "not in this, [there is] no (na + atra, sandhi-joined)"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative subject)"
          }
        ]
      }
    ],
    meaning: "Having thus meditated upon the Guru, one becomes filled with Brahman; that person is liberated in piṇḍa, pada, and rūpa alike — of this there is no doubt.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). Piṇḍa, pada, and rūpa are technical yogic terms, not everyday words for 'body,' 'state,' and 'form'; they are defined explicitly two verses later (v.121) as kuṇḍalinī-śakti, haṃsa (the vital breath), and bindu respectively."
  },
  {
    id: "guru-gita-120",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 120,
    speakerTag: "श्री पार्वत्युवाच",
    padas: [
      {
        text: "पिण्डं किं तु महादेव",
        iast: "piṇḍaṃ kiṃ tu mahādeva",
        words: [
          {
            devanagari: "पिण्डं",
            iast: "piṇḍaṃ",
            gloss: "'piṇḍa' (nominative subject of the question)"
          },
          {
            devanagari: "किं",
            iast: "kiṃ",
            gloss: "what? (nominative interrogative predicate)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "now, indeed (particle)"
          },
          {
            devanagari: "महादेव",
            iast: "mahādeva",
            gloss: "O Great God (vocative, addressing Śiva)"
          }
        ]
      },
      {
        text: "पदं किं समुदाहृतम्",
        iast: "padaṃ kiṃ samudāhṛtam",
        words: [
          {
            devanagari: "पदं",
            iast: "padaṃ",
            gloss: "'pada' (nominative subject)"
          },
          {
            devanagari: "किं",
            iast: "kiṃ",
            gloss: "what? (nominative interrogative predicate)"
          },
          {
            devanagari: "समुदाहृतम्",
            iast: "samudāhṛtam",
            gloss: "is declared, said to be (nominative past passive participle)"
          }
        ]
      },
      {
        text: "रूपातीतं च रूपं",
        iast: "rūpātītaṃ ca rūpaṃ",
        words: [
          {
            devanagari: "रूपातीतं",
            iast: "rūpātītaṃ",
            gloss: "that which transcends form, 'rūpātīta' (nominative subject)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (conjunction)"
          },
          {
            devanagari: "रूपं",
            iast: "rūpaṃ",
            gloss: "'rūpa,' form (nominative subject)"
          }
        ]
      },
      {
        text: "किमेतदाख्याहि शङ्कर",
        iast: "kimetadākhyāhi śaṅkara",
        words: [
          {
            devanagari: "किमेतदाख्याहि",
            iast: "kimetadākhyāhi",
            gloss: "tell [me] what this is (kim 'what' + etat 'this' + ākhyāhi 'tell!' imperative, sandhi-joined)"
          },
          {
            devanagari: "शङ्कर",
            iast: "śaṅkara",
            gloss: "O Śaṅkara (vocative)"
          }
        ]
      }
    ],
    meaning: "Pārvatī said: O Great God, what exactly is 'piṇḍa'? What is declared to be 'pada'? And what are 'rūpa' and 'rūpātīta,' that which transcends form? Tell me this, O Śaṅkara.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-121",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 121,
    speakerTag: "श्री महादेव उवाच",
    padas: [
      {
        text: "पिण्डं कुण्डलिनीशक्तिः",
        iast: "piṇḍaṃ kuṇḍalinīśaktiḥ",
        words: [
          {
            devanagari: "पिण्डं",
            iast: "piṇḍaṃ",
            gloss: "'piṇḍa' (nominative subject)"
          },
          {
            devanagari: "कुण्डलिनीशक्तिः",
            iast: "kuṇḍalinīśaktiḥ",
            gloss: "the Kuṇḍalinī Power (nominative predicate noun)"
          }
        ]
      },
      {
        text: "पदं हंसमुदाहृतम्",
        iast: "padaṃ haṃsamudāhṛtam",
        words: [
          {
            devanagari: "पदं",
            iast: "padaṃ",
            gloss: "'pada' (nominative subject)"
          },
          {
            devanagari: "हंसमुदाहृतम्",
            iast: "haṃsamudāhṛtam",
            gloss: "is declared to be haṃsa, the vital breath (haṃsam + udāhṛtam, sandhi-joined)"
          }
        ]
      },
      {
        text: "रूपं बिन्दुरिति ज्ञेयं",
        iast: "rūpaṃ binduriti jñeyaṃ",
        words: [
          {
            devanagari: "रूपं",
            iast: "rūpaṃ",
            gloss: "'rūpa' (nominative subject)"
          },
          {
            devanagari: "बिन्दुरिति",
            iast: "binduriti",
            gloss: "'is bindu,' thus (bindur + iti, sandhi-joined)"
          },
          {
            devanagari: "ज्ञेयं",
            iast: "jñeyaṃ",
            gloss: "should be known (nominative gerundive)"
          }
        ]
      },
      {
        text: "रूपातीतं निरञ्जनम्",
        iast: "rūpātītaṃ nirañjanam",
        words: [
          {
            devanagari: "रूपातीतं",
            iast: "rūpātītaṃ",
            gloss: "'rūpātīta,' that which transcends form (nominative subject)"
          },
          {
            devanagari: "निरञ्जनम्",
            iast: "nirañjanam",
            gloss: "the stainless, unmanifest [Absolute] (nominative predicate adjective)"
          }
        ]
      }
    ],
    meaning: "Mahādeva said: 'Piṇḍa' is the Kuṇḍalinī Power; 'pada' is said to be haṃsa, the vital breath; 'rūpa' should be known as the bindu; and 'rūpātīta' is the stainless, unmanifest Absolute.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-122",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 122,
    speakerTag: null,
    padas: [
      {
        text: "पिण्डे मुक्ता पदे मुक्ता",
        iast: "piṇḍe muktā pade muktā",
        words: [
          {
            devanagari: "पिण्डे",
            iast: "piṇḍe",
            gloss: "in the body / at the level of gross physical existence (locative)"
          },
          {
            devanagari: "मुक्ता",
            iast: "muktā",
            gloss: "liberated, freed (nominative singular feminine adjective, describing the liberated one)"
          },
          {
            devanagari: "पदे",
            iast: "pade",
            gloss: "in the (subtle) stage/station (locative)"
          },
          {
            devanagari: "मुक्ता",
            iast: "muktā",
            gloss: "liberated, freed (nominative singular feminine adjective, describing the liberated one)"
          }
        ]
      },
      {
        text: "रूपे मुक्ता वरानने",
        iast: "rūpe muktā varānane",
        words: [
          {
            devanagari: "रूपे",
            iast: "rūpe",
            gloss: "in (subtle) form (locative)"
          },
          {
            devanagari: "मुक्ता",
            iast: "muktā",
            gloss: "liberated, freed (nominative singular feminine adjective, describing the liberated one)"
          },
          {
            devanagari: "वरानने",
            iast: "varānane",
            gloss: "O fair-faced one (vocative, addressing the Goddess)"
          }
        ]
      },
      {
        text: "रूपातीते तु ये मुक्तास्ते",
        iast: "rūpātīte tu ye muktāste",
        words: [
          {
            devanagari: "रूपातीते",
            iast: "rūpātīte",
            gloss: "in that which transcends form (locative)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "but, indeed (particle)"
          },
          {
            devanagari: "ये",
            iast: "ye",
            gloss: "those who (relative pronoun, nominative plural)"
          },
          {
            devanagari: "मुक्तास्ते",
            iast: "muktāste",
            gloss: "are liberated — they (sandhi fusion of muktāḥ, 'are liberated', nominative plural + te, 'they', nominative plural pronoun, kept as one printed unit)"
          }
        ]
      },
      {
        text: "मुक्ता नात्र संशयः",
        iast: "muktā nātra saṃśayaḥ",
        words: [
          {
            devanagari: "मुक्ता",
            iast: "muktā",
            gloss: "are liberated (nominative plural — sandhi-elided from muktāḥ before the voiced न् of nātra, i.e. muktāḥ + nātra → muktā nātra; agrees with te, 'they', not with the singular muktā of the earlier padas)"
          },
          {
            devanagari: "नात्र",
            iast: "nātra",
            gloss: "there is not here (na + atra)"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative)"
          }
        ]
      }
    ],
    meaning: "O fair one, one may be freed at the level of the gross body, freed at the level of the subtle stage, or freed at the level of subtle form — but those who are liberated even beyond all form are, without any doubt, truly and completely liberated.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The phrase 'muktāste' preserves a sandhi join of muktāḥ ('they are liberated') and te ('they'/'those') that spans what would otherwise be the pāda boundary; it is kept as a single word entry to match the printed text exactly, and pāda division here (9+7 syllables rather than an even 8+8) follows that sandhi rather than forcing an artificial split. Note also that the final 'muktā' of the verse is grammatically plural (muktāḥ, agreeing with 'te'), unlike the three singular occurrences of 'muktā' earlier in the verse — the spelling is identical only because visarga elides before a following voiced consonant."
  },
  {
    id: "guru-gita-123",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 123,
    speakerTag: null,
    padas: [
      {
        text: "स्वयं सर्वमयो भूत्वा",
        iast: "svayaṃ sarvamayo bhūtvā",
        words: [
          {
            devanagari: "स्वयं",
            iast: "svayaṃ",
            gloss: "oneself (reflexive adverb)"
          },
          {
            devanagari: "सर्वमयो",
            iast: "sarvamayo",
            gloss: "consisting of/one with everything, all-pervading (nominative, sandhi of sarvamayaḥ before a voiced sound)"
          },
          {
            devanagari: "भूत्वा",
            iast: "bhūtvā",
            gloss: "having become (gerund)"
          }
        ]
      },
      {
        text: "परं तत्त्वं विलोकयेत्",
        iast: "paraṃ tattvaṃ vilokayet",
        words: [
          {
            devanagari: "परं",
            iast: "paraṃ",
            gloss: "the Supreme (accusative, qualifying tattvam)"
          },
          {
            devanagari: "तत्त्वं",
            iast: "tattvaṃ",
            gloss: "Reality, Truth (accusative, object)"
          },
          {
            devanagari: "विलोकयेत्",
            iast: "vilokayet",
            gloss: "one should perceive/behold (optative verb)"
          }
        ]
      },
      {
        text: "परात्परतरं नान्यत्",
        iast: "parātparataraṃ nānyat",
        words: [
          {
            devanagari: "परात्परतरं",
            iast: "parātparataraṃ",
            gloss: "more transcendent than the Supreme itself (parāt, ablative 'than the Supreme' + parataram, comparative nominative neuter)"
          },
          {
            devanagari: "नान्यत्",
            iast: "nānyat",
            gloss: "there is nothing else (na + anyat)"
          }
        ]
      },
      {
        text: "सर्वमेतन्निरालयम्",
        iast: "sarvametannirālayam",
        words: [
          {
            devanagari: "सर्वमेतन्निरालयम्",
            iast: "sarvametannirālayam",
            gloss: "all this (universe) has no separate abode/foundation of its own (sarvam + etat + nirālayam, fused by sandhi into one printed unit)"
          }
        ]
      }
    ],
    meaning: "Having become oneself one with everything, one should behold the Supreme Reality. Nothing is higher than that Supreme — indeed, this entire universe has no independent ground or basis of its own, apart from it.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-124",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 124,
    speakerTag: null,
    padas: [
      {
        text: "तस्यावलोकनं प्राप्य",
        iast: "tasyāvalokanaṃ prāpya",
        words: [
          {
            devanagari: "तस्यावलोकनं",
            iast: "tasyāvalokanaṃ",
            gloss: "the vision/sight of That (tasya + avalokanam, genitive + accusative)"
          },
          {
            devanagari: "प्राप्य",
            iast: "prāpya",
            gloss: "having attained, having obtained (gerund)"
          }
        ]
      },
      {
        text: "सर्वसङ्गविवर्जितः",
        iast: "sarvasaṅgavivarjitaḥ",
        words: [
          {
            devanagari: "सर्वसङ्गविवर्जितः",
            iast: "sarvasaṅgavivarjitaḥ",
            gloss: "devoid of all attachment (nominative masculine compound, sarva-saṅga-vivarjitaḥ)"
          }
        ]
      },
      {
        text: "एकाकी निःस्पृहः",
        iast: "ekākī niḥspṛhaḥ",
        words: [
          {
            devanagari: "एकाकी",
            iast: "ekākī",
            gloss: "alone, solitary (nominative)"
          },
          {
            devanagari: "निःस्पृहः",
            iast: "niḥspṛhaḥ",
            gloss: "free from longing/desire (nominative)"
          }
        ]
      },
      {
        text: "शान्तस्तिष्ठासेत्तत्प्रसादतः",
        iast: "śāntastiṣṭhāsettatprasādataḥ",
        words: [
          {
            devanagari: "शान्तस्तिष्ठासेत्तत्प्रसादतः",
            iast: "śāntastiṣṭhāsettatprasādataḥ",
            gloss: "tranquil, one should abide [in that state] through his (the Guru's) grace — sandhi fusion of śāntaḥ ('tranquil') + tiṣṭhāset ('should remain/abide') + tat-prasādataḥ ('through his grace'), kept as one printed unit"
          }
        ]
      }
    ],
    meaning: "Having attained the vision of That, and freed from every attachment, one should remain alone, free of longing, and at peace, abiding in that state through the Guru's grace.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). Heavy sandhi fusion (śāntaḥ + tiṣṭhāset + tat-prasādataḥ) leaves the second half of this line printed as one unbroken unit with no internal space in the source; it is kept as a single word entry rather than split, to preserve the source text exactly."
  },
  {
    id: "guru-gita-125",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 125,
    speakerTag: null,
    padas: [
      {
        text: "लब्धं वाऽथ न लब्धं वा",
        iast: "labdhaṃ vā'tha na labdhaṃ vā",
        words: [
          {
            devanagari: "लब्धं",
            iast: "labdhaṃ",
            gloss: "obtained, gained (accusative/nominative neuter)"
          },
          {
            devanagari: "वाऽथ",
            iast: "vā'tha",
            gloss: "or then, or else (vā + atha)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "लब्धं",
            iast: "labdhaṃ",
            gloss: "obtained, gained (accusative/nominative neuter)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          }
        ]
      },
      {
        text: "स्वल्पं वा बहुलं तथा",
        iast: "svalpaṃ vā bahulaṃ tathā",
        words: [
          {
            devanagari: "स्वल्पं",
            iast: "svalpaṃ",
            gloss: "very little (accusative/nominative neuter)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          },
          {
            devanagari: "बहुलं",
            iast: "bahulaṃ",
            gloss: "abundant, much (accusative/nominative neuter)"
          },
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "likewise, similarly"
          }
        ]
      },
      {
        text: "निष्कामेनैव भोक्तव्यं",
        iast: "niṣkāmenaiva bhoktavyaṃ",
        words: [
          {
            devanagari: "निष्कामेनैव",
            iast: "niṣkāmenaiva",
            gloss: "with a desireless [mind] alone (instrumental, niṣkāmena + eva)"
          },
          {
            devanagari: "भोक्तव्यं",
            iast: "bhoktavyaṃ",
            gloss: "is to be experienced/enjoyed (gerundive, neuter verbal duty-form)"
          }
        ]
      },
      {
        text: "सदा संतुष्टचेतसा",
        iast: "sadā saṃtuṣṭacetasā",
        words: [
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          },
          {
            devanagari: "संतुष्टचेतसा",
            iast: "saṃtuṣṭacetasā",
            gloss: "with a contented mind (instrumental compound, saṃtuṣṭa-cetasā)"
          }
        ]
      }
    ],
    meaning: "Whether one obtains much, little, or nothing at all, one should always experience it with a contented mind, free from desire.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-126",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 126,
    speakerTag: null,
    padas: [
      {
        text: "सर्वज्ञपदमित्याहुर्देही",
        iast: "sarvajñapadamityāhurdehī",
        words: [
          {
            devanagari: "सर्वज्ञपदमित्याहुर्देही",
            iast: "sarvajñapadamityāhurdehī",
            gloss: "the embodied soul — [the wise] call [it] 'the state of omniscience' (sarvajña-padam + iti + āhur + dehī, fused by sandhi into one printed unit)"
          }
        ]
      },
      {
        text: "सर्वमयो बुधाः",
        iast: "sarvamayo budhāḥ",
        words: [
          {
            devanagari: "सर्वमयो",
            iast: "sarvamayo",
            gloss: "all-pervading, one with everything (nominative, predicate adjective describing dehī; sandhi before a voiced sound)"
          },
          {
            devanagari: "बुधाः",
            iast: "budhāḥ",
            gloss: "the wise ones (nominative plural, subject of āhur)"
          }
        ]
      },
      {
        text: "सदानन्दः सदा शान्तो",
        iast: "sadānandaḥ sadā śānto",
        words: [
          {
            devanagari: "सदानन्दः",
            iast: "sadānandaḥ",
            gloss: "ever-blissful (nominative, sadā + ānandaḥ)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          },
          {
            devanagari: "शान्तो",
            iast: "śānto",
            gloss: "tranquil, peaceful (nominative, sandhi of śāntaḥ before a voiced sound)"
          }
        ]
      },
      {
        text: "रमते यत्रकुत्रचित्",
        iast: "ramate yatrakutracit",
        words: [
          {
            devanagari: "रमते",
            iast: "ramate",
            gloss: "delights, rejoices (3rd person singular present, ātmanepada)"
          },
          {
            devanagari: "यत्रकुत्रचित्",
            iast: "yatrakutracit",
            gloss: "wherever, no matter where (indeclinable compound)"
          }
        ]
      }
    ],
    meaning: "The wise call it 'the state of omniscience' when the embodied soul becomes one with everything. Ever blissful and always at peace, such a person delights in the Self no matter where they may be.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The opening of this line fuses four words (sarvajña-padam + iti + āhur + dehī) into one unbroken printed unit; it is kept as a single word entry, and the pāda division (10+6 syllables) follows the source's actual spacing rather than an even 8+8 split."
  },
  {
    id: "guru-gita-127",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 127,
    speakerTag: null,
    padas: [
      {
        text: "यत्रैव तिष्ठते सोऽपि",
        iast: "yatraiva tiṣṭhate so'pi",
        words: [
          {
            devanagari: "यत्रैव",
            iast: "yatraiva",
            gloss: "wherever indeed (yatra + eva)"
          },
          {
            devanagari: "तिष्ठते",
            iast: "tiṣṭhate",
            gloss: "abides, dwells (3rd person singular present, ātmanepada)"
          },
          {
            devanagari: "सोऽपि",
            iast: "so'pi",
            gloss: "he/that too (saḥ + api)"
          }
        ]
      },
      {
        text: "स देशः पुण्यभाजनम्",
        iast: "sa deśaḥ puṇyabhājanam",
        words: [
          {
            devanagari: "स",
            iast: "sa",
            gloss: "that (nominative, referring to deśaḥ)"
          },
          {
            devanagari: "देशः",
            iast: "deśaḥ",
            gloss: "place, region (nominative)"
          },
          {
            devanagari: "पुण्यभाजनम्",
            iast: "puṇyabhājanam",
            gloss: "a vessel/receptacle of holiness (nominative neuter, puṇya-bhājanam)"
          }
        ]
      },
      {
        text: "मुक्तस्य लक्षणं देवि",
        iast: "muktasya lakṣaṇaṃ devi",
        words: [
          {
            devanagari: "मुक्तस्य",
            iast: "muktasya",
            gloss: "of the liberated one (genitive)"
          },
          {
            devanagari: "लक्षणं",
            iast: "lakṣaṇaṃ",
            gloss: "characteristic, defining mark (nominative/accusative neuter)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "तवाग्रे कथितं मया",
        iast: "tavāgre kathitaṃ mayā",
        words: [
          {
            devanagari: "तवाग्रे",
            iast: "tavāgre",
            gloss: "before you, in your presence (tava + agre, locative compound)"
          },
          {
            devanagari: "कथितं",
            iast: "kathitaṃ",
            gloss: "has been told, described (past participle, neuter)"
          },
          {
            devanagari: "मया",
            iast: "mayā",
            gloss: "by me (instrumental)"
          }
        ]
      }
    ],
    meaning: "Wherever such a person dwells, that very place becomes a vessel of holiness. O Goddess, I have thus described to you the marks of the liberated one.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-128",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 128,
    speakerTag: null,
    padas: [
      {
        text: "उपदेशस्तथा देवि",
        iast: "upadeśastathā devi",
        words: [
          {
            devanagari: "उपदेशस्तथा",
            iast: "upadeśastathā",
            gloss: "and [likewise] the instruction/teaching (upadeśaḥ + tathā)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "गुरुमार्गेण मुक्तिदः",
        iast: "gurumārgeṇa muktidaḥ",
        words: [
          {
            devanagari: "गुरुमार्गेण",
            iast: "gurumārgeṇa",
            gloss: "by the path of the Guru (instrumental)"
          },
          {
            devanagari: "मुक्तिदः",
            iast: "muktidaḥ",
            gloss: "giver of liberation (nominative, describing upadeśas)"
          }
        ]
      },
      {
        text: "गुरुभक्तिस्तथा ध्यानं",
        iast: "gurubhaktistathā dhyānaṃ",
        words: [
          {
            devanagari: "गुरुभक्तिस्तथा",
            iast: "gurubhaktistathā",
            gloss: "and devotion to the Guru (gurubhaktiḥ + tathā)"
          },
          {
            devanagari: "ध्यानं",
            iast: "dhyānaṃ",
            gloss: "meditation (nominative/accusative neuter)"
          }
        ]
      },
      {
        text: "सकलं तव कीर्तितम्",
        iast: "sakalaṃ tava kīrtitam",
        words: [
          {
            devanagari: "सकलं",
            iast: "sakalaṃ",
            gloss: "all, the entirety (accusative/nominative neuter)"
          },
          {
            devanagari: "तव",
            iast: "tava",
            gloss: "to you, for you (genitive/dative)"
          },
          {
            devanagari: "कीर्तितम्",
            iast: "kīrtitam",
            gloss: "has been declared, proclaimed (past participle neuter)"
          }
        ]
      }
    ],
    meaning: "O Goddess, the teaching that liberation is won through the path of the Guru, and likewise devotion to the Guru and meditation on him — all of this I have now fully declared to you.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The reference translation's bracketed note '[phala shruti]' is an editorial heading marking where the text turns to describe the fruits of reciting the Guru Gītā; it is not part of the Sanskrit verse itself."
  },
  {
    id: "guru-gita-129",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 129,
    speakerTag: null,
    padas: [
      {
        text: "अनेन यद्भवेत्कार्यं",
        iast: "anena yadbhavetkāryaṃ",
        words: [
          {
            devanagari: "अनेन",
            iast: "anena",
            gloss: "by this (instrumental, referring to reciting/studying the Guru Gītā)"
          },
          {
            devanagari: "यद्भवेत्कार्यं",
            iast: "yadbhavetkāryaṃ",
            gloss: "whatever effect/benefit would arise (yat + bhavet + kāryam, relative clause, accusative object)"
          }
        ]
      },
      {
        text: "तद्वदामि महामते",
        iast: "tadvadāmi mahāmate",
        words: [
          {
            devanagari: "तद्वदामि",
            iast: "tadvadāmi",
            gloss: "that I shall declare (tat + vadāmi)"
          },
          {
            devanagari: "महामते",
            iast: "mahāmate",
            gloss: "O great-minded one, O wise one (vocative)"
          }
        ]
      },
      {
        text: "लोकोपकारकं देवि",
        iast: "lokopakārakaṃ devi",
        words: [
          {
            devanagari: "लोकोपकारकं",
            iast: "lokopakārakaṃ",
            gloss: "beneficial to the world, for the welfare of people (accusative, loka-upakārakam)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "लौकिकं तु न भावयेत्",
        iast: "laukikaṃ tu na bhāvayet",
        words: [
          {
            devanagari: "लौकिकं",
            iast: "laukikaṃ",
            gloss: "worldly, for mundane/selfish ends (accusative neuter)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "but, however"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "भावयेत्",
            iast: "bhāvayet",
            gloss: "one should intend/entertain [in the mind] (optative verb)"
          }
        ]
      }
    ],
    meaning: "O wise one, I shall now speak of the benefit that comes from this (the Guru Gītā). O Goddess, it should not be turned to selfish, worldly ends, but used for the welfare of the world.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-130",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 130,
    speakerTag: null,
    padas: [
      {
        text: "लौकिकात्कर्मणो यान्ति",
        iast: "laukikātkarmaṇo yānti",
        words: [
          {
            devanagari: "लौकिकात्कर्मणो",
            iast: "laukikātkarmaṇo",
            gloss: "from worldly/selfish action (ablative compound, laukikāt karmaṇaḥ, sandhi before a voiced sound)"
          },
          {
            devanagari: "यान्ति",
            iast: "yānti",
            gloss: "go, fall into (3rd person plural present)"
          }
        ]
      },
      {
        text: "ज्ञानहीना भवार्णवम्",
        iast: "jñānahīnā bhavārṇavam",
        words: [
          {
            devanagari: "ज्ञानहीना",
            iast: "jñānahīnā",
            gloss: "those devoid of knowledge (nominative plural, subject of yānti)"
          },
          {
            devanagari: "भवार्णवम्",
            iast: "bhavārṇavam",
            gloss: "the ocean of worldly existence (accusative, bhava-arṇavam)"
          }
        ]
      },
      {
        text: "ज्ञानी तु भावयेत्सर्वं",
        iast: "jñānī tu bhāvayetsarvaṃ",
        words: [
          {
            devanagari: "ज्ञानी",
            iast: "jñānī",
            gloss: "the knower, the enlightened one (nominative)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "but, however"
          },
          {
            devanagari: "भावयेत्सर्वं",
            iast: "bhāvayetsarvaṃ",
            gloss: "should regard everything as (bhāvayet + sarvam, 'should consider all [to be]')"
          }
        ]
      },
      {
        text: "कर्म निष्कर्म यत्कृतम्",
        iast: "karma niṣkarma yatkṛtam",
        words: [
          {
            devanagari: "कर्म",
            iast: "karma",
            gloss: "action (nominative/accusative)"
          },
          {
            devanagari: "निष्कर्म",
            iast: "niṣkarma",
            gloss: "non-action, non-binding action (nominative/accusative)"
          },
          {
            devanagari: "यत्कृतम्",
            iast: "yatkṛtam",
            gloss: "whatever is done (yat + kṛtam)"
          }
        ]
      }
    ],
    meaning: "Those without knowledge, acting from worldly/selfish motives, fall into the ocean of transmigratory existence; but the one with knowledge regards every action performed, whatever it may be, as non-binding.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-131",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 131,
    speakerTag: null,
    padas: [
      {
        text: "इदं तु भक्तिभावेन",
        iast: "idaṃ tu bhaktibhāvena",
        words: [
          {
            devanagari: "इदं",
            iast: "idaṃ",
            gloss: "this (accusative neuter, referring to the Guru Gītā)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed, but"
          },
          {
            devanagari: "भक्तिभावेन",
            iast: "bhaktibhāvena",
            gloss: "with a feeling of devotion (instrumental)"
          }
        ]
      },
      {
        text: "पठते शृणुते यदि",
        iast: "paṭhate śṛṇute yadi",
        words: [
          {
            devanagari: "पठते",
            iast: "paṭhate",
            gloss: "one recites/reads (3rd person singular present, ātmanepada)"
          },
          {
            devanagari: "शृणुते",
            iast: "śṛṇute",
            gloss: "one listens/hears (3rd person singular present, ātmanepada)"
          },
          {
            devanagari: "यदि",
            iast: "yadi",
            gloss: "if"
          }
        ]
      },
      {
        text: "लिखित्वा तत्प्रदातव्यं",
        iast: "likhitvā tatpradātavyaṃ",
        words: [
          {
            devanagari: "लिखित्वा",
            iast: "likhitvā",
            gloss: "having written out [a copy] (gerund)"
          },
          {
            devanagari: "तत्प्रदातव्यं",
            iast: "tatpradātavyaṃ",
            gloss: "that is to be given [to another] (tat + pradātavyam, gerundive)"
          }
        ]
      },
      {
        text: "तत्सर्वं सफलं भवेत्",
        iast: "tatsarvaṃ saphalaṃ bhavet",
        words: [
          {
            devanagari: "तत्सर्वं",
            iast: "tatsarvaṃ",
            gloss: "all of that (tat + sarvam)"
          },
          {
            devanagari: "सफलं",
            iast: "saphalaṃ",
            gloss: "fruitful, successful (nominative/accusative neuter)"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "becomes, would be (optative verb)"
          }
        ]
      }
    ],
    meaning: "If one reads or listens to this with a feeling of devotion, or writes out a copy of it and gives it to another, all of that will bear fruit.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-132",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 132,
    speakerTag: null,
    padas: [
      {
        text: "गुरुगीतात्मकं देवि",
        iast: "gurugītātmakaṃ devi",
        words: [
          {
            devanagari: "गुरुगीतात्मकं",
            iast: "gurugītātmakaṃ",
            gloss: "having the nature of / consisting in the Guru Gītā (nominative adjective, agrees with तत्त्वं — guru-gītā + ātmakam 'whose essence is')"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "शुद्धतत्त्वं मयोदितम्",
        iast: "śuddhatattvaṃ mayoditam",
        words: [
          {
            devanagari: "शुद्धतत्त्वं",
            iast: "śuddhatattvaṃ",
            gloss: "the pure truth/essence (nominative — the grammatical subject of the passive construction with उदितम्, not an accusative object)"
          },
          {
            devanagari: "मयोदितम्",
            iast: "mayoditam",
            gloss: "declared/spoken by me (sandhi of मया 'by me', instrumental of agent, + उदितम् 'was spoken, declared', past passive participle agreeing with तत्त्वं)"
          }
        ]
      },
      {
        text: "भवव्याधिविनाशार्थं",
        iast: "bhavavyādhivināśārthaṃ",
        words: [
          {
            devanagari: "भवव्याधिविनाशार्थं",
            iast: "bhavavyādhivināśārthaṃ",
            gloss: "for the sake of destroying the disease of worldly existence (accusative used adverbially of purpose; compound bhava 'worldly existence' + vyādhi 'disease' + vināśa 'destruction' + artham 'for the sake of')"
          }
        ]
      },
      {
        text: "स्वयमेव जपेत्सदा",
        iast: "svayameva japetsadā",
        words: [
          {
            devanagari: "स्वयमेव",
            iast: "svayameva",
            gloss: "by oneself, indeed (sandhi of स्वयम् 'oneself' + एव 'indeed, verily')"
          },
          {
            devanagari: "जपेत्सदा",
            iast: "japetsadā",
            gloss: "should always recite (sandhi of जपेत् 'one should recite/repeat', optative verb, + सदा 'always')"
          }
        ]
      }
    ],
    meaning: "O Goddess, I have declared to you this pure truth in the form of the Guru Gītā. To destroy the disease of worldly existence, one should always recite it oneself.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-133",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 133,
    speakerTag: null,
    padas: [
      {
        text: "गुरुगीताक्षरैकं तु",
        iast: "gurugītākṣaraikaṃ tu",
        words: [
          {
            devanagari: "गुरुगीताक्षरैकं",
            iast: "gurugītākṣaraikaṃ",
            gloss: "a single syllable of the Guru Gītā (accusative, object; compound guru-gītā + akṣara 'syllable' + ekam 'one, a single')"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed, but (emphatic/contrastive particle)"
          }
        ]
      },
      {
        text: "मन्त्रराजमिमं जपेत्",
        iast: "mantrarājamimaṃ japet",
        words: [
          {
            devanagari: "मन्त्रराजमिमं",
            iast: "mantrarājamimaṃ",
            gloss: "this king of mantras (accusative, in apposition to the syllable of the Guru Gītā; sandhi of मन्त्रराजम् 'king of mantras' + इमं 'this')"
          },
          {
            devanagari: "जपेत्",
            iast: "japet",
            gloss: "one should recite (optative verb)"
          }
        ]
      },
      {
        text: "अन्ये च विविधा मन्त्राः",
        iast: "anye ca vividhā mantrāḥ",
        words: [
          {
            devanagari: "अन्ये",
            iast: "anye",
            gloss: "other (nominative plural)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "विविधा",
            iast: "vividhā",
            gloss: "of various kinds, manifold (nominative plural adjective agreeing with मन्त्राः)"
          },
          {
            devanagari: "मन्त्राः",
            iast: "mantrāḥ",
            gloss: "mantras (nominative plural, subject)"
          }
        ]
      },
      {
        text: "कलां नार्हन्ति षोडशीम्",
        iast: "kalāṃ nārhanti ṣoḍaśīm",
        words: [
          {
            devanagari: "कलां",
            iast: "kalāṃ",
            gloss: "a fraction, a part (accusative)"
          },
          {
            devanagari: "नार्हन्ति",
            iast: "nārhanti",
            gloss: "are not worth, do not deserve (sandhi of न 'not' + अर्हन्ति 'they deserve/merit', present tense)"
          },
          {
            devanagari: "षोडशीम्",
            iast: "ṣoḍaśīm",
            gloss: "the sixteenth (accusative adjective, describes kalām — i.e. 'a sixteenth part')"
          }
        ]
      }
    ],
    meaning: "One should recite even a single syllable of the Guru Gītā — it is itself this king of mantras. All other mantras of various kinds, taken together, are not worth even a sixteenth part of it.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-134",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 134,
    speakerTag: null,
    padas: [
      {
        text: "अनन्तफलमाप्नोति",
        iast: "anantaphalamāpnoti",
        words: [
          {
            devanagari: "अनन्तफलमाप्नोति",
            iast: "anantaphalamāpnoti",
            gloss: "one attains endless fruit/reward (sandhi of अनन्तफलम् 'endless fruit', accusative object, + आप्नोति 'one attains', present verb)"
          }
        ]
      },
      {
        text: "गुरुगीताजपेन तु",
        iast: "gurugītājapena tu",
        words: [
          {
            devanagari: "गुरुगीताजपेन",
            iast: "gurugītājapena",
            gloss: "by repetition of the Guru Gītā (instrumental, compound guru-gītā + japena 'by recitation')"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed, moreover (particle)"
          }
        ]
      },
      {
        text: "सर्वपापप्रशमनं",
        iast: "sarvapāpapraśamanaṃ",
        words: [
          {
            devanagari: "सर्वपापप्रशमनं",
            iast: "sarvapāpapraśamanaṃ",
            gloss: "the complete pacification/destruction of all sin (nominative, predicate; compound sarva + pāpa + praśamanam)"
          }
        ]
      },
      {
        text: "सर्वदारिद्र्यनाशनम्",
        iast: "sarvadāridryanāśanam",
        words: [
          {
            devanagari: "सर्वदारिद्र्यनाशनम्",
            iast: "sarvadāridryanāśanam",
            gloss: "the destruction of all poverty (nominative, predicate; compound sarva + dāridrya + nāśanam)"
          }
        ]
      }
    ],
    meaning: "By reciting the Guru Gītā one attains boundless reward: it is the pacifier of all sin and the destroyer of all poverty.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-135",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 135,
    speakerTag: null,
    padas: [
      {
        text: "कालमृत्युभयहरं",
        iast: "kālamṛtyubhayaharaṃ",
        words: [
          {
            devanagari: "कालमृत्युभयहरं",
            iast: "kālamṛtyubhayaharaṃ",
            gloss: "the remover of the fear of time and death (nominative, predicate adjective; compound kāla 'time' + mṛtyu 'death' + bhaya 'fear' + haram 'removing')"
          }
        ]
      },
      {
        text: "सर्वसङ्कटनाशनम्",
        iast: "sarvasaṅkaṭanāśanam",
        words: [
          {
            devanagari: "सर्वसङ्कटनाशनम्",
            iast: "sarvasaṅkaṭanāśanam",
            gloss: "the destroyer of all calamities (nominative, predicate; compound sarva + saṅkaṭa + nāśanam)"
          }
        ]
      },
      {
        text: "यक्षराक्षसभूतानां",
        iast: "yakṣarākṣasabhūtānāṃ",
        words: [
          {
            devanagari: "यक्षराक्षसभूतानां",
            iast: "yakṣarākṣasabhūtānāṃ",
            gloss: "of yakṣas, rākṣasas, and bhūtas/ghosts (genitive plural, compound yakṣa + rākṣasa + bhūta)"
          }
        ]
      },
      {
        text: "चोरव्याघ्रभयापहम्",
        iast: "coravyāghrabhayāpaham",
        words: [
          {
            devanagari: "चोरव्याघ्रभयापहम्",
            iast: "coravyāghrabhayāpaham",
            gloss: "the taker-away of the fear of thieves and tigers (nominative, predicate; compound cora + vyāghra + bhaya + apaham 'removing', with sandhi bhaya+apaham)"
          }
        ]
      }
    ],
    meaning: "It removes the fear of time and death, destroys all calamities, and takes away the fear of yakṣas, rākṣasas, ghosts, thieves, and tigers.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-136",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 136,
    speakerTag: null,
    padas: [
      {
        text: "महाव्याधिहरं सर्वं",
        iast: "mahāvyādhiharaṃ sarvaṃ",
        words: [
          {
            devanagari: "महाव्याधिहरं",
            iast: "mahāvyādhiharaṃ",
            gloss: "the remover of great diseases (nominative, predicate adjective; compound mahā + vyādhi + haram)"
          },
          {
            devanagari: "सर्वं",
            iast: "sarvaṃ",
            gloss: "entirely, wholly (accusative used adverbially, or 'all')"
          }
        ]
      },
      {
        text: "विभूतिसिद्धिदं भवेत्",
        iast: "vibhūtisiddhidaṃ bhavet",
        words: [
          {
            devanagari: "विभूतिसिद्धिदं",
            iast: "vibhūtisiddhidaṃ",
            gloss: "granting prosperity and spiritual attainments (nominative, predicate adjective; compound vibhūti 'prosperity' + siddhi 'attainment' + dam 'giving')"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "it would be, it becomes (optative verb)"
          }
        ]
      },
      {
        text: "अथवा मोहनं वश्यं",
        iast: "athavā mohanaṃ vaśyaṃ",
        words: [
          {
            devanagari: "अथवा",
            iast: "athavā",
            gloss: "or"
          },
          {
            devanagari: "मोहनं",
            iast: "mohanaṃ",
            gloss: "the power of enchantment/infatuation (accusative noun)"
          },
          {
            devanagari: "वश्यं",
            iast: "vaśyaṃ",
            gloss: "the power of subjugation/control (accusative noun)"
          }
        ]
      },
      {
        text: "स्वयमेव जपेत्सदा",
        iast: "svayameva japetsadā",
        words: [
          {
            devanagari: "स्वयमेव",
            iast: "svayameva",
            gloss: "by oneself, indeed (sandhi of स्वयम् + एव)"
          },
          {
            devanagari: "जपेत्सदा",
            iast: "japetsadā",
            gloss: "should always recite (sandhi of जपेत् + सदा)"
          }
        ]
      }
    ],
    meaning: "It removes all serious diseases and would bestow prosperity and spiritual attainments — or, alternatively, the powers to enchant and to subdue others. One should always recite it oneself.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-137",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 137,
    speakerTag: null,
    padas: [
      {
        text: "वस्त्रासने च दारिद्र्यं",
        iast: "vastrāsane ca dāridryaṃ",
        words: [
          {
            devanagari: "वस्त्रासने",
            iast: "vastrāsane",
            gloss: "on a cloth seat (locative, compound vastra 'cloth' + āsane 'on a seat')"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "दारिद्र्यं",
            iast: "dāridryaṃ",
            gloss: "poverty (nominative/accusative, the resulting condition)"
          }
        ]
      },
      {
        text: "पाषाणे रोगसंभवः",
        iast: "pāṣāṇe rogasaṃbhavaḥ",
        words: [
          {
            devanagari: "पाषाणे",
            iast: "pāṣāṇe",
            gloss: "on stone (locative)"
          },
          {
            devanagari: "रोगसंभवः",
            iast: "rogasaṃbhavaḥ",
            gloss: "the arising of disease (nominative, compound roga + sambhavaḥ)"
          }
        ]
      },
      {
        text: "मोदिन्यां दुःखमाप्नोति",
        iast: "modinyāṃ duḥkhamāpnoti",
        words: [
          {
            devanagari: "मोदिन्यां",
            iast: "modinyāṃ",
            gloss: "on the ground (locative; the received tradition reads this as मेदिन्यां, from medinī 'earth, ground')"
          },
          {
            devanagari: "दुःखमाप्नोति",
            iast: "duḥkhamāpnoti",
            gloss: "one obtains sorrow (sandhi of दुःखम् 'sorrow', accusative, + आप्नोति 'one obtains', present verb)"
          }
        ]
      },
      {
        text: "काष्ठे भवति निष्फलम्",
        iast: "kāṣṭhe bhavati niṣphalam",
        words: [
          {
            devanagari: "काष्ठे",
            iast: "kāṣṭhe",
            gloss: "on wood (locative)"
          },
          {
            devanagari: "भवति",
            iast: "bhavati",
            gloss: "becomes, turns out to be (present verb)"
          },
          {
            devanagari: "निष्फलम्",
            iast: "niṣphalam",
            gloss: "fruitless (nominative predicate adjective)"
          }
        ]
      }
    ],
    meaning: "Reciting it seated on a cloth mat brings poverty; on stone, disease arises; on bare ground one meets with sorrow; and on wood the recitation bears no fruit.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The source prints मोदिन्यां (o-vowel), but the word making sense here — 'on the ground' — is मेदिन्यां (from medinī, 'earth'); this is a well-known orthographic variant in circulating editions, and the gloss follows the meaning rather than the printed vowel."
  },
  {
    id: "guru-gita-138",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 138,
    speakerTag: null,
    padas: [
      {
        text: "कृष्णाजिने ज्ञानसिद्धिर्",
        iast: "kṛṣṇājine jñānasiddhir",
        words: [
          {
            devanagari: "कृष्णाजिने",
            iast: "kṛṣṇājine",
            gloss: "on a black antelope skin (locative, compound kṛṣṇa 'black' + ajina 'hide, skin')"
          },
          {
            devanagari: "ज्ञानसिद्धिर्",
            iast: "jñānasiddhir",
            gloss: "the attainment of knowledge (nominative, compound jñāna + siddhiḥ; here the visarga has sandhi-shifted to र् before the following voiced consonant)"
          }
        ]
      },
      {
        text: "मोक्षश्री व्याघ्रचर्मणि",
        iast: "mokṣaśrī vyāghracarmaṇi",
        words: [
          {
            devanagari: "मोक्षश्री",
            iast: "mokṣaśrī",
            gloss: "the glory/wealth of liberation (nominative, compound mokṣa + śrī)"
          },
          {
            devanagari: "व्याघ्रचर्मणि",
            iast: "vyāghracarmaṇi",
            gloss: "on a tiger skin (locative, compound vyāghra + carmaṇi)"
          }
        ]
      },
      {
        text: "कुशासने ज्ञानसिद्धिः",
        iast: "kuśāsane jñānasiddhiḥ",
        words: [
          {
            devanagari: "कुशासने",
            iast: "kuśāsane",
            gloss: "on a seat of kuśa grass (locative, compound kuśa + āsane)"
          },
          {
            devanagari: "ज्ञानसिद्धिः",
            iast: "jñānasiddhiḥ",
            gloss: "the attainment of knowledge (nominative)"
          }
        ]
      },
      {
        text: "सर्वसिद्धिस्तु कंबले",
        iast: "sarvasiddhistu kaṃbale",
        words: [
          {
            devanagari: "सर्वसिद्धिस्तु",
            iast: "sarvasiddhistu",
            gloss: "but all attainments/siddhis (nominative, sandhi of सर्वसिद्धिः 'all attainment' + तु 'but')"
          },
          {
            devanagari: "कंबले",
            iast: "kaṃbale",
            gloss: "on a wool blanket (locative)"
          }
        ]
      }
    ],
    meaning: "On a black antelope skin, one attains knowledge; on a tiger skin, the glory of liberation. On kuśa grass, knowledge is attained; but on a wool blanket, every siddhi (spiritual attainment) is granted.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-139",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 139,
    speakerTag: null,
    padas: [
      {
        text: "कुशैर्वा दूर्वया देवि",
        iast: "kuśairvā dūrvayā devi",
        words: [
          {
            devanagari: "कुशैर्वा",
            iast: "kuśairvā",
            gloss: "with kuśa grass, or (instrumental, sandhi of कुशैः 'with kuśa grass' + वा 'or')"
          },
          {
            devanagari: "दूर्वया",
            iast: "dūrvayā",
            gloss: "with dūrvā grass (instrumental)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "आसने शुभ्रकंबले",
        iast: "āsane śubhrakaṃbale",
        words: [
          {
            devanagari: "आसने",
            iast: "āsane",
            gloss: "on a seat (locative)"
          },
          {
            devanagari: "शुभ्रकंबले",
            iast: "śubhrakaṃbale",
            gloss: "on a white blanket (locative, in apposition to āsane; compound śubhra 'white' + kambale 'blanket')"
          }
        ]
      },
      {
        text: "उपविश्य ततो देवि",
        iast: "upaviśya tato devi",
        words: [
          {
            devanagari: "उपविश्य",
            iast: "upaviśya",
            gloss: "having sat down (gerund)"
          },
          {
            devanagari: "ततो",
            iast: "tato",
            gloss: "then (sandhi of ततः 'then' before a voiced sound)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "जपेदेकाग्रमानसः",
        iast: "japedekāgramānasaḥ",
        words: [
          {
            devanagari: "जपेदेकाग्रमानसः",
            iast: "japedekāgramānasaḥ",
            gloss: "one should recite with a one-pointed mind (sandhi of जपेत् 'one should recite', optative, + एकाग्रमानसः 'one whose mind is one-pointed', nominative adjective)"
          }
        ]
      }
    ],
    meaning: "O Goddess, having seated oneself upon a seat of kuśa or dūrvā grass covered with a white blanket, one should then recite it, O Goddess, with a one-pointed mind.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-140",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 140,
    speakerTag: null,
    padas: [
      {
        text: "ध्येयं शुक्लं च शान्त्यर्थं",
        iast: "dhyeyaṃ śuklaṃ ca śāntyarthaṃ",
        words: [
          {
            devanagari: "ध्येयं",
            iast: "dhyeyaṃ",
            gloss: "should be contemplated/used (nominative gerundive, neuter — referring to the seat or its color)"
          },
          {
            devanagari: "शुक्लं",
            iast: "śuklaṃ",
            gloss: "white (nominative adjective)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "शान्त्यर्थं",
            iast: "śāntyarthaṃ",
            gloss: "for the purpose of peace (accusative used adverbially, compound śānti + artham)"
          }
        ]
      },
      {
        text: "वश्ये रक्तासनं प्रिये",
        iast: "vaśye raktāsanaṃ priye",
        words: [
          {
            devanagari: "वश्ये",
            iast: "vaśye",
            gloss: "for gaining control over others (locative used to express purpose)"
          },
          {
            devanagari: "रक्तासनं",
            iast: "raktāsanaṃ",
            gloss: "a red seat (nominative/accusative, compound rakta + āsanam)"
          },
          {
            devanagari: "प्रिये",
            iast: "priye",
            gloss: "O Beloved (vocative)"
          }
        ]
      },
      {
        text: "अभिचारे कृष्णवर्णं",
        iast: "abhicāre kṛṣṇavarṇaṃ",
        words: [
          {
            devanagari: "अभिचारे",
            iast: "abhicāre",
            gloss: "for exorcism/black magic (locative expressing purpose)"
          },
          {
            devanagari: "कृष्णवर्णं",
            iast: "kṛṣṇavarṇaṃ",
            gloss: "black-colored (nominative/accusative, compound kṛṣṇa + varṇam)"
          }
        ]
      },
      {
        text: "पीतवर्णं धनागमे",
        iast: "pītavarṇaṃ dhanāgame",
        words: [
          {
            devanagari: "पीतवर्णं",
            iast: "pītavarṇaṃ",
            gloss: "yellow-colored (nominative/accusative, compound pīta + varṇam)"
          },
          {
            devanagari: "धनागमे",
            iast: "dhanāgame",
            gloss: "for the acquisition of wealth (locative expressing purpose, compound dhana + āgame)"
          }
        ]
      }
    ],
    meaning: "For peace, O Beloved, one should use a white seat; for gaining control over others, a red seat; for exorcism, a black one; and for acquiring wealth, a yellow one.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-141",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 141,
    speakerTag: null,
    padas: [
      {
        text: "उत्तरे शान्तिकामस्तु",
        iast: "uttare śāntikāmastu",
        words: [
          {
            devanagari: "उत्तरे",
            iast: "uttare",
            gloss: "facing north (locative)"
          },
          {
            devanagari: "शान्तिकामस्तु",
            iast: "śāntikāmastu",
            gloss: "but one desiring peace (nominative, sandhi of शान्तिकामः 'one desiring peace' + तु 'but')"
          }
        ]
      },
      {
        text: "वश्ये पूर्वमुखो जपेत्",
        iast: "vaśye pūrvamukho japet",
        words: [
          {
            devanagari: "वश्ये",
            iast: "vaśye",
            gloss: "for gaining control over others (locative expressing purpose)"
          },
          {
            devanagari: "पूर्वमुखो",
            iast: "pūrvamukho",
            gloss: "facing east (nominative adjective, sandhi of पूर्वमुखः 'facing east' before a voiced sound)"
          },
          {
            devanagari: "जपेत्",
            iast: "japet",
            gloss: "should recite (optative verb)"
          }
        ]
      },
      {
        text: "दक्षिणे मारणं प्रोक्तं",
        iast: "dakṣiṇe māraṇaṃ proktaṃ",
        words: [
          {
            devanagari: "दक्षिणे",
            iast: "dakṣiṇe",
            gloss: "facing south (locative)"
          },
          {
            devanagari: "मारणं",
            iast: "māraṇaṃ",
            gloss: "the destruction/killing of an enemy (nominative)"
          },
          {
            devanagari: "प्रोक्तं",
            iast: "proktaṃ",
            gloss: "is declared, is said (nominative past passive participle)"
          }
        ]
      },
      {
        text: "पश्चिमे च धनागमः",
        iast: "paścime ca dhanāgamaḥ",
        words: [
          {
            devanagari: "पश्चिमे",
            iast: "paścime",
            gloss: "facing west (locative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "धनागमः",
            iast: "dhanāgamaḥ",
            gloss: "the acquisition of wealth (nominative, compound dhana + āgamaḥ)"
          }
        ]
      }
    ],
    meaning: "One who desires peace should recite facing north; for gaining control over others, facing east. Facing south is said to bring the destruction of an enemy, and facing west, the acquisition of wealth.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-142",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 142,
    speakerTag: null,
    padas: [
      {
        text: "मोहनं सर्वभूतानां",
        iast: "mohanaṃ sarvabhūtānāṃ",
        words: [
          {
            devanagari: "मोहनं",
            iast: "mohanaṃ",
            gloss: "captivating, enchanting (nominative predicate adjective)"
          },
          {
            devanagari: "सर्वभूतानां",
            iast: "sarvabhūtānāṃ",
            gloss: "of all beings/creatures (genitive plural)"
          }
        ]
      },
      {
        text: "बन्धमोक्षकरं भवेत्",
        iast: "bandhamokṣakaraṃ bhavet",
        words: [
          {
            devanagari: "बन्धमोक्षकरं",
            iast: "bandhamokṣakaraṃ",
            gloss: "causing release from bondage (nominative predicate compound: bandha 'bondage' + mokṣa 'release' + karam 'causing')"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "it becomes, may become (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "देवराजप्रियकरं",
        iast: "devarājapriyakaraṃ",
        words: [
          {
            devanagari: "देवराजप्रियकरं",
            iast: "devarājapriyakaraṃ",
            gloss: "endearing to the king of the gods, i.e. Indra (nominative predicate compound: deva-rāja-priya-karam)"
          }
        ]
      },
      {
        text: "सर्वलोकवशं भवेत्",
        iast: "sarvalokavaśaṃ bhavet",
        words: [
          {
            devanagari: "सर्वलोकवशं",
            iast: "sarvalokavaśaṃ",
            gloss: "bringing all worlds under control (nominative predicate compound)"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "it becomes, may become (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "Reciting it makes one captivating to all beings and brings release from bondage; it wins the favor of Indra, lord of the gods, and brings every world under one's sway.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-143",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 143,
    speakerTag: null,
    padas: [
      {
        text: "सर्वेषां स्तंभनकरं",
        iast: "sarveṣāṃ staṃbhanakaraṃ",
        words: [
          {
            devanagari: "सर्वेषां",
            iast: "sarveṣāṃ",
            gloss: "of all [opponents/rivals] (genitive plural)"
          },
          {
            devanagari: "स्तंभनकरं",
            iast: "staṃbhanakaraṃ",
            gloss: "causing the immobilizing/paralyzing (of them) (nominative predicate compound)"
          }
        ]
      },
      {
        text: "गुणानां च विवर्धनम्",
        iast: "guṇānāṃ ca vivardhanam",
        words: [
          {
            devanagari: "गुणानां",
            iast: "guṇānāṃ",
            gloss: "of [one's] good qualities (genitive plural)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "विवर्धनम्",
            iast: "vivardhanam",
            gloss: "the increase, the growth (nominative)"
          }
        ]
      },
      {
        text: "दुष्कर्मनाशनं चैव",
        iast: "duṣkarmanāśanaṃ caiva",
        words: [
          {
            devanagari: "दुष्कर्मनाशनं",
            iast: "duṣkarmanāśanaṃ",
            gloss: "the destruction of bad deeds/misdeeds (nominative)"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed (ca + eva)"
          }
        ]
      },
      {
        text: "सुकर्मसिद्धिदं भवेत्",
        iast: "sukarmasiddhidaṃ bhavet",
        words: [
          {
            devanagari: "सुकर्मसिद्धिदं",
            iast: "sukarmasiddhidaṃ",
            gloss: "the granter of the fruition of good deeds (nominative predicate compound)"
          },
          {
            devanagari: "भवेत्",
            iast: "bhavet",
            gloss: "it becomes, may become (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "It has the power to still every opponent, and it increases one's good qualities; it undoes the effects of bad deeds, and it grants the fruition of good ones.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-144",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 144,
    speakerTag: null,
    padas: [
      {
        text: "असिद्धं साधयेत्कार्यं",
        iast: "asiddhaṃ sādhayetkāryaṃ",
        words: [
          {
            devanagari: "असिद्धं",
            iast: "asiddhaṃ",
            gloss: "an unaccomplished, unfinished (task) (accusative, object)"
          },
          {
            devanagari: "साधयेत्कार्यं",
            iast: "sādhayetkāryaṃ",
            gloss: "sandhi-joined साधयेत् 'would accomplish' (optative verb, 3rd person singular) + कार्यं 'the task' (accusative, object)"
          }
        ]
      },
      {
        text: "नवग्रहभयापहम्",
        iast: "navagrahabhayāpaham",
        words: [
          {
            devanagari: "नवग्रहभयापहम्",
            iast: "navagrahabhayāpaham",
            gloss: "the remover of fear arising from the nine planets (nominative predicate compound: nava-graha-bhaya-apaham)"
          }
        ]
      },
      {
        text: "दुःस्वप्ननाशनं चैव",
        iast: "duḥsvapnanāśanaṃ caiva",
        words: [
          {
            devanagari: "दुःस्वप्ननाशनं",
            iast: "duḥsvapnanāśanaṃ",
            gloss: "the destroyer of bad dreams (nominative)"
          },
          {
            devanagari: "चैव",
            iast: "caiva",
            gloss: "and indeed"
          }
        ]
      },
      {
        text: "सुस्वप्नफलदायकम्",
        iast: "susvapnaphaladāyakam",
        words: [
          {
            devanagari: "सुस्वप्नफलदायकम्",
            iast: "susvapnaphaladāyakam",
            gloss: "the giver of the fruit/benefit of good dreams (nominative predicate compound)"
          }
        ]
      }
    ],
    meaning: "It accomplishes even a task that seemed impossible, and removes the fear caused by the nine planets; it destroys bad dreams and grants the benefit that good dreams bring.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-145",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 145,
    speakerTag: null,
    padas: [
      {
        text: "सर्वशान्तिकरं नित्यं",
        iast: "sarvaśāntikaraṃ nityaṃ",
        words: [
          {
            devanagari: "सर्वशान्तिकरं",
            iast: "sarvaśāntikaraṃ",
            gloss: "the bringer of complete peace (nominative predicate compound)"
          },
          {
            devanagari: "नित्यं",
            iast: "nityaṃ",
            gloss: "always, constantly (adverb)"
          }
        ]
      },
      {
        text: "तथा वन्ध्यासुपुत्रदम्",
        iast: "tathā vandhyāsuputradam",
        words: [
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "likewise, and"
          },
          {
            devanagari: "वन्ध्यासुपुत्रदम्",
            iast: "vandhyāsuputradam",
            gloss: "the giver of a good son to a barren woman (nominative predicate compound: vandhyā-su-putra-dam)"
          }
        ]
      },
      {
        text: "अवैधव्यकरं स्त्रीणां",
        iast: "avaidhavyakaraṃ strīṇāṃ",
        words: [
          {
            devanagari: "अवैधव्यकरं",
            iast: "avaidhavyakaraṃ",
            gloss: "the preventer of widowhood (nominative predicate compound)"
          },
          {
            devanagari: "स्त्रीणां",
            iast: "strīṇāṃ",
            gloss: "for women (genitive plural)"
          }
        ]
      },
      {
        text: "सौभाग्यदायकं सदा",
        iast: "saubhāgyadāyakaṃ sadā",
        words: [
          {
            devanagari: "सौभाग्यदायकं",
            iast: "saubhāgyadāyakaṃ",
            gloss: "the giver of good fortune (nominative predicate compound)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          }
        ]
      }
    ],
    meaning: "It constantly brings complete peace, and likewise grants a fine son to a barren woman; it wards off widowhood for women and forever bestows good fortune.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-146",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 146,
    speakerTag: null,
    padas: [
      {
        text: "आयुरारोग्यमैश्वर्य",
        iast: "āyurārogyamaiśvarya",
        words: [
          {
            devanagari: "आयुरारोग्यमैश्वर्य",
            iast: "āyurārogyamaiśvarya",
            gloss: "longevity, health, and prosperity (compound stem, āyus-ārogya-aiśvarya; grammatically incomplete by itself, continuing without a break into the compound completed in the next pāda)"
          }
        ]
      },
      {
        text: "पुत्रपौत्रप्रवर्धनम्",
        iast: "putrapautrapravardhanam",
        words: [
          {
            devanagari: "पुत्रपौत्रप्रवर्धनम्",
            iast: "putrapautrapravardhanam",
            gloss: "the increase of sons and grandsons (nominative/accusative neuter singular; completes the single compound begun in the previous pāda, the whole meaning 'the increase of longevity, health, prosperity, sons, and grandsons')"
          }
        ]
      },
      {
        text: "अकामतः स्त्री विधवा",
        iast: "akāmataḥ strī vidhavā",
        words: [
          {
            devanagari: "अकामतः",
            iast: "akāmataḥ",
            gloss: "without desire, desirelessly (ablative used adverbially)"
          },
          {
            devanagari: "स्त्री",
            iast: "strī",
            gloss: "a woman (nominative, subject)"
          },
          {
            devanagari: "विधवा",
            iast: "vidhavā",
            gloss: "a widow (nominative, in apposition to स्त्री)"
          }
        ]
      },
      {
        text: "जपान्मोक्षमवाप्नुयात्",
        iast: "japānmokṣamavāpnuyāt",
        words: [
          {
            devanagari: "जपान्मोक्षमवाप्नुयात्",
            iast: "japānmokṣamavāpnuyāt",
            gloss: "sandhi-joined जपात् 'through recitation' (ablative) + मोक्षम् 'liberation' (accusative, object) + अवाप्नुयात् 'would obtain' (optative verb, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "It multiplies longevity, health, prosperity, and one's line of sons and grandsons. And a widow who recites it without any desire attains liberation through that very recitation.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). In the source text the entire first line is printed as one unbroken compound (āyur-ārogya-aiśvarya-putra-pautra-pravardhanam) with no internal word-space, so the required pāda break falls in the middle of that compound rather than at a word boundary — an artifact of the sandhi-run-together printing rather than a real division in sense."
  },
  {
    id: "guru-gita-147",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 147,
    speakerTag: null,
    padas: [
      {
        text: "अवैधव्यं सकामा तु",
        iast: "avaidhavyaṃ sakāmā tu",
        words: [
          {
            devanagari: "अवैधव्यं",
            iast: "avaidhavyaṃ",
            gloss: "freedom from widowhood, non-widowhood (accusative, object)"
          },
          {
            devanagari: "सकामा",
            iast: "sakāmā",
            gloss: "one with desire (nominative feminine, describing the widow)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "but, however"
          }
        ]
      },
      {
        text: "लभते चान्यजन्मनि",
        iast: "labhate cānyajanmani",
        words: [
          {
            devanagari: "लभते",
            iast: "labhate",
            gloss: "obtains, gains (present tense verb, 3rd person singular, middle)"
          },
          {
            devanagari: "चान्यजन्मनि",
            iast: "cānyajanmani",
            gloss: "sandhi-joined च 'and' + अन्यजन्मनि 'in another birth' (locative)"
          }
        ]
      },
      {
        text: "सर्वदुःखभयं विघ्नं",
        iast: "sarvaduḥkhabhayaṃ vighnaṃ",
        words: [
          {
            devanagari: "सर्वदुःखभयं",
            iast: "sarvaduḥkhabhayaṃ",
            gloss: "all sorrow and fear (accusative object compound)"
          },
          {
            devanagari: "विघ्नं",
            iast: "vighnaṃ",
            gloss: "obstacle, hindrance (accusative, object)"
          }
        ]
      },
      {
        text: "नाशयेच्छापहारकम्",
        iast: "nāśayecchāpahārakam",
        words: [
          {
            devanagari: "नाशयेच्छापहारकम्",
            iast: "nāśayecchāpahārakam",
            gloss: "sandhi-joined नाशयेत् 'would destroy' (optative verb, 3rd person singular) + शापहारकम् 'the remover of curses' (nominative predicate compound)"
          }
        ]
      }
    ],
    meaning: "But a widow who recites it with a desire (for remarriage) attains freedom from widowhood in a future birth. It destroys every sorrow, fear, and obstacle, and it lifts the effect of curses.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-148",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 148,
    speakerTag: null,
    padas: [
      {
        text: "सर्वबाधाप्रशमनं",
        iast: "sarvabādhāpraśamanaṃ",
        words: [
          {
            devanagari: "सर्वबाधाप्रशमनं",
            iast: "sarvabādhāpraśamanaṃ",
            gloss: "the pacifier of every affliction (nominative predicate compound)"
          }
        ]
      },
      {
        text: "धर्मार्थकाममोक्षदम्",
        iast: "dharmārthakāmamokṣadam",
        words: [
          {
            devanagari: "धर्मार्थकाममोक्षदम्",
            iast: "dharmārthakāmamokṣadam",
            gloss: "the giver of righteousness, wealth, desire, and liberation, the four aims of life (nominative predicate compound: dharma-artha-kāma-mokṣa-dam)"
          }
        ]
      },
      {
        text: "यं यं चिन्तयते कामं",
        iast: "yaṃ yaṃ cintayate kāmaṃ",
        words: [
          {
            devanagari: "यं",
            iast: "yaṃ",
            gloss: "whatever, which (relative pronoun, accusative)"
          },
          {
            devanagari: "यं",
            iast: "yaṃ",
            gloss: "(repeated for emphasis) whatever (relative pronoun, accusative)"
          },
          {
            devanagari: "चिन्तयते",
            iast: "cintayate",
            gloss: "one thinks of, dwells on (present tense verb, 3rd person singular, middle)"
          },
          {
            devanagari: "कामं",
            iast: "kāmaṃ",
            gloss: "desire, wish (accusative, object)"
          }
        ]
      },
      {
        text: "तं तं प्राप्नोति निश्चितम्",
        iast: "taṃ taṃ prāpnoti niścitam",
        words: [
          {
            devanagari: "तं",
            iast: "taṃ",
            gloss: "that (correlative pronoun, accusative)"
          },
          {
            devanagari: "तं",
            iast: "taṃ",
            gloss: "(repeated for emphasis) that (correlative pronoun, accusative)"
          },
          {
            devanagari: "प्राप्नोति",
            iast: "prāpnoti",
            gloss: "obtains, attains (present tense verb, 3rd person singular)"
          },
          {
            devanagari: "निश्चितम्",
            iast: "niścitam",
            gloss: "certainly, without doubt (adverb)"
          }
        ]
      }
    ],
    meaning: "It quiets every affliction and grants the four aims of life: righteousness, wealth, desire, and liberation. Whatever desire one keeps dwelling on, that very thing one is certain to attain.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-149",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 149,
    speakerTag: null,
    padas: [
      {
        text: "कामितस्य कामधेनुः",
        iast: "kāmitasya kāmadhenuḥ",
        words: [
          {
            devanagari: "कामितस्य",
            iast: "kāmitasya",
            gloss: "for one who desires, of the desirer (genitive)"
          },
          {
            devanagari: "कामधेनुः",
            iast: "kāmadhenuḥ",
            gloss: "the wish-fulfilling cow (nominative predicate)"
          }
        ]
      },
      {
        text: "कल्पनाकल्पपादपः",
        iast: "kalpanākalpapādapaḥ",
        words: [
          {
            devanagari: "कल्पनाकल्पपादपः",
            iast: "kalpanākalpapādapaḥ",
            gloss: "the wish-fulfilling tree for one's imagining/fancy (nominative predicate compound: kalpanā-kalpa-pādapaḥ)"
          }
        ]
      },
      {
        text: "चिन्तामणिश्चिन्तितस्य",
        iast: "cintāmaṇiścintitasya",
        words: [
          {
            devanagari: "चिन्तामणिश्चिन्तितस्य",
            iast: "cintāmaṇiścintitasya",
            gloss: "sandhi-joined चिन्तामणिः 'the wish-fulfilling gem' (nominative predicate) + चिन्तितस्य 'for one who contemplates' (genitive)"
          }
        ]
      },
      {
        text: "सर्वमङ्गलकारकम्",
        iast: "sarvamaṅgalakārakam",
        words: [
          {
            devanagari: "सर्वमङ्गलकारकम्",
            iast: "sarvamaṅgalakārakam",
            gloss: "the cause of every auspicious thing (nominative predicate compound)"
          }
        ]
      }
    ],
    meaning: "For one who desires something, it is the wish-fulfilling cow; for one whose mind fancies something, the wish-fulfilling tree; for one who contemplates, the wish-fulfilling gem. It is the source of every good fortune.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-150",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 150,
    speakerTag: null,
    padas: [
      {
        text: "मोक्षहेतुर्जपेन्नित्यं",
        iast: "mokṣaheturjapennityaṃ",
        words: [
          {
            devanagari: "मोक्षहेतुर्जपेन्नित्यं",
            iast: "mokṣaheturjapennityaṃ",
            gloss: "sandhi-joined मोक्षहेतुः 'one whose aim is liberation' (nominative, subject) + जपेत् 'should recite' (optative verb, 3rd person singular) + नित्यं 'always' (adverb)"
          }
        ]
      },
      {
        text: "मोक्षश्रियमवाप्नुयात्",
        iast: "mokṣaśriyamavāpnuyāt",
        words: [
          {
            devanagari: "मोक्षश्रियमवाप्नुयात्",
            iast: "mokṣaśriyamavāpnuyāt",
            gloss: "sandhi-joined मोक्षश्रियम् 'the glory/fortune of liberation' (accusative, object) + अवाप्नुयात् 'would obtain' (optative verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "भोगकामो जपेद्यो वै",
        iast: "bhogakāmo japedyo vai",
        words: [
          {
            devanagari: "भोगकामो",
            iast: "bhogakāmo",
            gloss: "sandhi form of भोगकामः 'one desiring [worldly] enjoyment' (nominative, describes the subject)"
          },
          {
            devanagari: "जपेद्यो",
            iast: "japedyo",
            gloss: "sandhi-joined जपेत् 'would recite' (optative verb) + यः 'who' (relative pronoun, nominative)"
          },
          {
            devanagari: "वै",
            iast: "vai",
            gloss: "indeed (emphatic particle)"
          }
        ]
      },
      {
        text: "तस्य कामफलप्रदम्",
        iast: "tasya kāmaphalapradam",
        words: [
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "for him, his (genitive)"
          },
          {
            devanagari: "कामफलप्रदम्",
            iast: "kāmaphalapradam",
            gloss: "the giver of the fruit of desire (nominative predicate compound)"
          }
        ]
      }
    ],
    meaning: "One whose goal is liberation should recite it always and will thereby obtain the glory of liberation; and whoever recites it desiring worldly enjoyment will, for his part, receive the fruit of that very desire.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-151",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 151,
    speakerTag: null,
    padas: [
      {
        text: "जपेच्छाक्तश्च सौरश्च",
        iast: "japecchāktaśca sauraśca",
        words: [
          {
            devanagari: "जपेच्छाक्तश्च",
            iast: "japecchāktaśca",
            gloss: "sandhi-joined जपेत् 'let (him) recite' (optative verb, 3rd person singular) + शाक्तः 'a Śākta, a devotee of Śakti' (nominative) + च 'and'"
          },
          {
            devanagari: "सौरश्च",
            iast: "sauraśca",
            gloss: "sandhi-joined सौरः 'a Saura, a sun-worshipper' (nominative) + च 'and'"
          }
        ]
      },
      {
        text: "गाणपत्यश्च वैष्णवः",
        iast: "gāṇapatyaśca vaiṣṇavaḥ",
        words: [
          {
            devanagari: "गाणपत्यश्च",
            iast: "gāṇapatyaśca",
            gloss: "sandhi-joined गाणपत्यः 'a Gāṇapatya, a devotee of Gaṇapati' (nominative) + च 'and'"
          },
          {
            devanagari: "वैष्णवः",
            iast: "vaiṣṇavaḥ",
            gloss: "a Vaiṣṇava, a devotee of Viṣṇu (nominative)"
          }
        ]
      },
      {
        text: "शैवश्च सिद्धिदं देवि",
        iast: "śaivaśca siddhidaṃ devi",
        words: [
          {
            devanagari: "शैवश्च",
            iast: "śaivaśca",
            gloss: "sandhi-joined शैवः 'a Śaiva, a devotee of Śiva' (nominative) + च 'and'"
          },
          {
            devanagari: "सिद्धिदं",
            iast: "siddhidaṃ",
            gloss: "the granter of accomplishment/spiritual power (nominative predicate compound)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "सत्यं सत्यं न संशयः",
        iast: "satyaṃ satyaṃ na saṃśayaḥ",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "truly (accusative used adverbially)"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "(repeated for emphasis) truly (accusative used adverbially)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative; 'there is no doubt')"
          }
        ]
      }
    ],
    meaning: "Let the Śākta, the Saura, the Gāṇapatya, the Vaiṣṇava, and the Śaiva alike recite it, O Goddess — it grants accomplishment to every one of them. This is the truth, the truth; there is no doubt of it.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-152",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 152,
    speakerTag: null,
    padas: [
      {
        text: "अथ काम्यजपे स्थानं",
        iast: "atha kāmyajape sthānaṃ",
        words: [
          {
            devanagari: "अथ",
            iast: "atha",
            gloss: "now, then"
          },
          {
            devanagari: "काम्यजपे",
            iast: "kāmyajape",
            gloss: "in recitation performed for a desired end (locative; kāmya \"desired\" + japa \"recitation\")"
          },
          {
            devanagari: "स्थानं",
            iast: "sthānaṃ",
            gloss: "the place(s) (accusative, object of kathayāmi)"
          }
        ]
      },
      {
        text: "कथयामि वरानने",
        iast: "kathayāmi varānane",
        words: [
          {
            devanagari: "कथयामि",
            iast: "kathayāmi",
            gloss: "I shall tell, declare (present, 1st person)"
          },
          {
            devanagari: "वरानने",
            iast: "varānane",
            gloss: "O fair-faced one (vocative, addressing Pārvatī)"
          }
        ]
      },
      {
        text: "सागरे वा सरित्तीरे",
        iast: "sāgare vā sarittīre",
        words: [
          {
            devanagari: "सागरे",
            iast: "sāgare",
            gloss: "by the ocean (locative)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          },
          {
            devanagari: "सरित्तीरे",
            iast: "sarittīre",
            gloss: "on a riverbank (locative; sarit \"river\" + tīra \"bank\")"
          }
        ]
      },
      {
        text: "ऽथवा हरिहरालये",
        iast: "'thavā hariharālaye",
        words: [
          {
            devanagari: "ऽथवा",
            iast: "'thavā",
            gloss: "or (= अथवा; its initial vowel is elided by sandhi with the preceding tīre, marked by the avagraha)"
          },
          {
            devanagari: "हरिहरालये",
            iast: "hariharālaye",
            gloss: "in a temple of Hari-Hara, i.e. of Viṣṇu-Śiva (locative)"
          }
        ]
      }
    ],
    meaning: "Now, O fair one, I shall tell you the places for reciting the Guru Gītā to fulfill a wish: by the ocean, on a riverbank, or in a temple of Hari or Hara.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). सरित्तीरेऽथवा is one sandhi-joined string in the source spanning the pāda break — तीरे closes the third pāda and ऽथवा (=अथवा, its initial vowel elided) opens the fourth; the split follows the metrical boundary rather than the printed word-gap."
  },
  {
    id: "guru-gita-153",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 153,
    speakerTag: null,
    padas: [
      {
        text: "शक्तिदेवालये गोष्ठे",
        iast: "śaktidevālaye goṣṭhe",
        words: [
          {
            devanagari: "शक्तिदेवालये",
            iast: "śaktidevālaye",
            gloss: "in a temple of Śakti (locative)"
          },
          {
            devanagari: "गोष्ठे",
            iast: "goṣṭhe",
            gloss: "in a cowshed (locative)"
          }
        ]
      },
      {
        text: "सर्वदेवालये शुभे",
        iast: "sarvadevālaye śubhe",
        words: [
          {
            devanagari: "सर्वदेवालये",
            iast: "sarvadevālaye",
            gloss: "in any temple of a deity (locative; sarva \"any\" + devālaya \"god's abode\")"
          },
          {
            devanagari: "शुभे",
            iast: "śubhe",
            gloss: "auspicious, holy (locative adjective, describes devālaye)"
          }
        ]
      },
      {
        text: "वटे च धात्रीमूले वा",
        iast: "vaṭe ca dhātrīmūle vā",
        words: [
          {
            devanagari: "वटे",
            iast: "vaṭe",
            gloss: "at a banyan tree (locative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "धात्रीमूले",
            iast: "dhātrīmūle",
            gloss: "at the root of a dhātrī tree, i.e. the āmalaka/emblic myrobalan (locative)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          }
        ]
      },
      {
        text: "मठे वृन्दावने तथा",
        iast: "maṭhe vṛndāvane tathā",
        words: [
          {
            devanagari: "मठे",
            iast: "maṭhe",
            gloss: "in a hermitage or monastery (locative)"
          },
          {
            devanagari: "वृन्दावने",
            iast: "vṛndāvane",
            gloss: "in Vṛndāvana (locative)"
          },
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "likewise"
          }
        ]
      }
    ],
    meaning: "In a temple of Śakti, in a cowshed, in any holy temple of a deity, at a banyan tree, at the root of a dhātrī tree, or in a hermitage, or likewise in Vṛndāvana.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). धात्री here denotes the āmalaka (emblic-myrobalan) tree, distinct from the dhattūra (thorn-apple) named two verses later in v.155 — the two plants are sometimes conflated in translation, though their ritual associations differ."
  },
  {
    id: "guru-gita-154",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 154,
    speakerTag: null,
    padas: [
      {
        text: "पवित्रे निर्मले स्थाने",
        iast: "pavitre nirmale sthāne",
        words: [
          {
            devanagari: "पवित्रे",
            iast: "pavitre",
            gloss: "in a pure (place) (locative adjective)"
          },
          {
            devanagari: "निर्मले",
            iast: "nirmale",
            gloss: "in a clean, spotless (place) (locative adjective)"
          },
          {
            devanagari: "स्थाने",
            iast: "sthāne",
            gloss: "place (locative noun, modified by pavitre and nirmale)"
          }
        ]
      },
      {
        text: "नित्यानुष्ठानतोऽपि वा",
        iast: "nityānuṣṭhānato'pi vā",
        words: [
          {
            devanagari: "नित्यानुष्ठानतोऽपि",
            iast: "nityānuṣṭhānato'pi",
            gloss: "even through regular, constant practice (ablative sense; nitya \"constant\" + anuṣṭhānataḥ \"through practice\" + api \"even\")"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          }
        ]
      },
      {
        text: "निर्वेदनेन मौनेन",
        iast: "nirvedanena maunena",
        words: [
          {
            devanagari: "निर्वेदनेन",
            iast: "nirvedanena",
            gloss: "with dispassion, detachment (instrumental)"
          },
          {
            devanagari: "मौनेन",
            iast: "maunena",
            gloss: "in silence (instrumental)"
          }
        ]
      },
      {
        text: "जपमेतं समाचरेत्",
        iast: "japametaṃ samācaret",
        words: [
          {
            devanagari: "जपमेतं",
            iast: "japametaṃ",
            gloss: "this recitation (accusative; japam \"recitation\" + etam \"this\")"
          },
          {
            devanagari: "समाचरेत्",
            iast: "samācaret",
            gloss: "one should perform, carry out (optative, 3rd person)"
          }
        ]
      }
    ],
    meaning: "In a pure, clean place — or, indeed, through regular practice — one should carry out this recitation in silence and with dispassion.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-155",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 155,
    speakerTag: null,
    padas: [
      {
        text: "श्मशाने भयभूमौ तु",
        iast: "śmaśāne bhayabhūmau tu",
        words: [
          {
            devanagari: "श्मशाने",
            iast: "śmaśāne",
            gloss: "in a cremation ground (locative)"
          },
          {
            devanagari: "भयभूमौ",
            iast: "bhayabhūmau",
            gloss: "in a fearsome place (locative)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed, but"
          }
        ]
      },
      {
        text: "वटमूलान्तिके तथा",
        iast: "vaṭamūlāntike tathā",
        words: [
          {
            devanagari: "वटमूलान्तिके",
            iast: "vaṭamūlāntike",
            gloss: "near the root of a banyan tree (locative; vaṭa \"banyan\" + mūla \"root\" + antike \"near\")"
          },
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "likewise"
          }
        ]
      },
      {
        text: "सिद्ध्यन्ति धौत्तरे मूले",
        iast: "siddhyanti dhauttare mūle",
        words: [
          {
            devanagari: "सिद्ध्यन्ति",
            iast: "siddhyanti",
            gloss: "[results, siddhis] are attained, succeed (present, 3rd plural)"
          },
          {
            devanagari: "धौत्तरे",
            iast: "dhauttare",
            gloss: "of a dhattūra, thorn-apple tree (locative adjective)"
          },
          {
            devanagari: "मूले",
            iast: "mūle",
            gloss: "at the root (locative)"
          }
        ]
      },
      {
        text: "चूतवृक्षस्य सन्निधौ",
        iast: "cūtavṛkṣasya sannidhau",
        words: [
          {
            devanagari: "चूतवृक्षस्य",
            iast: "cūtavṛkṣasya",
            gloss: "of a mango tree (genitive; cūta \"mango\" + vṛkṣa \"tree\")"
          },
          {
            devanagari: "सन्निधौ",
            iast: "sannidhau",
            gloss: "in the vicinity, nearby (locative)"
          }
        ]
      }
    ],
    meaning: "In a cremation ground, in a fearsome place, likewise near the root of a banyan tree, at the root of a dhattūra tree, or in the vicinity of a mango tree — there one attains success.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-156",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 156,
    speakerTag: null,
    padas: [
      {
        text: "गुरुपुत्रो वरं मूर्खस्",
        iast: "guruputro varaṃ mūrkhas",
        words: [
          {
            devanagari: "गुरुपुत्रो",
            iast: "guruputro",
            gloss: "a son of the Guru, one who is to the Guru as a son (nominative; guru+putra)"
          },
          {
            devanagari: "वरं",
            iast: "varaṃ",
            gloss: "rather, preferably (indeclinable, comparative sense)"
          },
          {
            devanagari: "मूर्खस्",
            iast: "mūrkhas",
            gloss: "a fool (nominative; visarga sandhi-shifted to स् before the following त् of tasya)"
          }
        ]
      },
      {
        text: "तस्य सिद्ध्यन्ति नान्यथा",
        iast: "tasya siddhyanti nānyathā",
        words: [
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "for him, his (genitive)"
          },
          {
            devanagari: "सिद्ध्यन्ति",
            iast: "siddhyanti",
            gloss: "succeed, are accomplished (present, 3rd plural)"
          },
          {
            devanagari: "नान्यथा",
            iast: "nānyathā",
            gloss: "not otherwise (न + अन्यथा)"
          }
        ]
      },
      {
        text: "शुभकर्माणि सर्वाणि",
        iast: "śubhakarmāṇi sarvāṇi",
        words: [
          {
            devanagari: "शुभकर्माणि",
            iast: "śubhakarmāṇi",
            gloss: "auspicious deeds, good actions (nominative plural, subject)"
          },
          {
            devanagari: "सर्वाणि",
            iast: "sarvāṇi",
            gloss: "all (nominative plural, agrees with śubhakarmāṇi)"
          }
        ]
      },
      {
        text: "दीक्षाव्रततपांसि च",
        iast: "dīkṣāvratatapāṃsi ca",
        words: [
          {
            devanagari: "दीक्षाव्रततपांसि",
            iast: "dīkṣāvratatapāṃsi",
            gloss: "initiations, vows, and austerities (nominative plural; dīkṣā+vrata+tapas)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      }
    ],
    meaning: "Better a fool who is a son to the Guru — for him alone, and not otherwise, do all good deeds succeed: initiations, vows, and austerities.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). मूर्खस्तस्य is one sandhi-joined string in the source spanning the pāda break: मूर्खः (\"fool\") closes the first pāda, its visarga shifted to स् before the following त्, while तस्य (\"his\") opens the second."
  },
  {
    id: "guru-gita-157",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 157,
    speakerTag: null,
    padas: [
      {
        text: "संसारमलनाशार्थं",
        iast: "saṃsāramalanāśārthaṃ",
        words: [
          {
            devanagari: "संसारमलनाशार्थं",
            iast: "saṃsāramalanāśārthaṃ",
            gloss: "for the sake of destroying the impurity of worldly existence (accusative of purpose; saṃsāra+mala+nāśa+artham)"
          }
        ]
      },
      {
        text: "भवपाशनिवृत्तये",
        iast: "bhavapāśanivṛttaye",
        words: [
          {
            devanagari: "भवपाशनिवृत्तये",
            iast: "bhavapāśanivṛttaye",
            gloss: "for the cessation of the noose/bondage of worldly existence (dative; bhava+pāśa+nivṛttaye)"
          }
        ]
      },
      {
        text: "गुरुगीताम्भसि स्नानं",
        iast: "gurugītāmbhasi snānaṃ",
        words: [
          {
            devanagari: "गुरुगीताम्भसि",
            iast: "gurugītāmbhasi",
            gloss: "in the waters of the Guru Gītā (locative; guru+gītā+ambhas \"water\")"
          },
          {
            devanagari: "स्नानं",
            iast: "snānaṃ",
            gloss: "bathing (accusative, object of kurute)"
          }
        ]
      },
      {
        text: "तत्त्वज्ञः कुरुते सदा",
        iast: "tattvajñaḥ kurute sadā",
        words: [
          {
            devanagari: "तत्त्वज्ञः",
            iast: "tattvajñaḥ",
            gloss: "the knower of Truth (nominative, subject)"
          },
          {
            devanagari: "कुरुते",
            iast: "kurute",
            gloss: "performs, does (present, 3rd singular)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          }
        ]
      }
    ],
    meaning: "To destroy the impurity of worldly existence and to end the bondage of saṃsāra, the knower of Truth always bathes in the waters of the Guru Gītā.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-158",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 158,
    speakerTag: null,
    padas: [
      {
        text: "स एव च गुरुः साक्षात्",
        iast: "sa eva ca guruḥ sākṣāt",
        words: [
          {
            devanagari: "स",
            iast: "sa",
            gloss: "he (nominative pronoun)"
          },
          {
            devanagari: "एव",
            iast: "eva",
            gloss: "indeed, alone (emphatic particle)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "गुरुः",
            iast: "guruḥ",
            gloss: "the Guru (nominative)"
          },
          {
            devanagari: "साक्षात्",
            iast: "sākṣāt",
            gloss: "directly, verily, in person (adverb)"
          }
        ]
      },
      {
        text: "सदा सद्ब्रह्मवित्तमः",
        iast: "sadā sadbrahmavittamaḥ",
        words: [
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          },
          {
            devanagari: "सद्ब्रह्मवित्तमः",
            iast: "sadbrahmavittamaḥ",
            gloss: "the foremost knower of the true Brahman (nominative superlative; sat+brahma+vit+tama)"
          }
        ]
      },
      {
        text: "तस्य स्थानानि सर्वाणि",
        iast: "tasya sthānāni sarvāṇi",
        words: [
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "his (genitive)"
          },
          {
            devanagari: "स्थानानि",
            iast: "sthānāni",
            gloss: "abodes, places (nominative plural, subject)"
          },
          {
            devanagari: "सर्वाणि",
            iast: "sarvāṇi",
            gloss: "all (nominative plural)"
          }
        ]
      },
      {
        text: "पवित्राणि न संशयः",
        iast: "pavitrāṇi na saṃśayaḥ",
        words: [
          {
            devanagari: "पवित्राणि",
            iast: "pavitrāṇi",
            gloss: "pure, sacred (nominative plural predicate)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative; \"there is no doubt\")"
          }
        ]
      }
    ],
    meaning: "He who is always the foremost knower of the true Brahman — he indeed, verily, is the Guru. All his abodes are sacred; of this there is no doubt.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-159",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 159,
    speakerTag: null,
    padas: [
      {
        text: "सर्वशुद्धः पवित्रोऽसौ",
        iast: "sarvaśuddhaḥ pavitro'sau",
        words: [
          {
            devanagari: "सर्वशुद्धः",
            iast: "sarvaśuddhaḥ",
            gloss: "utterly pure (nominative; sarva+śuddha)"
          },
          {
            devanagari: "पवित्रोऽसौ",
            iast: "pavitro'sau",
            gloss: "this holy one (nominative; pavitraḥ \"pure\" + asau \"this, he\")"
          }
        ]
      },
      {
        text: "स्वभावाद्यत्र तिष्ठति",
        iast: "svabhāvādyatra tiṣṭhati",
        words: [
          {
            devanagari: "स्वभावाद्यत्र",
            iast: "svabhāvādyatra",
            gloss: "wherever, by his very nature (combines svabhāvāt \"by nature\" + yatra \"where\")"
          },
          {
            devanagari: "तिष्ठति",
            iast: "tiṣṭhati",
            gloss: "stays, dwells (present, 3rd singular)"
          }
        ]
      },
      {
        text: "तत्र देवगणाः सर्वे",
        iast: "tatra devagaṇāḥ sarve",
        words: [
          {
            devanagari: "तत्र",
            iast: "tatra",
            gloss: "there"
          },
          {
            devanagari: "देवगणाः",
            iast: "devagaṇāḥ",
            gloss: "hosts of devas (nominative plural, subject)"
          },
          {
            devanagari: "सर्वे",
            iast: "sarve",
            gloss: "all (nominative plural)"
          }
        ]
      },
      {
        text: "क्षेत्रे पीठे वसन्ति हि",
        iast: "kṣetre pīṭhe vasanti hi",
        words: [
          {
            devanagari: "क्षेत्रे",
            iast: "kṣetre",
            gloss: "in that sacred region, field (locative)"
          },
          {
            devanagari: "पीठे",
            iast: "pīṭhe",
            gloss: "in that seat, abode (locative)"
          },
          {
            devanagari: "वसन्ति",
            iast: "vasanti",
            gloss: "dwell (present, 3rd plural)"
          },
          {
            devanagari: "हि",
            iast: "hi",
            gloss: "indeed, verily"
          }
        ]
      }
    ],
    meaning: "Wherever this utterly pure and holy one dwells by his very nature, there indeed all the hosts of devas come to dwell — in that sacred region, in that seat.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-160",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 160,
    speakerTag: null,
    padas: [
      {
        text: "आसनस्थः शयानो वा",
        iast: "āsanasthaḥ śayāno vā",
        words: [
          {
            devanagari: "आसनस्थः",
            iast: "āsanasthaḥ",
            gloss: "seated, in a sitting posture (nominative; āsana+stha)"
          },
          {
            devanagari: "शयानो",
            iast: "śayāno",
            gloss: "lying down (nominative present participle)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          }
        ]
      },
      {
        text: "गच्छंस्तिष्ठन् वदन्नपि",
        iast: "gacchaṃstiṣṭhan vadannapi",
        words: [
          {
            devanagari: "गच्छंस्तिष्ठन्",
            iast: "gacchaṃstiṣṭhan",
            gloss: "walking or standing (nominative, combining gacchan \"going\" + tiṣṭhan \"standing\" by sandhi)"
          },
          {
            devanagari: "वदन्नपि",
            iast: "vadannapi",
            gloss: "even while speaking (combining vadan \"speaking\" + api \"even\")"
          }
        ]
      },
      {
        text: "अश्वारूढो गजारूढः",
        iast: "aśvārūḍho gajārūḍhaḥ",
        words: [
          {
            devanagari: "अश्वारूढो",
            iast: "aśvārūḍho",
            gloss: "mounted on a horse (nominative; aśva+ārūḍha)"
          },
          {
            devanagari: "गजारूढः",
            iast: "gajārūḍhaḥ",
            gloss: "mounted on an elephant (nominative; gaja+ārūḍha)"
          }
        ]
      },
      {
        text: "सुप्तो वा जागृतोऽपि वा",
        iast: "supto vā jāgṛto'pi vā",
        words: [
          {
            devanagari: "सुप्तो",
            iast: "supto",
            gloss: "asleep (nominative)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          },
          {
            devanagari: "जागृतोऽपि",
            iast: "jāgṛto'pi",
            gloss: "even while awake (nominative; jāgṛtaḥ+api)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          }
        ]
      }
    ],
    meaning: "One should keep reciting it in every state — whether seated or lying down, walking, standing, or even speaking, mounted on a horse or on an elephant, asleep or even awake.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse has no finite verb of its own — it is a list of postures/states continuing the surrounding discussion of when the Guru Gītā may be recited; the implied verb (\"one should recite\") is supplied from context and does not itself appear in the Sanskrit."
  },
  {
    id: "guru-gita-161",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 161,
    speakerTag: null,
    padas: [
      {
        text: "शुचिष्मांश्च सदा ज्ञानी",
        iast: "śuciṣmāṃśca sadā jñānī",
        words: [
          {
            devanagari: "शुचिष्मांश्च",
            iast: "śuciṣmāṃśca",
            gloss: "and the pure one (nominative; śuciṣmān \"possessing purity\" + ca \"and\")"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          },
          {
            devanagari: "ज्ञानी",
            iast: "jñānī",
            gloss: "the wise one, knower (nominative)"
          }
        ]
      },
      {
        text: "गुरुगीताजपेन तु",
        iast: "gurugītājapena tu",
        words: [
          {
            devanagari: "गुरुगीताजपेन",
            iast: "gurugītājapena",
            gloss: "by recitation of the Guru Gītā (instrumental; guru+gītā+japa+ena)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed, but"
          }
        ]
      },
      {
        text: "तस्य दर्शनमात्रेण",
        iast: "tasya darśanamātreṇa",
        words: [
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "of him (genitive)"
          },
          {
            devanagari: "दर्शनमात्रेण",
            iast: "darśanamātreṇa",
            gloss: "by the mere sight (instrumental; darśana+mātra+ena)"
          }
        ]
      },
      {
        text: "पुनर्जन्म न विद्यते",
        iast: "punarjanma na vidyate",
        words: [
          {
            devanagari: "पुनर्जन्म",
            iast: "punarjanma",
            gloss: "rebirth (nominative, subject)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "विद्यते",
            iast: "vidyate",
            gloss: "exists, occurs (present, 3rd singular)"
          }
        ]
      }
    ],
    meaning: "One who through recitation of the Guru Gītā is ever pure and wise — merely by the sight of him, there is no rebirth for the beholder.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-162",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 162,
    speakerTag: null,
    padas: [
      {
        text: "समुद्रे च यथा तोयं",
        iast: "samudre ca yathā toyaṃ",
        words: [
          {
            devanagari: "समुद्रे",
            iast: "samudre",
            gloss: "in the ocean (locative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "यथा",
            iast: "yathā",
            gloss: "just as, in the same way as"
          },
          {
            devanagari: "तोयं",
            iast: "toyaṃ",
            gloss: "water (nominative, subject; sandhi form of तोयम्)"
          }
        ]
      },
      {
        text: "क्षीरे क्षीरं घृते घृतम्",
        iast: "kṣīre kṣīraṃ ghṛte ghṛtam",
        words: [
          {
            devanagari: "क्षीरे",
            iast: "kṣīre",
            gloss: "in milk (locative)"
          },
          {
            devanagari: "क्षीरं",
            iast: "kṣīraṃ",
            gloss: "milk (nominative, subject; sandhi form of क्षीरम्)"
          },
          {
            devanagari: "घृते",
            iast: "ghṛte",
            gloss: "in ghee (locative)"
          },
          {
            devanagari: "घृतम्",
            iast: "ghṛtam",
            gloss: "ghee (nominative, subject)"
          }
        ]
      },
      {
        text: "भिन्ने कुंभे यथाकाशस्",
        iast: "bhinne kuṃbhe yathākāśas",
        words: [
          {
            devanagari: "भिन्ने",
            iast: "bhinne",
            gloss: "broken (locative, describing कुंभे)"
          },
          {
            devanagari: "कुंभे",
            iast: "kuṃbhe",
            gloss: "pot, jar (locative)"
          },
          {
            devanagari: "यथाकाशस्",
            iast: "yathākāśas",
            gloss: "as [does] the space/ether (यथा \"as\" + आकाशः \"space\", nominative subject; sandhi form of यथा आकाशः)"
          }
        ]
      },
      {
        text: "तथात्मा परमात्मनि",
        iast: "tathātmā paramātmani",
        words: [
          {
            devanagari: "तथात्मा",
            iast: "tathātmā",
            gloss: "so [does] the individual self (तथा \"thus\" + आत्मा \"self\", nominative subject)"
          },
          {
            devanagari: "परमात्मनि",
            iast: "paramātmani",
            gloss: "in the Supreme Self (locative)"
          }
        ]
      }
    ],
    meaning: "Just as water merges into the ocean, milk into milk, and ghee into ghee, and just as the space enclosed within a broken pot merges into the space outside it, so does the individual soul merge into the Supreme Self.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-163",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 163,
    speakerTag: null,
    padas: [
      {
        text: "तथैव ज्ञानी जीवात्मा",
        iast: "tathaiva jñānī jīvātmā",
        words: [
          {
            devanagari: "तथैव",
            iast: "tathaiva",
            gloss: "in that very same way, likewise"
          },
          {
            devanagari: "ज्ञानी",
            iast: "jñānī",
            gloss: "the knower, the wise one (nominative, subject)"
          },
          {
            devanagari: "जीवात्मा",
            iast: "jīvātmā",
            gloss: "the individual soul (nominative, in apposition to ज्ञानी — जीव \"living being\" + आत्मा \"self\")"
          }
        ]
      },
      {
        text: "परमात्मनि लीयते",
        iast: "paramātmani līyate",
        words: [
          {
            devanagari: "परमात्मनि",
            iast: "paramātmani",
            gloss: "into the Supreme Self (locative)"
          },
          {
            devanagari: "लीयते",
            iast: "līyate",
            gloss: "dissolves, merges (present verb, 3rd person singular)"
          }
        ]
      },
      {
        text: "ऐक्येन रमते ज्ञानी",
        iast: "aikyena ramate jñānī",
        words: [
          {
            devanagari: "ऐक्येन",
            iast: "aikyena",
            gloss: "through oneness, in unity (instrumental)"
          },
          {
            devanagari: "रमते",
            iast: "ramate",
            gloss: "delights, revels (present verb, 3rd person singular)"
          },
          {
            devanagari: "ज्ञानी",
            iast: "jñānī",
            gloss: "the wise one (nominative, subject)"
          }
        ]
      },
      {
        text: "यत्र तत्र दिवानिशम्",
        iast: "yatra tatra divāniśam",
        words: [
          {
            devanagari: "यत्र",
            iast: "yatra",
            gloss: "where, wherever"
          },
          {
            devanagari: "तत्र",
            iast: "tatra",
            gloss: "there (यत्र तत्र together: \"here and there, everywhere\")"
          },
          {
            devanagari: "दिवानिशम्",
            iast: "divāniśam",
            gloss: "day and night (adverbial accusative compound; दिवा \"day\" + निशा \"night\" joined as a dvandva and inflected together as one neuter adverb meaning \"day and night\")"
          }
        ]
      }
    ],
    meaning: "In just this way, the wise individual soul dissolves into the Supreme Self; the knower revels in that oneness everywhere, day and night.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-164",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 164,
    speakerTag: null,
    padas: [
      {
        text: "एवंविधो महामुक्तः",
        iast: "evaṃvidho mahāmuktaḥ",
        words: [
          {
            devanagari: "एवंविधो",
            iast: "evaṃvidho",
            gloss: "of such a kind, thus disposed (nominative adjective; sandhi form of एवंविधः)"
          },
          {
            devanagari: "महामुक्तः",
            iast: "mahāmuktaḥ",
            gloss: "greatly liberated, one of supreme freedom (nominative predicate adjective)"
          }
        ]
      },
      {
        text: "सर्वदा वर्तते बुधः",
        iast: "sarvadā vartate budhaḥ",
        words: [
          {
            devanagari: "सर्वदा",
            iast: "sarvadā",
            gloss: "always"
          },
          {
            devanagari: "वर्तते",
            iast: "vartate",
            gloss: "remains, abides (present verb, 3rd person singular)"
          },
          {
            devanagari: "बुधः",
            iast: "budhaḥ",
            gloss: "the wise one (nominative, subject)"
          }
        ]
      },
      {
        text: "तस्य सर्वप्रयत्नेन",
        iast: "tasya sarvaprayatnena",
        words: [
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "of him, for him (genitive, correlative with यः)"
          },
          {
            devanagari: "सर्वप्रयत्नेन",
            iast: "sarvaprayatnena",
            gloss: "with complete, utmost effort (instrumental)"
          }
        ]
      },
      {
        text: "भावभक्तिं करोति यः",
        iast: "bhāvabhaktiṃ karoti yaḥ",
        words: [
          {
            devanagari: "भावभक्तिं",
            iast: "bhāvabhaktiṃ",
            gloss: "heartfelt devotion, devotion of feeling (accusative, object of करोति)"
          },
          {
            devanagari: "करोति",
            iast: "karoti",
            gloss: "does, performs (present verb, 3rd person singular)"
          },
          {
            devanagari: "यः",
            iast: "yaḥ",
            gloss: "who (relative pronoun, nominative, subject of करोति)"
          }
        ]
      }
    ],
    meaning: "Such a person — one who, with utmost effort, cultivates heartfelt devotion — always abides as a wise being of supreme liberation.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The link between तस्य and the relative यः is a loose correlative construction (\"for him who...\") rather than a single unbroken clause, so translators render the causal connection between devotion and liberation with slightly different phrasing."
  },
  {
    id: "guru-gita-165",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 165,
    speakerTag: null,
    padas: [
      {
        text: "सर्वसन्देहरहितो",
        iast: "sarvasandeharahito",
        words: [
          {
            devanagari: "सर्वसन्देहरहितो",
            iast: "sarvasandeharahito",
            gloss: "free from all doubt (nominative adjective; सर्व \"all\" + सन्देह \"doubt\" + रहित \"devoid of\"; sandhi form of सर्वसन्देहरहितः)"
          }
        ]
      },
      {
        text: "मुक्तो भवति पार्वति",
        iast: "mukto bhavati pārvati",
        words: [
          {
            devanagari: "मुक्तो",
            iast: "mukto",
            gloss: "liberated, freed (nominative predicate adjective; sandhi form of मुक्तः)"
          },
          {
            devanagari: "भवति",
            iast: "bhavati",
            gloss: "becomes (present verb, 3rd person singular)"
          },
          {
            devanagari: "पार्वति",
            iast: "pārvati",
            gloss: "O Pārvatī (vocative)"
          }
        ]
      },
      {
        text: "भुक्तिमुक्तिद्वयं तस्य",
        iast: "bhuktimuktidvayaṃ tasya",
        words: [
          {
            devanagari: "भुक्तिमुक्तिद्वयं",
            iast: "bhuktimuktidvayaṃ",
            gloss: "the pair of enjoyment and liberation (nominative, subject; भुक्ति \"enjoyment\" + मुक्ति \"liberation\" + द्वयं \"pair, both\")"
          },
          {
            devanagari: "तस्य",
            iast: "tasya",
            gloss: "his, belonging to him (genitive)"
          }
        ]
      },
      {
        text: "जिह्वाग्रे च सरस्वती",
        iast: "jihvāgre ca sarasvatī",
        words: [
          {
            devanagari: "जिह्वाग्रे",
            iast: "jihvāgre",
            gloss: "on the tip of the tongue (locative; जिह्वा \"tongue\" + अग्रे \"at the tip\")"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "सरस्वती",
            iast: "sarasvatī",
            gloss: "Sarasvatī, goddess of speech (nominative, subject)"
          }
        ]
      }
    ],
    meaning: "Free of all doubt, he becomes liberated, O Pārvatī; both enjoyment and liberation are his, and Sarasvatī herself dwells on the tip of his tongue.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-166",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 166,
    speakerTag: null,
    padas: [
      {
        text: "अनेन प्राणिनः सर्वे",
        iast: "anena prāṇinaḥ sarve",
        words: [
          {
            devanagari: "अनेन",
            iast: "anena",
            gloss: "by this (instrumental, referring to the Guru Gītā)"
          },
          {
            devanagari: "प्राणिनः",
            iast: "prāṇinaḥ",
            gloss: "living beings (nominative plural, subject)"
          },
          {
            devanagari: "सर्वे",
            iast: "sarve",
            gloss: "all (nominative plural adjective)"
          }
        ]
      },
      {
        text: "गुरुगीता जपेन तु",
        iast: "gurugītā japena tu",
        words: [
          {
            devanagari: "गुरुगीता",
            iast: "gurugītā",
            gloss: "the Guru Gītā (uninflected stem functioning with जपेन: \"by recitation of the Guru Gītā\")"
          },
          {
            devanagari: "जपेन",
            iast: "japena",
            gloss: "by recitation, by repetition (instrumental)"
          },
          {
            devanagari: "तु",
            iast: "tu",
            gloss: "indeed (emphatic particle)"
          }
        ]
      },
      {
        text: "सर्वसिद्धिं प्राप्नुवन्ति",
        iast: "sarvasiddhiṃ prāpnuvanti",
        words: [
          {
            devanagari: "सर्वसिद्धिं",
            iast: "sarvasiddhiṃ",
            gloss: "every accomplishment, all siddhi (accusative, object)"
          },
          {
            devanagari: "प्राप्नुवन्ति",
            iast: "prāpnuvanti",
            gloss: "obtain, attain (present verb, 3rd person plural)"
          }
        ]
      },
      {
        text: "भुक्तिं मुक्तिं न संशयः",
        iast: "bhuktiṃ muktiṃ na saṃśayaḥ",
        words: [
          {
            devanagari: "भुक्तिं",
            iast: "bhuktiṃ",
            gloss: "worldly enjoyment (accusative, in apposition to सर्वसिद्धिं)"
          },
          {
            devanagari: "मुक्तिं",
            iast: "muktiṃ",
            gloss: "liberation (accusative, in apposition)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative, subject of an implied \"there is\")"
          }
        ]
      }
    ],
    meaning: "By this alone — by reciting the Guru Gītā — all living beings attain every accomplishment, both worldly enjoyment and liberation; of this there is no doubt.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-167",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 167,
    speakerTag: null,
    padas: [
      {
        text: "सत्यं सत्यं पुनः सत्यं",
        iast: "satyaṃ satyaṃ punaḥ satyaṃ",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true, truth (nominative/adverbial predicate)"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true [repeated for emphasis]"
          },
          {
            devanagari: "पुनः",
            iast: "punaḥ",
            gloss: "again"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true [repeated a third time]"
          }
        ]
      },
      {
        text: "धर्म्यं साङ्ख्यं मयोदितम्",
        iast: "dharmyaṃ sāṅkhyaṃ mayoditam",
        words: [
          {
            devanagari: "धर्म्यं",
            iast: "dharmyaṃ",
            gloss: "in accordance with dharma, righteous (accusative adjective)"
          },
          {
            devanagari: "साङ्ख्यं",
            iast: "sāṅkhyaṃ",
            gloss: "[true] wisdom, discriminative knowledge (accusative)"
          },
          {
            devanagari: "मयोदितम्",
            iast: "mayoditam",
            gloss: "spoken by me (accusative past participle; मया \"by me\" + उदितम् \"uttered\")"
          }
        ]
      },
      {
        text: "गुरुगीतासमं नास्ति",
        iast: "gurugītāsamaṃ nāsti",
        words: [
          {
            devanagari: "गुरुगीतासमं",
            iast: "gurugītāsamaṃ",
            gloss: "equal to the Guru Gītā (nominative/accusative adjective; गुरुगीता + सम \"equal to\")"
          },
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not"
          }
        ]
      },
      {
        text: "सत्यं सत्यं वरानने",
        iast: "satyaṃ satyaṃ varānane",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true [repeated]"
          },
          {
            devanagari: "वरानने",
            iast: "varānane",
            gloss: "O one of beautiful face (vocative, epithet of Pārvatī)"
          }
        ]
      }
    ],
    meaning: "True, true, and true again is what I have spoken — righteous, discriminating wisdom. There is nothing equal to the Guru Gītā; this is the truth, the truth, O lovely-faced one.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-168",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 168,
    speakerTag: null,
    padas: [
      {
        text: "एको देव एकधर्म",
        iast: "eko deva ekadharma",
        words: [
          {
            devanagari: "एको",
            iast: "eko",
            gloss: "one, single (nominative adjective; sandhi form of एकः)"
          },
          {
            devanagari: "देव",
            iast: "deva",
            gloss: "God, deity (nominative, subject)"
          },
          {
            devanagari: "एकधर्म",
            iast: "ekadharma",
            gloss: "one dharma, a single [right] duty (nominative compound; एक \"one\" + धर्म \"dharma\")"
          }
        ]
      },
      {
        text: "एकनिष्ठा परं तपः",
        iast: "ekaniṣṭhā paraṃ tapaḥ",
        words: [
          {
            devanagari: "एकनिष्ठा",
            iast: "ekaniṣṭhā",
            gloss: "single-minded devotion, unwavering fidelity (nominative)"
          },
          {
            devanagari: "परं",
            iast: "paraṃ",
            gloss: "supreme, highest (nominative adjective)"
          },
          {
            devanagari: "तपः",
            iast: "tapaḥ",
            gloss: "austerity (nominative, subject/predicate)"
          }
        ]
      },
      {
        text: "गुरोः परतरं नान्यन्",
        iast: "guroḥ parataraṃ nānyan",
        words: [
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "than the Guru (ablative, object of comparison)"
          },
          {
            devanagari: "परतरं",
            iast: "parataraṃ",
            gloss: "higher, more supreme (nominative/accusative adjective)"
          },
          {
            devanagari: "नान्यन्",
            iast: "nānyan",
            gloss: "nothing else (न \"not\" + अन्यत् \"other\"; sandhi form)"
          }
        ]
      },
      {
        text: "नास्ति तत्त्वं गुरोः परम्",
        iast: "nāsti tattvaṃ guroḥ param",
        words: [
          {
            devanagari: "नास्ति",
            iast: "nāsti",
            gloss: "there is not"
          },
          {
            devanagari: "तत्त्वं",
            iast: "tattvaṃ",
            gloss: "truth, reality (nominative, subject)"
          },
          {
            devanagari: "गुरोः",
            iast: "guroḥ",
            gloss: "than the Guru (ablative)"
          },
          {
            devanagari: "परम्",
            iast: "param",
            gloss: "higher, beyond (nominative/accusative adjective)"
          }
        ]
      }
    ],
    meaning: "One God, one dharma, and single-pointed devotion — these are the highest austerity. There is nothing else higher than the Guru; no truth surpasses him.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-169",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 169,
    speakerTag: null,
    padas: [
      {
        text: "माता धन्या पिता धन्यो",
        iast: "mātā dhanyā pitā dhanyo",
        words: [
          {
            devanagari: "माता",
            iast: "mātā",
            gloss: "mother (nominative, subject)"
          },
          {
            devanagari: "धन्या",
            iast: "dhanyā",
            gloss: "blessed, fortunate (nominative feminine adjective)"
          },
          {
            devanagari: "पिता",
            iast: "pitā",
            gloss: "father (nominative, subject)"
          },
          {
            devanagari: "धन्यो",
            iast: "dhanyo",
            gloss: "blessed, fortunate (nominative masculine adjective; sandhi form of धन्यः)"
          }
        ]
      },
      {
        text: "धन्यो वंशः कुलं तथा",
        iast: "dhanyo vaṃśaḥ kulaṃ tathā",
        words: [
          {
            devanagari: "धन्यो",
            iast: "dhanyo",
            gloss: "blessed (sandhi form of धन्यः)"
          },
          {
            devanagari: "वंशः",
            iast: "vaṃśaḥ",
            gloss: "lineage, family line (nominative, subject)"
          },
          {
            devanagari: "कुलं",
            iast: "kulaṃ",
            gloss: "clan, family (nominative, subject)"
          },
          {
            devanagari: "तथा",
            iast: "tathā",
            gloss: "likewise, also"
          }
        ]
      },
      {
        text: "धन्या च वसुधा देवि",
        iast: "dhanyā ca vasudhā devi",
        words: [
          {
            devanagari: "धन्या",
            iast: "dhanyā",
            gloss: "blessed (nominative feminine adjective)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "वसुधा",
            iast: "vasudhā",
            gloss: "the earth (nominative, subject; literally \"wealth-bearer\")"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "गुरुभक्तिः सुदुर्लभा",
        iast: "gurubhaktiḥ sudurlabhā",
        words: [
          {
            devanagari: "गुरुभक्तिः",
            iast: "gurubhaktiḥ",
            gloss: "devotion to the Guru (nominative, subject)"
          },
          {
            devanagari: "सुदुर्लभा",
            iast: "sudurlabhā",
            gloss: "very rare, extremely hard to attain (nominative feminine adjective)"
          }
        ]
      }
    ],
    meaning: "Blessed is the mother, blessed the father, blessed too the lineage and family, and blessed is the earth, O Goddess — for devotion to the Guru is exceedingly rare.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-170",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 170,
    speakerTag: null,
    padas: [
      {
        text: "शरीरमिन्द्रियं प्राणाश्",
        iast: "śarīramindriyaṃ prāṇāś",
        words: [
          {
            devanagari: "शरीरमिन्द्रियं",
            iast: "śarīramindriyaṃ",
            gloss: "the body and the senses (nominative, listed together; शरीरम् \"body\" + इन्द्रियम् \"sense organ\", sandhi-joined)"
          },
          {
            devanagari: "प्राणाश्",
            iast: "prāṇāś",
            gloss: "the vital breaths (nominative plural; sandhi form of प्राणाः)"
          }
        ]
      },
      {
        text: "चार्थः स्वजनबान्धवाः",
        iast: "cārthaḥ svajanabāndhavāḥ",
        words: [
          {
            devanagari: "चार्थः",
            iast: "cārthaḥ",
            gloss: "and wealth, and purpose (nominative; च \"and\" + अर्थः \"wealth/purpose\", sandhi-joined)"
          },
          {
            devanagari: "स्वजनबान्धवाः",
            iast: "svajanabāndhavāḥ",
            gloss: "kinsmen and relatives (nominative plural; स्वजन \"one's own people\" + बान्धवाः \"relatives\")"
          }
        ]
      },
      {
        text: "माता पिता कुलं देवि",
        iast: "mātā pitā kulaṃ devi",
        words: [
          {
            devanagari: "माता",
            iast: "mātā",
            gloss: "mother (nominative)"
          },
          {
            devanagari: "पिता",
            iast: "pitā",
            gloss: "father (nominative)"
          },
          {
            devanagari: "कुलं",
            iast: "kulaṃ",
            gloss: "family, clan (nominative)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "गुरुरेव न संशयः",
        iast: "gurureva na saṃśayaḥ",
        words: [
          {
            devanagari: "गुरुरेव",
            iast: "gurureva",
            gloss: "the Guru alone, verily the Guru (nominative; गुरुः + एव, sandhi-joined)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "संशयः",
            iast: "saṃśayaḥ",
            gloss: "doubt (nominative, subject)"
          }
        ]
      }
    ],
    meaning: "The body, the senses, the vital breaths, wealth, kinsmen and relatives, mother, father, family, O Goddess — all these are, without doubt, the Guru himself.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-171",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 171,
    speakerTag: null,
    padas: [
      {
        text: "आकल्पजन्मना कोट्या",
        iast: "ākalpajanmanā koṭyā",
        words: [
          {
            devanagari: "आकल्पजन्मना",
            iast: "ākalpajanmanā",
            gloss: "through births lasting until the end of an aeon (instrumental compound; आ-कल्प \"until the end of a kalpa\" + जन्मना \"by birth\")"
          },
          {
            devanagari: "कोट्या",
            iast: "koṭyā",
            gloss: "by ten million, i.e. countless [births] (instrumental; कोटि \"ten million\")"
          }
        ]
      },
      {
        text: "जपव्रततपःक्रियाः",
        iast: "japavratatapaḥkriyāḥ",
        words: [
          {
            devanagari: "जपव्रततपःक्रियाः",
            iast: "japavratatapaḥkriyāḥ",
            gloss: "the acts of recitation, vows, and austerity (nominative plural compound; जप \"recitation\" + व्रत \"vow\" + तपः \"austerity\" + क्रियाः \"acts, rites\")"
          }
        ]
      },
      {
        text: "तत्सर्वं सफलं देवि",
        iast: "tatsarvaṃ saphalaṃ devi",
        words: [
          {
            devanagari: "तत्सर्वं",
            iast: "tatsarvaṃ",
            gloss: "all that (nominative, subject; तत् \"that\" + सर्वं \"all\")"
          },
          {
            devanagari: "सफलं",
            iast: "saphalaṃ",
            gloss: "fruitful, bearing fruit (predicate adjective)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "गुरुसंतोषमात्रतः",
        iast: "gurusaṃtoṣamātrataḥ",
        words: [
          {
            devanagari: "गुरुसंतोषमात्रतः",
            iast: "gurusaṃtoṣamātrataḥ",
            gloss: "merely from [causing] the Guru's satisfaction (ablative compound; गुरु \"Guru\" + संतोष \"satisfaction\" + मात्रतः \"by the mere fact of\")"
          }
        ]
      }
    ],
    meaning: "O Goddess, all the acts of recitation, vows, and austerities performed through countless births, even until the end of an aeon, become fruitful the very moment the Guru is pleased.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-172",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 172,
    speakerTag: null,
    padas: [
      {
        text: "विद्यातपोबलेनैव",
        iast: "vidyātapobalenaiva",
        words: [
          {
            devanagari: "विद्यातपोबलेनैव",
            iast: "vidyātapobalenaiva",
            gloss: "by the strength of learning and austerity, indeed (instrumental compound: vidyā 'learning' + tapas 'austerity' + bala 'strength' + eva 'indeed')"
          }
        ]
      },
      {
        text: "मन्दभाग्याश्च ये नराः",
        iast: "mandabhāgyāśca ye narāḥ",
        words: [
          {
            devanagari: "मन्दभाग्याश्च",
            iast: "mandabhāgyāśca",
            gloss: "and of meager fortune, unlucky (nominative plural adjective mandabhāgyāḥ + ca 'and')"
          },
          {
            devanagari: "ये",
            iast: "ye",
            gloss: "who (relative pronoun, nominative plural)"
          },
          {
            devanagari: "नराः",
            iast: "narāḥ",
            gloss: "men (nominative plural, subject)"
          }
        ]
      },
      {
        text: "गुरुसेवां न कुर्वन्ति",
        iast: "gurusevāṃ na kurvanti",
        words: [
          {
            devanagari: "गुरुसेवां",
            iast: "gurusevāṃ",
            gloss: "service to the Guru (accusative, object)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "कुर्वन्ति",
            iast: "kurvanti",
            gloss: "do, perform (present tense, 3rd person plural)"
          }
        ]
      },
      {
        text: "सत्यं सत्यं वरानने",
        iast: "satyaṃ satyaṃ varānane",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true (emphatic)"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true (repeated for emphasis)"
          },
          {
            devanagari: "वरानने",
            iast: "varānane",
            gloss: "O one of the lovely face (vocative, epithet of Pārvatī)"
          }
        ]
      }
    ],
    meaning: "Even with learning and the power gained through austerity, those men are unfortunate who fail to serve the Guru — this is the truth, O lovely-faced one, the utter truth.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-173",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 173,
    speakerTag: null,
    padas: [
      {
        text: "ब्रह्मविष्णुमहेशाश्च",
        iast: "brahmaviṣṇumaheśāśca",
        words: [
          {
            devanagari: "ब्रह्मविष्णुमहेशाश्च",
            iast: "brahmaviṣṇumaheśāśca",
            gloss: "Brahmā, Viṣṇu, and Maheśa (Śiva), and (nominative plural compound + ca 'and')"
          }
        ]
      },
      {
        text: "देवर्षिपितृकिन्नराः",
        iast: "devarṣipitṛkinnarāḥ",
        words: [
          {
            devanagari: "देवर्षिपितृकिन्नराः",
            iast: "devarṣipitṛkinnarāḥ",
            gloss: "gods, sages, ancestors, and kinnaras (nominative plural compound: deva + ṛṣi + pitṛ + kinnara)"
          }
        ]
      },
      {
        text: "सिद्धचारणयक्षाश्च",
        iast: "siddhacāraṇayakṣāśca",
        words: [
          {
            devanagari: "सिद्धचारणयक्षाश्च",
            iast: "siddhacāraṇayakṣāśca",
            gloss: "siddhas, cāraṇas, and yakṣas, and (nominative plural compound + ca 'and')"
          }
        ]
      },
      {
        text: "अन्येऽपि मुनयो जनाः",
        iast: "anye'pi munayo janāḥ",
        words: [
          {
            devanagari: "अन्येऽपि",
            iast: "anye'pi",
            gloss: "and other (people) too (nominative plural: anye 'others' + api 'also', sandhi e+a→e with the elision marked by avagraha)"
          },
          {
            devanagari: "मुनयो",
            iast: "munayo",
            gloss: "sages (nominative plural, munayaḥ; final visarga shifts to -o before the following j-)"
          },
          {
            devanagari: "जनाः",
            iast: "janāḥ",
            gloss: "people, folk (nominative plural, subject)"
          }
        ]
      }
    ],
    meaning: "Brahmā, Viṣṇu, and Maheśa; the gods, seers, ancestors, and kinnaras; siddhas, cāraṇas, and yakṣas; and other sages and people besides — all of them too honor the Guru in this way.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This verse has no finite verb of its own — it is simply a list of exalted beings continuing the surrounding argument that even gods and sages must serve the Guru; a verb such as 'also honor/serve him' is supplied from context, as most translations of this line do."
  },
  {
    id: "guru-gita-174",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 174,
    speakerTag: null,
    padas: [
      {
        text: "गुरुभावः परं तीर्थम्",
        iast: "gurubhāvaḥ paraṃ tīrtham",
        words: [
          {
            devanagari: "गुरुभावः",
            iast: "gurubhāvaḥ",
            gloss: "the feeling of devotion toward the Guru (nominative, subject)"
          },
          {
            devanagari: "परं",
            iast: "paraṃ",
            gloss: "supreme, highest (nominative neuter adjective, describes tīrtham)"
          },
          {
            devanagari: "तीर्थम्",
            iast: "tīrtham",
            gloss: "sacred place of pilgrimage (nominative neuter predicate)"
          }
        ]
      },
      {
        text: "अन्यतीर्थं निरर्थकम्",
        iast: "anyatīrthaṃ nirarthakam",
        words: [
          {
            devanagari: "अन्यतीर्थं",
            iast: "anyatīrthaṃ",
            gloss: "any other place of pilgrimage (nominative neuter, subject)"
          },
          {
            devanagari: "निरर्थकम्",
            iast: "nirarthakam",
            gloss: "useless, without value (nominative neuter predicate adjective)"
          }
        ]
      },
      {
        text: "सर्वतीर्थाश्रयं देवि",
        iast: "sarvatīrthāśrayaṃ devi",
        words: [
          {
            devanagari: "सर्वतीर्थाश्रयं",
            iast: "sarvatīrthāśrayaṃ",
            gloss: "the abode/refuge of all sacred places (nominative neuter predicate, compound: sarva + tīrtha + āśrayam)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "पादाङ्गुष्ठं च वर्तते",
        iast: "pādāṅguṣṭhaṃ ca vartate",
        words: [
          {
            devanagari: "पादाङ्गुष्ठं",
            iast: "pādāṅguṣṭhaṃ",
            gloss: "the toe of the [Guru's] foot (nominative neuter, subject, compound: pāda + aṅguṣṭham)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "वर्तते",
            iast: "vartate",
            gloss: "is, abides, exists (present tense, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "Devotion to the Guru is the supreme place of pilgrimage; every other tīrtha is fruitless beside it. O Goddess, even the mere toe of the Guru's foot is the refuge of all sacred waters.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The source prints तीर्थम् (closing the first half-verse) and अन्यतीर्थं (opening the second) fused without a space, as तीर्थमन्यतीर्थं, since ordinary vowel sandhi (म्+अ→म) erases the word boundary there; they are shown here as two separate words split at the pāda boundary, since they belong to two different clauses, matching how published translations divide this line."
  },
  {
    id: "guru-gita-175",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 175,
    speakerTag: null,
    padas: [
      {
        text: "जपेन जयमाप्नोति",
        iast: "japena jayamāpnoti",
        words: [
          {
            devanagari: "जपेन",
            iast: "japena",
            gloss: "by/through repetition, recitation (instrumental)"
          },
          {
            devanagari: "जयमाप्नोति",
            iast: "jayamāpnoti",
            gloss: "obtains victory (fused: jayam 'victory' (accusative object) + āpnoti 'obtains' (present, 3rd singular), sandhi m+ā→mā)"
          }
        ]
      },
      {
        text: "चानन्तफलमाप्नुयात्",
        iast: "cānantaphalamāpnuyāt",
        words: [
          {
            devanagari: "चानन्तफलमाप्नुयात्",
            iast: "cānantaphalamāpnuyāt",
            gloss: "and may obtain endless reward (fused: ca 'and' + ananta 'endless' + phalam 'reward' (accusative object) + āpnuyāt 'may obtain' (optative, 3rd singular))"
          }
        ]
      },
      {
        text: "हीनकर्म त्यजन्सर्वं",
        iast: "hīnakarma tyajansarvaṃ",
        words: [
          {
            devanagari: "हीनकर्म",
            iast: "hīnakarma",
            gloss: "base, degrading action (accusative object)"
          },
          {
            devanagari: "त्यजन्सर्वं",
            iast: "tyajansarvaṃ",
            gloss: "abandoning entirely, all (fused: tyajan 'abandoning' (present participle, nominative) + sarvam 'all, entirely' (accusative/adverbial); printed without a space though no sound actually changes)"
          }
        ]
      },
      {
        text: "स्थानानि चाधमानि च",
        iast: "sthānāni cādhamāni ca",
        words: [
          {
            devanagari: "स्थानानि",
            iast: "sthānāni",
            gloss: "places (accusative plural, object continuing 'abandoning')"
          },
          {
            devanagari: "चाधमानि",
            iast: "cādhamāni",
            gloss: "and low, unworthy ones (fused: ca 'and' + adhamāni 'low, inferior' (accusative plural neuter adjective), sandhi a+a→ā)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and (repeated, for metrical emphasis)"
          }
        ]
      }
    ],
    meaning: "Through japa one gains victory and may attain boundless reward — provided one entirely abandons every degrading act and every unworthy place.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-176",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 176,
    speakerTag: null,
    padas: [
      {
        text: "जपं हीनासनं कुर्वन्",
        iast: "japaṃ hīnāsanaṃ kurvan",
        words: [
          {
            devanagari: "जपं",
            iast: "japaṃ",
            gloss: "repetition, japa (accusative object)"
          },
          {
            devanagari: "हीनासनं",
            iast: "hīnāsanaṃ",
            gloss: "on/with an improper seat (accusative, describing the manner of the japa)"
          },
          {
            devanagari: "कुर्वन्",
            iast: "kurvan",
            gloss: "doing, performing (present participle, nominative singular)"
          }
        ]
      },
      {
        text: "हीनकर्मफलप्रदम्",
        iast: "hīnakarmaphalapradam",
        words: [
          {
            devanagari: "हीनकर्मफलप्रदम्",
            iast: "hīnakarmaphalapradam",
            gloss: "that which yields the fruit of inferior action (accusative neuter compound: hīna + karma + phala + prada, describing the outcome)"
          }
        ]
      },
      {
        text: "गुरुगीतां प्रयाणे वा",
        iast: "gurugītāṃ prayāṇe vā",
        words: [
          {
            devanagari: "गुरुगीतां",
            iast: "gurugītāṃ",
            gloss: "the Guru Gītā (accusative, object)"
          },
          {
            devanagari: "प्रयाणे",
            iast: "prayāṇe",
            gloss: "while journeying, in travel (locative)"
          },
          {
            devanagari: "वा",
            iast: "vā",
            gloss: "or"
          }
        ]
      },
      {
        text: "सङ्ग्रामे रिपुसङ्कटे",
        iast: "saṅgrāme ripusaṅkaṭe",
        words: [
          {
            devanagari: "सङ्ग्रामे",
            iast: "saṅgrāme",
            gloss: "in battle (locative)"
          },
          {
            devanagari: "रिपुसङ्कटे",
            iast: "ripusaṅkaṭe",
            gloss: "in danger from an enemy (locative compound: ripu + saṃkaṭe)"
          }
        ]
      }
    ],
    meaning: "Performing japa while seated on an unfit āsana yields only an inferior result. But reciting the Guru Gītā while journeying, or amid battle, in danger from an enemy—",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). The source prints कुर्वन् (closing the first pāda) and हीनकर्मफलप्रदम् (opening the second) fused together as कुर्वन्हीनकर्मफलप्रदम्, since no sound actually changes at that boundary (न्+ह); they are shown here as two separate words split at the pāda boundary, matching the standard division of the verse into its two metrical quarters."
  },
  {
    id: "guru-gita-177",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 177,
    speakerTag: null,
    padas: [
      {
        text: "जपञ्जयमवाप्नोति",
        iast: "japañjayamavāpnoti",
        words: [
          {
            devanagari: "जपञ्जयमवाप्नोति",
            iast: "japañjayamavāpnoti",
            gloss: "doing japa, obtains victory (fused: japan 'reciting' (present participle) + jayam 'victory' (accusative) + avāpnoti 'obtains' (present, 3rd singular), sandhi n+j→ñj and m+a→ma)"
          }
        ]
      },
      {
        text: "मरणे मुक्तिदायकम्",
        iast: "maraṇe muktidāyakam",
        words: [
          {
            devanagari: "मरणे",
            iast: "maraṇe",
            gloss: "at the time of death (locative)"
          },
          {
            devanagari: "मुक्तिदायकम्",
            iast: "muktidāyakam",
            gloss: "liberation-bestowing (accusative neuter compound, describing the japa's effect)"
          }
        ]
      },
      {
        text: "सर्वकर्म च सर्वत्र",
        iast: "sarvakarma ca sarvatra",
        words: [
          {
            devanagari: "सर्वकर्म",
            iast: "sarvakarma",
            gloss: "every action, all deeds (nominative subject, compound sarva + karma)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "सर्वत्र",
            iast: "sarvatra",
            gloss: "everywhere (adverb)"
          }
        ]
      },
      {
        text: "गुरुपुत्रस्य सिद्ध्यति",
        iast: "guruputrasya siddhyati",
        words: [
          {
            devanagari: "गुरुपुत्रस्य",
            iast: "guruputrasya",
            gloss: "of the Guru's disciple/son (genitive)"
          },
          {
            devanagari: "सिद्ध्यति",
            iast: "siddhyati",
            gloss: "succeeds, is accomplished (present tense, 3rd person singular)"
          }
        ]
      }
    ],
    meaning: "—one who thus recites it attains victory, and at the hour of death it bestows liberation. For the Guru's disciple, every undertaking, in every place, comes to fruition.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-178",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 178,
    speakerTag: null,
    padas: [
      {
        text: "इदं रहस्यं नो वाच्यं",
        iast: "idaṃ rahasyaṃ no vācyaṃ",
        words: [
          {
            devanagari: "इदं",
            iast: "idaṃ",
            gloss: "this (nominative neuter, subject of vācyam, referring to rahasyam)"
          },
          {
            devanagari: "रहस्यं",
            iast: "rahasyaṃ",
            gloss: "secret (nominative neuter, in apposition to idam; subject of the gerundive vācyam 'is to be told')"
          },
          {
            devanagari: "नो",
            iast: "no",
            gloss: "not (emphatic negative)"
          },
          {
            devanagari: "वाच्यं",
            iast: "vācyaṃ",
            gloss: "to be spoken (gerundive, neuter nominative)"
          }
        ]
      },
      {
        text: "तवाग्रे कथितं मया",
        iast: "tavāgre kathitaṃ mayā",
        words: [
          {
            devanagari: "तवाग्रे",
            iast: "tavāgre",
            gloss: "before you, in your presence (fused: tava 'your' (genitive) + agre 'in front, before' (locative), sandhi a+a→ā)"
          },
          {
            devanagari: "कथितं",
            iast: "kathitaṃ",
            gloss: "told, spoken (past passive participle, neuter nominative, agrees with idam rahasyam)"
          },
          {
            devanagari: "मया",
            iast: "mayā",
            gloss: "by me (instrumental, agent)"
          }
        ]
      },
      {
        text: "सुगोप्यं च प्रयत्नेन",
        iast: "sugopyaṃ ca prayatnena",
        words: [
          {
            devanagari: "सुगोप्यं",
            iast: "sugopyaṃ",
            gloss: "to be carefully guarded, kept secret (gerundive, neuter nominative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "प्रयत्नेन",
            iast: "prayatnena",
            gloss: "with effort (instrumental)"
          }
        ]
      },
      {
        text: "मम त्वं च प्रिया त्विति",
        iast: "mama tvaṃ ca priyā tviti",
        words: [
          {
            devanagari: "मम",
            iast: "mama",
            gloss: "mine, my (genitive)"
          },
          {
            devanagari: "त्वं",
            iast: "tvaṃ",
            gloss: "you (nominative)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "प्रिया",
            iast: "priyā",
            gloss: "dear, beloved (nominative predicate adjective)"
          },
          {
            devanagari: "त्विति",
            iast: "tviti",
            gloss: "thus, indeed (fused: tu 'indeed/but' + iti 'thus', marking the close of the statement, sandhi u+i→vi)"
          }
        ]
      }
    ],
    meaning: "This secret I have now told before you must not be spoken further; guard it with careful effort, for you are mine, and you are dear to me — so he said.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-179",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 179,
    speakerTag: null,
    padas: [
      {
        text: "स्वामि मुख्यगणेशादि",
        iast: "svāmi mukhyagaṇeśādi",
        words: [
          {
            devanagari: "स्वामि",
            iast: "svāmi",
            gloss: "Svāmi, i.e. Kārtikeya/Skanda (name, first in the list of those not to be told)"
          },
          {
            devanagari: "मुख्यगणेशादि",
            iast: "mukhyagaṇeśādi",
            gloss: "chief Gaṇeśa and others (compound: mukhya 'foremost' + gaṇeśa + ādi 'and so forth', continuing the list)"
          }
        ]
      },
      {
        text: "विष्ण्वादीनां च पार्वति",
        iast: "viṣṇvādīnāṃ ca pārvati",
        words: [
          {
            devanagari: "विष्ण्वादीनां",
            iast: "viṣṇvādīnāṃ",
            gloss: "of Viṣṇu and others (genitive plural, fused: viṣṇu + ādīnām, sandhi u+ā→vā)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          },
          {
            devanagari: "पार्वति",
            iast: "pārvati",
            gloss: "O Pārvatī (vocative)"
          }
        ]
      },
      {
        text: "मनसापि न वक्तव्यं",
        iast: "manasāpi na vaktavyaṃ",
        words: [
          {
            devanagari: "मनसापि",
            iast: "manasāpi",
            gloss: "even in/with the mind (fused: manasā 'with the mind' (instrumental) + api 'even', sandhi ā+a→ā)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "वक्तव्यं",
            iast: "vaktavyaṃ",
            gloss: "to be told, spoken (gerundive, neuter nominative)"
          }
        ]
      },
      {
        text: "सत्यं सत्यं वदाम्यहम्",
        iast: "satyaṃ satyaṃ vadāmyaham",
        words: [
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true"
          },
          {
            devanagari: "सत्यं",
            iast: "satyaṃ",
            gloss: "true (repeated for emphasis)"
          },
          {
            devanagari: "वदाम्यहम्",
            iast: "vadāmyaham",
            gloss: "I speak, I say (fused: vadāmi 'I speak' (present, 1st singular) + aham 'I' (emphatic nominative pronoun), sandhi i+a→ya)"
          }
        ]
      }
    ],
    meaning: "Not to Svāmi, not to the foremost Gaṇeśa and the rest, nor even to the likes of Viṣṇu, O Pārvatī, should this be told — not even in thought. I speak the truth, the utter truth.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-180",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 180,
    speakerTag: null,
    padas: [
      {
        text: "अतीवपक्वचित्ताय",
        iast: "atīvapakvacittāya",
        words: [
          {
            devanagari: "अतीवपक्वचित्ताय",
            iast: "atīvapakvacittāya",
            gloss: "to one whose mind has grown exceedingly ripe/mature (dative singular compound: atīva + pakva + cittāya)"
          }
        ]
      },
      {
        text: "श्रद्धाभक्तियुताय च",
        iast: "śraddhābhaktiyutāya ca",
        words: [
          {
            devanagari: "श्रद्धाभक्तियुताय",
            iast: "śraddhābhaktiyutāya",
            gloss: "to one endowed with faith and devotion (dative singular compound: śraddhā + bhakti + yutāya)"
          },
          {
            devanagari: "च",
            iast: "ca",
            gloss: "and"
          }
        ]
      },
      {
        text: "प्रवक्तव्यमिदं देवि",
        iast: "pravaktavyamidaṃ devi",
        words: [
          {
            devanagari: "प्रवक्तव्यमिदं",
            iast: "pravaktavyamidaṃ",
            gloss: "this is to be told (fused: pravaktavyam 'is to be spoken' (gerundive, neuter nominative) + idam 'this' (nominative neuter), sandhi m+i→mi)"
          },
          {
            devanagari: "देवि",
            iast: "devi",
            gloss: "O Goddess (vocative)"
          }
        ]
      },
      {
        text: "ममात्माऽसि सदा प्रिये",
        iast: "mamātmā'si sadā priye",
        words: [
          {
            devanagari: "ममात्माऽसि",
            iast: "mamātmā'si",
            gloss: "you are my [very] Self (fused: mama 'my' (genitive) + ātmā 'self, soul' (nominative predicate) + asi 'you are' (present, 2nd singular); the elided vowel of asi is marked by the avagraha)"
          },
          {
            devanagari: "सदा",
            iast: "sadā",
            gloss: "always"
          },
          {
            devanagari: "प्रिये",
            iast: "priye",
            gloss: "O beloved (vocative)"
          }
        ]
      }
    ],
    meaning: "This should be taught only to one whose mind has grown truly ripe and who is filled with faith and devotion. O Goddess, you are ever my own Self, beloved one.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-181",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 181,
    speakerTag: null,
    padas: [
      {
        text: "अभक्ते वञ्चके धूर्ते",
        iast: "abhakte vañcake dhūrte",
        words: [
          {
            devanagari: "अभक्ते",
            iast: "abhakte",
            gloss: "in the faithless, devotion-less one (locative)"
          },
          {
            devanagari: "वञ्चके",
            iast: "vañcake",
            gloss: "in the deceiver, cheat (locative)"
          },
          {
            devanagari: "धूर्ते",
            iast: "dhūrte",
            gloss: "in the rogue, knave (locative)"
          }
        ]
      },
      {
        text: "पाखण्डे नास्तिके नरे",
        iast: "pākhaṇḍe nāstike nare",
        words: [
          {
            devanagari: "पाखण्डे",
            iast: "pākhaṇḍe",
            gloss: "in the hypocrite, heretic (locative)"
          },
          {
            devanagari: "नास्तिके",
            iast: "nāstike",
            gloss: "in the unbeliever, atheist (locative)"
          },
          {
            devanagari: "नरे",
            iast: "nare",
            gloss: "in a man (locative, governing all the preceding adjectives)"
          }
        ]
      },
      {
        text: "मनसापि न वक्तव्या",
        iast: "manasāpi na vaktavyā",
        words: [
          {
            devanagari: "मनसापि",
            iast: "manasāpi",
            gloss: "even in the mind (fused: manasā 'with the mind' (instrumental) + api 'even', sandhi ā+a→ā)"
          },
          {
            devanagari: "न",
            iast: "na",
            gloss: "not"
          },
          {
            devanagari: "वक्तव्या",
            iast: "vaktavyā",
            gloss: "is to be spoken (gerundive, feminine nominative, agrees with gurugītā)"
          }
        ]
      },
      {
        text: "गुरुगीता कदाचन",
        iast: "gurugītā kadācana",
        words: [
          {
            devanagari: "गुरुगीता",
            iast: "gurugītā",
            gloss: "the Guru Gītā (nominative, subject)"
          },
          {
            devanagari: "कदाचन",
            iast: "kadācana",
            gloss: "ever, at any time"
          }
        ]
      }
    ],
    meaning: "To a faithless man, a deceiver, a rogue, a hypocrite, or an unbeliever, the Guru Gītā must never be spoken — not even in the mind.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary)."
  },
  {
    id: "guru-gita-182",
    source: "Guru Gita (Siddha Yoga / Muktananda recension, ~182 verses)",
    verseNumber: 182,
    speakerTag: null,
    padas: [
      {
        text: "संसारसागरसमुद्धरणैकमन्त्रं",
        iast: "saṃsārasāgarasamuddharaṇaikamantraṃ",
        words: [
          {
            devanagari: "संसारसागरसमुद्धरणैकमन्त्रं",
            iast: "saṃsārasāgarasamuddharaṇaikamantraṃ",
            gloss: "the sole mantra for delivering [beings] out of the ocean of worldly existence (accusative, compound: saṃsāra-sāgara-samuddharaṇa-eka-mantram — modifies guru-rāja-mantram in pāda 4)"
          }
        ]
      },
      {
        text: "ब्रह्मादिदेवमुनिपूजितसिद्धमन्त्रम्",
        iast: "brahmādidevamunipūjitasiddhamantram",
        words: [
          {
            devanagari: "ब्रह्मादिदेवमुनिपूजितसिद्धमन्त्रम्",
            iast: "brahmādidevamunipūjitasiddhamantram",
            gloss: "the perfected/efficacious mantra worshipped by Brahmā, the other gods, and the sages (accusative, compound: brahma-ādi-deva-muni-pūjita-siddha-mantram — modifies guru-rāja-mantram)"
          }
        ]
      },
      {
        text: "दारिद्र्यदुःखभवरोगविनाशमन्त्रं",
        iast: "dāridryaduḥkhabhavarogavināśamantraṃ",
        words: [
          {
            devanagari: "दारिद्र्यदुःखभवरोगविनाशमन्त्रं",
            iast: "dāridryaduḥkhabhavarogavināśamantraṃ",
            gloss: "the mantra that destroys poverty, sorrow, and the disease of worldly existence (accusative, compound: dāridrya-duḥkha-bhava-roga-vināśa-mantram — modifies guru-rāja-mantram)"
          }
        ]
      },
      {
        text: "वन्दे महाभयहरं गुरुराजमन्त्रम्",
        iast: "vande mahābhayaharaṃ gururājamantram",
        words: [
          {
            devanagari: "वन्दे",
            iast: "vande",
            gloss: "I venerate, I bow to (present tense verb, 1st person singular ātmanepada)"
          },
          {
            devanagari: "महाभयहरं",
            iast: "mahābhayaharaṃ",
            gloss: "the remover of great fear (accusative adjective, describes guru-rāja-mantram — mahā-bhaya-haram)"
          },
          {
            devanagari: "गुरुराजमन्त्रम्",
            iast: "gururājamantram",
            gloss: "the sovereign/supreme mantra of the Guru (accusative, object of vande — compound guru-rāja-mantram)"
          }
        ]
      }
    ],
    meaning: "I venerate this supreme mantra of the Guru — the one mantra that carries souls across the ocean of worldly existence, the perfected mantra honored by Brahmā, the other gods, and the sages, the mantra that destroys poverty, sorrow, and the disease of becoming, and that dispels even the greatest fear.",
    citation: "Devanagari per sanskritdocuments.org's \"guru gItA - short version\" transcription, independently cross-checked against a Harvard-Kyoto transliteration + published translation from veda.harekrsna.cz (both fetched 2026-08-13 — verse 1's own two-source methodology, continued here). Word segmentation, gloss, and meaning: independent grammatical analysis, drafted then adversarially re-verified by re-deriving from the source text directly (not from the draft's own summary). This is the sanskritdocuments.org edition's own closing benedictory verse — present there but absent from the veda.harekrsna.cz cross-reference edition, which ends its own numbering at verse 181 with the identical closing colophon (\"iti śrī skanda purāṇe...guru gītā samāptāḥ\") that instead follows THIS verse in the sanskritdocuments.org edition. A genuine edition variant, not a numbering error or a mistake in either source."
  },
];

export function verseById(id: string): ChantVerse | null {
  return guruGitaVerses.find((verse) => verse.id === id) ?? null;
}
