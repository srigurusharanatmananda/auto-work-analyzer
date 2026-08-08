# Platform consolidation: absorbing call intelligence and learning into auto-work-analyzer

> ## ⚠️ Historical. Read [`STATUS.md`](../../STATUS.md) first.
>
> **Written 2026-08-05. Annotated 2026-08-08.** This is the design document the
> project was built against. It is kept because its *reasoning* is still the
> best account of why things are the way they are — the SQLite constraints, the
> identity mismatch, the data-at-risk inventory.
>
> Its *instructions* are partly obsolete. Phases 1, 2 and 6 are done. Phases 3
> and 5 rest on an assumption that turned out false, and following them now
> would mean a large restructure with no remaining justification.
>
> Every phase below carries a status banner. **Trust the banners over the prose.**
> Where the two disagree, the prose is what we believed on 2026-08-05.
>
> The live picture — what is done, what is next, and the landmines — is in
> [`STATUS.md`](../../STATUS.md) at the repo root.

## Context

`auto-work-analyzer` turns git work into ClickUp tasks. `call-intelligence-system`
turns audio into transcripts. The goal is one product on one foundation, with
call intelligence and a Sanskrit/Tamil learning module as first-class modules,
gated by roles and permissions.

Exploration found this is not a code-move. Three things are true today,
independent of any integration:

- **There is no authorisation.** `authorize()` at
  `src/middleware/auth.middleware.ts:97` is correct, complete, and applied to
  **zero routes**. Every authenticated user can do everything.
  `AUTHENTICATION.md` documents RBAC that was never wired up.
- **`POST /api/auth/register` is public and accepts `role: 'admin'` from the
  body** (`src/routes/auth.routes.ts:39`, validated only as "is one of three
  strings"). Latent only because nothing checks role.
- **`analysis_history`, `work_items` and `processed_commits` have no `user_id`.**
  `GET /api/reports`, `/api/reports/:id` and `/api/history` already return every
  user's data to any authenticated caller.

And the two codebases cannot simply coexist:

| | analyzer | call system |
| --- | --- | --- |
| Runtime | Node ≥18 via `tsx` | **Bun 1.3.4 required** — 14 Bun-only globals (`Bun.spawn`, `Bun.file`, `Bun.$`) |
| Store | better-sqlite3, **synchronous single writer**, no `busy_timeout` | Postgres, 4 concurrent BullMQ workers |
| Identity | `users.id TEXT` (uuid) | `users.id serial` (int) — **and the int is embedded in 1.9 GB of audio filenames** |
| Schema change | `CREATE TABLE IF NOT EXISTS` in each store — **no `ALTER TABLE` path at all** | Drizzle migrations |

The call system's incremental segment write is
`COALESCE(segments,'[]'::jsonb) || $1::jsonb` (`language.queue.ts:86`). SQLite has
no jsonb concat — `||` is *string* concatenation there, so it would silently
corrupt rather than error.

**Decisions taken:** Postgres + Bun everywhere; one front-end, upgrading the
analyzer's UI to Next 16 + Tailwind 4 and merging the call pages into it;
foundation shipped and verified before any feature code.

One consequence worth naming: moving to Postgres dissolves the `*.nodetest.ts`
split, which exists *only* because better-sqlite3 cannot run under `bun test`
(`scripts/run-nodetests.sh`). One runtime, one database, one test runner.

## Target architecture

Bun workspaces + Turborepo — the shape the call system already has.

```
packages/
  identity/     users, JWT, RBAC, entitlements — the single auth authority
  db/           Drizzle schema + migrations for every module
  ai/           AiClient (moved from src/ai) — multi-provider with fallback
  clickup/      ClickUpService, destinations, templates, renderers
apps/
  api/          one HTTP surface, module routers mounted under /api/<module>
  worker/       BullMQ workers — transcription, scans, extraction
  web/          one Next 16 front-end
services/
  whisper/      Python + faster-whisper container (unchanged)
modules/
  work/         git → WorkItem → ClickUp        (exists)
  calls/        audio → transcript → action items → ClickUp
  learn/        Sanskrit/Tamil teaching
```

**Access control.** Roles stay `admin | manager | user` (already in the token —
`JWTService.ts:18`). Add **module entitlements** as a separate concept: a role
says *what you may do*, an entitlement says *which modules you may see*. Two
axes, because "can this user reach the calls module at all" is not the same
question as "may this user delete another user's destination". Gate in three
places: `authorize()` on every route, an entitlement check in the module
routers, and the nav array at `ui/lib/components/Sidebar.tsx:8` for the cosmetic
layer. **UI gating is cosmetic only** — `AuthContext` trusts `localStorage`
unconditionally, so a user can grant themselves `role: 'admin'` in DevTools. The
server must gate independently.

**Background work.** All of it moves to BullMQ. That also fixes a live hazard:
`ScanScheduler` is an in-process `setInterval` with no lock or leader election
(`src/scanning/ScanScheduler.ts:114`), so a second process would run the daily
scan twice and **create duplicate ClickUp tasks**.

## Phases

Each ships and is verified before the next. Phase 1 is the immediate deliverable.

### Phase 1 — Security and scoping (on the current stack, no restructuring)

> **✅ DONE.** Commits `8f6c3bd`, `70bcc50`, `7766fb3`, and — as the plan below
> correctly predicted it would slip — `b6482da` for the `processed_commits`
> scoping. `POST /api/webhook` remains unauthenticated *by design*: it is gated
> by a shared secret and refuses the request when that secret is unset.

Highest value per hour, and a prerequisite for everything: RBAC on a codebase
where registration grants admin is worse than no RBAC.

1. **Registration cannot set a role.** Strip `role` from the `register` input
   (`src/routes/auth.routes.ts:39,46`, `src/services/AuthService.ts:84`). Role
   changes only via a new admin-only route.
2. **Apply `authorize()`.** Every route in `auth.routes.ts`, `templates.routes.ts`,
   `destinations.routes.ts`, `scanning.routes.ts`, `clickup.routes.ts`,
   `tasks.routes.ts`, plus the inline routes in `webhook-server.ts`. Add the
   admin user-management surface that does not exist —
   `AuthDatabaseService.getAllUsers/updateUser/deleteUser` have no HTTP caller
   today.
3. **Scope the three unscoped tables.** Add `user_id` to `analysis_history`,
   `work_items`, `processed_commits` and filter every read. Needs a real
   migration — see Phase 2; until then this is the one Phase 1 item that must
   wait, so **order it last and expect it to slip into Phase 2**.
   Note `processed_commits` is *deliberately* global today
   (`DatabaseService.ts:286`); scoping it per user changes dedup semantics and
   needs a decision, not just a column.
4. **Wire the JWT guard.** `JWTService.validateConfig()` (`JWTService.ts:218`) is
   written and **never called**; the server boots happily with hard-coded
   `'change-this-…'` secrets. Add it beside the `CREDENTIAL_ENCRYPTION_KEY` guard
   at `webhook-server.ts:126`.
5. **`authenticate` must not re-open SQLite per request.** It constructs a new
   `AuthService` → `AuthDatabaseService` → `new Database()` on **every
   authenticated call** (`auth.middleware.ts:39`) and runs five
   `CREATE TABLE IF NOT EXISTS` each time. Also check `is_active` — a deactivated
   user's unexpired token currently still works.

### Phase 2 — Data platform

> **✅ DONE**, except item 8. Commits `023b4eb` (schema + migrations + verified
> SQLite import) through `12feff3`. Five migrations live in
> `src/db/migrations`; `better-sqlite3` survives only in the one-way import path
> and its tests.
>
> **Item 8 (unify identity) never happened and is now moot** — it existed to
> reconcile this project's uuid ids with the call system's `serial` ids during a
> code merge that did not take place. See the Phase 5 banner.

6. **A real migration mechanism.** `runMigrations` handles data moves only, by
   its own docstring; schema lives in `CREATE TABLE IF NOT EXISTS`, so **adding a
   column to an existing database is silently a no-op**. Adopt Drizzle
   migrations (the call system's `packages/database` is the model).
7. **Migrate the analyzer's stores to Postgres.** The largest single change:
   ~104 raw statements across 9 files, all synchronous, becoming async — an
   `await` cascade through `IDatabaseService.ts` and every caller. SQLite-isms to
   convert: `INSERT OR REPLACE` (`DatabaseService.ts:268`), `INSERT OR IGNORE`,
   `COLLATE NOCASE`, `datetime('now')`, all `PRAGMA`s, `INTEGER` booleans, TEXT
   timestamps, TEXT-uuid primary keys.
8. **Unify identity.** Keep the analyzer's scheme — it is strictly better
   (15-min access + 7-day refresh, rotation, `jti` blacklist, token families,
   roles). Delete the call system's single-token `lib/jwt.ts`. Re-key its
   `serial` user ids to uuid with a mapping table, and **preserve the
   `${userId}_${uuid}` audio filenames** or rewrite `calls.audio_path` in the
   same transaction.

### Phase 3 — Monorepo, Bun, queue

> **❌ NOT STARTED, and largely obsolete. Do not begin this on the strength of
> the text below.**
>
> Item 9's whole purpose was getting the call system's code in *without losing
> its 71 commits* — hence `git subtree`, hence "not a copy". That code was never
> taken; the capability was rebuilt natively. A `packages/`+`apps/`+`modules/`
> layout for one app with one deployable is now a directory rearrangement with
> no functional payoff, and it would still drag in the data hazards listed at
> the end of this document.
>
> Item 10's justification is **gone**. It cites the unlocked `setInterval` that
> would duplicate every ClickUp task across two processes — real, and closed by
> `ScanLeaseStore` (`d726c8f`, `8c510ba`) rather than by a queue. BullMQ would
> add Redis as a required service for two low-volume job types Postgres already
> handles correctly. Revisit only when something concretely hurts: a queue
> backing up, or wanting more than one worker box.
>
> Item 11 is **mostly done**. `b45c680` consolidated the UI onto one HTTP layer;
> `NEXT_PUBLIC_API_URL` is read by `ui/lib/api/config.ts`. The "19+ files" claim
> below is stale — three real source files reference the port now, and most grep
> hits are `.next/` build artifacts. What genuinely remains is small:
> in-memory rate limiting (resets on restart, per-process) and single-origin
> CORS.

9. Restructure into the layout above via `git subtree` or a remote merge with
   `--allow-unrelated-histories` — **not a copy**, or the call system's 71
   commits and its unmerged `feat/sanskrit-tamil-translation` branch are lost.
10. Move all background work to BullMQ; delete the unlocked `setInterval`.
11. **Fix config.** `http://localhost:3009` is hard-coded in **19+ UI files**
    while the server defaults to 3000 and the UI serves on 3008 — and the call
    system wants 3001/3000, colliding. Introduce `NEXT_PUBLIC_API_URL`
    (documented at `ui/ARCHITECTURE.md:326`, read nowhere). Reconcile the two
    CORS policies and the two rate-limiter implementations onto one Redis-backed
    store.

### Phase 4 — One front-end

> **❌ NOT STARTED — and this is the next real body of work.** `ui/package.json`
> is still `next@^15.1.6`, `tailwindcss@^3.4.1`, `react@^19`.
>
> One correction: "then merge the call system's 34 UI files" no longer applies,
> since those pages were rebuilt here. What remains is the upgrade alone — which
> makes this *smaller* than planned, and the plan's advice to ship it with
> nothing else in flight still stands.

12. Upgrade `ui/` to Next 16 + Tailwind 4 (53 files), then merge the call
    system's 34 UI files. Tailwind 3→4 changes the config format; this risks a
    working app, so it ships on its own with nothing else in flight.

### Phase 5 — Absorb the call module

> **❌ NOT STARTED, and this is the assumption that broke the plan.**
>
> The plan assumed call intelligence would arrive by *moving code in*. It did
> not. It was **rebuilt natively** on this stack over 2026-08-06/07 — see
> `src/calls/`, `src/transcription/`, `services/whisper`.
>
> So item 13 is down to two things with no local equivalent: `bhashini.ts`
> (a specific seq2seq translation endpoint `AiClient`'s chat interface cannot
> serve — the plan called this correctly) and `language.queue.ts`. Item 14 — the
> 73 missing `.js` specifiers and the `@database` alias — dies with the code it
> was for.
>
> **Correction, 2026-08-08:** an earlier version of this banner listed those two
> alone, which silently wrote **contact intelligence** out of existence — it is
> half of what the source system is named for, and there is no contact code in
> this repo at all. It was surfaced as Phase 8 in
> [`../../STATUS.md`](../../STATUS.md) and, **later the same day, dropped by
> decision**: the port is not happening, and if contacts are ever wanted they get
> built natively here. The reasoning is in that Phase 8 section — chiefly that
> the source's contact feature is far thinner than its name suggests (no dedup,
> no merging, no relationship graph, and no column linking a contact to a call),
> so a port would be new work wearing the label of a port.
>
> Recorded this way on purpose: dropped *by decision* reads differently from
> dropped *by omission*, and only one of them should be re-opened casually.
>
> The plan's warning that `gemini-1.5-flash` is a retired model id was right and
> was fixed here independently in `09dbdae`.
>
> `call-intelligence-system` is now a **read-only reference**, not a merge
> source. Its audio is test data and permanently out of scope.

13. Move `apps/api/src` (26 non-test files, ~3,262 lines), `packages/database`,
    and `services/whisper`. Re-point `lib/gemini.ts` at `packages/ai` —
    **`gemini-1.5-flash` there is a retired model id, so contact extraction is
    plausibly already broken**; the shared client fixes it and adds fallback.
    Keep `bhashini.ts` as-is: it targets a specific seq2seq translation
    endpoint that `AiClient`'s chat interface cannot serve.
14. Add the 73 missing `.js` import specifiers and resolve the `@database` path
    alias — `tsc` does not rewrite paths on emit.

### Phase 6 — Transcripts → ClickUp tasks

> **✅ DONE, and well past the "thin version" scoped here.** `8db30df` onward.
>
> Shipped: extraction with the verbatim-quote validator the plan insisted on
> (item 15 — an item whose quote is not present in the transcript is rejected),
> the review UI, real Whisper end to end, per-call filing destinations, the
> unattended sweep, transcript search, playback aligned to the transcript, and
> ingestion from a URL behind an SSRF guard.
>
> The plan's ordering — "paste/upload UI first (reviewed path), then a scheduled
> sweep" — was followed exactly, and was the right call.

**This is the original request, and it does not have to wait.** A thin version
ships straight after Phase 1, because it needs no absorbed call system — only a
transcript as text:

15. `modules/calls/ActionItemExtractor` — modelled on
    `src/grouping/AiCommitGrouper.ts` + `groupingSchema.ts`, which already solve
    this shape (LLM → JSON → validate → fail safe). Chunk long transcripts.
    **Every extracted item must cite the transcript sentence it came from, and
    the validator rejects any item whose quote is not present verbatim.** A task
    nobody agreed to is worse than a missed one, and that check is a cheap
    mechanical guard against invention.
16. `TranscriptWorkSource` producing `WorkItem[]` with
    `provenance.source: "transcript"`, then the existing pipeline unchanged —
    `buildPreview`, `annotateStatusMapping`, `createRenderedTasks`,
    `DestinationResolver`.
17. Paste/upload UI first (reviewed path), then a scheduled sweep over completed
    transcripts reusing the scanning machinery's dry-run and per-item dedup.

### Phase 7 — Learning module

> **🔄 UNBLOCKED as of 2026-08-08. Specced, not started.** See
> [`../specs/2026-08-08-learning-module-design.md`](../specs/2026-08-08-learning-module-design.md).
>
> The Sanskrit TTS question at the end of this document is answered. Two
> corrections to it: the "Hindi voice mispronounces Devanagari" problem is
> **schwa deletion**, and it has a known fix (synthesise from Kannada
> transliteration); and Sanskrit TTS is no longer scarce — AI4Bharat
> Indic-Parler-TTS supports it officially, Apache-2.0, and covers Tamil too.
>
> A reciter is still needed for **Vedic pitch accent only** — nothing
> synthesises *svaras*. That is one slice of stage four, not the whole phase.
> The plan blocked everything on the hardest requirement of the last stage.
>
> The Whisper question the plan flagged as unverified **was tested**: at `base`
> it never emits Devanagari at all, so pronunciation feedback is off the table
> for now. Probe and full results in the spec.

Needs its own spec; see below.

## Files

Phase 1 touches: `src/middleware/auth.middleware.ts`, `src/routes/auth.routes.ts`,
`src/services/AuthService.ts`, `src/services/JWTService.ts`,
`src/webhook-server.ts`, and one new `src/routes/users.routes.ts`. Every existing
router gains `authorize(...)` on its routes — same one-line pattern in each, so
treat it as one change repeated, not six.

Reuse rather than rebuild: `authorize` / `authorizeOwnership`
(`auth.middleware.ts:97,125` — already written), `AiClient`
(`src/ai/AiClient.ts`), `buildPreview` / `annotateStatusMapping` /
`createRenderedTasks` (`src/routes/tasks.routes.ts`), `DestinationResolver`,
`ScanRegistry` and `DailyScanner` as the dry-run/summary/dedup precedent,
`AiCommitGrouper` + `groupingSchema` as the extraction precedent.

## Before anything moves — data at risk

> **Partly resolved as of 2026-08-08.** Item by item:
>
> - ✅ The call system's uncommitted queue files were committed (`395de55`), and
>   `feat/sanskrit-tamil-translation` is resolved — 0 commits ahead of its main.
> - ✅ **It had no git remote at all** — 72 commits on one disk — until
>   2026-08-08, when it was pushed to
>   `srigurusharanatmananda/call-intelligence-system` (private), both branches.
>   History was checked clean first: no `.env` ever committed, no key-shaped
>   strings, no audio in history.
> - ❌ **The 1.9 GB of audio is still unbacked.** 43 files in
>   `apps/api/storage/audio/`, untracked by design and too large for git. Every
>   `calls.audio_path` row points at them. Still true, still irreversible.
> - ❌ **This repo's 64 unpushed `main` commits and 2 live worktrees are still
>   as described.** Current work is on `feat/rbac-and-scoping` (PR #1, pushed);
>   local `main` is 64 ahead of `origin/main` and has not been pushed.
> - ⚠️ The `docker compose down -v` / directory-rename hazard is untested and
>   remains live if anything ever moves.

Not optional, and not reversible if skipped:

- **The call system has uncommitted changes to its two most complex files**
  (`transcription.queue.ts`, `language.queue.ts`), a stash, and an unmerged
  worktree branch `feat/sanskrit-tamil-translation` ahead of main. It may have
  **no git remote**, making its local `.git` the only copy of 71 commits.
  Commit, resolve the branch, and push somewhere first.
- **1.9 GB of audio in `apps/api/storage/audio/` is untracked** — `.gitignore`
  targets `storage/audio/*`, which does not match that path. Every
  `calls.audio_path` row points at it. Any clone- or archive-based migration
  silently drops all of it.
- **`apps/api/.env` and `.env` are gitignored but hold live secrets**
  (`JWT_SECRET`, `GOOGLE_API_KEY`). Move out of band.
- **`docker compose down -v` or the directory rename orphans `postgres_data`** —
  the compose project name derives from the directory, and absorbing changes it.
  `pg_dump` first. (Volume sizes unverified: the Docker daemon was not running.)
- **The analyzer has 64 unpushed commits** and 4 in-flight branches across 2 live
  worktrees (`awa-slice2`, `awa-slice3`). Restructuring will conflict with all
  four. Push and resolve first.

## Verification

> **The baseline stated below is stale.** It records "3 pre-existing
> `auth.routes.ts` errors — note `tsc` does not currently pass clean". It does
> now. As of 2026-08-08: `tsc --noEmit` clean, `npm run lint` clean, `bun test`
> 512 pass, `npm run test:db` 445 pass, all 0 fail.
>
> Two additions the plan did not anticipate, both earned the hard way:
>
> - **`npm run lint` exists and is not optional.** The SQLite→Postgres move
>   (item 7) turned ~104 statements async, and TypeScript cannot see a caller
>   that forgot `await`. Four such bugs shipped while `tsc` was clean and every
>   test passed. `eslint.config.js` is type-aware and scoped to exactly that.
> - **Assert response bodies, not just status codes.** The `/me` bug survived a
>   test called "/me requires a token", which only ever exercised the 401 path.

**Phase 1, and this is the phase that must be verified adversarially** — a
half-applied permission model is worse than none:

- A `role: 'user'` token must get **403** on every admin route; a `manager` token
  the documented subset; an `admin` all of them. One test per route, not one per
  role, asserting the status — not merely "not 200".
- `POST /api/auth/register` with `{"role":"admin"}` must produce a `user`.
- `GET /api/reports` as user A must not return user B's reports. Write this test
  **before** the fix and watch it fail — it passes today for the wrong reason.
- A deactivated user's unexpired token must be rejected.
- Boot with `JWT_ACCESS_SECRET` unset must **refuse to start**.
- Existing suites stay green: `bun test`, `bun run test:db`, `bun run build`
  (3 pre-existing `auth.routes.ts` errors is the baseline — note `tsc` does not
  currently pass clean), `cd ui && bun run build`, `bun run e2e:clickup`.

**Phase 2:** a migration must be proven to run twice safely and to survive a
crash between the data move and the bookkeeping row — the existing
`002-destinations.nodetest.ts` is the model. Every store's tests must pass
against Postgres unchanged in behaviour.

**Phase 6:** extraction tests must include an item whose quote is absent from the
transcript (rejected), a transcript with no action items (returns `[]`, invents
nothing), and chunk-boundary coverage. **No test may call a real AI provider.**
Then end-to-end: a real transcript → preview → create into a scratch ClickUp
list → re-run and confirm nothing is created twice.

## Not planned here: the learning module

Established: absolute beginner in both languages, needs to be *told where to
start*, voice-guided throughout — letters → words → sentences → chanting — "one
stop for any level".

Assets that exist: the call system already transcribes and translates Sanskrit
and Tamil (`apps/api/src/lib/bhashini.ts`, IndicTrans2, auto-triggered on
detected `sa`/`ta`), has a `language_jobs` table and UI, and ~43 processed audio
files.

**The constraint to settle before planning it:** *voice-guided* needs a voice.
Tamil TTS is well served (Google, Azure). **Sanskrit TTS is scarce** — realistic
options are recorded audio from a reciter, or a Hindi voice approximating
Devanagari, which mispronounces Vedic length and pitch. For chanting that is the
whole point, so this is a product decision, not an implementation detail.

Pronunciation feedback is the one thing an app can do that a book cannot, and
Whisper is already deployed — record, transcribe, diff against the intended text.
Whether Whisper is accurate enough for Sanskrit syllable length is **unverified**
and should be tested with a throwaway probe before being planned around.
