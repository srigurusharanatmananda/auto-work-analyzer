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
new alveolar-நு-shaped letter not yet cleanly scoped, so it waits for
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

## What's next, in order

1. **Grammar completeness, scoped from real primer/source content**:
   more of Sanskrit's 2nd-person pronoun (tranche 18 shipped only the
   two nominatives; the fuller Whitney §491 table has accusative,
   instrumental, dative, ablative, genitive, locative, and the dual too
   — all already transcribed in this tranche's research, unused so
   far), more mood coverage; Tamil's other pronoun genitives from the
   same Lesson Twenty-One passage (அவளுடைய "her", அவருடைய "his,
   honorific", அவர்களுடைய "their", என்னுடைய "my", etc. — all already
   scoped by tranche 18's own research as needing zero new letters
   too), more negation forms (plural, colloquial — tranche 16 shipped
   only the 3rd-singular-neuter negative indicative), genitive for more
   nouns, more tenses/persons. Each still needs its own citation the way
   every tranche so far has had.
2. **Expert-tier reading** for both languages, once a real short verse —
   freshly chosen for what it needs, not assumed to be one of the two
   calibration verses above — is fully decomposable into taught vocabulary
   and taught grammar. At that point, source and read the actual verse in
   full (public-domain, per this plan's own quality bar) before any of it
   becomes lesson content.

Each step gets the same treatment this one did: read the actual primer
section (not recalled from training data), cite it per item, run
`validateManifest` (via `bun test src/learn/content/manifests.test.ts`)
before calling it done.
