# Project status

**Last verified: 2026-08-08.** Everything here was checked against the repo on
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
tasks and now also does call recordings → transcript → action items → tasks.

One Express API, one Next.js UI, Postgres, and a Python Whisper service in
`services/whisper`.

```
src/
  ai/            AiClient — multi-provider with fallback
  calls/         transcript → action items (extraction, grouping, sweep, search)
  db/            Drizzle schema + migrations, Postgres pool
  destinations/  ClickUp destinations, URL parsing, encrypted credentials
  formatting/    templates and renderers
  grouping/      AI commit grouping
  middleware/    auth, RBAC policy, rate limiting, security
  routes/        the HTTP surface
  scanning/      org-wide daily repo scan, scheduler, lease
  services/      auth, git analysis, history
  sources/       where WorkItems come from
  transcription/ audio ingest, Whisper client, job queue, SSRF guard
ui/              Next 15 + Tailwind 3 front-end
services/whisper Python faster-whisper container
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
bun test                  # 512 pass, 0 fail
npm run test:db           # 445 pass, 0 fail  (needs Postgres up)
```

`npm test` runs lint → bun → db in that order.

The db suite needs a live Postgres (`docker compose up -d`). The `*.nodetest.ts`
split exists because those tests need a real database; `bun test` covers the
pure `*.test.ts` files.

---

## Where the work stands

This follows the phase plan the project was built against. Phases are numbered
from that plan; the numbering is kept so older notes still line up.

### Done

| Phase | What | Evidence |
|---|---|---|
| **1 — Security & scoping** | RBAC actually applied; registration cannot set a role; deactivated users' tokens rejected; JWT config guard called at boot; admin user management; `analysis_history`, `work_items`, `processed_commits` scoped per user | every router has `authenticate` + a policy guard; `users.routes.ts` gates at router level |
| **2 — Data platform** | Drizzle migrations replace `CREATE TABLE IF NOT EXISTS`; every store on Postgres | 5 migrations in `src/db/migrations`; `better-sqlite3` survives only in the one-way import path and its tests |
| **6 — Transcripts → ClickUp** | Extraction with a verbatim-quote validator, review UI, real Whisper end to end, per-call filing destinations, unattended sweep, transcript search, playback aligned to transcript, URL ingestion behind an SSRF guard | `src/calls/`, `src/transcription/` |

`POST /api/webhook` is intentionally unauthenticated — it is gated by a shared
secret and refuses the request when that secret is unset. That is not a gap.

### Not started

| Phase | What | Note |
|---|---|---|
| **3 — Monorepo / Bun / BullMQ** | `packages/`+`apps/`+`modules/` layout, Redis-backed queue | **Largely obsolete — see below.** No `packages/`, no BullMQ, still `tsx` on Node ≥18 |
| **4 — One front-end** | Next 15 → 16, Tailwind 3 → 4 | `ui/package.json` confirms current versions. **This is the next real body of work.** |
| **5 — Absorb the call module** | Move code in from `call-intelligence-system` | **Largely obsolete — see below** |
| **7 — Learning module** | Sanskrit/Tamil teaching | **Specced 2026-08-08, not started.** No longer blocked — see [`docs/specs/2026-08-08-learning-module-design.md`](docs/specs/2026-08-08-learning-module-design.md) |

### Why phases 3 and 5 are obsolete

The plan assumed call intelligence would arrive by *moving code in* from
`call-intelligence-system`, and phase 3's monorepo restructure existed to give
that code somewhere to land without losing its history.

That is not what happened. The capability was **rebuilt natively** on this
stack. So:

- Phase 5 is down to the two pieces with no local equivalent: `bhashini.ts` (a
  seq2seq translation endpoint `AiClient`'s chat interface cannot serve) and
  `language.queue.ts`.
- Phase 3's restructure is now purely cosmetic. Its one *hazard* justification —
  `ScanScheduler` was an unlocked `setInterval` that would duplicate every
  ClickUp task across two processes — was closed by `ScanLeaseStore` instead.
  BullMQ would add Redis as a required service for two low-volume job types
  that Postgres already handles correctly. Not worth it until something
  concretely hurts: a queue backing up, or wanting more than one worker box.

**Do not start phase 3 on the strength of the old plan document.** Read this
section first.

The plan itself is at
[`docs/plans/2026-08-05-platform-consolidation.md`](docs/plans/2026-08-05-platform-consolidation.md),
kept because its *reasoning* remains the best account of why things are as they
are. Every phase in it now carries a status banner; trust the banners over the
prose.

---

## Next

**Phase 4: upgrade `ui/` to Next 16 + Tailwind 4.** Tailwind 3→4 changes the
config format and risks a working app, so it ships alone with nothing else in
flight.

Smaller deployment-readiness items, none blocking anything today:

- Rate limiting is in-memory — resets on restart, and is per-process.
- CORS is configured for a single localhost origin.
- `.next/` build artifacts pollute repo-wide greps. Exclude them when searching.

---

## Landmines

Things that have already cost time. Read before touching anything.

### The shell's working directory is not this repo

On the machine this was built on, the session's default directory is a
**different project** (`ask_nithyananda_app`, a Flutter app) and the shell
resets to it after every command. Every command must `cd` explicitly.

This is not hypothetical: a code review launched with a bare PR number resolved
in the wrong repository and reviewed an unrelated Flutter commit. **When
invoking a tool that takes a target, spell out the absolute repo path.**

### `main` is 64 commits behind the work

All current work is on `feat/rbac-and-scoping`, open as
[PR #1](https://github.com/srigurusharanatmananda/auto-work-analyzer/pull/1) —
94 commits, 219 files. `origin/main` is an ancestor of local `main`, so history
is clean, but **local `main` is 64 commits ahead of `origin/main` and unpushed.**

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

1. **Which language first — Sanskrit, Tamil, or both?** Tamil has better tooling
   and immediate practical use; Sanskrit is the harder problem and presumably the
   actual motivation. Both at once doubles the curriculum work for one learner.
   This is the only open question left in phase 7 — the TTS question that used to
   block it is answered in the spec, and the Whisper probe has been run.
2. **Test data cleanup.** Three test tasks exist in the live ClickUp workspace —
   `869ef37ez`, `869ef37f2` (both tagged `sweep check two`), and `869ef03tn`
   (`🧪 DELETE ME`, tagged `test-fixture`). Five test recordings sit in the dev
   database (`call-one.wav`, `call-two.wav`, two `horse.mp3`, and
   `youtube-jNQXAC9IVRw`).
3. **Whether PR #1 should be split.** 94 commits in one diff is not reviewable
   line-by-line. The natural seams are security (`8f6c3bd`…`7766fb3`), Postgres
   (`023b4eb`…`12feff3`), and calls (`8db30df` onward) — but that means three
   branches rebased off each other, which is real work for a repo with one
   reviewer.

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
