# Project status

**Last verified: 2026-08-13.** Everything here was checked against the repo on
that date, not recalled.

If you are picking this up cold, read this file first. There is no `CLAUDE.md`
or `CONTRIBUTING.md` here — the conventions that matter are in **Landmines** and
**Standing rules** below, and the rest is best learned from recent commit
messages, which explain *why* rather than *what*.

The root also holds ~19 older markdown files (`AUTHENTICATION.md`,
`DATABASE-MIGRATION-GUIDE.md`, `QUICK_START.md`, and so on). Treat them as
historical: several describe behaviour that predates the Postgres move or the
RBAC work, and at least one documented an RBAC scheme that had never been wired
up. **Verify against the code before believing any of them.**

Re-verify this file too — the commands to do so are in each section.

---

## What this is

`auto-work-analyzer` turns work into ClickUp tasks. It started as git commits →
tasks and now also does call recordings → transcript → action items → tasks —
and, since phase 7, teaches the operator Sanskrit and Tamil on the side.

One Express API, one Next.js UI, Postgres, and two Python model-serving
containers (`services/whisper`, `services/tts`).

```
src/
  ai/            AiClient — multi-provider with fallback
  calls/         transcript → action items (extraction, grouping, sweep, search)
  db/            Drizzle schema + migrations, Postgres pool
  destinations/  ClickUp destinations, URL parsing, encrypted credentials
  formatting/    templates and renderers
  grouping/      AI commit grouping
  learn/         Sanskrit/Tamil curriculum engine, transliteration, speech, audio cache, progress
  middleware/    auth, RBAC policy, rate limiting, security
  routes/        the HTTP surface
  scanning/      org-wide daily repo scan, scheduler, lease
  services/      auth, git analysis, history
  sources/       where WorkItems come from
  transcription/ audio ingest, Whisper client, job queue, SSRF guard
ui/              Next 16 + Tailwind 4 front-end
services/whisper Python faster-whisper container
services/tts     Python Indic-Parler-TTS container (Sanskrit speech; Tamil uses Gemini directly)
```

**State management of note:** background work is in-process, not a queue.
`TranscriptionWorker` polls a Postgres job table; `ScanScheduler` is a
`setInterval` made multi-process-safe by a database lease (`ScanLeaseStore`),
not by leader election.

---

## Health

```bash
npx tsc --noEmit          # clean
npm run lint              # clean  (eslint src)
bun test                  # 1801 pass, 2 fail  (see below)
npm run test:db           # 472 pass, 1 fail   (needs Postgres up)

cd ui
npx tsc --noEmit          # clean
npx next build            # clean
bun test                  # 54 pass, 0 fail
npm run lint              # clean; 14 warnings — pre-existing, see Known issues
```

The 2 `bun test` failures are `templates.routes.mount.test.ts` only, and only
in a FULL run — both pass in isolation. Cross-file `mock.module` pollution
from the auth mocks, not a broken route. Pre-existing; reproduces on a clean
checkout of `HEAD`.

Speech needs only `GOOGLE_API_KEY` now — both languages go to Gemini and
answer in seconds, so `docker compose up tts` is no longer required and
pregeneration is an optimisation rather than a prerequisite. `services/tts`
(Indic-Parler-TTS, gated model — see env.example's `HUGGINGFACE_API_KEY`)
remains the fallback when no Google key is set, and can be forced back for
Sanskrit with `LEARN_SANSKRIT_TTS=self-hosted`; on CPU it is several minutes
per phrase, so that path really does need
`npm run learn:pregenerate-sanskrit-audio` run first.

`npm test` runs lint → bun → db in that order.

The db suite needs a live Postgres (`docker compose up -d`). The `*.nodetest.ts`
split exists because those tests need a real database; `bun test` covers the
pure `*.test.ts` files.

**Nothing runs the `ui/` checks for you.** They are in no script and no CI job;
the root `npm test` is `eslint src` and the server suites only. Run them by hand
when you touch the front-end.

---

## Where the work stands

Phase numbers come from the original plan document. That document has been
retired — most of it had become banners explaining what was no longer happening,
which is the opposite of a plan. This file replaces it. The numbering is kept
only so older commit messages and notes still line up; there is no phase 3 or 5
to do.

To read the retired plan and its reasoning:
`git log --diff-filter=D -1 -p -- docs/plans/2026-08-05-platform-consolidation.md`

### Done

| Phase | What | Evidence |
|---|---|---|
| **1 — Security & scoping** | RBAC actually applied; registration cannot set a role; deactivated users' tokens rejected; JWT config guard called at boot; admin user management; `analysis_history`, `work_items`, `processed_commits` scoped per user | every router has `authenticate` + a policy guard; `users.routes.ts` gates at router level |
| **2 — Data platform** | Drizzle migrations replace `CREATE TABLE IF NOT EXISTS`; every store on Postgres | 5 migrations in `src/db/migrations`; `better-sqlite3` survives only in the one-way import path and its tests |
| **6 — Transcripts → ClickUp** | Extraction with a verbatim-quote validator, review UI, real Whisper end to end, per-call filing destinations, unattended sweep, transcript search, playback aligned to transcript, URL ingestion behind an SSRF guard | `src/calls/`, `src/transcription/` |
| **4 — One front-end** | Next 15 → 16, Tailwind 3 → 4, `next lint` → flat-config `eslint` | `ui/package.json`; `ui/app/globals.css` now holds the theme as `@theme`, and `tailwind.config.ts` is gone |
| **7 — Learning module** | Curriculum engine, both languages, all three stages reachable (letters, words, one sentence each) with explicit numbered levels (1-5, beginner through expert); real speech for both (Gemini for Tamil, self-hosted Indic-Parler-TTS for Sanskrit); UI at `/learn`. Lesson Previous/Next navigation, a translate/transliterate tool, and in-app reading resources (excerpts, notes, video/playlist embeds, full public-domain book scans, your own PDF uploads) are in progress on separate, not-yet-merged PRs — see those PRs for their own status, not claimed as done here until merged. | `src/learn/`, `services/tts/`, `ui/app/learn/`. PRs #4-#8. [`docs/specs/2026-08-08-learning-module-design.md`](docs/specs/2026-08-08-learning-module-design.md) (2026-08-10 update reversing its Sanskrit-via-Kannada design), [`docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`](docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md) (content depth plan) |

`POST /api/webhook` is intentionally unauthenticated — it is gated by a shared
secret and refuses the request when that secret is unset. That is not a gap.

**Phase 7's real remaining gap: content depth, not the one-sentence-per-language
minimum stage 3 needed to prove the engine.** That minimum shipped 2026-08-10.
What's still thin overall is scoped in
[`docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`](docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md),
whose tranches so far: the complete alphabets for both languages (Sanskrit
62 letters, Tamil 37 letters total — 33 live forms plus 4 dead/pulli forms
— up from 9 and 6+2 respectively), a first batch of Sanskrit vowel signs
(Wikner 6.A.1), the two special Sanskrit conjuncts kṣa/jña
(Wikner 7.A.3-7.A.5), two new Sanskrit words — one dropped after two
adversarial verifiers flagged it, one added later (vṛkṣa, "tree", the
specific word kṣa unblocks) — and the full Tamil vowel-sign table (ABC of
Tamil, Lessons Three-Fifteen) on 17 of 18 consonants (ங alone is excluded,
and only 10 of the 17 get the rare au sign, both per the primer's own
explicit account — see the plan doc's tranche-5 entry). Tranche 6 added a
real engine capability — `Lesson.sandhiRule`, letting a lesson's `text`
legitimately diverge from simple `composedOf` concatenation when a real
sandhi/junction sound change is what's being taught — plus the first
sandhi content it unblocks (one Sanskrit visarga-sandhi sentence, five
Tamil conjunction-rule words/sentence). Tranche 7 shipped the first slice
of real grammar beyond nominative-only: Sanskrit's accusative (dvitīyā)
case plus its first ātmanepada verb, unblocking अश्व ("horse") — the word
every prior tranche's own comments named as still-blocked — in Wikner's
own worked sentence (नरः अश्वम् वृक्षम् नयते); and Tamil's first verb
conjugation, present tense (நான் செய்கிறேன், "I do"), needing zero new
letters since everything it uses was already taught. Tranche 8 added one
more case each: Sanskrit's genitive (नरस्य, "of the man") and Tamil's
accusative (கண்ணை, பல்லை), both reusing already-proven letters/patterns.
Tranche 9 added a third/second case each: Sanskrit's instrumental (नरेण,
"by/with the man") and Tamil's dative (யாருக்கு, "to whom"). Tranche 10
added a fourth/third case each: Sanskrit's dative (नराय, "to/for the
man") and Tamil's genitive (யாருடைய, "whose"). Re-testing against the
plan doc's own reading benchmarks after that showed three more cases
hadn't moved either language closer — real blockers are pronouns, verb
moods, and particles, not case coverage — so tranche 11 pivoted: a
particle (इति) and a second verb person (नये) for Sanskrit, a second verb
person (அவன் செய்கிறான்) for Tamil. Tranche 12 researched sourcing first
(confirmed Wikner has no pronoun table or imperative mood; confirmed ABC
of Tamil is exhausted at Lesson 21), then shipped what that research
found: Sanskrit's तिष्ठति ("stands") and तिष्ठामि ("I stand"), finally
unblocking the ष्ठ conjunct every tranche since 4 named as missing; and
Tamil's first tense beyond present, past (செய்தேன்/செய்தான்), from a new
second source, M.S. Andronov's *A Grammar of Modern and Classical Tamil*
(catalogued as `tam-andronov-grammar`). Tranche 13 added Sanskrit's three
isolated pronoun/particle glossary words (अहम्/नौ/अस्तु — Wikner has no
pronoun or mood lesson to draw a real one from) and Tamil's first
negation (செய்யாதே, "don't do!"). Re-tested against both benchmark verses
after: genuinely closer (अस्तु is a verbatim match in BG 2.47) but not
close (11 of 12 words in that verse, and all 7 in Thirukkural 1, are
still unreachable). Operator decision: treat those two verses as
calibration, not a checklist, and target grammar completeness on its own
merits going forward. Tranche 14 acted on that: Sanskrit's second
particle (हे, "O!", vocative — the sentence हे नर means "O man!") and
Tamil's future tense
(செய்வேன், "I shall do"). Tranche 15 added Sanskrit's first participle
and adjective (अधीतम्, "studied"; तेजस्वि, "brilliant" — both from
Wikner's Invocation verse, the same passage that sourced नौ/अस्तु; अहम्
is a separate back-matter citation, not this same passage — a real
citation bug this tranche's own verifier caught and fixed before merge.
A second, thorough re-check also confirmed Wikner has no 2nd-person
pronoun anywhere in the text, so that gap stays open) and Tamil's second
grammatical person, present tense (நீ, "you"; செய்கிறாய், "you do" —
Lesson Seventeen). Tranche 16 added Tamil's first negative indicative
(செய்யாது, "does not do" — distinct from tranche 13's negative
imperative செய்யாதே) and a second dative sub-rule (கண்ணுக்கு "to the
eye", பல்லுக்கு "to the tooth" — short nouns doubling their final
consonant), Tamil-only since this tranche's research found no unspent
Sanskrit lead. Tranche 17 added Sanskrit's second particle, एव ("indeed,
verily", Wikner §15.8 line 3876 — the line right after line 3875's
अहम्, in that same back-matter passage), Sanskrit-only this time since
Tamil's own next candidate (pronoun genitives) needs a new letter not
yet scoped. Tranche 18 finally closed Sanskrit's 2nd-person-pronoun gap
via a genuinely new source — Wikner has none, and Perry's primer's own
cached OCR is unreadable for this exact table, but William Dwight
Whitney's Sanskrit Grammar (1889, public domain, `skt-whitney-grammar`,
§491) has it in clean Devanagari + IAST: त्वम् ("you") and यूयम् ("you
all"). Same tranche shipped Tamil's அவனுடைய ("his"), which turned out
to need zero new letters (the alveolar னு grapheme it needs was
already in the file from an earlier tranche). Tranches 19–26 followed
(2nd-person pronoun case forms, a broad grammar push,
pronoun/mood/compound/tense completion, verb number + the 2nd-person plural
+ Tamil's three unstarted person-categories, noun number + closing all three
Sanskrit present indicatives, and then the rest of the नर declension +
filling Level 4, then Wikner's three remaining exercise verbs: √gam, √labh,
and √vah, then Wikner 6.B.4's letters lā/bhe, words bālā/phalam/labhe, and
two Level 4 sentences, then the case-reading slice from Wikner 6.B.4(c)6:
the letters le/kṣe, bāle ("the two girls") and vṛkṣeṣu ("among the trees"),
and the Level 4 sentence bāle vṛkṣeṣu tiṣṭhataḥ vadataḥ ca — “the girls (two)
stand among the trees and speak”), then Wikner 6.B.4(c)1's phalāya (“for
fruit") and its Level 4 sentence, then the accusative bālam ("the girl")
and its Level 4 sentence, then the ablative bālāyāḥ ("from the girl") and
its Level 4 sentence, then the genitive-plural vṛkṣāṇām ("of the trees"),
phalāni ("the fruits"), and labhete ("they two take") with their Level 4
sentence, then the nominative-plural bālāḥ ("the girls") and instrumental
aśvena ("by horse") with their Level 4 sentence. Counted by running the real
manifests, not grep: **Sanskrit 298 lessons, Tamil 315**. The next slice added
the dual-destination vṛkṣau ("to the two trees") and gacchāmi ("I go"), then
the dual fruit phale ("the two fruits"), the ablative vṛkṣāt ("from the
tree"), and the dative bālāyai ("for the girl") with their Level 4 sentences,
then the possessive-tree reading sentence, dual-carrying vahataḥ, the
horse-carrying sentence, and the girl-possessive horse sentence. All nine person/number cells of √sthā,
√vad and √nī are taught, Sanskrit nouns inflect for dual and plural (so verb
agreement can be shown subject-to-verb, not only verb-to-verb), Wikner's नर
paradigm is complete, and Tamil has a second verb root (போ).

**Level 4 ("Reading Practice") holds 44 Sanskrit sentences — but read the
caveat before treating it as done.** Every one is a line Wikner prints, with
his own printed English as its gloss, so they clear the sourcing bar. But 25
of the 44 are the same two-verb-plus-च shape (तिष्ठसि वदसि च, वदामि तिष्ठसि च,
…) — permutations from his conjugation exercises. The tier is populated;
whether it teaches "graded reading of real text" is a different question, and
today it mostly drills verb agreement. The first vocabulary tranche has now
added √gam, √labh and √vah, tranche 26 added bālā, phalam and labhe, and
tranche 27 added the case-reading sentence from Wikner 6.B.4(c)6, and tranche
28 added the dative-reading sentence from 6.B.4(c)1, tranche 29 added the
accusative-reading sentence from 6.B.4(c)2, and tranche 30 added the
ablative-reading sentence from 6.B.4(c)3; tranche 31 added the
genitive/plural-reading sentence from 6.B.4(c)4; tranche 32 added the
plural/instrumental-reading sentence from 6.B.4(c)5; tranche 33 added the
dual-destination sentence from 6.B.4(c)7; tranche 34 added the dual-fruit
sentence from 6.B.4(c)8; tranche 35 added the possessive-tree sentence from
6.B.4(c)9; and tranche 36 added the dual-carrying sentence from 6.B.4(c)10.
Real prose
still needs future Wikner lessons 5-11 vocabulary and their
locative/genitive/instrumental declensions. That is future vocabulary work,
not an immediate re-leveling of the existing Level 4 sentences.

**Level 5 ("Classical Texts") is empty, and that is a measurement rather than
an oversight**: a `sentences` lesson must reconstruct exactly from words the
curriculum already teaches, and tokenising all 182 Guru Gita verses against
the taught Sanskrit vocabulary gives a best case of 3 words out of 12, with
no verse reaching zero gaps. Tamil Level 4 is likewise empty — ABC of Tamil
Book One was enumerated and contains no graded reading at any vocabulary
size, so that one is blocked on a new source, not on more work.
The remaining gap is content, not
an engine limitation — per the design doc's own risk note, needs the one
human quality gate this
module can't automate: a beginner cannot detect a bad teacher. The plan's
"What's next, in order" section is the actual backlog here.

**Chanting Practice, a new feature area (2026-08-13).** `/learn/chanting`
teaches full verses (Guru Gita to start), separate from the letters-up
curriculum above — pronunciation via a syllable/metrical-weight
breakdown, then meaning, then the whole verse. Two research passes
first: (1) the verse the operator's own source material presented as
"Guru Gita verse 1" turned out to be a real verse, but from the wrong
recension — the unrelated ~350-verse "long version," not the popular
~182-verse Siddha Yoga version almost everyone means; shipped the
correct one instead, independently re-sourced from two agreeing sources
rather than copying either's own restrictively-licensed transcription.
(2) The syllable-splitting/heavy-light (guru/laghu) rules were verified
against Whitney, Macdonell, and Apte before being encoded — two real
refinements survived that check (e/o are unconditionally long, not
"usually"; a pāda's last syllable is metrically ambiguous by
convention, not scored by the general rule). Segmentation itself uses
`@vipran/aksharas` (MIT, npm), adopted after confirming it reproduces
Whitney's own worked example, rather than hand-rolled from scratch.
Chant-melody synthesis was researched and found not realistically
available — the one real project for this (Vāgdhenu) needs GPU infra
this app doesn't have and only approximates one recording artist's
take — so audio practice uses the existing Sanskrit TTS pipeline
(already built for the curriculum) and melody is left to curated real
recordings, not yet added. New: `src/learn/Akshara.ts` (the engine,
fully unit- and adversarially-tested), `src/learn/content/chanting.ts`
(verse content), `src/routes/chanting.routes.ts`, `ui/app/learn/
chanting/page.tsx`. All 182 verses of the short recension have since
shipped, each with the same per-verse sourcing rigor as the curriculum
tranches above.

**Chant books: bring your own text (2026-08-13).** `/learn/chanting/books`
takes a PDF or `.txt` up to 500MB, splits it on explicit verse-number
markers (`BookVerseParser.ts` — danda-wrapped `॥ १॥` or a bare numeral
starting a line; a book using neither is rejected rather than guessed
at), and computes each verse's pāda/word/gloss breakdown on the AI
lazily, the first time that verse is opened. Verified end to end against
a real text-layer PDF, in both Latin and Devanagari script. Known limit:
a purely scanned PDF has no text to extract and is rejected, and Tamil
books get no syllable-weight analysis (`@vipran/aksharas` is
Devanagari-only — see `chantBooks.routes.ts`'s own comment).

**Chanting audio: fixed 2026-08-13.** Only verse 1 would play; every
other verse hung on "Synthesising" for three minutes and failed. Not a
playback bug — Sanskrit was routed to the self-hosted, CPU-only
Indic-Parler-TTS container, which is only usable via a pre-warmed
`AudioCache`, and pregeneration had warmed exactly 5 of the 910 chanting
items (all of them verse 1's) before anyone stopped waiting. Measured,
not assumed: recomputing every cache key against `storage/learn-audio`
gives 5/910. Sanskrit now routes to Gemini, which Google does not list as
supporting Sanskrit but which — verified directly against the live API —
speaks Devanagari intelligibly and in seconds. `LEARN_SANSKRIT_TTS=self-hosted`
restores the old routing for anyone running the container on a GPU.

**Fixed same day: `services/tts` had a real memory leak, not just
slowness.** "Play audio" on the chanting page appeared permanently
stuck; the actual cause was `docker stats`-reported RSS climbing every
consecutive synthesis call (40% → 82%+ of the container's 4g limit
after 3-4 requests) until requests started failing outright with no
error from the model itself — a plain container restart, no code
change, reset it every time. `model.generate()` was already correctly
wrapped in `torch.no_grad()` (verified by reading the installed
library's own source, not assumed), so this wasn't the usual
gradient-graph-retention bug; the actual signature — Python objects
freed, native RSS climbing anyway, clean reset on restart — is glibc/
OpenMP/MKL not returning freed heap arenas and per-thread scratch
buffers back to the OS after a large CPU tensor workload. Fixed in
`services/tts/main.py` by calling `gc.collect()` plus
`ctypes.CDLL("libc.so.6").malloc_trim(0)` after every synthesis call
(success or failure, via `finally`). Verified with 5 consecutive real
requests post-fix: all 5 succeeded (previously request 3+ failed),
memory stayed in a flat 20-27% band instead of climbing — it dropped
*below* its post-startup baseline after the first call, confirming the
trim is doing real work, not just papering over the symptom.

### Still to do

| Phase | What | State |
|---|---|---|
| **— Analytics** | A reporting view over work items, scans and calls | **Undecided.** Raised in conversation, never scoped. Nothing depends on it |

### Not doing

Each of these was a real plan item, and each was closed deliberately. They are
listed so nobody re-opens one as "we forgot to do this" — the reasons are the
point, not the verdicts.

| Phase | Verdict | Why |
|---|---|---|
| **3 — Monorepo / Bun / BullMQ** | Abandoned | It existed to give incoming call-system code somewhere to land. Nothing is being moved in, so the restructure is now cosmetic. Its one *hazard* justification — `ScanScheduler` duplicating every ClickUp task across two processes — was closed by `ScanLeaseStore` instead. BullMQ would make Redis a required service for two low-volume job types Postgres already handles. Revisit only if a queue actually backs up, or you want more than one worker box |
| **5 — Absorb the call module** | Superseded | Call intelligence was **rebuilt natively** rather than merged in, and that went better than the merge would have. All that ever remained were two pieces with no local equivalent: `bhashini.ts` (a seq2seq translation endpoint `AiClient`'s chat interface cannot serve) and `language.queue.ts` |
| **8 — Contact intelligence** | Dropped 2026-08-08 | Not a port and not scheduled. See below |

**Contacts, in full, because this one is easy to get wrong.** The sister repo is
named for two capabilities and only one was rebuilt here. What it actually has is
a flat per-user address book, one LLM extraction prompt (whose 188 lines of tests
cover JSON-parsing robustness, not extraction quality), and a `LIKE` search. What
it does *not* have — verified, the greps are empty — is fuzzy matching, dedup,
profile merging, a relationship graph, or **any column linking a contact to a
call**; the source's own "contacts for this call" query returns a hardcoded empty
array.

So a port would mean re-keying `serial` ids to uuid and *then* building every
interesting part from scratch: new work wearing the label of a port. If contacts
are ever wanted, build them here — uuid identity and a `callId` link from the
start, extraction validated the way `AiCommitGrouper` + `groupingSchema` already
validate LLM output. Copy the prompt, not the code. Nothing depends on this, so
the decision is cheap to reverse on evidence.

---

## Next

**Phase 7 content depth, per the new curriculum plan.** The next task is
future Sanskrit vocabulary work toward genuine reading practice: expand
Wikner lessons 5-11 vocabulary and the needed
locative/genitive/instrumental declensions. It is not an immediate re-leveling
of the existing Level 4 sentences. See
[`docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`](docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md)'s
"What's next, in order" for the source and quality constraints. Content work
still needs the human quality gate the design doc calls for before it ships to
the one real learner.

**The `ui/` upgrade still has not been looked at by a human eye**, for the
whole app, not just `/learn`. It was verified by diffing the class tokens
used in source against the selectors in the compiled CSS — which is what
caught the opaque modal backdrops — but "every utility emits the right rule"
is not the same claim as "the pages look right". Layout and spacing
regressions would survive that check.

Smaller deployment-readiness items, none blocking anything today, are in
**Known issues** below. One search annoyance worth knowing: `.next/` build
artifacts pollute repo-wide greps — exclude them.

---

## Known issues

Small, real, and not urgent. Listed here because a defect recorded only inside a
dated design document is lost the moment that document ages out.

| Where | Issue | Impact |
|---|---|---|
| `src/middleware/security.middleware.ts` | Rate limiting is in-memory. | Resets on restart, and is per-process rather than per-installation. Only matters once this runs behind more than one instance. |
| `src/webhook-server.ts` | CORS is configured for a single localhost origin. | Blocks any non-local deployment. |
| `ui/` (12 components) | `npm run lint` reports 14 warnings: 12 `react-hooks/set-state-in-effect`, 2 `react-hooks/immutability`. Both rules are downgraded from error in `ui/eslint.config.mjs`. | Pre-existing, and newly *visible* rather than newly broken — those two rules ship in `eslint-config-next@16`, and before it `next lint` was in no gate, so ui linting had never actually run. Downgraded rather than fixed so the script is not red on a clean checkout; re-ordering effects across 12 components is a behavioural change that deserves its own diff and a browser to verify it in. Nothing is known to misbehave because of them. Delete the override block once they are fixed. |
| `ui/app/saved-reports/[id]/manager-summary/page.tsx`, `ui/app/settings/templates/page.tsx` | `bg-accent`, `bg-accent-hover` and `text-foreground-muted` emit no CSS. | Neither colour was ever defined — not in the v4 `@theme` and not in the v3 config before it, so these have never rendered and are not a Tailwind-4 regression. The elements are presumably drawn wrong today and always have been. Needs someone to say what they were meant to look like. |

## Landmines

Things that have already cost time. Read before touching anything.

### The shell's working directory is not this repo

On the machine this was built on, the session's default directory is a
**different project** (`ask_nithyananda_app`, a Flutter app) and the shell
resets to it after every command. Every command must `cd` explicitly.

This is not hypothetical: a code review launched with a bare PR number resolved
in the wrong repository and reviewed an unrelated Flutter commit. **When
invoking a tool that takes a target, spell out the absolute repo path.**

### `main` has caught up — but check before trusting that

Resolved 2026-08-09. `feat/next16-tailwind4` merged into
`feat/rbac-and-scoping` as PR #2, then that merged into `main` as PR #1 —
112 commits, merge commit `3a3a742`. Both PRs are closed and `main` is now
the tip of the work.

Two things this history leaves behind. First, **a local `main` from before
that day is 112 commits stale** and `git log` on it shows none of this;
`git pull` before believing anything it says. Second, **nothing in CI ever
checked those 112 commits** — `.github/workflows/` holds only
`daily-report.yml`, a cron job. The suite was run by hand at the merge
point and was green; that is the whole of the verification.

There are also two live worktrees whose branches predate all of this and will
conflict with any restructuring:

```
../awa-slice2   feat/clickup-destinations
../awa-slice3   feat/ai-commit-grouping
```

### The unawaited-Promise class of bug

The SQLite→Postgres move turned ~104 statements async. TypeScript cannot catch
a caller that forgot `await` — ignoring a Promise is legal — so `tsc` stayed
clean and every test passed while four such bugs were live, including one that
made `GET /api/auth/me` return `{"user":{}}` to every caller.

`eslint.config.js` now exists for exactly this: type-aware
`no-floating-promises`, `await-thenable`, `no-misused-promises`. It is
deliberately **not** `recommendedTypeChecked`, which reported 931 pre-existing
problems and would bury the rules that matter.

**If you add async code, run `npm run lint`.** `tsc` will not save you.

### Tests that pass for the wrong reason

The `/me` bug shipped past a test named "/me requires a token" — which only ever
asserted the 401 path. The bug lived in the branch it never visited. When adding
a test for a route, assert the **body**, not just the status.

### The scan lease has two modes and they are not symmetric

`ScanLeaseStore.withLease` takes:

- `redoCompleted` — a *person* may retake a finished day (the "I fixed the
  settings, run it again" case). Never passed by the scheduler.
- `markComplete: false` — a scan of a day still in progress must not mark it
  finished, or the evening's scheduled run is refused forever and the
  afternoon's commits are never filed.

Neither may override a **live** claim. Concurrency is what duplicates tasks, and
no amount of the user having asked makes two simultaneous scans of one day
correct. Do not relax that.

### Dates are local, not UTC

Use `localDate()` from `src/scanning/scanDate.ts`. The scheduler fires at a
local wall-clock time and users pick dates from a local calendar; a
`toISOString()`-derived date names a different day for several hours daily and
keys the lease wrongly.

---

## Sister repo

`call-intelligence-system` (`../call-intelligence-system`) is the **read-only
reference** the call features were modelled on. It is not merged and is not a
merge target. Its audio is test data and permanently out of scope.

As of 2026-08-08 it is backed up: pushed to
`srigurusharanatmananda/call-intelligence-system` (private), 72 commits, both
`main` and `feat/sanskrit-tamil-translation`.

**Still unbacked:** 1.9 GB across 43 audio files in `apps/api/storage/audio/`,
untracked by design and too large for git. Every `calls.audio_path` row points
at them. Any clone- or archive-based migration silently drops all of it.

That repo also holds ~17 untracked CSVs of business contact data (lead lists,
publisher contacts). They do not belong in a code repo and were deliberately
left alone — that is a human's decision, not a cleanup task.

---

## Open questions for a human

An agent should **not** decide these alone.

1. **Analytics: is a reporting view wanted?** Raised in conversation as an option
   and never scoped. Nothing depends on it.

2. **Test data cleanup.** Three test tasks exist in the live ClickUp workspace —
   `869ef37ez`, `869ef37f2` (both tagged `sweep check two`), and `869ef03tn`
   (`🧪 DELETE ME`, tagged `test-fixture`). Five test recordings sit in the dev
   database (`call-one.wav`, `call-two.wav`, two `horse.mp3`, and
   `youtube-jNQXAC9IVRw`).

3. **Whether anything should gate `main`.** There is no CI beyond a cron job,
   and PR #1 landed 112 commits with no automated check having run over any of
   them. A workflow running the four commands in Health above would have caught
   nothing this time, which is the argument for adding it while that is still
   true.

*(A fourth question — whether PR #1 should be split into security, Postgres and
calls — is now moot. It was merged whole on 2026-08-09.)*

---

## Standing rules

From the operator, and they hold regardless of what any plan document says:

- **Never merge a PR or land into a shared branch without an explicit go-ahead
  each time.** Feature branches and PRs are the norm, not direct pushes.
- **Never open a PR without being asked.** Pushing is not PR permission.
- `git add <explicit paths>` only — never `git add -A`.
- Never log an API key, plaintext or ciphertext.
- The server must refuse to start without `CREDENTIAL_ENCRYPTION_KEY`.
- No test may hit a live AI provider or create real ClickUp tasks.
- New code must meet DRY/SOLID on its own terms — matching a bad surrounding
  pattern is not a justification. Extract the seam instead of adding a copy.
