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

## What's next, in order

1. **Sanskrit conjuncts** (Wikner 7.A) — halanta and the special conjuncts
   (kṣa, jña, etc.), the remaining letters-stage gap before real
   multi-syllable words become constructible.
2. **More Sanskrit words**, once conjuncts unlock the many B-section verbs
   that need them (tiṣṭhati's ṣṭha, aśva's śva, vṛkṣa's kṣa — all flagged
   as blocked-on-conjuncts by tranche 2's own research).
3. **Tamil vowel-sign combinations** (ABC of Tamil, Lessons Three onward) —
   the consonantal-vowel matrix beyond the two combinations (நா, யா)
   already taught.
4. **Sandhi (Sanskrit) / conjunction rules (Tamil)** — the prerequisite for
   sentences that read like real text rather than two words placed side by
   side.
5. **Expert-tier reading** for both languages, once the above make it
   possible to verify a real sentence the same rigorous way the existing
   one was.

Each step gets the same treatment this one did: read the actual primer
section (not recalled from training data), cite it per item, run
`validateManifest` (via `bun test src/learn/content/manifests.test.ts`)
before calling it done.
