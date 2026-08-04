# Org-Wide Daily Scan — Design

**Date:** 2026-08-04
**Status:** Approved for planning

## Problem

Today the analyzer works one repository at a time: the user picks a project path
in the Reports tab, generates a report, reviews it, and creates tasks. Someone
working across a dozen repositories in the `kailasa-ngpt` organisation has to
repeat that a dozen times, and in practice will not.

This feature scans every accessible repository in the organisation and creates
the day's ClickUp tasks unattended, at end of day.

## Decisions

Each of these was chosen over stated alternatives; the rejected options are
recorded because the reasoning is the useful part.

| Decision | Chosen | Rejected because |
| --- | --- | --- |
| Commit source | **Local clones** | The GitHub API would need a token with org read access and a per-commit call to get file lists and line counts. Local clones reuse the existing `git log --numstat` pipeline verbatim, with full fidelity and no rate limit. |
| Org membership | **Parsed from `git remote`** | Asking GitHub which repos the user can access would reintroduce the token that choosing local clones removed. A clone's remote URL already states its owner. |
| Task routing | **Per-repo destination, default fallback** | A single shared list mixes projects and makes per-project reporting depend on tags. A parent-task-per-repo shape deepens the N+1 problem the codebase already has. |
| Trigger | **In-app scheduler + Run now** | OS-level cron puts configuration outside the app where failures are invisible. Manual-only is not automatic. |
| Attribution | **Multiple configured author identities** | One hardcoded email silently returns zero for every repo where the user's git identity differs — a wrong report that does not look wrong. |
| Dedup key | **Commit hash alone** | Keying on `(hash, path)` is what the code appears to do but cannot, since `hash` is the primary key — the two disagree and produce endless duplicate creation across clones. |
| Freshness | **`git fetch` per repo, failures reported** | Scanning whatever is on disk silently misses work pushed from another machine. Fetching only "recently active" repos misses exactly the repos worked on elsewhere. |

### Assumptions

- Default scan root is `~/Documents/GitHub`, one level deep. Configurable.
- The scheduler ships **disabled**. Nothing is created unattended until the user
  enables it. Dry run is available from the first commit onwards.
- One schedule for all repos. No per-repo scan times.
- Out of scope: Slack/email digests, and any GitHub API usage.

## Architecture

Four new units under `src/scanning/`, each usable and testable alone.

| File | Responsibility |
| --- | --- |
| `RepoDiscovery.ts` | Walk the root, identify git repos, parse remotes, filter to the org |
| `RepoRegistry.ts` | `scanned_repos` table: slug → destination, template, enabled, last scanned |
| `DailyScanner.ts` | One run: per repo, fetch → analyze → group → resolve → create |
| `ScanScheduler.ts` | Fires at the configured time; catches up a missed day on startup |

`DailyScanner` **composes existing pieces and adds no formatting or creation
logic of its own**: `GitWorkAnalyzer` per repo, the injected `CommitGrouper`,
`DestinationResolver`, and `createRenderedTasks`. If it starts formatting
anything, the canonical pipeline has been bypassed and preview/created parity is
broken again.

### Repo identity

`parseRemote(url)` accepts both forms and yields `{ owner, name, slug }`:

```
git@github.com:kailasa-ngpt/ask_nithyananda_app.git  -> kailasa-ngpt/ask_nithyananda_app
https://github.com/kailasa-ngpt/ask_nithyananda_app  -> kailasa-ngpt/ask_nithyananda_app
```

The slug is the repo's identity everywhere: registry key, ClickUp tag, and —
see below — the commit-dedup key. A repo whose remote is absent, non-GitHub, or
owned by another org is skipped, and the skip reason is recorded so the settings
page can explain why a directory the user expected is not listed.

### Commit dedup: drop the path from the key, do not add a slug

**This section was rewritten after verifying the actual behaviour. The first
draft was wrong, and the migration it proposed is impossible.**

`processed_commits` declares `hash TEXT PRIMARY KEY` — the hash **alone**
(`DatabaseService.ts:83-93`). But `isCommitProcessed` filters on hash *and*
`project_path` (`DatabaseService.ts:288-295`), and writes use
`INSERT OR REPLACE` (`:268`). Verified against an in-memory copy of the real
schema:

```
clone one records abc123                      -> 1 row
isProcessed(abc123, /clone/one)  = true
isProcessed(abc123, /clone/two)  = false      <- clone two re-creates the task
clone two records abc123                      -> still 1 row (hash is PK: REPLACED)
isProcessed(abc123, /clone/one)  = false      <- clone one now re-creates too
```

Two clones of one repository therefore **flip-flop forever**, each run
re-creating the other's commits. That is a live bug today for anyone with a
second clone, and org-wide discovery walks a directory tree that can easily
contain one.

It also rules out the mirroring migration this spec originally proposed: with
`hash` as the primary key, inserting a slug-keyed row *replaces* the path-keyed
row rather than sitting beside it.

**Decision: dedup on `hash` alone.** Remove `project_path` from the
`isCommitProcessed` predicate and from `filterUnprocessedCommits`. The primary
key already enforces one row per commit, which is the correct semantic — a given
commit should become a ClickUp task once, no matter which clone observed it.
`project_path` stays on the row as provenance, and `markCommitsAsProcessed` keeps
recording it.

Consequences, all of them good:

- **No migration.** Existing rows keep matching, because the predicate only gets
  weaker. Migration `003-dedup-by-slug` is deleted from this design.
- **No `dedupKey` parameter** on `GitWorkAnalyzer`. Deleted from this design too;
  the scanner needs no special casing.
- The pre-existing flip-flop is fixed for the Reports tab as well, not only for
  the scanner.

The plan pins this with a test asserting that a commit recorded under one path is
seen as processed when queried under a different path — which fails today.

### Shell-injection fix, in scope

`getCommitsForDateRange` builds a git command by string interpolation and runs it
through a shell (`GitWorkAnalyzer.ts:314-336`):

```ts
gitCommand += ` --author="${author}"`;
gitCommand += ` ${branch}`;
```

Today `author` and `branch` come from an authenticated user and a dropdown. This
feature feeds it a configurable list of author identities and iterates over
discovered directories, so the input surface widens. Convert to `execFile` with
an argv array — no shell, no quoting, no injection. This also makes repeated
`--author` flags natural, which is how multi-identity matching works.

## The daily run

For each enabled repo, sequentially (ClickUp rate-limits, and sequential keeps
the failure report readable):

1. `git fetch --all --prune`. A failure is recorded and the repo is still
   scanned against local history, flagged as possibly stale. A fetch that would
   prompt for credentials must fail fast, not hang — the plan pins a timeout.
2. `analyzeWork(date, date, authorPattern, "--all", false)` — the day only, every
   branch, unprocessed commits only.

   **`--all` is load-bearing and must not be left to the default.** `git log`
   with no revision argument walks **HEAD only**, so work committed on a feature
   branch that is not the checked-out branch is invisible. The Reports tab's
   "All Branches" option passes `branch: undefined` and therefore does *not* scan
   all branches — a pre-existing mislabel this feature must not inherit. The plan
   pins this with a test: a commit on a non-checked-out branch must be found.
3. Grouping happens inside `analyzeWork` via the injected `CommitGrouper`, so AI
   grouping applies automatically and falls back to the heuristic per its own
   rules.
4. Resolve the repo's destination and template from the registry, falling back to
   the user's default destination.
5. `createRenderedTasks`, with the repo slug added as a tag.

Multi-identity attribution repeats `--author` once per configured identity; git
ORs them, and each matches against author name and email.

Re-running is safe by construction: unprocessed-commit filtering means a second
run for the same day finds nothing. That is what makes both "Run now" and
startup catch-up safe.

### Scheduler

`ScanScheduler` stores `last_completed_date`. On startup, and on each tick, if
`last_completed_date < today` and the configured local time has passed, it runs
once for the missed date. No external cron; the mechanism is a plain interval
timer, which is sufficient at day granularity and avoids a dependency.

## Configuration UI — `/settings/scanning`

Following `/settings/destinations` conventions.

- Scan root, organisation, and scan time.
- Author identities: add/remove list of emails or names.
- Master enable (default **off**), **Run now**, and **Dry run**.
- Discovered repos table: slug, last scanned, destination `<select>`, template
  `<select>`, enable toggle. Skipped directories listed separately with their
  reason.
- Last run summary: repos scanned, tasks created, and per-repo errors.

## Dry run

`DailyScanner.run({ dryRun: true })` performs discovery, fetch, analysis and
rendering, then returns exactly what it would create — per repo, per task, with
the resolved destination and template — and writes **nothing**: no ClickUp calls,
no `processed_commits` rows, no history. This is the safe first-use path and the
basis of the acceptance test.

## Failure handling

Per-repo isolation is the rule. A repo that fails to fetch, is not a git
repository, has no matching remote, or whose ClickUp list rejects a task must not
prevent the remaining repos from being processed.

Every run records a summary — repos scanned, tasks created, per-repo error
strings — retrievable in the UI. An unattended job whose failures are invisible
is worse than no job, and this codebase has already shipped three bugs whose only
symptom was silence.

No API key, and no `fallbackReason` provider text, may appear in a summary.

## Testing

**Pure, unit-tested:** `parseRemote` over both URL forms plus the reject cases
(no remote, non-GitHub host, wrong owner, trailing `.git`, SSH with a port).

**`RepoDiscovery`:** over a temp tree containing a real git repo in the org, one
in another org, one with no remote, and a plain directory. Asserts exactly which
are returned and that each skip carries a reason.

**`DailyScanner`,** over temp git repos created in-test with known commits and a
stubbed ClickUp:

- Creates tasks for the day's commits in an enabled repo.
- A second run creates nothing (dedup).
- A repo outside the org is never scanned.
- A repo whose fetch fails is still scanned, and the failure appears in the
  summary.
- One repo's ClickUp failure does not prevent the next repo's tasks.
- Two configured identities both contribute commits; a third party's do not.
- Dry run creates nothing and writes no `processed_commits` row — asserted by
  running it twice and confirming the second run still reports the same work.

**Scheduler:** a missed day is caught up exactly once; an already-completed day
is not re-run.

These are DB-touching, so `*.nodetest.ts` under the sequential runner.

## Definition of Done

- `/settings/scanning` lists the org's local repos and lets each be bound to a
  destination and template.
- Dry run reports what would be created, touching neither ClickUp nor the DB.
- A real run creates tasks in each repo's bound destination, tagged with the slug.
- A second run the same day creates nothing.
- A repo that fails to fetch does not stop the run and is reported.
- The scheduler catches up one missed day on startup, once.
- Author matching works across at least two configured identities.
- `getCommitsForDateRange` no longer interpolates into a shell string.
- `bun test`, `bun run test:db`, `bun run build` (3 baseline errors), and
  `cd ui && bun run build` all pass; `bun run e2e:clickup` still passes.
