# Sanskrit and Tamil curriculum: beginner to advanced

**Status: plan, partially executed.** Extends
[`2026-08-08-learning-module-design.md`](2026-08-08-learning-module-design.md),
which built the engine and left content as "phase 7's one real remaining
gap" (see [`../../STATUS.md`](../../STATUS.md)). That design doc's own stage
list is unchanged by this one — stages 1-3 (letters, words, sentences) are
still the whole deliverable, stage 4 (chanting, Vedic pitch accent) is still
deferred, and nothing here proposes touching `Curriculum.ts`. This document
is about what goes **inside** those three stages. Before this plan's first
tranche (below), that was 17-19 lessons per language — sized to prove the
engine works, not to teach the language. It maps out how much further each
stage can go using sources already verified in this codebase, and ships
that first tranche now: Sanskrit is 58 lessons as of this PR; Tamil is
still 19, its own equivalent tranche being the next item in the plan.

## Why this exists

The operator's own words: "the lessons look too scantty, only 17 lessons,
that is not real," plus a request to research six Sanskrit-adjacent apps
found on the Mac App Store and use them to inform a "full learning
curriculum, from beginner to expert" (certification features explicitly
out of scope — there is one learner, not a cohort).

Before this plan, `content/sanskrit.ts` called itself, verbatim, "a seed,
not a curriculum" in its own header comment (rewritten by this same PR —
see its current header for the file's new self-description). `tamil.ts`
never used that exact phrase but described the same state of affairs:
"letters, plus a first small set of real words." Both were accurate and
deliberate at the time: `STATUS.md` records stage 3 (sentences) as
empty until 2026-08-10, closed with exactly one sentence per language,
chosen for being the smallest change that proved the engine could hold a
real sentence at all. Neither was ever meant to be the final size — just
small enough to hand-verify completely, per the design doc's own quality
bar: "a beginner cannot detect a bad teacher, which makes this the one
quality gate that has to be human."

That quality bar is the reason this plan is a plan and not a 2,000-line
diff. Every existing lesson in both manifests was individually checked
against a primary source before it shipped. Scaling that up by 50-100x in
one pass would either take the same care and be too large to review, or cut
corners on exactly the thing the design doc calls unrecoverable. So: **this
document is the map, executed in tranches**, each one sized to actually get
the same hand-verification the existing 17-19 lessons got.

## What the six researched apps actually offer

None of the six is a full course. Each is a single-skill tool:

| App | What it actually is | Relevant to this plan? |
|---|---|---|
| Pronounce Sanskrit | Yoga-chant pronunciation drills (asanas, chakras, invocations) | Organizing principle only (see below) — not a source of lesson content |
| Sanskrit Writer ($14.99) | IAST/Devanāgarī/Brāhmī input method + on-the-fly declension tables | Feature idea, not curriculum content |
| Cologne Sanskrit Lexicon | The CDSD dictionaries, packaged natively | Already covered — `skt-cdsl-mw` in `resources.ts` |
| Sanskrit Lexicon | 250k-word dictionary; backs out root + grammar tags from an inflected form typed in | Feature idea for the "expert" reading tier (below) |
| Chitrakshar | Alphabet flashcards + auto-generated quiz bank, Hindi/Marathi/Sanskrit/English side by side | Reinforcement-mechanic idea, not curriculum content |
| Mudrakshar | Devanāgarī handwriting/stroke-order tracing, 422 letterforms | Real gap — this app currently teaches *reading*, never *writing* |

Two concrete, out-of-scope-for-now feature ideas came out of this, flagged
here rather than silently dropped:

1. **Handwriting/stroke-order practice.** The lesson engine's data model is
   recognition (`Lesson.text`, shown for the learner to read), not
   production. Adding a writing-practice mode is a real, separate feature —
   worth a future ticket, not a `Manifest` change.
2. **"Paste an inflected form, get the root + grammar tags."** This is
   exactly the skill Wikner Lessons 12-14 exist to teach by hand (dictionary
   navigation, Dhatu-Pāṭha lookup) and exactly what Sanskrit Lexicon and
   Ambuda's reader both automate. Worth eventually surfacing as an in-app
   tool once the reading tier (below) is reached — not a lesson-content
   item either.

The one idea that DOES inform lesson-content shape: Mudrakshar's
vowel → consonant → **barākhaḍī** (systematic consonant+vowel-sign matrix)
progression is a real traditional teaching order, and lines up with exactly
what Wikner Lesson 6 does (vowel signs attached to already-taught
consonants) — corroboration, not a new idea, but worth naming as such.

## Round 2: named web resources, and why levels are numbered, not named after either real ladder

A second round of feedback — "still too basic, re-organize it into learning
levels" — named ten more resources and asked that they inform the redesign.
Checked live (each URL actually fetched, not assumed) rather than taken on
the names alone, since several turned out not to be what they sounded like:

| # | Resource | Verdict |
|---|---|---|
| 1 | Samskrita Bharati | **Real & active — added** (`skt-samskrita-bharati`). A genuine spoken-Sanskrit organization, samskritabharati.in. Free 10-day "Spoken Sanskrit Classes", plus a paid, certificate-granting correspondence ladder: **Pravesha → Parichaya → Shiksha → Kovida**, six months each, ~2 years to reading the Gītā. |
| 2 | learnsanskrit.org | Already catalogued (`skt-learnsanskrit-course`) — confirmed its full structure: Introduction → Sounds → Starting Out → Nouns → Verbs → Odds and Ends → References → Panini, linear "core" then free branching. No change needed, already accurately described. |
| 3 | sanskritdocuments.org | Real & active, but a pure e-text repository — no level structure, nothing to borrow. Not added; doesn't fit this catalogue's "howToRead a specific thing" shape. |
| 4 | Ashtadhyayi.com / "DeoDoc" | **Real & active — added** (`skt-ashtadhyayi`). A specialist Pāṇinian-grammar platform (Sūtrapāṭha, Dhātupāṭha, a derivation generator). "DeoDoc" could not be verified as a real, separate thing — likely a misattribution; not pursued further. |
| 5 | Vyoma Linguistic Labs | Already partly catalogued on a separate, not-yet-merged branch (their YouTube channel — see PR #20's resource additions, not present on this branch). Confirmed they're bigger than that — sanskritfromhome.org runs 300+ courses grouped by learner *persona* (kids, university, professionals...) rather than by numbered level. Not added as its own entry here — the YouTube content already catalogued elsewhere is the free, structured slice of the same organization. |
| 6 | "Ashish Chaturvedi" / "Sanskrit From Home" (YouTube) | **Could not verify as named.** No channel by that exact name teaches Sanskrit; "Sanskrit From Home" is the platform in #5, not a distinct channel. Not added. |
| 7 | Tamil Virtual Academy / tamilvu.org | Same publisher as the already-catalogued `tam-abc-of-tamil`. Confirmed its full ladder: Certificate → Higher Certificate → Diploma → Higher Diploma → Degree (B.A. Tamilology) — a real, government-affiliated program. Not added as a separate resource (credential-shaped, and the user asked to leave certification out) — instead noted as one line in the existing entry's `howToRead`, so a reader knows it exists without this app treating it as a track to complete. |
| 8 | learn101.org / "Ezhuthu" | learn101.org real but a flat, unordered topic list — confirms what a level-less resource looks like, nothing to borrow. "Ezhuthu" is not one identifiable resource (the word just means "letter/script" in Tamil); not pursued. |
| 9 | "Learn Tamil" / "Tamil Padam" (YouTube) | **Could not verify as named.** "Learn Tamil" matches many unrelated channels; "Tamil Padam" appears confused with "Thamizh Padam," a movie/entertainment channel, not a learning resource. Not added. |
| 10 | Madhura Tamil / TamilCube | TamilCube already catalogued (`tam-tamilcube-chart`). "Madhura Tamil" (tamilmadhura.com) turned out to be a **Tamil fiction/serial-story site**, not a course, despite the name — not added. |

Also checked: the user's claim that Duolingo has no Sanskrit course. **Confirmed true** — not in Duolingo's course incubator or any current app-store listing.

**Why the five levels above are named "The Alphabet" / "First Words" / etc.
and not "Pravesha/Parichaya/Shiksha/Kovida" or "Certificate/Diploma/Degree":**
both real ladders found above are language-specific and one is explicitly a
paid credential program — adopting either verbatim would either only fit
one language (breaking the design doc's "one engine, language-agnostic"
principle for `Curriculum.ts`) or reintroduce exactly the certification
framing this round's feedback asked to leave out. The five levels are
content-described instead, sized to be reachable by both languages' actual
primers, and cross-reference cleanly onto either real ladder for anyone who
also wants the formal version: level 1-2 here is roughly Samskrita
Bharati's free 10-day class or TVA's Certificate tier; level 3-5 is roughly
where Pravesha/Parichaya or TVA's Diploma tier would pick up.

## Sanskrit track — Charles Wikner, *A Practical Sanskrit Introductory*

Already the cited source for every existing Sanskrit lesson. It is a
genuine 15-lesson beginner-to-intermediate course (its own preface: lifts a
reader "who knows nothing of Sanskrit" to the point of applying
Monier-Williams' dictionary and the Dhātu-Pāṭha to reading scripture) —
public domain by the author's own stated release, already read in full
(`wikner2.pdf`/`.txt` in this session's working files, not paraphrased from
training-time recall).

| Lessons | Topic | Engine stage | Status |
|---|---|---|---|
| 1.A-3.A | Full alphabet: 14 vowels, anusvara+visarga, 25 stops, 4 semivowels, 3 sibilants, ha | `letters` | **Shipped this pass** — 50 letters (up from 9) |
| 6.A | Vowel signs (mātrā) attached to consonants | `letters` | Not started |
| 7.A | Halanta, conjunct consonants (kṣa, jña, etc.) | `letters` | Not started |
| 4.A-5.A, 8.A | Devanāgarī variant forms, numerals, nasal substitution | `letters` | Not started |
| 1.B-9.B | Dhātu concept, verb intro, noun cases, gender, adjectives, adverbs, verbal prefixes | `words` | 7 words shipped (2026-08-09/10); the rest of this vocabulary is the next tranche |
| 9.A | Vowel accents, alphabet variations | `letters` | Not started |
| 10.A-11.A | Sandhi (vowel, consonant, visarga) | grammar, feeds `sentences` | Not started — **real sentences need this**: Sanskrit word-boundaries change sound under sandhi, so a "sentences" stage that ignores it teaches a form learners won't meet in real text |
| 10.B-11.B | Compound words (dvandva, tatpuruṣa, avyayībhāva, bahuvrīhi) | `words`/`sentences` | Not started |
| 12.A-14.A | Monier-Williams dictionary navigation, Dhātu-Pāṭha | tool skill, not lesson content | Already partly covered by `resources.ts`'s `skt-cdsl-mw`/`skt-ambuda-library` `inAppNotes`; could be deepened there, not here |
| 15.A | Applying the above to reading scripture | `sentences` (expert tier) | Not started — see below |

**Expert tier, beyond Wikner:** Wikner's own last lesson points at "the study
of the scriptures" without supplying scripture text itself (staying
grammar-focused throughout). The natural continuation, once sandhi and case
morphology are solid, is graded real reading — short, well-known,
public-domain verses (e.g. gīta or Upaniṣad excerpts already in the public
domain, the same bar every existing sentence in this file has already had
to clear) as `sentences`-stage entries, each with the same per-item
verification the existing narah-vadati sentence got.

## Tamil track — T.B. Siddalingaiah, *ABC of Tamil, Book One*

Also the existing cited source (Tamil Virtual Academy, read in full,
`abc_tamil.txt`/`ABC_Tamil.pdf` in this session's working files). 21 lessons,
ending at basic cases and present tense — genuinely "Book One" of what the
title implies is a longer series.

| Lessons | Topic | Engine stage | Status |
|---|---|---|---|
| 1-2 | 12 vowels, 18 consonants + pulli (dead-consonant mark) | `letters` | Partial — 0 of 12 vowels taught independently (only two vowel+consonant combinations exist, நா/யா); 6 of 18 consonants taught with their inherent vowel, plus 4 more taught only in dead (pulli) form for the words that need them |
| 3-7, 9-11, 13-15 | Consonantal vowels (vowel signs on each consonant) | `letters` | Only 2 of these combinations taught (நா, யா) |
| 8 | Numbers | `words` | Not started |
| 12 | Conjunction (junction rules between letters) | grammar, feeds `sentences` | Not started — Tamil's equivalent gate before real multi-word sentences, same role sandhi plays for Sanskrit |
| 16 | Remaining letters (Grantha letters for loanwords, etc.) | `letters` | Not started |
| 17-18 | Present tense | `words`/`sentences` | Not started |
| 19-21 | Cases: accusative (implied), dative, genitive | `words`/`sentences` | Not started |

**Beyond Book One:** the primer's own title implies a Book Two; not yet
located/verified this session. Absent that, the existing catalogue's
`tam-wikibooks` (Wikibooks Tamil, CC BY-SA, already excerpted in-app) and
`tam-omniglot`/`tam-audio-htla` cover intermediate grammar and the
pronunciation contrasts (ல/ள/ழ, ண/ன/ந, ர/ற) a "Book One only" learner would
still be missing — the expert tier for Tamil should draw on these plus
whatever a located Book Two supplies, verified the same way before any of
it becomes lesson content.

**Sequencing note, unchanged from the design doc:** Sanskrit is built first
tranche-by-tranche; Tamil mirrors the same shape as pure data once a
tranche's pattern is proven on Sanskrit, per "Sanskrit first... because it
is the harder case" in the original design doc. This plan's first shipped
tranche is therefore Sanskrit-only; Tamil's equivalent alphabet-completion
tranche is the next one, not this one.

## What shipped in this pass

`content/sanskrit.ts`: the complete alphabet (50 letters, up from 9) —
every vowel, anusvara, all 25 stops, all 4 semivowels, all 3 sibilants, ha —
cited to the exact Wikner subsection per group, in Wikner's own
alphabetical order. The 7 existing words and 1 sentence are unchanged; nothing
that already worked was touched, only what was missing around it.

**Second pass, same PR series:** the explicit numbered level system in
`Curriculum.ts` (`LevelId`/`LevelInfo`/`LEVELS`, a new required `level` field
on every `Lesson`, and a `validateManifest` check that a lesson may not claim
a lower level than what it depends on), backfilled onto every existing lesson
in both manifests, plus a levels-overview strip and per-lesson level badge in
`ui/app/learn`. Two new verified resources (`skt-samskrita-bharati`,
`skt-ashtadhyayi`) and one existing entry's `howToRead` updated per the
Round 2 table above.

**Third pass — tranche 2, run as an orchestrated multi-agent workflow**
(research → draft → independent adversarial verification, each of the three
content batches checked by two separate verifiers re-reading the primary
source directly rather than trusting the drafting agent's own summary):

- Sanskrit vowel signs (Wikner 6.A.1): 12 new letters — a full worked table
  for ब across all fourteen vowels it teaches bare, plus both of Wikner's
  own worked examples for the separate above-attaching rule (कि, णे).
  Deliberately partial, not exhaustive across all 33 consonants — see the
  block's own comment in `sanskrit.ts` for what was excluded and why
  (theoretical-vowel signs, and two named exceptions whose rule doesn't
  survive the cached extraction).
- Sanskrit words (Wikner 1.B-3.B): only 1 of 2 drafted proposals survived
  verification. `skt-word-ca` ("and") shipped clean. `skt-word-nayati` was
  independently flagged by BOTH verifiers and dropped entirely: Wikner's own
  course explicitly instructs students to use the ātmanepada (nayate-family)
  forms for this root, not the parasmaipada form actually proposed, and
  nayati never appears in any example sentence in the primer — exactly the
  kind of error adversarial verification exists to catch before it reaches
  the one real learner.
- Tamil alphabet completion (ABC of Tamil, Lessons One/Two): 25 new
  letters — all 12 vowels, the āytham, 8 consonants not yet taught in any
  form, and the bare inherent-vowel form of the 4 consonants previously
  taught only as their dead (pulli) form. Both verifiers signed off with no
  issues.

Sanskrit: 58 → 71 lessons. Tamil: 19 → 44 lessons.

**Fourth pass — tranche 3**, same adversarial-verification discipline (two
independent verifiers per content batch, re-deriving from the primary source
rather than trusting the proposer's summary):

- Sanskrit conjuncts (Wikner 7.A.3-7.A.5): 2 new letters, kṣa (क्ष) and jña
  (ज्ञ) — the two conjuncts Wikner himself singles out by name as a special
  pair, each with its own dedicated pronunciation section, rather than a read
  off his ~150-entry reference table (7.A.6), whose actual glyphs are almost
  entirely lost to the same cached-extraction corruption already flagged for
  earlier tranches. The general table stays deferred to whenever an actual
  word needs a specific conjunct from it — see `sanskrit.ts`'s own comment.
  Both verifiers signed off with no issues.
- Tamil vowel signs on க (ABC of Tamil, Lessons Three-Fifteen): 11 new
  letters — the full vowel-sign table for the one consonant the primer
  itself always lists first, mirroring Sanskrit tranche 2's own single-
  consonant approach rather than all 18 consonants at once (198 entries).
  Both verifiers signed off with no issues; one flagged (non-blocking) that
  the primer's own transliteration house-style spells the au-diphthong row
  "kow" rather than "kau" — kept as "kau" to match this file's own
  pre-existing bare-vowel gloss for ஔ.

Sanskrit: 71 → 73 lessons. Tamil: 44 → 55 lessons.

**Fifth pass — tranche 4**, same two-independent-verifier discipline:

- Sanskrit word (Wikner 3.B.2, line 979): 1 new word, vṛkṣa ("tree", वृक्ष) —
  the pratipadika/dictionary form, same citation convention as the existing
  `skt-word-nara`. Needed 1 new enabling letter, वृ (vṛ, va + the vocalic-r̥
  sign already proven on ब), added purely because this word needs it, the
  same rule skt-letter-ti was added under. This is the specific word kṣa
  (tranche 3) unblocks; the same passage's aśva and tiṣṭhati still need
  different conjuncts (śva, ṣṭha) this file doesn't teach yet, and remain
  future work. Both verifiers signed off with no issues.

Sanskrit: 73 → 75 lessons. Tamil: unchanged at 55.

**Sixth pass — tranche 5**, same two-independent-verifier discipline:

- Tamil vowel signs on the other 16 consonants (ABC of Tamil, Lessons
  Three-Fifteen): 167 new letters — the same 11-sign table already taught
  on க (tranche 3), completed for every other consonant the primer actually
  teaches it for. Two things stopped this from being a mechanical
  17-consonants-×-11-signs=187 fill-in: ங (ṅa) is missing from every one of
  these tables after Lesson Three, and Lesson Three's own note explains why
  — "the combination of ங் with other vowels need not be learnt", ங being
  used only bare or dead in real Tamil — so it is excluded entirely, leaving
  16 consonants. And Lesson Fifteen's own au-sign table lists only 9 of
  those 16 (ச/த/ந/ப/ம/ய/ர/ல/வ), with its own explanation: "there are hardly
  half-a-dozen words with 'ஔ' sound in Tamil... no necessity to study all
  the consonants with [it]." 16 consonants × 10 signs, plus 9 of them × 1
  more (au), minus the 2 ā-forms (நா/யா) already taught since 2026-08-10 =
  167. See `tamil.ts`'s own tranche-5 block comment for the full citation
  and romanization-normalization method. Both verifiers signed off with no
  issues.

Sanskrit: unchanged at 75. Tamil: 55 → 222 lessons.

**Seventh pass — tranche 6**: the engine change item 1 (below, as it stood
before this pass) was blocked on, plus the sandhi/conjunction content it
unblocks, plus a real, evidence-based answer on item 2 (expert-tier
reading) — not more content, but the actual research the previous pass's
"once case morphology is solid" deferred.

- **Engine change**: `Curriculum.ts`'s `Lesson` gained an optional
  `sandhiRule?: string` field. When set, `validateManifest` skips the
  exact-reconstruction check for that one lesson (every other check —
  dependencies exist, right stage, already taught, level-monotonic — still
  applies in full), and requires the field to be a non-empty string naming
  the actual rule. This is the minimal version of the override the previous
  pass called for: it doesn't weaken the check for any lesson that doesn't
  opt in, and it forces the divergence to be documented rather than merely
  permitted. New tests in `Curriculum.test.ts` cover both the exemption and
  its limits (an unknown dependency is still rejected; an empty
  `sandhiRule` is rejected). The UI (`ui/app/learn/page.tsx`) shows the rule
  text under the lesson when present, since for a level-3 lesson the rule
  *is* the content, not a footnote.
- **Sanskrit sandhi** (Wikner 11.A.1): one lesson, `skt-sentence-naro-vadati`
  (नरो वदति) — the exact same two words as the existing `naraḥ vadati`
  (नरः वदति), showing the visarga sandhi (Wikner's own rule 1: "-as before a
  ghoṣa consonant becomes -o") that actually applies when they're spoken
  together. Wikner is explicit that the existing sentence is the
  independent-word/pausa form and this is what a learner actually meets in
  connected text. No new vocabulary — reusing already-taught words is what
  makes the *sandhi*, not the words, the thing being taught. Both verifiers
  signed off with no issues.
- **Tamil conjunction rules** (ABC of Tamil, Lesson Twelve): the உம்
  ("and"/"too") enclitic, plus three of its worked forms — கண்ணும்
  (Rule I, consonant doubling), நீயும் (Rule III, medial-consonant fusion),
  and நானும் (the same general fusion, confirmed by the primer's own
  exercise text rather than a named rule — flagged as such in its own
  comment). Plus the real two-word phrase the primer's own exercise uses
  them in, நீயும் நானும் ("you and I"). Two new atomic letters
  (tam-pulli-ma, tam-pulli-ya) were needed and added, the same
  add-only-what-a-word-needs rule every previous tranche's enabling letters
  followed. Both verifiers signed off with no issues beyond the one
  citation-strength note above.
- **Expert-tier reading — researched, not shipped, and now concretely
  scoped**: fetched and word-by-word checked one short, famous,
  unambiguously public-domain verse per language against this file's actual
  taught content — Bhagavad Gītā 2.47 for Sanskrit, Thirukkural 1 for Tamil
  (see the research task's own output for sources and full breakdowns).
  Both fail completely, and not narrowly: Sanskrit's ceiling is exactly
  nominative-subject + 3rd-singular-present-parasmaipada verb (नरः वदति/
  नरो वदति), and real verse needs at minimum a second case (locative and/or
  genitive), a pronoun paradigm, compound formation, and additional verb
  moods; even the three-word माण्डूक्य maxim "सत्यमेव जयते" fails on an
  unshipped case ending and an ātmanepada verb form. Tamil has zero
  vocabulary overlap with Thirukkural 1, and its one unfamiliar word beyond
  plain nouns (முதற்றே) is a verbal-noun-plus-clitic construction — genuine
  verb-derived morphology, not addable as a vocabulary item. Both languages
  are blocked on the same shape of gap: a second noun case and a working
  verb-conjugation system, not on vocabulary breadth or on this pass's
  sandhi work. That gap is now this plan's next item, not "researched
  later."

Sanskrit: 75 → 76 lessons. Tamil: 222 → 229 lessons.

**Eighth pass — tranche 7**: the first real slice of item 1 above — one
case, one verb pada per language, not the whole grammar system at once.

- **Sanskrit — dvitīyā (accusative) and one ātmanepada verb**: नरम्/वृक्षम्
  (accusative singular of the already-taught नर/वृक्ष, Wikner 5.B.1's own
  declension table), नयते (leads, ātmanepada 3rd singular of √nī, Wikner
  3.B.1's paradigm — this file's first non-parasmaipada verb), and अश्व
  ("horse") — the specific word every prior tranche's own comments named as
  blocked on a conjunct it didn't teach, unblocked here by श्व. All four
  ship together in Wikner's own worked sentence (3.B.2, line 987): नरः
  अश्वम् वृक्षम् नयते ("the man leads the horse to the tree") — not
  assembled for this app, quoted whole, word order included. Needed two new
  atomic letters beyond श्व: म् (word-final halanta, Wikner 7.A.1 — not
  taught until now, the Sanskrit equivalent of Tamil's pulli mark) and ते
  (reusing the े vowel sign already proven on ब/ण). Two independent
  verifiers signed off with no issues.
- **Tamil — present tense**: செய்கிறேன் ("I do", ABC of Tamil Lesson
  Seventeen's own worked derivation, root + tense symbol கிறு + personal
  suffix ஏன், line 1388) and the sentence நான் செய்கிறேன், the primer's own
  example sentence for this exact derivation. Needed zero new letters —
  செ, ய், கி, றே, ன் were all already taught by earlier tranches, which is
  itself a small piece of evidence the alphabet/vowel-sign work already
  done was not wasted effort. Two independent verifiers signed off with no
  issues.

Sanskrit: 76 → 85 lessons. Tamil: 229 → 232 lessons.

**Ninth pass — tranche 8**: one more case per language, lighter than
tranche 7 — no new sentence forced this time, just the case-marked forms
themselves, each still real and cited.

- **Sanskrit — ṣaṣṭhī (genitive)**: नरस्य ("of the man"/"the man's"),
  Wikner 5.B.1's own declension table (line 1206). Needed one new atomic
  letter, स्य (an ordinary word-internal conjunct, स + य, same 7.A.1-7.A.2
  reasoning already established for श्व in tranche 7).
- **Tamil — accusative (ஐ)**: கண்ணை and பல்லை, the accusative forms of the
  already-taught கண் ("eye") and பல் ("tooth"), ABC of Tamil Lesson
  Nineteen's own consonant-doubling sub-rule (lines 1744-1758, e.g. line
  1748: "kaṇ + ai = kaṇ + ṇ + ai = kaṇṇai") — the same doubling mechanism
  already proven for உம் in tranche 6's கண்ணும். Needed zero new letters —
  ணை and லை were already atomic letters from tranche 5's vowel-sign
  tables.

One verifier per language this pass (not two) — the content is smaller
and lower-risk than tranche 7's (reusing an already-twice-proven
consonant-doubling pattern, no new sentence assembly), and both signed
off clean.

Sanskrit: 85 → 87 lessons. Tamil: 232 → 234 lessons.

**Tenth pass — tranche 9**: one more case per language again, same
lighter shape as tranche 8.

- **Sanskrit — tṛtīyā (instrumental)**: नरेण ("by/with the man"), Wikner
  5.B.1's own declension table (line 1203) — नर's third case singular.
  Needed one new atomic letter, रे (reusing the े vowel sign already
  proven on ब/ण/त).
- **Tamil — dative (கு/க்கு)**: யாருக்கு ("to whom"), the already-taught
  யார்'s dative singular, ABC of Tamil Lesson Twenty's own worked example
  (line 1843-1844) — this file's second case. Needed one new atomic
  letter, a dead க் (this file's first — every earlier dead-consonant
  letter happened to be a different consonant). Using the already-fused
  ரு letter directly, rather than decomposing to dead ர் + bare உ, is what
  lets plain concatenation reach the real spelling without a sandhiRule —
  the same dead-consonant-plus-vowel fusion fact tranche 6 already
  documented, applied in the direction that avoids needing the field
  rather than the direction that requires it.

One verifier per language again, both clean.

Sanskrit: 87 → 89 lessons. Tamil: 234 → 236 lessons.

**Eleventh pass — tranche 10**: a fourth/third case each, same lighter
shape as tranches 8-9.

- **Sanskrit — caturthī (dative)**: नराय ("to/for the man"), Wikner 5.B.1's
  own declension table (line 1204) — नर's fourth case singular. Needed one
  new atomic letter, रा (ra + the long-ā sign) — already named as missing
  by an earlier tranche's own comment on skt-word-raja, now added.
- **Tamil — genitive (உடைய)**: யாருடைய ("whose"), the already-taught
  யார்'s genitive, ABC of Tamil Lesson Twenty-One (lines 2042-2043: the
  case's two symbols, அது and உடைய, the latter "used more frequently") —
  this file's third case. Needed zero new letters — யார் isn't one of the
  lesson's mutating personal pronouns, so it takes உடைய by plain
  concatenation, reusing the already-fused ரு letter the same way
  tranche 9's dative did.

One verifier per language again, both clean.

Sanskrit: 89 → 91 lessons. Tamil: 236 → 237 lessons.

**Checkpoint, after tranche 10**: re-tested against Bhagavad Gītā 2.47 and
Thirukkural 1 again, per this plan's own stated discipline — three more
cases each did not move either language closer. BG 2.47's real blockers
are a pronoun system, a prohibitive/imperative mood, and indeclinable
particles, categorically different from "one more case for नर." Thirukkural
1's real blocker is vocabulary breadth (0% overlap) plus one verbal-noun
construction — also not a case gap. Operator decision: pivot away from
cases toward the actual blockers (pronouns, verb moods, particles) rather
than continuing the same shape of tranche on the theory that eventually it
adds up.

**Twelfth pass — tranche 11**: the first pivot tranche, one particle/person
addition per language.

- **Sanskrit — a particle and a second person**: इति (Wikner 9.B.2, "the
  Sanskrit equivalent of inverted commas" — marks the end of a quoted
  statement), the same avyaya category as the already-taught च; and नये
  ("I lead", Wikner 3.B.1's own paradigm table) — this file's first verb
  form in any person other than 3rd (prathama-puruṣa), same root as the
  already-taught नयते. Needed one new atomic letter, ये (reusing the े
  sign already proven on four other consonants).
- **Tamil — a second person**: அவன் ("he") and செய்கிறான் ("he does", 3rd
  person singular masculine present, ABC of Tamil Lesson Seventeen's own
  person table) — this file's first verb form in any person other than
  1st. Needed zero new letters — the same fusion pattern already proven
  for செய்கிறேன், with றா (already atomic) standing in for றே.

One verifier per language; both clean (one caught a citation typo in a
Sanskrit code comment — "navavahe" for "nayavahe" — fixed, not a data
defect).

Sanskrit: 91 → 94 lessons. Tamil: 237 → 240 lessons.

**Sourcing research, before tranche 12**: rather than guess at what to draft
next, this pass first asked whether Sanskrit's real blockers (a pronoun
table, an imperative/prohibitive mood) and Tamil's (past/future tense,
negation) are even *in* the two sources this plan has used exclusively so
far. Answer for Sanskrit: no. Wikner explicitly limits the whole course to
present indicative ("lakāra... the conjugations given here are all in the
present indicative... called lat", lines 763-766) — no imperative
conjugation table exists, and no personal-pronoun declension table exists
either (the "Declension Paradigms" appendix, lines 1932-1967, tables only
nouns). The only pronoun/mood forms anywhere are three isolated
glossary-style word-notes on quoted verses (अहम् "I", नौ "of us two", अस्तु
"let it be") — real and citable as bare vocabulary, but not a lesson. What
Wikner DOES have cleanly: a full multi-person paradigm table for तिष्ठति
("stand", 2.B.1, lines 744-756) — the exact word every tranche since 4 has
named as blocked on an untaught conjunct (ṣṭha). Answer for Tamil: also no,
and confirmed exhausted rather than assumed — ABC of Tamil, Book One
genuinely ends at Lesson Twenty-One (read to the last page); Wikibooks
Tamil's "Grammar"/"Advanced topics" pages are confirmed-live 404s (matching
what `resources.ts`'s own `tam-wikibooks` entry already said). The one
real find: M.S. Andronov's *A Grammar of Modern and Classical Tamil*
(1989), verified by direct fetch to have real past-tense content,
including the exact worked forms this app needed (ceyteen "I did", ceytaan
"he did") — now catalogued as `tam-andronov-grammar`.

**Thirteenth pass — tranche 12**: acts on that research rather than forcing
a pronoun/mood lesson from source material that doesn't have one.

- **Sanskrit — unblock तिष्ठति, add a parasmaipada 1st person**: तिष्ठति
  ("stands") and तिष्ठामि ("I stand", 1st singular parasmaipada — the
  parasmaipada counterpart to tranche 11's ātmanepada नये), both from
  Wikner's own 2.B.1 paradigm table. Also अश्वः (nominative of the
  already-taught अश्व) and the sentence अश्वः तिष्ठति ("the horse
  stands") — the other half of the sentence tranches 6-7 already quoted
  (Wikner 3.B.3, "aśvaḥ tiṣṭhati ca naraḥ vadati ca") but couldn't teach in
  full until the ṣṭha conjunct existed. Needed three new atomic letters:
  ष्ठ (the conjunct itself), ष्ठा (reusing the ा sign), मि (reusing the ि
  sign).
- **Tamil — first tense other than present**: செய்தேன் ("I did") and
  செய்தான் ("he did"), past tense, sourced from Andronov (this app's first
  source beyond Wikner/ABC of Tamil) — and the sentences நான் செய்தேன் /
  அவன் செய்தான். Needed zero new letters — தே/தா were already atomic from
  tranche 5's vowel-sign work, the same "the alphabet work wasn't wasted"
  pattern tranche 7 first noticed.

One verifier per language; both clean (one flagged a level-3-vs-2
inconsistency on the अश्वः/तिष्ठति sentence — fixed to level 2, matching
skt-sentence-narah-vadati's own precedent for a plain two-word sentence
with no sandhi or new grammar; one flagged that the "ceyteen" citation's
suffix list is OCR-garbled at its exact line and was reconstructed from
the parallel "ceytaan" passage rather than quoted directly — comment
tightened to say so explicitly, not a data defect).

Sanskrit: 94 → 101 lessons. Tamil: 240 → 244 lessons.

**Operator decisions after tranche 12**: (1) ship Sanskrit's three isolated
glossary words as bare vocabulary rather than wait for a lesson Wikner
doesn't have; (2) keep both languages moving together rather than doing
Tamil negation alone.

**Fourteenth pass — tranche 13**: acts on both.

- **Sanskrit — three pronoun/particle glossary words**: अहम् ("I",
  nominative singular — Wikner's back-matter Bhagavad Gītā study exercise,
  §15.8, line 3875), नौ ("of us two", genitive dual — Wikner's front-matter
  Invocation analysis, line 207), and अस्तु ("let it be" — same Invocation
  analysis, line 226). Each is Wikner's own word-by-word grammatical note
  on a real quoted verse, not a lesson — shipped as such, explicitly
  labeled in their own comments. One genuine correction made along the
  way: Wikner's text glosses अस्तु as "first person singular imperative,"
  but standard Sanskrit grammar is unambiguous that अस्तु is 3rd person
  (the loṭ-lakāra paradigm for अस् is असानि/एधि/**अस्तु** — 1st/2nd/3rd).
  Quoted faithfully in the comment for an honest sourcing trail; glossed
  correctly for the learner, not per the mislabel. Needed two new atomic
  letters: नौ (reusing the ौ sign already proven on ब), and स्तु (स + त, an
  ordinary word-internal conjunct — स् sits mid-word in अस्तु, not
  word-final, so this is the same category as श्व/स्य/ष्ठ, not a plain
  halanta — combined with the ु sign already proven on ब).
- **Tamil — first negation**: செய்யாதே ("don't do!", literary negative
  imperative singular), Andronov §229. Negation turned out messier than
  past tense — separate literary/colloquial registers and separate
  indicative/imperative constructions, and no clean worked example for
  செய் in the negative *indicative* specifically (its own worked examples
  all use other verbs) — but the negative *imperative* gives one directly:
  "ceytal 'to do' - ceyyaatee 'don't do'." Needed zero new letters.

One verifier per language; both clean (one Sanskrit finding was actually a
confirmation — independently re-derived that अस्तु really is 3rd person
and the file's override of Wikner's own label is the correct call, not an
overreach; one Tamil finding tightened a comment's morpheme boundaries —
தே's own த is the negative suffix's tail, not part of the imperative
morpheme -ee, though the grapheme-level composedOf was already exactly
right).

Sanskrit: 101 → 106 lessons. Tamil: 244 → 245 lessons.

**Checkpoint, after tranche 13**: re-tested against both benchmarks — the
last checkpoint was after tranche 10, and three tranches (11-13) had
shipped since without re-checking, exactly the drift this discipline
exists to catch.

- **BG 2.47**: one word closer. अस्तु (tranche 13) is a verbatim match for
  the verse's own अस्तु. Nothing else is: कर्मणि/फलेषु/अकर्मणि (locative,
  no case this app teaches reaches yet), ते (genitive of "you" — this app
  has अहम्/नौ, first person, but no second-person pronoun at all), एव/मा/
  कदाचन (three different indeclinables this app doesn't teach), मा भूः
  (a prohibitive construction, not just a word — this app has no mood
  besides indicative/one imperative), कर्मफलहेतुः (a compound). Genuinely
  closer, not closer-to-done: still 11 of 12 words away.
- **Thirukkural 1**: unchanged, 0 of 7 words. Nothing shipped since the
  tranche-10 checkpoint touches this verse's own vocabulary
  (அகர/முதல/எழுத்து/ஆதி/பகவன்/முதற்றே/உலகு) or its verbal-noun-plus-clitic
  construction.

Neither verse is close to reachable. Continuing to chase these two
specific verses one word at a time has a real cost the plan should name
plainly: at this rate, closing BG 2.47 alone means finding and citing a
second-person pronoun, at least one more particle, a full compound-
formation rule, and a real prohibitive-mood construction — each its own
research-and-source problem the way tranches 12-13 already were. That may
still be the right path, but it is a multi-tranche commitment, not a
"one more slice" one, and worth naming as such rather than discovering it
tranche by tranche.

**Operator decision, after tranche 13**: treat BG 2.47 and Thirukkural 1 as
calibration verses, not a checklist. They already did their job — surfacing
cases, tenses, persons, and now pronouns/particles/mood as real gaps — and
continuing to gate every future tranche on whether it moves these two
*specific* verses would fit the plan to the benchmark rather than the
language. Future tranches target grammar completeness on its own merits;
reading-readiness gets re-checked in general (a freshly-chosen verse,
picked for what it needs rather than for being the same two), not against
these two by name.

**Fifteenth pass — tranche 14**: acts on the tranche-13 decision — grammar
completeness on its own merits, not gated on the two calibration verses.

- **Sanskrit — a second particle**: हे (vocative, "O!") and the sentence हे
  नर ("O man!"). Neither needed a new source or a new primer section —
  both come from tables this file had already read and cited (Wikner
  5.B.1 for cases, already the source for नरः/नरम्/नरस्य/नरेण/नराय; 9.B.1
  for इति's own avyaya classification) but hadn't fully mined. नर's own
  vocative singular is identical in spelling to its bare stem (standard
  a-stem declension), so the sentence reuses the already-taught
  skt-word-nara directly — no new "vocative form" word needed. One new
  atomic letter, हे (reusing the े sign already proven on five other
  consonants).
- **Tamil — future tense**: செய்வேன் ("I shall do"/"I will do"), sourced
  from a genuinely two-sided passage: Andronov gives BOTH "ceykeen" (a
  rule-list form) and "ceyveen" (the same section's own worked example,
  plus a separate rule statement, plus three more real quoted sentences
  elsewhere in the book) for செய்'s future 1st person. Verification caught
  this file's first draft understating "ceykeen" as likely erroneous, when
  it is in fact independently attested too (a real quotation from
  Tiruvācakam, a 9th-century classical text) — a rarer register, not a
  mistake. Shipped ceyveen as the modern colloquial standard (named as
  such by Andronov's own §115), with the comment corrected to say so
  honestly rather than overstating confidence. Zero new letters.

One verifier per language; both clean (the Tamil one is the correction
above — a real finding, addressed before merge, not after).

Sanskrit: 106 → 109 lessons. Tamil: 245 → 246 lessons.

**Sixteenth pass — tranche 15**: continues grammar completeness on its
own merits, drafted via a single `Workflow` sweep of 5 parallel research
agents (in response to an explicit "finish this today" instruction) that
covered both languages' remaining grammar gaps at once.

- **Sanskrit — a participle and an adjective**: अधीतम् ("studied,
  learned" — past passive participle, neuter nominative singular) and
  तेजस्वि ("brilliant, splendid, bright, energetic"), both drawn from
  Wikner's own Invocation verse analysis (lines 190-233), the same
  passage that already sourced नौ/अस्तु in tranche 13 (अहम् is a separate,
  back-matter citation — §15.8, line 3875 — a genuine bug this tranche's
  own verifier caught in the shipped comment's first draft, fixed before
  merge). Two new
  atomic letters: धी (reusing the ी sign already proven on other
  consonants) and स्वि (an ordinary conjunct स्व + ि sign — no new
  mechanism). The same sweep re-confirmed, via a second and more
  thorough grep-based check of the full text, that Wikner's *A Practical
  Sanskrit Introductory* has no 2nd-person pronoun (tvam/te/tubhyam/
  yuṣmabhyam/yuṣmad/yuṣman/yuyam/tvayā/tava) anywhere — 2nd person is
  only ever expressed through verb endings there. That gap stays open;
  closing it needs a second source, same as the 12th-tranche's-era
  imperative-mood gap did before Andronov.
- **Tamil — the second grammatical person, present tense**: நீ ("you",
  singular) and செய்கிறாய் ("you do"), both from ABC of Tamil Lesson
  Seventeen's own line 1432. நீ itself is real taught vocabulary since
  Lesson Five (lines 538/543/549/554/560-562) — not a repurposed
  vowel-sign letter reused for a new job. Zero new letters: செய்கிறாய்
  reuses ce/pulli-ya/ki/rraa/pulli-ya, all already taught (pulli-ya
  appears twice — once for செய்'s own dead-ய், once for the -ாய் ending's
  — matching the multi-occurrence precedent already set by கண்ணும்'s
  doubled pulli-nna).

One verifier per language; both clean.

Sanskrit: 109 → 113 lessons. Tamil: 246 → 249 lessons.

**Seventeenth pass — tranche 16**: Tamil-only — this tranche's own
research turned up no unspent Sanskrit lead (tranche 15 already consumed
the 5-agent sweep's Sanskrit findings), and the tranche-13 operator
decision no longer requires lockstep parity between the two languages.

- **Tamil — negative indicative and a second dative sub-rule**: செய்யாது
  ("[it/they] do(es) not do", 3rd person singular neuter negative
  indicative) — this file's first negative INDICATIVE, distinct from
  tranche 13's negative IMPERATIVE (செய்யாதே). Sourced from Andronov §223
  (line 15185, giving செய் itself as the worked negative-stem example)
  and §225 (line 15215, the -aatu 3rd-sg-neuter suffix), independently
  attested in a real quoted sentence (NMY, 71; line 21686). Also
  கண்ணுக்கு ("to the eye") and பல்லுக்கு ("to the tooth"), extending
  tranche 9's own dative citation (ABC of Tamil Lesson Twenty) a few
  lines further (1961-1973) into a second sub-rule: short two-letter
  nouns double their final consonant before கு/க்கு. Zero new letters,
  all three words.

One verifier; clean.

Sanskrit: 113 lessons (unchanged). Tamil: 249 → 252 lessons.

**Eighteenth pass — tranche 17**: Sanskrit-only — Tamil's own next
candidate (pronoun genitives, ABC of Tamil Lesson Twenty-One) needs a
new alveolar-னு-shaped letter not yet cleanly scoped, so it waits for
its own tranche rather than being rushed in here.

- **Sanskrit — a second particle**: एव ("indeed, verily", an emphatic
  avyaya), Wikner §15.8, line 3876 — the very next line after line
  3875's अहम् in the same back-matter passage tranche 13 already cited.
  Wikner's own sandhi-free breakdown of Bhagavad Gītā 10.33 ("aham eva
  akṣayaḥ kālaḥ...", "I am verily inexhaustible Time..."), glossed
  directly, dictionary-style. Zero new letters: ए is the independent vowel letter
  (already taught, not the dependent vowel sign — एव opens with a bare
  vowel sound) and व is the bare consonant with its own inherent 'a'
  (already taught, no virama needed since the word ends in "va").

One verifier; clean (independently cross-confirmed the underlying verse
as BG 10.33 by matching Wikner's own English gloss to the standard
translation, not just accepting the OCR line at face value).

Sanskrit: 113 → 114 lessons. Tamil: 252 lessons (unchanged).

**Nineteenth pass — tranche 18**: closes both of the two items the
previous "what's next" list had actually blocked on missing research —
run via a `Workflow` research sweep (2 parallel agents) prompted by an
explicit "tackle all" instruction.

- **Sanskrit — the second-person pronoun, finally**: Wikner has none
  (confirmed by two independent full-text greps across this whole
  session), so this required a genuinely new source. William Dwight
  Whitney's *Sanskrit Grammar* (1889, public domain) has it — Chapter
  VII, §491 — but Perry's *Sanskrit Primer* (already catalogued as
  `skt-primer-perry`, tried first) turned out unusable for this specific
  table: its cached OCR text renders the actual Devanagari as
  unreadable symbol soup, even though the surrounding English section
  headers came through cleanly. Whitney's own Wikisource transcription
  is proofread against the page scans, not a raw OCR dump, and renders
  clean Devanagari + IAST — independently re-verified twice: once via
  the research agent's saved audit files, and again via a completely
  fresh live fetch of the Wikisource page during adversarial
  verification, not just the cached copy. Catalogued as
  `skt-whitney-grammar` (new resources.ts entry, same "adopt a second
  source" pattern as Andronov on the Tamil side). Ships त्वम् ("you",
  nominative singular) and यूयम् ("you all", nominative plural) — two
  new letters, the conjunct त्व and यू, both following this file's
  already-established "add only what's needed" and
  conjunct-vs-halanta conventions.
- **Tamil — a pronoun genitive**: அவனுடைய ("his"), the genitive of
  already-taught அவன் ("he"), ABC of Tamil Lesson Twenty-One, line
  2046. Turned out to need **zero** new letters, not the one the
  previous "what's next" entry expected — the alveolar னு grapheme this
  word needs (distinct from the already-taught dental நு) was already
  in the file from an earlier, unrelated tranche; the research agent
  caught this, and adversarial verification independently confirmed it
  by codepoint (U+0BA9 alveolar ன vs U+0BA8 dental ந).

Two verifiers (one per language); both clean. One real-but-cosmetic
finding: the new word's gloss used a voiced "ḍ" (avaṉuḍaiya) where the
file's own sibling entry (yāruṭaiya) uses voiceless "ṭ" for the same
டை letter — fixed for internal consistency before merge.

Sanskrit: 114 → 118 lessons. Tamil: 252 → 253 lessons.

**Twentieth pass — tranche 19**: run as an orchestrated multi-agent `Workflow`
(research+draft → adversarial verify per language) in response to a UI
observation ("Level 4/5 are still coming soon") that surfaced this plan's own
still-open item 1. Not an attempt at Level 4/5 itself — this is one more
grammar-completeness slice, the same shape as tranches 7-18, toward the
prerequisite item 1 names before item 2 (expert-tier reading) is reachable.

- **Sanskrit — three more 2nd-person singular case forms**: त्वाम् (tvām,
  accusative), तव (tava, genitive), त्वया (tvayā, instrumental) — Whitney
  §491(a)'s own table, the same source tranche 18 used for the nominative
  त्वम्/यूयम्. Two new atomic letters (त्वा, या), both the already-established
  conjunct/consonant + ा-sign fusion. Deliberately not shipped: the
  accentless brief alternates त्वा and ते the same table rows also give —
  ते specifically overlaps in spelling between two different cases in
  Whitney's own table (dative "तुभ्यम्, ते" vs genitive "तव, ते"), so
  teaching it as its own bare vocabulary item would conflate two
  grammatical meanings. One verifier, independently re-fetching the same
  Wikisource transcription rather than trusting the drafter's quotes, and
  additionally proving correctness by mechanically inserting all five
  proposed lessons into a working copy of `sanskrit.ts` and running
  `validateManifest` before signing off — found no issues.
- **Tamil — two more pronoun genitives**: அவருடைய (avaruṭaiya, "his/her,
  honorific" — genitive of the newly-added அவர்) and என்னுடைய (eṉṉuṭaiya,
  "my" — genitive of already-taught நான், via the primer's own irregular
  நான்→என் shortening rule, ABC of Tamil Lesson Twenty-One lines 2069-2071).
  அவர் itself needed adding first (ABC of Tamil Lesson Seventeen's person
  table, lines 1415-1416, plus three further sentence attestations) since
  the plan's own prior forecast that these genitives need "zero new
  letters" was about letters only — it did not account for a genitive
  needing its own not-yet-taught base pronoun taught first. Similarly, என்
  needed adding as its own word (Lesson Two's vocabulary, line 354) before
  என்னுடைய could use it. Zero new LETTERS, as forecast — four new WORDS.
  The verifier caught and fixed four real citation/reasoning errors in the
  draft: a misattributed source for the already-existing அவன் entry, an
  overstated letter-reuse claim (only யார் reuses the dead ர்; யாருடைய/
  யாருக்கு reuse the distinct fused ரு instead), an off-by-one lesson
  citation, and an incorrect claim about what `validateManifest` mechanically
  enforces (a word's `composedOf` may only reference letters, never other
  words, so base-pronoun-before-genitive ordering is convention, not a
  checked rule) — all fixed before this pass's own review.
- **Still genuinely blocked, confirmed rather than assumed**: அவளுடைய
  ("her") and அவர்களுடைய ("their") — both real and doubly-attested in the
  same Lesson Twenty-One passage — need a new atomic letter (dead ள்) this
  file has never taught. The plan's own "zero new letters for all four"
  forecast (tranche 18) does not hold for these two; corrected here rather
  than left standing uncorrected.

Sanskrit: 118 → 123 lessons. Tamil: 253 → 257 lessons.

**Twenty-first pass — tranche 20**: a broader push in response to an
explicit "complete the grammar work" request, run as an orchestrated
multi-agent `Workflow` — 6 parallel research+draft areas (3 Sanskrit, 3
Tamil), each independently adversarially verified before anything reached
a file. Two verifiers, going beyond their own brief of returning a
checked proposal, applied their corrected content directly to the working
tree during "verification by insertion" — a real process deviation from
the intended propose-then-apply flow, caught and accounted for (see below)
rather than silently accepted as normal.

- **Sanskrit — ablative and locative singular pronoun**: त्वत् (tvat,
  ablative) and त्वयि (tvayi, locative), Whitney §491(a) — the two
  remaining cases from that table with no accentless "briefer" alternate
  to weigh (unlike tranches 19's accusative/genitive/dative wrinkle). Two
  new letters.
- **Sanskrit — imperative mood, first multi-person paradigm**: तिष्ठ
  ("stand!"), तिष्ठतु ("let him/her/it stand!"), तिष्ठानि ("let me
  stand!") — Whitney Chapter VIII §553(d) (general parasmaipada imperative
  endings) + Chapter IX §671/§739 (this file's already-taught तिष्ठति
  inflects exactly like the fully-tabulated model root bhū), independently
  corroborated within this file itself by the already-shipped एधि/अस्तु/
  असानि (tranche 13's अस् paradigm) confirming the ending pattern holds
  across verb classes. Not the first Sanskrit mood shipped (अस्तु already
  was, tranche 13) — the verifier caught and corrected that overclaim —
  but the first full multi-person paradigm, and the first sourced from
  Whitney's tables rather than an isolated Wikner glossary word.
- **Sanskrit — compound words (samāsa), the first one**: वृक्षमूलम्
  ("root of a tree"), Wikner 10.B.1/11.B.2 — flagged "not started" since
  this plan's very first pass. The ṣaṣṭhī-tatpuruṣa type only, reusing
  the already-taught वृक्ष. Genuinely extends `sandhiRule`'s use beyond a
  pure sound-change explanation (a samāsa also drops the first member's
  own case ending and adds a single vibhakti ending to the compound as a
  whole) — the most faithful modeling available without an engine change,
  grounded directly in Wikner's own description of what a samāsa does,
  but flagged as setting precedent for future compound lessons.
- **Tamil — negation, beyond what's shipped**: செய்யாதீர் (negative
  imperative, plural/polite, Andronov §231) plus four negative
  participial nouns (செய்யாதவன்/செய்யாதவர்/செய்யாதவை/செய்யாதது, Andronov
  §240) — grammatically distinct nominals, not finite verbs, and
  genuinely different from the already-shipped செய்யாது (a finite 3sg-
  neuter negative indicative) despite similar glosses. Two of the five
  rest on reconstructing a short OCR-garbled span from the same
  paragraph's own explicit rule statement — independently re-verified by
  the adversarial pass via a fresh re-fetch, same disclosed-reconstruction
  standard tranche 12's "ceyteen" already established.
- **Tamil — the other two pronoun genitives, finally**: அவளுடைய ("her")
  and அவர்களுடைய ("their") — the two this plan's own tranche-19 writeup
  flagged as blocked on a new dead ள் letter. Ships that letter
  (tam-pulli-lla) plus the two base pronouns (அவள், அவர்கள் — neither
  taught before) and both genitives. Applied directly to `tamil.ts` by
  its own verifier during verification, not returned as a proposal first
  — see this pass's own header note above.
- **Tamil — third-person feminine present tense**: செய்கிறாள் ("she
  does") and அவள் செய்கிறாள், ABC of Tamil Lesson Seventeen — zero new
  letters, all reused from the already-shipped செய்கிறான். The
  drafter for this item initially re-proposed தம்-pulli-lla/அவள் as if
  new, unaware the OTHER Tamil item above had just added them to the
  working tree (both ran in the same parallel batch) — the verifier
  caught the collision by re-reading the actual file rather than trusting
  either drafter's own "as of tranche 19" framing, and trimmed the
  proposal to just the one genuinely new word and sentence.

Sanskrit: 123 → 136 lessons. Tamil: 257 → 269 lessons. (Code review on this
pass's own PR caught two further real issues, fixed before merge: the
samāsa lesson's `composedOf` didn't account for the compound's final case
ending at all — fixed by adding a proper word-level lesson for मूलम्, the
case-marked form, rather than leaning on `sandhiRule` to paper over an
entirely undeclared morpheme; and செய்யாதவர்'s gloss presented itself as
exclusively epicene-plural when the -அவர் suffix family, like this file's
own அவர் pronoun, standardly doubles as honorific singular too — the gloss
now discloses both readings instead of picking one silently.)

**A note on process, not just content**: two of tranche 20's six items
applied their own verified output directly to the repo's real files
during adversarial verification, rather than returning it as a checked
JSON proposal the way this whole tranche-based plan (and the workflow
script driving this pass) was actually designed for. The content itself
held up under independent re-verification and mechanical `validateManifest`
checks either way, but the WORKING TREE having uncommitted, unreviewed
changes appear mid-session — discovered only because a later item's own
verifier happened to re-read the file and notice — is a process risk this
plan's own multi-agent tranches hadn't hit before at this scale. Worth
naming for whoever runs the next large parallel push: a verify step's
job is to check and return a corrected proposal, not to edit the tree
itself, and a workflow spanning several concurrent drafters on the same
file should assume a later drafter's "read the file first" step may see
a different file than the one the first drafter saw.

**Twenty-second pass — tranche 21**: another explicit "continue grammar
completeness" request, again run as an orchestrated multi-agent
`Workflow` — 6 parallel research+draft areas (4 Sanskrit, 2 Tamil), each
independently adversarially verified before anything reached a file. This
time the verify-stage prompt was strengthened with an explicit, all-caps
instruction against editing repository files directly (naming tranche
20's own process deviation by name) — and it held: `git status` after the
workflow completed showed a clean tree, confirming every item came back
as a proposal, not an unreviewed edit.

- **Sanskrit — the dative pronoun, finally**: तुभ्यम् (tubhyam, "to/for
  you"), Whitney §491(a) — the case deferred twice in tranches 19 and 20
  over its accentless alternate ते colliding in spelling with the
  genitive's own ते. Shipped the full (non-colliding) accented form
  instead of the alternate, sidestepping the collision rather than
  resolving it. One new letter (भ्य). Completes all 7 cases of the
  2nd-person singular pronoun.
- **Sanskrit — the 2nd-person dual pronoun**: युवाम् (nom/acc/voc),
  युवाभ्याम् (instr/dat/abl), युवयोः (gen/loc) — Whitney §491(a). Six
  grammatical cases collapse to 3 distinct surface forms via case
  syncretism; each shipped as one word lesson whose gloss names every
  case it covers, rather than three near-duplicate lessons. Four new
  letters. (This item originally shipped the genitive/locative form as
  युवयोस्, with a new bare word-final स् letter — phonotactically invalid
  Sanskrit, since word-final -s always surfaces as visarga in citation
  position, the exact rule this file already applies for नरः/अश्वः. Code
  review on this pass's own PR caught it; fixed by reusing the
  already-existing skt-letter-visarga instead of introducing an invalid
  new letter — see the process note below.)
- **Sanskrit — the optative mood (vidhi-liṅ), singular**: तिष्ठेत्
  ("he/she/it may/should stand"), तिष्ठेयम् ("I may/should stand"),
  तिष्ठेः ("you may/should stand") — Whitney Chapter IX §738 (bhū's own
  optative paradigm) applied to तिष्ठ per §671's already-cited
  inflects-like-bhū equivalence (the same equivalence tranche 20 used for
  the imperative). One new letter. (Same visarga bug as the dual-pronoun
  item above — this item's 2nd-singular form originally shipped as
  तिष्ठेस्, sharing the same invalid bare-स् letter; fixed the same way,
  reusing skt-letter-visarga.)
- **Sanskrit — dvandva (copulative) compounds, the samāhāra subtype**:
  सुखदुःखम् ("pleasure and pain"), Wikner 11.B.1 — the second compound
  type shipped (tranche 20 shipped only ṣaṣṭhī-tatpuruṣa). A samāhāra
  dvandva is always neuter singular regardless of its members' own
  independent gender, a property of the compound type itself per Wikner's
  own text — modeled the same way tranche 20's code review required for
  वृक्षमूलम्: the compound's final case ending is traceable through a
  proper word-level lesson (दुःखम्) rather than papered over by
  `sandhiRule`, which here names only the real no-space compounding
  convention. Two new letters, three new words, one new sentence.
- **Tamil — third-person honorific and plural present tense**: அவர்
  செய்கிறார் ("he/she does", honorific) and அவர்கள் செய்கிறார்கள் ("they
  do") — ABC of Tamil Lesson Seventeen's own "III Person" table, verified
  by rendering the cached PDF's page 41 to an image and reading it
  directly (the OCR-text cache is unreliable mojibake from a custom PDF
  font encoding). Zero new letters, all reused from the already-shipped
  செய்கிறான்/செய்கிறாள். Code review on this pass's own PR caught the
  verifier's self-reported fix not matching its own returned data: the
  verifier's summary claimed the two sentences' `sandhiRule` field was
  fixed by omission, but the actual returned JSON still literally
  contained `sandhiRule: ''` on both — caught only by reading the raw
  returned structures rather than trusting the prose summary, and fixed
  by omitting the field when applying the content.
- **Tamil — third-person feminine and plural past/future tense**:
  செய்தாள்/செய்வாள் ("she did"/"she will do") and
  செய்தார்கள்/செய்வார்கள் ("they did"/"they will do"), Andronov §138
  (p.163) and §143 (p.165) — extends the already-shipped
  1st-singular/3rd-masculine-singular past and future to the feminine and
  human-plural persons, matching the modern-register suffix choice
  (-aaL/-aarkaL, dropping the optional -ku- increment) this file already
  established for ceyveen over ceykeen. Zero new letters. No composed
  sentences shipped this pass — Andronov's own worked examples for these
  paradigms use different verbs than செய், and the pronoun+verb
  compositions (அவள் செய்தாள், etc.) are flagged as ready-on-request in
  this item's own openQuestions rather than shipped speculatively.

Sanskrit: 136 → 156 lessons (one letter, skt-letter-sa-halanta, was removed
during code-review fixes below, netting the same total the workflow
originally proposed). Tamil: 269 → 277 lessons.

**A note on process**: the letter-collision and self-report discrepancy
above were both caught by direct verification (grepping the working file
before insertion; reading raw JSON instead of prose summaries) rather than
by the workflow's own agents. Code review on this pass's own PR caught a
further, more serious issue neither the workflow's drafter nor its
verifier caught: a genuinely invalid Sanskrit form (bare word-final स्
where visarga is phonotactically required) that the mechanical
`composedOf`-reconstruction check cannot detect, since the wrong letter
and the wrong word text agreed with each other. Two lessons
(skt-word-yuvayoh, renamed from skt-word-yuvayos, and skt-word-tishtheh,
renamed from skt-word-tishthes) were corrected to use the existing
skt-letter-visarga in place of the invalid new letter, which was then
removed as unused. Worth carrying forward as standing discipline for the
next tranche: `validateManifest`'s checks (dependency existence, stage,
level, text reconstruction) verify internal consistency, not phonological
validity — a human or adversarial-review pass must still check that the
Devanagari itself is real Sanskrit/Tamil, not just self-consistent.

**Twenty-third pass — tranche 22**: run as an orchestrated multi-agent
`Workflow` — 6 research+draft areas, each checked by TWO verifiers given
deliberately different lenses (one re-fetching the primary source, one
applying `validateManifest` by hand and then executing it over a scratch
copy) rather than two verifiers doing the same job twice.

- **Sanskrit verbs beyond the singular**: the dual and plural cells of both
  paradigm tables — तिष्ठतः/तिष्ठन्ति/तिष्ठथः/तिष्ठथ/तिष्ठावः/तिष्ठामः
  (parasmaipada, Wikner 2.B.1) and नयेते/नयन्ते/नयावहे/नयामहे (ātmanepada,
  Wikner 3.B.1), plus वदन्ति. Dropped on the source's own pedagogy, not on
  sourcing: the whole parasmaipada half of Wikner's नी table, because 3.B.1
  says outright to use the ātmanepada endings for that root — the
  skt-word-nayati trap, caught a second time.
- **Sanskrit 2nd-person plural**: युष्मान्, युष्माभिः, युष्मभ्यम्, युष्मत्,
  युष्माकम्, युष्मासु (Whitney §491(a)), closing the paradigm tranches 18-21
  walked down. वस् dropped for the same three-way case collision that
  dropped ते in tranche 19.
- **Tamil person-categories**: நாம்/நாங்கள் (the inclusive/exclusive "we"
  distinction, glossed from the primer rather than from recall), நீங்கள்,
  அது/அவை/அவைகள், each with its present-tense form and sentence — the three
  categories the plan recorded as "entirely unstarted" are now complete for
  the present tense.
- **Tamil tense gaps**: செய்தார் and செய்வான் shipped. செய்வார் (honorific
  singular future) DROPPED as genuinely unsourceable — ABC of Tamil Book One
  stops at present tense for that cell and Andronov states the rule but
  switches verbs for its example. Both Tamil sources are now exhausted for
  it; unblocking needs a new source.
- **Level 4 opened, for Sanskrit only**: four sentences quoted verbatim from
  Wikner's 3.B.3 graded exercises and glossed with his own printed answers.
  A full scan of the primer found exactly five decomposable lines in the
  whole book, one already shipped. Tamil Level 4 ships EMPTY, for a measured
  reason: this curriculum teaches one verb root (செய்) while the primer's
  sentences run on sixteen.
- **Level 5 remains empty, and the measurement is the deliverable**: all 182
  Guru Gita verses were tokenised against the taught Sanskrit vocabulary.
  The best verse has 3 of 12 words taught; NO verse has zero gaps. Unglossed
  scripture reading is many vocabulary tranches away, and saying so with a
  number is worth more than another speculative attempt.

Sanskrit: 155 → 183 lessons. Tamil: 277 → 298 lessons.

**Two process findings worth carrying forward.** First: giving the two
verifiers *different lenses* rather than running the same check twice paid
for itself immediately — the source verifier established that a proposed
युष्माभिः is not in Whitney's bytes at all (he prints युष्माभिस्), while the
mechanics verifier independently proved the batch clean under
`validateManifest`. Neither would have found the other's issue. Second, and
more important: the Tamil verifier discovered that ABC of Tamil's PDF text
layer is legacy TAB/TSCII that **decodes wrong**, and switched to rendering
pages to 600-dpi images and reading the glyphs. Its verdict — *"every Tamil
form in this tranche is real; almost every page number is not"* — is the
kind of finding only an independent re-derivation produces. Rendering, not
text extraction, is now the standard for that source. The equivalent
Sanskrit finding: Wikner's PDF embeds Devanagari in a non-Unicode font, so
his book can establish which form exists and what it means, but never how it
is spelled — spellings must come from Whitney's Wikisource transcription,
whose chapter pages are transclusion stubs and must be read from the `Page:`
namespace.

**Twenty-fourth pass — tranche 23**: same six-agent shape, in response to an
explicit instruction to finish the grammar item before pushing further at the
levels. Ran twice: the first attempt lost 6 of 8 agents to the machine
sleeping mid-response, and was recovered with `Workflow`'s `resumeFromRunId`,
which replayed the completed drafts from cache and re-ran only the casualties.

- **Sanskrit nouns beyond the singular** — नरौ, नराः, नरान्, अश्वाः, अश्वान्,
  वृक्षान्, on Wikner's own paradigm noun (3.B.2), plus five sentences quoted
  whole from his exercises and answer key. This is what tranche 22 named as
  its highest-value follow-up: नराः तिष्ठन्ति is the first sentence in the
  file where the SUBJECT rather than another verb carries the number the verb
  agrees with, and नरः अश्वः च नयेते shows the converse — two singular
  subjects joined by च taking a dual verb.
- **The three present indicatives closed** — √sthā needed only तिष्ठसि, √vad
  had nothing but वदति/वदन्ति (seven forms land here), √nī was missing its
  whole madhyama-puruṣa row (नयसे, नयेथे, नयध्वे). All nine cells of each are
  now taught.
- **Tamil past/future for the pronouns tranche 22 added** — செய்வோம்,
  செய்வீர்கள், செய்தீர்கள், செய்தது, செய்தன, with their sentences.
- **Confirmed unsourceable, four times over**: செய்வார், செய்தோம், செய்யும்,
  செய்வன. All fail identically — Andronov states the rule in the right
  section, conjugates செய் by name in that section's *other* tenses, then
  switches verbs for exactly the wanted cell. That is a structural property
  of the source, not bad luck, and a future tranche should not spend budget
  re-grepping for them. What would unblock them is a source printing a full
  paradigm TABLE rather than rule-plus-example prose — Arden's *A Progressive
  Grammar of Common Tamil* is the named candidate, not yet fetched.
- **अश्वौ blocked on a glyph, established by census not by giving up early**:
  श्वौ is genuinely absent from Whitney vol. 1 (an insource regex over the
  whole scan finds श्व on six pages, श्वा on one, श्वौ on none). It blocks
  three Wikner-printed sentences. This shape will recur — the file needs
  conjunct-plus-vowel-sign glyphs that Whitney happens never to print,
  because Whitney is a grammar, not a corpus.

Sanskrit: 183 → 213 lessons. Tamil: 298 → 309.

**The methodological correction that outlives this tranche**: *"the extraction
loses X" is not "the source lacks X."* Tranche 22 concluded flatly that
Wikner's Devanagari and vowel lengths could not be read from him at all, and
built a whole justification chain through Whitney on that basis. Rendering his
PDF at 400 dpi — the method this project had until then used only for Tamil —
shows him printing narāḥ, narān, aśvāḥ, vṛkṣān and nayāmahe with macrons
intact. The rendering technique that fixed the Tamil source fixed the Sanskrit
one too, and nobody tried it there for a full tranche. Reach for rendering
before concluding a source is deficient.

**Two process failures worth recording, both real:** the workflow ran twice
because of environmental interruptions, and the recovery path (`resume`)
worked exactly as intended. But the first recovery quietly shipped 16 Sanskrit
lessons on the MECHANICS verifier alone, because that area's source verifier
had crashed and the survivorship rule only required "at least one verdict and
no DROP". The content happened to be sound — re-checked by hand against
Whitney §735(a)'s printed paradigm afterwards, every ending attested — but the
rule was wrong and is now "both lenses must have looked at it". A verifier
that dies must not read as a verifier that approved.

**Twenty-fifth pass — tranche 24**: three areas, all eleven agents completing
cleanly. Survivorship was tightened first, per the finding above: a lesson now
ships only if BOTH lenses actually returned a verdict on it.

- **Level 4 filled from Wikner's own exercises**: 26 more sentences, each a
  printed line carrying Wikner's own printed English as its gloss, taking
  Sanskrit Level 4 from 4 to 30. The area reports Level 4 now SATURATED for
  Wikner's lessons 1-4 — every sentence he prints in 1.B.2, 1.B.3, 2.B.2,
  3.B.3 and 4.B.3 is either shipped or listed with the one word blocking it.
- **The rest of the नर declension**: नराभ्याम्, नरैः, नरेभ्यः, नरयोः,
  नराणाम्, नरेषु, plus वृक्षः (the cheapest form in the file, deferred twice)
  and वृक्षाः, with three more whole-quoted sentences.
- **Tamil's second verb root**: போ, with the three person forms ABC of Tamil
  actually prints, and their sentences. The primer runs its full table on
  செய் alone, so a partial paradigm is what the source supports and what
  shipped.

Sanskrit: 213 → 253 lessons. Tamil: 309 → 315.

**Twenty-sixth pass — tranche 25: the first vocabulary bottleneck slice.**
Wikner's 4.B.1 reference sheet (PDF p. 42; source-text lines 1087–1092) supplies the
forms and printed English glosses for three exercise verbs: √gam → गच्छति
("he goes"), √labh → लभते ("he takes"), and √vah → वहति ("he carries").
Only one new atomic letter is required: च्छ (`ccha`), which Wikner lists in
his 7.A.6 conjunct table; all other components were already taught. The
Devanagari forms were independently cross-checked against the printed
present-tense table in *Sanskritabodhini 2*. This tranche intentionally adds
no sentences or noun forms: those belong to the following reading-quality
slice, after the new verbs are available as dependencies.

Sanskrit: 253 → 257 lessons. Tamil: unchanged at 315.

**A caveat to read before anyone calls Level 4 done.** 25 of its 30 sentences
are the same two-verb-plus-च drill shape (तिष्ठसि वदसि च, वदामि तिष्ठसि च, …),
permutations out of Wikner's conjugation exercises. They are legitimately
printed and legitimately glossed, so they clear this project's sourcing bar —
but Level 4 is defined as "graded reading of real text, dictionary in hand",
and a conjugation drill is not reading. The tier is populated; whether it
*teaches what it claims to* is a separate question, and the honest answer
today is that it mostly drills verb agreement. Real graded prose needs
Wikner's lessons 5-11, which need a vocabulary tranche first (bālā "girl",
phala "fruit", and the locative/genitive/instrumental declensions). A sentence
tranche cannot reach them.

**अश्वौ is now closed hard, by census rather than by fatigue.** The search was
re-run across ALL of English Wikisource, every namespace including every
proofread `Page:`. श्वौ: 0 hits; अश्वौ: 0 hits. Three Wikner-printed sentences
stay blocked on that single glyph, and unblocking them needs a genuinely new
scan-backed source, not more searching in this one. This is the recurring
shape of the Sanskrit problem: the file needs conjunct-plus-vowel-sign glyphs
that Whitney happens never to print, because Whitney is a grammar, not a
corpus.

## What's next, in order

*Rewritten after tranche 25, which closed the first vocabulary slice from the
previous
version of this list named. Superseded items are gone rather than left
standing with a "done" beside them; the tranche log above is the record.*

1. **Make Level 4 read like Level 4.** It is populated (30 sentences) but 25
   are two-verb-plus-च conjugation drills. Use the newly taught verbs to add
   the remaining already-decomposable Wikner exercise sentences, then move
   into lessons 5-11 vocabulary (bālā "girl", phala "fruit") and the
   locative/genitive/instrumental declensions needed for real prose. Prefer
   real sentences over permutations —
   and consider whether the drill-shaped ones belong at level 3 instead,
   the way tranche 22 demoted `tam-sentence-en-kan` rather than let an
   alphabet-drill fragment stand as graded reading.
2. **A new Tamil source, which is now a hard blocker rather than a
   preference.** Four cells of the செய் grid (செய்வார், செய்தோம், செய்யும்,
   செய்வன) are confirmed unsourceable four times over from ABC of Tamil Book
   One plus Andronov, and the failure is structural: Andronov varies his
   illustrative verb by paragraph, so the wanted cell is always conjugated on
   some other verb. Tamil Level 4 is blocked the same way — Book One contains
   no graded reading at any vocabulary size, established by enumeration. The
   named candidates, neither yet fetched: ABC of Tamil Books Two/Three (if
   tamilvu.org hosts them) and Arden's *A Progressive Grammar of Common
   Tamil*, which is a teaching grammar with real conjugation tables and old
   enough for archive.org. Either would also settle the ceyv-/ceyk- register
   question this file keeps re-deciding case by case.
3. **A Devanagari corpus source, for glyphs Whitney never prints.** अश्वौ is
   blocked on श्वौ, which a census over all of English Wikisource shows
   appears nowhere in any namespace — three Wikner sentences stay out because
   of it. Whitney is a grammar, not a corpus, so this will keep recurring.
   What is needed is a scan-backed Devanagari text of comparable standing.
4. **Sanskrit moods beyond the singular** — the optative and imperative dual
   and plural of √sthā, and either mood for √vad and √nī. Blocked in an
   interesting way: Whitney §§738-741 would give the Devanagari, but Wikner's
   exercises never leave the present indicative, so the ENGLISH GLOSS has no
   source. Resolving it means either finding where Wikner introduces these
   moods later, or deciding deliberately that Whitney's own section headings
   may serve as gloss source — a methodology change to make on purpose, not
   inside a tranche.
5. **Expert-tier reading (Level 5)**, still the last item and still far off.
   The bar is a real short verse fully decomposable into taught vocabulary
   and grammar. Measured, not assumed: tokenising all 182 Guru Gita verses
   against the taught Sanskrit vocabulary gives a best case of 3 words out of
   12, and no verse reaches zero gaps. This is many vocabulary tranches away,
   and item 1 is the only thing that moves it.

Each step gets the same treatment this one did: read the actual primer
section (not recalled from training data), cite it per item, run
`validateManifest` (via `bun test src/learn/content/manifests.test.ts`)
before calling it done.
