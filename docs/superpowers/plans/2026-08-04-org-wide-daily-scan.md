# Org-Wide Daily Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan every locally-cloned `kailasa-ngpt` repository and create the day's ClickUp tasks unattended, at a configured end-of-day time.

**Architecture:** Four units under `src/scanning/` — discovery, a registry table, a scanner that orchestrates one run, and a scheduler. The scanner composes existing pieces (`GitWorkAnalyzer` per repo, the injected `CommitGrouper`, `DestinationResolver`, `createRenderedTasks`) and contains no formatting or creation logic of its own. Repo identity is the `owner/name` slug parsed from `git remote`, which is also how the org filter works without any GitHub API.

**Tech Stack:** TypeScript ESM (`.js` import specifiers), Express, better-sqlite3, Next.js 15 for the UI, `bun test` for non-DB tests and `*.nodetest.ts` under `scripts/run-nodetests.sh` for DB-touching ones.

**Spec:** `docs/superpowers/specs/2026-08-04-org-wide-daily-scan-design.md`

## Global Constraints

- Every relative import specifier ends in `.js`. `import type` for type-only symbols.
- `better-sqlite3` cannot run under `bun test`. Any test that opens a database MUST be `*.nodetest.ts` using `node:test` + `node:assert/strict`.
- Never run two nodetest files in one `node --test` invocation — node:test's parallel IPC dies intermittently under tsx. Use `bun run test:db`, which runs one file per invocation.
- `strictNullChecks` is OFF repo-wide.
- Verification bar for every commit: `bun test` green · `bun run test:db` green · `bun run build 2>&1 | grep "error TS"` shows EXACTLY the 3 pre-existing `src/routes/auth.routes.ts` TS2341 errors · and once `ui/` is touched, `cd ui && bun run build` green (Next gates on ESLint, so a new unescaped quote or `any` in `.tsx` fails the build).
- Baseline at plan start: `bun test` 187 pass, `bun run test:db` 116 pass.
- Never log, echo, or return a ClickUp API key, and never put one in a fixture.
- No test may make a real ClickUp call or a real AI provider call. Stub `globalThis.fetch` or inject a stub.
- Scheduler ships **disabled**; nothing writes to ClickUp unattended until the user enables it.

---

### Task 1: Parse a git remote into an org/repo slug

**Files:**
- Create: `src/scanning/repoSlug.ts`
- Test: `src/scanning/repoSlug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface RepoSlug { owner: string; name: string; slug: string }` and `export function parseRemote(url: string): RepoSlug | null`. Tasks 2, 3 and 5 use both.

- [ ] **Step 1: Write the failing test**

Create `src/scanning/repoSlug.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseRemote } from "./repoSlug.js";

describe("parseRemote", () => {
  test("parses an SSH remote", () => {
    expect(parseRemote("git@github.com:kailasa-ngpt/ask_nithyananda_app.git")).toEqual({
      owner: "kailasa-ngpt",
      name: "ask_nithyananda_app",
      slug: "kailasa-ngpt/ask_nithyananda_app",
    });
  });

  test("parses an HTTPS remote, with and without .git", () => {
    expect(parseRemote("https://github.com/kailasa-ngpt/soma_v2")!.slug).toBe(
      "kailasa-ngpt/soma_v2"
    );
    expect(parseRemote("https://github.com/kailasa-ngpt/soma_v2.git")!.slug).toBe(
      "kailasa-ngpt/soma_v2"
    );
  });

  test("tolerates a trailing slash and surrounding whitespace", () => {
    // `git remote get-url` output arrives with a trailing newline.
    expect(parseRemote("  https://github.com/kailasa-ngpt/x/\n")!.slug).toBe("kailasa-ngpt/x");
  });

  test("parses an SSH remote carrying an explicit ssh:// scheme and port", () => {
    expect(parseRemote("ssh://git@github.com:22/kailasa-ngpt/x.git")!.slug).toBe(
      "kailasa-ngpt/x"
    );
  });

  test("returns null for a non-GitHub host", () => {
    expect(parseRemote("git@gitlab.com:kailasa-ngpt/x.git")).toBeNull();
    expect(parseRemote("https://bitbucket.org/kailasa-ngpt/x")).toBeNull();
  });

  test("returns null for anything that is not a parseable remote", () => {
    expect(parseRemote("")).toBeNull();
    expect(parseRemote("not a url")).toBeNull();
    expect(parseRemote("https://github.com/onlyowner")).toBeNull();
  });

  test("does not lowercase the owner or name", () => {
    // GitHub slugs are case-insensitive to resolve but case-preserving to
    // display, and the slug is used as a ClickUp tag, so mangling case would
    // produce tags that do not match the repo.
    expect(parseRemote("git@github.com:Kailasa-NGPT/Ask_App.git")!.slug).toBe(
      "Kailasa-NGPT/Ask_App"
    );
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `bun test src/scanning/repoSlug.test.ts`
Expected: fails to resolve `./repoSlug.js` — not an assertion failure.

- [ ] **Step 3: Implement**

Create `src/scanning/repoSlug.ts`:

```ts
/**
 * Parses a git remote URL into an owner/name slug.
 *
 * This is how org membership is determined without any GitHub API call: a
 * clone's remote already states its owner. The slug is the repository's identity
 * throughout the scanning subsystem — registry key, ClickUp tag, and log line.
 */

export interface RepoSlug {
  owner: string;
  name: string;
  slug: string;
}

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** Returns null for anything that is not a GitHub owner/name remote. */
export function parseRemote(url: string): RepoSlug | null {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  // scp-style: git@github.com:owner/name(.git)
  // Also matches ssh://git@github.com:22/owner/name — the port is discarded
  // because only host and path matter here.
  const scp = trimmed.match(
    /^(?:ssh:\/\/)?[^@/]+@([^:/]+)(?::\d+)?[:/](?<path>[^/]+\/[^/]+?)(?:\.git)?$/
  );
  if (scp) {
    return fromHostAndPath(scp[1]!, scp.groups!.path!);
  }

  // https://github.com/owner/name(.git)
  const https = trimmed.match(/^https?:\/\/([^/]+)\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (https) {
    return fromHostAndPath(https[1]!, https[2]!);
  }

  return null;
}

function fromHostAndPath(host: string, path: string): RepoSlug | null {
  if (!GITHUB_HOSTS.has(host.toLowerCase())) return null;

  const [owner, name] = path.split("/");
  if (!owner || !name) return null;

  // Case is preserved: the slug becomes a ClickUp tag, and lowercasing it would
  // produce tags that do not match the repository.
  return { owner, name, slug: `${owner}/${name}` };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `bun test src/scanning/repoSlug.test.ts`
Expected: 7 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/scanning/repoSlug.ts src/scanning/repoSlug.test.ts
git commit -m "feat(scanning): parse git remotes into org/repo slugs

<trailer>"
```

---

### Task 2: Fix commit dedup so it keys on the hash alone

**Files:**
- Modify: `src/services/DatabaseService.ts` (`isCommitProcessed`, around line 288)
- Modify: `src/services/HistoryService.ts` (`isCommitProcessed` line 50, `filterUnprocessedCommits` line 57)
- Test: `src/services/HistoryService.dedup.nodetest.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `HistoryService.filterUnprocessedCommits(commits: GitCommit[], projectPath?: string)` — `projectPath` becomes optional and is ignored for matching. Task 5 calls it with no path.

**Why this is Task 2 and not an afterthought.** `processed_commits` declares `hash TEXT PRIMARY KEY` (`DatabaseService.ts:83-93`), so a hash can exist at most once. But `isCommitProcessed` filters on hash **and** `project_path`, and writes use `INSERT OR REPLACE`. Two clones of one repo therefore flip-flop forever, each run re-creating the other's commits. Org-wide discovery makes duplicate clones likely, so this must be correct before the scanner exists.

- [ ] **Step 1: Write the failing test**

Create `src/services/HistoryService.dedup.nodetest.ts`:

```ts
/**
 * Runs under `tsx --test`, not `bun test`: HistoryService opens better-sqlite3,
 * which cannot run under Bun (oven-sh/bun#4290).
 *
 * DatabaseService hardcodes `process.cwd()/.database`, so each test gets its own
 * temp cwd — the same isolation GitWorkAnalyzer.createTasks.nodetest.ts uses.
 */
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HistoryService } from "./HistoryService.js";
import type { GitCommit } from "../types/index.js";

const commit = (hash: string): GitCommit => ({
  hash,
  author: "dev@example.com",
  date: "2026-08-04",
  message: "feat: a thing",
  files: ["a.ts"],
  insertions: 1,
  deletions: 0,
});

let dir: string;
let originalCwd: string;
let history: HistoryService;

beforeEach(() => {
  originalCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "awa-dedup-"));
  process.chdir(dir);
  history = new HistoryService();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("commit dedup keys on the hash alone", () => {
  /**
   * The bug: `hash` is the PRIMARY KEY, so a hash exists at most once — but the
   * predicate also filtered on project_path and writes used INSERT OR REPLACE.
   * Two clones of one repo flip-flopped forever, each run re-creating the
   * other's commits, with nothing thrown and nothing logged.
   */
  test("a commit recorded under one path is processed when queried under another", () => {
    history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");

    assert.equal(history.isCommitProcessed("abc1230000", "/clone/one"), true);
    assert.equal(
      history.isCommitProcessed("abc1230000", "/clone/two"),
      true,
      "a second clone must not re-create tasks for a commit already processed"
    );
  });

  test("filterUnprocessedCommits drops it regardless of the path passed", () => {
    history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");

    assert.deepEqual(history.filterUnprocessedCommits([commit("abc1230000")], "/clone/two"), []);
    assert.deepEqual(history.filterUnprocessedCommits([commit("abc1230000")]), []);
  });

  test("recording under a second path does not un-process the first", () => {
    // INSERT OR REPLACE rewrites the single row; with the path out of the
    // predicate that no longer matters, which is the whole point.
    history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");
    history.markCommitsAsProcessed([commit("abc1230000")], "/clone/two");

    assert.equal(history.isCommitProcessed("abc1230000", "/clone/one"), true);
    assert.equal(history.isCommitProcessed("abc1230000", "/clone/two"), true);
  });

  test("an unrecorded commit is still unprocessed", () => {
    history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");

    assert.equal(history.isCommitProcessed("zzz9990000", "/clone/one"), false);
    assert.deepEqual(
      history.filterUnprocessedCommits([commit("abc1230000"), commit("zzz9990000")]).map((c) => c.hash),
      ["zzz9990000"]
    );
  });
});
```

- [ ] **Step 2: Run it and confirm the right assertions fail**

Run: `npx tsx --test src/services/HistoryService.dedup.nodetest.ts`
Expected: the first two tests FAIL (`false !== true`) on the cross-path assertions. The fourth passes already. Record the actual output in your report.

- [ ] **Step 3: Drop project_path from the predicate**

In `src/services/DatabaseService.ts`, replace `isCommitProcessed`:

```ts
  /**
   * Keyed on the hash alone, deliberately.
   *
   * `processed_commits.hash` is the PRIMARY KEY, so a hash can exist at most
   * once — but this predicate also filtered on project_path while writes used
   * INSERT OR REPLACE. Two clones of one repository therefore flip-flopped
   * forever, each run re-creating the other's commits with nothing thrown.
   *
   * One commit becomes one task, whichever clone observed it. `project_path`
   * stays on the row as provenance and is still recorded; it is simply not part
   * of the identity. `projectPath` is accepted and ignored so existing callers
   * are unchanged.
   */
  isCommitProcessed(hash: string, _projectPath?: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM processed_commits
      WHERE hash = ?
    `);

    return stmt.get(hash) !== undefined;
  }
```

In `src/services/HistoryService.ts`, widen both signatures:

```ts
  isCommitProcessed(commitHash: string, projectPath?: string): boolean {
    return this.db.isCommitProcessed(commitHash, projectPath);
  }

  /**
   * `projectPath` is accepted for call-site compatibility and ignored: dedup is
   * keyed on the commit hash alone. See DatabaseService.isCommitProcessed.
   */
  filterUnprocessedCommits(commits: GitCommit[], projectPath?: string): GitCommit[] {
    return commits.filter((commit) => !this.isCommitProcessed(commit.hash, projectPath));
  }
```

- [ ] **Step 4: Run the test and the full suites**

Run: `npx tsx --test src/services/HistoryService.dedup.nodetest.ts` → 4 pass.
Run: `bun test` and `bun run test:db` → both green. `GitWorkAnalyzer.createTasks.nodetest.ts` must still pass; if it does not, you have changed recording behaviour rather than matching behaviour.

- [ ] **Step 5: Mutation-test the fix**

Restore `AND project_path = ?` (and the bound argument) in `DatabaseService.isCommitProcessed`, re-run the new file, and confirm exactly the two cross-path tests go red. Restore the fix and confirm green. Report both outputs — a green suite is not evidence that a test pins anything.

- [ ] **Step 6: Commit**

```bash
git add src/services/DatabaseService.ts src/services/HistoryService.ts src/services/HistoryService.dedup.nodetest.ts
git commit -m "fix(history): key commit dedup on the hash alone

<trailer>"
```

---

### Task 3: Discover org repositories under a root directory

**Files:**
- Create: `src/scanning/RepoDiscovery.ts`
- Test: `src/scanning/RepoDiscovery.nodetest.ts`

**Interfaces:**
- Consumes: `parseRemote`, `RepoSlug` (Task 1).
- Produces:
  ```ts
  export interface DiscoveredRepo { path: string; slug: string; owner: string; name: string }
  export interface SkippedDir { path: string; reason: string }
  export interface DiscoveryResult { repos: DiscoveredRepo[]; skipped: SkippedDir[] }
  export async function discoverRepos(root: string, owner: string): Promise<DiscoveryResult>
  ```
  Tasks 5 and 7 consume `DiscoveryResult`.

This is a nodetest because it shells out to `git` in temp directories; that is not a database, but keeping it out of `bun test` avoids any dependence on Bun's subprocess behaviour. Put it under the sequential runner with the rest.

- [ ] **Step 1: Write the failing test**

Create `src/scanning/RepoDiscovery.nodetest.ts`:

```ts
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverRepos } from "./RepoDiscovery.js";

let root: string;

function makeRepo(name: string, remote?: string): string {
  const path = join(root, name);
  mkdirSync(path, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: path });
  if (remote) execFileSync("git", ["remote", "add", "origin", remote], { cwd: path });
  return path;
}

before(() => {
  root = mkdtempSync(join(tmpdir(), "awa-discovery-"));
  makeRepo("in-org", "git@github.com:kailasa-ngpt/in-org.git");
  makeRepo("also-in-org", "https://github.com/kailasa-ngpt/also-in-org");
  makeRepo("other-org", "git@github.com:someone-else/other-org.git");
  makeRepo("no-remote");
  mkdirSync(join(root, "not-a-repo"), { recursive: true });
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("discoverRepos", () => {
  test("returns only repos whose remote owner matches", async () => {
    const { repos } = await discoverRepos(root, "kailasa-ngpt");
    assert.deepEqual(
      repos.map((r) => r.slug).sort(),
      ["kailasa-ngpt/also-in-org", "kailasa-ngpt/in-org"]
    );
  });

  test("reports each skipped directory with a reason", async () => {
    const { skipped } = await discoverRepos(root, "kailasa-ngpt");
    const byName = Object.fromEntries(skipped.map((s) => [s.path.split("/").pop(), s.reason]));

    // Every skip must carry a reason, so the settings page can explain why a
    // directory the user expected is absent instead of silently omitting it.
    assert.match(byName["other-org"]!, /owner/i);
    assert.match(byName["no-remote"]!, /remote/i);
    assert.match(byName["not-a-repo"]!, /git/i);
  });

  test("returns an absolute path for each repo", async () => {
    const { repos } = await discoverRepos(root, "kailasa-ngpt");
    for (const repo of repos) assert.ok(repo.path.startsWith("/"), repo.path);
  });

  test("a missing root is an empty result, not a throw", async () => {
    const result = await discoverRepos(join(root, "does-not-exist"), "kailasa-ngpt");
    assert.deepEqual(result.repos, []);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0]!.reason, /not found|does not exist/i);
  });

  test("matches the owner case-insensitively", async () => {
    // GitHub owners resolve case-insensitively, so a clone remote written
    // "Kailasa-NGPT" must not be silently excluded.
    const { repos } = await discoverRepos(root, "KAILASA-NGPT");
    assert.equal(repos.length, 2);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `npx tsx --test src/scanning/RepoDiscovery.nodetest.ts`
Expected: cannot resolve `./RepoDiscovery.js`.

- [ ] **Step 3: Implement**

Create `src/scanning/RepoDiscovery.ts`:

```ts
/**
 * Finds locally-cloned repositories belonging to one GitHub organisation.
 *
 * Organisation membership comes from each clone's `git remote`, not from the
 * GitHub API — which is what keeps this feature tokenless. A directory that is
 * not a repo, has no remote, or belongs to another owner is skipped WITH A
 * REASON: the settings page shows those reasons, because "the repo I expected is
 * missing and I cannot tell why" is the failure this avoids.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";
import { join } from "path";
import { parseRemote } from "./repoSlug.js";

const execFileAsync = promisify(execFile);

export interface DiscoveredRepo {
  path: string;
  slug: string;
  owner: string;
  name: string;
}

export interface SkippedDir {
  path: string;
  reason: string;
}

export interface DiscoveryResult {
  repos: DiscoveredRepo[];
  skipped: SkippedDir[];
}

/** Guards against a hung `git` on a pathological directory. */
const GIT_TIMEOUT_MS = 10_000;

export async function discoverRepos(root: string, owner: string): Promise<DiscoveryResult> {
  const repos: DiscoveredRepo[] = [];
  const skipped: SkippedDir[] = [];

  let entries: string[];
  try {
    const dirents = await readdir(root, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return { repos, skipped: [{ path: root, reason: "Scan root not found or not readable" }] };
  }

  for (const entry of entries.sort()) {
    const path = join(root, entry);

    let remote: string;
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
        cwd: path,
        timeout: GIT_TIMEOUT_MS,
      });
      remote = stdout;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({
        path,
        reason: /not a git repository/i.test(message)
          ? "Not a git repository"
          : "No git remote named origin",
      });
      continue;
    }

    const parsed = parseRemote(remote);
    if (!parsed) {
      skipped.push({ path, reason: `Remote is not a GitHub owner/name URL: ${remote.trim()}` });
      continue;
    }

    // GitHub owners resolve case-insensitively.
    if (parsed.owner.toLowerCase() !== owner.toLowerCase()) {
      skipped.push({ path, reason: `Different owner: ${parsed.owner}` });
      continue;
    }

    repos.push({ path, slug: parsed.slug, owner: parsed.owner, name: parsed.name });
  }

  return { repos, skipped };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx tsx --test src/scanning/RepoDiscovery.nodetest.ts` → 5 pass.
Then `bun run test:db` → green overall.

- [ ] **Step 5: Commit**

```bash
git add src/scanning/RepoDiscovery.ts src/scanning/RepoDiscovery.nodetest.ts
git commit -m "feat(scanning): discover org repos from local clones' remotes

<trailer>"
```

---

### Task 4: Persist scan settings and per-repo bindings

**Files:**
- Create: `src/scanning/ScanRegistry.ts`
- Test: `src/scanning/ScanRegistry.nodetest.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface ScanSettings {
    userId: string;
    root: string;
    owner: string;
    authorIdentities: string[];
    scanTime: string;          // "HH:MM", local
    enabled: boolean;
    lastCompletedDate?: string; // "YYYY-MM-DD"
  }
  export interface RepoBinding {
    slug: string;
    destinationId?: string;
    templateId?: string;
    enabled: boolean;
    lastScannedDate?: string;
  }
  export class ScanRegistry {
    constructor(dbPath: string);
    getSettings(userId: string): ScanSettings;
    saveSettings(userId: string, patch: Partial<Omit<ScanSettings, "userId">>): ScanSettings;
    listBindings(userId: string): RepoBinding[];
    getBinding(userId: string, slug: string): RepoBinding | null;
    saveBinding(userId: string, slug: string, patch: Partial<Omit<RepoBinding, "slug">>): RepoBinding;
    markScanned(userId: string, slug: string, date: string): void;
    saveRun(userId: string, summary: unknown): void;
    getLastRun(userId: string): { ranAt: string; summary: unknown } | null;
    close(): void;
  }
  ```
  Tasks 5, 6 and 7 consume these.

Follow `DestinationStore` exactly for shape: `CREATE TABLE IF NOT EXISTS` in the constructor, every method scoped by `userId`, and a `close()`.

- [ ] **Step 1: Write the failing test**

Create `src/scanning/ScanRegistry.nodetest.ts`:

```ts
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanRegistry } from "./ScanRegistry.js";

let dir: string;
let registry: ScanRegistry;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-scanreg-"));
  registry = new ScanRegistry(join(dir, "test.db"));
});

afterEach(() => {
  registry.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("ScanRegistry settings", () => {
  test("defaults are safe: disabled, with a sensible root and owner", () => {
    const settings = registry.getSettings("user-1");

    // Disabled by default is a safety property, not a preference: nothing may
    // create ClickUp tasks unattended until the user opts in.
    assert.equal(settings.enabled, false);
    assert.match(settings.root, /GitHub$/);
    assert.equal(settings.owner, "kailasa-ngpt");
    assert.equal(settings.scanTime, "18:00");
    assert.deepEqual(settings.authorIdentities, []);
    assert.equal(settings.lastCompletedDate, undefined);
  });

  test("saves and round-trips the author identity list", () => {
    registry.saveSettings("user-1", {
      authorIdentities: ["a@example.com", "b@example.com"],
    });
    assert.deepEqual(registry.getSettings("user-1").authorIdentities, [
      "a@example.com",
      "b@example.com",
    ]);
  });

  test("a patch leaves unmentioned fields alone", () => {
    registry.saveSettings("user-1", { scanTime: "21:30", enabled: true });
    registry.saveSettings("user-1", { owner: "another-org" });

    const settings = registry.getSettings("user-1");
    assert.equal(settings.scanTime, "21:30");
    assert.equal(settings.enabled, true);
    assert.equal(settings.owner, "another-org");
  });

  test("settings are per user", () => {
    registry.saveSettings("user-1", { scanTime: "07:00" });
    assert.equal(registry.getSettings("user-2").scanTime, "18:00");
  });
});

describe("ScanRegistry bindings", () => {
  test("an unbound repo reports no binding", () => {
    assert.equal(registry.getBinding("user-1", "kailasa-ngpt/x"), null);
  });

  test("saves a destination and template per repo", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", {
      destinationId: "dest-1",
      templateId: "builtin-terse",
      enabled: true,
    });

    const binding = registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.templateId, "builtin-terse");
    assert.equal(binding.enabled, true);
  });

  test("clears a destination when explicitly set to null", () => {
    // null means "unbind, fall back to the default destination"; undefined
    // means "leave it alone". Conflating them is the bug slice 2 hit in
    // DestinationStore.update.
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1" });
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: null as unknown as undefined });

    assert.equal(registry.getBinding("user-1", "kailasa-ngpt/x")!.destinationId, undefined);
  });

  test("a patch leaves the other binding fields alone", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", {
      destinationId: "dest-1",
      enabled: true,
    });
    registry.saveBinding("user-1", "kailasa-ngpt/x", { templateId: "builtin-terse" });

    const binding = registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.enabled, true);
  });

  test("bindings are per user", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1" });
    assert.equal(registry.getBinding("user-2", "kailasa-ngpt/x"), null);
    assert.deepEqual(registry.listBindings("user-2"), []);
  });

  test("markScanned records the date without disturbing the binding", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1", enabled: true });
    registry.markScanned("user-1", "kailasa-ngpt/x", "2026-08-04");

    const binding = registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.lastScannedDate, "2026-08-04");
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.enabled, true);
  });

  test("markScanned creates a row for a repo with no binding yet", () => {
    registry.markScanned("user-1", "kailasa-ngpt/new", "2026-08-04");
    assert.equal(registry.getBinding("user-1", "kailasa-ngpt/new")!.lastScannedDate, "2026-08-04");
  });
});

describe("ScanRegistry run history", () => {
  test("no run recorded yet reports null", () => {
    assert.equal(registry.getLastRun("user-1"), null);
  });

  test("stores and returns the latest summary, per user", () => {
    registry.saveRun("user-1", { date: "2026-08-04", totalTasksCreated: 3 });
    registry.saveRun("user-1", { date: "2026-08-05", totalTasksCreated: 7 });

    const last = registry.getLastRun("user-1")!;
    assert.equal((last.summary as any).totalTasksCreated, 7);
    assert.match(last.ranAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(registry.getLastRun("user-2"), null);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `npx tsx --test src/scanning/ScanRegistry.nodetest.ts`
Expected: cannot resolve `./ScanRegistry.js`.

- [ ] **Step 3: Implement**

Create `src/scanning/ScanRegistry.ts`:

```ts
/**
 * Scan configuration and per-repository bindings.
 *
 * Two tables, one class, because they are always read together and a repo
 * binding is meaningless without the settings that decide when scanning runs.
 *
 * Shaped after DestinationStore: schema created in the constructor, every method
 * scoped by userId, and `patch` semantics where `undefined` means "leave alone"
 * and `null` means "clear" — a distinction DestinationStore originally got wrong
 * and which silently kept a stale value.
 */

import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

export interface ScanSettings {
  userId: string;
  root: string;
  owner: string;
  authorIdentities: string[];
  /** "HH:MM", local time. */
  scanTime: string;
  enabled: boolean;
  /** "YYYY-MM-DD" of the last fully completed run. */
  lastCompletedDate?: string;
}

export interface RepoBinding {
  slug: string;
  destinationId?: string;
  templateId?: string;
  enabled: boolean;
  lastScannedDate?: string;
}

interface SettingsRow {
  user_id: string;
  root: string;
  owner: string;
  author_identities: string;
  scan_time: string;
  enabled: number;
  last_completed_date: string | null;
}

interface BindingRow {
  user_id: string;
  slug: string;
  destination_id: string | null;
  template_id: string | null;
  enabled: number;
  last_scanned_date: string | null;
}

export const SCANNING_SCHEMA = `
  CREATE TABLE IF NOT EXISTS scan_settings (
    user_id TEXT PRIMARY KEY,
    root TEXT NOT NULL,
    owner TEXT NOT NULL,
    author_identities TEXT NOT NULL,
    scan_time TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    last_completed_date TEXT
  );
  CREATE TABLE IF NOT EXISTS scan_runs (
    user_id TEXT PRIMARY KEY,
    ran_at TEXT NOT NULL,
    summary TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scanned_repos (
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    destination_id TEXT,
    template_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_scanned_date TEXT,
    PRIMARY KEY (user_id, slug)
  );
`;

/** Disabled, so nothing is created unattended before the user opts in. */
function defaultSettings(userId: string): ScanSettings {
  return {
    userId,
    root: join(homedir(), "Documents", "GitHub"),
    owner: "kailasa-ngpt",
    authorIdentities: [],
    scanTime: "18:00",
    enabled: false,
  };
}

function toSettings(row: SettingsRow): ScanSettings {
  return {
    userId: row.user_id,
    root: row.root,
    owner: row.owner,
    authorIdentities: JSON.parse(row.author_identities),
    scanTime: row.scan_time,
    enabled: row.enabled === 1,
    lastCompletedDate: row.last_completed_date ?? undefined,
  };
}

function toBinding(row: BindingRow): RepoBinding {
  return {
    slug: row.slug,
    destinationId: row.destination_id ?? undefined,
    templateId: row.template_id ?? undefined,
    enabled: row.enabled === 1,
    lastScannedDate: row.last_scanned_date ?? undefined,
  };
}

/** `undefined` keeps the stored value; `null` clears it. */
function patched<T>(incoming: T | null | undefined, stored: T | undefined): T | undefined {
  if (incoming === undefined) return stored;
  if (incoming === null) return undefined;
  return incoming;
}

export class ScanRegistry {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCANNING_SCHEMA);
  }

  getSettings(userId: string): ScanSettings {
    const row = this.db
      .prepare(`SELECT * FROM scan_settings WHERE user_id = ?`)
      .get(userId) as SettingsRow | undefined;
    return row ? toSettings(row) : defaultSettings(userId);
  }

  saveSettings(userId: string, patch: Partial<Omit<ScanSettings, "userId">>): ScanSettings {
    const current = this.getSettings(userId);
    const merged: ScanSettings = {
      userId,
      root: patch.root ?? current.root,
      owner: patch.owner ?? current.owner,
      authorIdentities: patch.authorIdentities ?? current.authorIdentities,
      scanTime: patch.scanTime ?? current.scanTime,
      enabled: patch.enabled ?? current.enabled,
      lastCompletedDate: patched(patch.lastCompletedDate, current.lastCompletedDate),
    };

    this.db
      .prepare(
        `INSERT INTO scan_settings
           (user_id, root, owner, author_identities, scan_time, enabled, last_completed_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           root = excluded.root,
           owner = excluded.owner,
           author_identities = excluded.author_identities,
           scan_time = excluded.scan_time,
           enabled = excluded.enabled,
           last_completed_date = excluded.last_completed_date`
      )
      .run(
        userId,
        merged.root,
        merged.owner,
        JSON.stringify(merged.authorIdentities),
        merged.scanTime,
        merged.enabled ? 1 : 0,
        merged.lastCompletedDate ?? null
      );

    return merged;
  }

  listBindings(userId: string): RepoBinding[] {
    const rows = this.db
      .prepare(`SELECT * FROM scanned_repos WHERE user_id = ? ORDER BY slug ASC`)
      .all(userId) as BindingRow[];
    return rows.map(toBinding);
  }

  getBinding(userId: string, slug: string): RepoBinding | null {
    const row = this.db
      .prepare(`SELECT * FROM scanned_repos WHERE user_id = ? AND slug = ?`)
      .get(userId, slug) as BindingRow | undefined;
    return row ? toBinding(row) : null;
  }

  saveBinding(
    userId: string,
    slug: string,
    patch: Partial<Omit<RepoBinding, "slug">>
  ): RepoBinding {
    const current = this.getBinding(userId, slug);
    const merged: RepoBinding = {
      slug,
      destinationId: patched(patch.destinationId, current?.destinationId),
      templateId: patched(patch.templateId, current?.templateId),
      enabled: patch.enabled ?? current?.enabled ?? true,
      lastScannedDate: patched(patch.lastScannedDate, current?.lastScannedDate),
    };

    this.db
      .prepare(
        `INSERT INTO scanned_repos
           (user_id, slug, destination_id, template_id, enabled, last_scanned_date)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, slug) DO UPDATE SET
           destination_id = excluded.destination_id,
           template_id = excluded.template_id,
           enabled = excluded.enabled,
           last_scanned_date = excluded.last_scanned_date`
      )
      .run(
        userId,
        slug,
        merged.destinationId ?? null,
        merged.templateId ?? null,
        merged.enabled ? 1 : 0,
        merged.lastScannedDate ?? null
      );

    return merged;
  }

  markScanned(userId: string, slug: string, date: string): void {
    this.saveBinding(userId, slug, { lastScannedDate: date });
  }

  /**
   * The most recent run's summary, kept so a SCHEDULED run's failures are
   * visible in the UI. A summary that only reaches console.log makes an
   * unattended job's errors invisible, which is worse than no job. Only the
   * latest is retained — this is a status panel, not an audit log.
   */
  saveRun(userId: string, summary: unknown): void {
    this.db
      .prepare(
        `INSERT INTO scan_runs (user_id, ran_at, summary) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET ran_at = excluded.ran_at, summary = excluded.summary`
      )
      .run(userId, new Date().toISOString(), JSON.stringify(summary));
  }

  getLastRun(userId: string): { ranAt: string; summary: unknown } | null {
    const row = this.db
      .prepare(`SELECT ran_at, summary FROM scan_runs WHERE user_id = ?`)
      .get(userId) as { ran_at: string; summary: string } | undefined;
    return row ? { ranAt: row.ran_at, summary: JSON.parse(row.summary) } : null;
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run the test and the suites**

Run: `npx tsx --test src/scanning/ScanRegistry.nodetest.ts` → 11 pass.
Run: `bun test`, `bun run test:db`, `bun run build 2>&1 | grep "error TS"` (3 baseline).

- [ ] **Step 5: Commit**

```bash
git add src/scanning/ScanRegistry.ts src/scanning/ScanRegistry.nodetest.ts
git commit -m "feat(scanning): persist scan settings and per-repo bindings

<trailer>"
```

---

### Task 5: The scanner — one run over all enabled repos

**Files:**
- Create: `src/scanning/DailyScanner.ts`
- Modify: `src/services/GitWorkAnalyzer.ts` (`getCommitsForDateRange`, lines ~296-340: shell → argv)
- Test: `src/scanning/DailyScanner.nodetest.ts`

**Interfaces:**
- Consumes: `discoverRepos`, `DiscoveryResult` (Task 3); `ScanRegistry`, `ScanSettings`, `RepoBinding` (Task 4); `GitWorkAnalyzer`, `DestinationResolver`, `createRenderedTasks`, `CommitGrouper` (existing).
- Produces:
  ```ts
  export interface RepoScanResult {
    slug: string;
    commits: number;
    workItems: number;
    tasksCreated: number;
    destination: string | null;
    fetchFailed?: string;
    error?: string;
    wouldCreate?: Array<{ name: string; description: string }>;
  }
  export interface ScanRunSummary {
    date: string;
    dryRun: boolean;
    repos: RepoScanResult[];
    skipped: SkippedDir[];
    totalTasksCreated: number;
  }
  export interface DailyScannerDeps {
    registry: ScanRegistry;
    resolver: DestinationResolver;
    grouper: CommitGrouper;
    analyzerFactory?: (projectPath: string) => GitWorkAnalyzer;
    clickUpFactory?: (config: ClickUpConfig) => ClickUpService;
    discover?: typeof discoverRepos;
    fetchRepo?: (path: string) => Promise<void>;
  }
  export class DailyScanner {
    constructor(deps: DailyScannerDeps);
    run(userId: string, opts: { date: string; dryRun?: boolean }): Promise<ScanRunSummary>;
  }
  ```
  Tasks 6 and 7 consume `ScanRunSummary`.

Every collaborator is injectable **because that is the only way to test this without a network, a real ClickUp, or a real AI provider.** Production leaves the factories unset.

**The shell-injection fix is part of this task** because this task is what widens the input surface: a configurable identity list, iterated over discovered directories.

- [ ] **Step 1: Convert the git invocation to argv, keeping behaviour identical**

In `src/services/GitWorkAnalyzer.ts`, replace the body of `getCommitsForDateRange`'s command construction and execution. The `author` parameter now also accepts an array:

```ts
  private async getCommitsForDateRange(
    startDate?: string,
    endDate?: string,
    author?: string | string[],
    branch?: string
  ): Promise<GitCommit[]> {
    try {
      const authors = author === undefined ? [] : Array.isArray(author) ? author : [author];
      const cacheKey = `commits:${startDate || ""}:${endDate || ""}:${authors.join(",")}:${branch || ""}`;

      const cached = this.getCached<GitCommit[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // argv, not a shell string. The previous form interpolated `author` and
      // `branch` into a command run through a shell, so a value containing shell
      // metacharacters would have been executed. Nothing exploited it — author
      // came from an authenticated user and branch from a dropdown — but the
      // scanner feeds this a configurable identity list across discovered
      // directories, and argv removes the question entirely.
      const args = [
        "log",
        "--pretty=format:%H|%an|%ad|%s",
        "--date=short",
        "--numstat",
        "--no-merges",
      ];

      if (startDate) args.push(`--since=${startDate} 00:00:00`);
      if (endDate) args.push(`--until=${endDate} 23:59:59`);
      // Repeated --author flags OR together in git, and each matches the author
      // name as well as the email.
      for (const identity of authors) args.push(`--author=${identity}`);
      if (branch) args.push(branch);

      const { stdout } = await execFileAsync("git", args, {
        cwd: this.projectPath,
        maxBuffer: 10 * 1024 * 1024,
      });

      const commits = this.parseGitLog(stdout);
```

Add the import beside the existing `exec` one, and keep `execAsync` — other methods still use it:

```ts
import { exec, execFile } from "child_process";
const execFileAsync = promisify(execFile);
```

Note the `--pretty` value loses its surrounding quotes: those were shell quoting, and passing them as part of an argv element would make git treat them as literal characters in the format string.

Widen `analyzeWork`'s `author` parameter to `string | string[]` to match.

- [ ] **Step 2: Prove the conversion changed nothing**

Run: `bun run test:db` — `GitWorkAnalyzer.createTasks.nodetest.ts` must still pass.
Then verify against this repo directly, which the old code path also handled:

```bash
npx tsx -e '
import { GitWorkAnalyzer } from "./src/services/GitWorkAnalyzer.js";
new GitWorkAnalyzer(process.cwd()).analyzeWork("2026-08-01", "2026-08-04", undefined, "--all", true)
  .then(r => console.log("commits:", r.totalCommits, "items:", r.detectedWork.length));
'
```
Expected: a non-zero commit count. Zero means the format string or an argument is wrong — a silently empty result is the exact failure this step exists to catch.

- [ ] **Step 3: Write the failing test**

Create `src/scanning/DailyScanner.nodetest.ts`:

```ts
/**
 * Runs under `tsx --test`: constructing a GitWorkAnalyzer opens better-sqlite3.
 *
 * Nothing here touches the network, ClickUp, or an AI provider — every
 * collaborator is injected. Real git repositories are created in temp dirs so
 * the git plumbing is exercised for real.
 */
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DailyScanner } from "./DailyScanner.js";
import type { DailyScannerDeps } from "./DailyScanner.js";
import { GitWorkAnalyzer } from "../services/GitWorkAnalyzer.js";
import { ScanRegistry } from "./ScanRegistry.js";
import { HeuristicCommitGrouper } from "../grouping/HeuristicCommitGrouper.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import type { ClickUpService } from "../services/ClickUpService.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";
import type { ClickUpConfig } from "../types/index.js";

const DATE = "2026-08-04";

let root: string;
let dbDir: string;
let originalCwd: string;
let registry: ScanRegistry;
let created: string[];

function commitIn(path: string, message: string, email: string, branch?: string): void {
  if (branch) execFileSync("git", ["checkout", "-q", "-b", branch], { cwd: path });
  writeFileSync(join(path, `${message.replace(/\W+/g, "-")}.ts`), "export const x = 1;\n");
  execFileSync("git", ["add", "-A"], { cwd: path });
  execFileSync(
    "git",
    ["-c", `user.email=${email}`, "-c", "user.name=Dev", "commit", "-q", "-m", message,
     `--date=${DATE}T12:00:00`],
    { cwd: path, env: { ...process.env, GIT_COMMITTER_DATE: `${DATE}T12:00:00` } }
  );
}

function makeRepo(name: string, remote: string): string {
  const path = join(root, name);
  mkdirSync(path, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: path });
  execFileSync("git", ["remote", "add", "origin", remote], { cwd: path });
  return path;
}

function stubResolver(): DestinationResolver {
  const config: ClickUpConfig = { teamId: "t", apiKey: "unused", projectName: "test" };
  return {
    resolve: (_userId: string, destinationId?: string, templateId?: string) => ({
      destination: destinationId ? { id: destinationId, name: destinationId } : null,
      clickUp: {
        createTask: async (task: any) => {
          created.push(task.name);
          return { id: `task-${created.length}`, name: task.name, url: "http://x" };
        },
        getListStatuses: async () => [],
      } as unknown as ClickUpService,
      listId: "list-1",
      template: BUILTIN_TEMPLATES.find((t) => t.id === (templateId || "builtin-standard"))!,
      config,
    }),
  } as unknown as DestinationResolver;
}

function scanner(overrides: Partial<DailyScannerDeps> = {}): DailyScanner {
  return new DailyScanner({
    registry,
    resolver: stubResolver(),
    grouper: new HeuristicCommitGrouper(),
    fetchRepo: async () => {},
    ...overrides,
  });
}

beforeEach(() => {
  originalCwd = process.cwd();
  root = mkdtempSync(join(tmpdir(), "awa-scan-root-"));
  dbDir = mkdtempSync(join(tmpdir(), "awa-scan-db-"));
  // GitWorkAnalyzer's HistoryService writes to process.cwd()/.database.
  process.chdir(dbDir);
  registry = new ScanRegistry(join(dbDir, "registry.db"));
  registry.saveSettings("user-1", { root, owner: "kailasa-ngpt", enabled: true });
  created = [];
});

afterEach(() => {
  registry.close();
  process.chdir(originalCwd);
  for (const d of [root, dbDir]) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
});

describe("DailyScanner", () => {
  test("creates tasks for the day's commits in an in-org repo", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");

    const summary = await scanner().run("user-1", { date: DATE });

    assert.equal(summary.repos.length, 1);
    assert.equal(summary.repos[0]!.slug, "kailasa-ngpt/alpha");
    assert.ok(summary.repos[0]!.tasksCreated > 0, "expected at least one task");
    assert.ok(created.length > 0);
  });

  test("a second run the same day creates nothing", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");

    await scanner().run("user-1", { date: DATE });
    const before = created.length;
    const summary = await scanner().run("user-1", { date: DATE });

    assert.equal(created.length, before, "dedup must prevent a second creation");
    assert.equal(summary.totalTasksCreated, 0);
  });

  test("a repo owned by another org is never scanned", async () => {
    const path = makeRepo("beta", "git@github.com:someone-else/beta.git");
    commitIn(path, "feat: not ours", "dev@example.com");

    const summary = await scanner().run("user-1", { date: DATE });

    assert.deepEqual(summary.repos, []);
    assert.equal(created.length, 0);
    assert.ok(summary.skipped.some((s) => /owner/i.test(s.reason)));
  });

  test("a failed fetch does not stop the repo being scanned, and is reported", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");

    const summary = await scanner({
      fetchRepo: async () => {
        throw new Error("Permission denied (publickey)");
      },
    }).run("user-1", { date: DATE });

    assert.match(summary.repos[0]!.fetchFailed!, /publickey/);
    assert.ok(summary.repos[0]!.tasksCreated > 0, "stale history is still worth scanning");
  });

  test("one repo's failure does not prevent the next repo's tasks", async () => {
    const good = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(good, "feat: alpha works", "dev@example.com");
    const bad = makeRepo("zeta", "git@github.com:kailasa-ngpt/zeta.git");
    commitIn(bad, "feat: zeta explodes", "dev@example.com");

    let calls = 0;
    const summary = await scanner({
      analyzerFactory: (projectPath: string) => {
        calls += 1;
        if (projectPath.endsWith("zeta")) {
          return { analyzeWork: async () => { throw new Error("boom"); } } as any;
        }
        return new GitWorkAnalyzer(projectPath);
      },
    }).run("user-1", { date: DATE });

    assert.equal(calls, 2, "both repos must be attempted");
    const zeta = summary.repos.find((r) => r.slug.endsWith("zeta"))!;
    const alpha = summary.repos.find((r) => r.slug.endsWith("alpha"))!;
    assert.match(zeta.error!, /boom/);
    assert.ok(alpha.tasksCreated > 0);
  });

  test("picks up commits from every configured identity and no one else's", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: from work email", "work@example.com");
    commitIn(path, "feat: from personal email", "personal@example.com");
    commitIn(path, "feat: from a colleague", "someone@else.com");

    registry.saveSettings("user-1", {
      authorIdentities: ["work@example.com", "personal@example.com"],
    });

    const summary = await scanner().run("user-1", { date: DATE });

    assert.equal(summary.repos[0]!.commits, 2, `saw ${JSON.stringify(created)}`);
  });

  test("finds a commit on a branch that is not checked out", async () => {
    // git log with no revision argument walks HEAD only, so this fails unless
    // --all is passed. The Reports tab's "All Branches" option does NOT do this.
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: on main", "dev@example.com");
    commitIn(path, "feat: on a side branch", "dev@example.com", "side-branch");
    execFileSync("git", ["checkout", "-q", "main"], { cwd: path });

    const summary = await scanner().run("user-1", { date: DATE });

    assert.equal(summary.repos[0]!.commits, 2, "a non-checked-out branch must be scanned");
  });

  test("a disabled repo binding is skipped", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");
    registry.saveBinding("user-1", "kailasa-ngpt/alpha", { enabled: false });

    const summary = await scanner().run("user-1", { date: DATE });

    assert.equal(summary.totalTasksCreated, 0);
    assert.equal(created.length, 0);
  });

  test("dry run creates nothing and marks nothing processed", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");

    const first = await scanner().run("user-1", { date: DATE, dryRun: true });
    assert.equal(created.length, 0, "a dry run must not call ClickUp");
    assert.ok(first.repos[0]!.wouldCreate!.length > 0);

    // The real proof it wrote no processed_commits row: a second dry run still
    // reports the same work.
    const second = await scanner().run("user-1", { date: DATE, dryRun: true });
    assert.equal(second.repos[0]!.wouldCreate!.length, first.repos[0]!.wouldCreate!.length);
  });

  test("tags each task with the repo slug", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");

    const tags: string[][] = [];
    await new DailyScanner({
      registry,
      grouper: new HeuristicCommitGrouper(),
      fetchRepo: async () => {},
      resolver: {
        resolve: () => ({
          destination: null,
          clickUp: {
            createTask: async (task: any) => {
              tags.push(task.tags ?? []);
              return { id: "t", name: task.name, url: "u" };
            },
            getListStatuses: async () => [],
          } as unknown as ClickUpService,
          listId: "list-1",
          template: BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!,
          config: { teamId: "t", apiKey: "unused", projectName: "p" },
        }),
      } as unknown as DestinationResolver,
    }).run("user-1", { date: DATE });

    assert.ok(
      tags.some((t) => t.includes("kailasa-ngpt/alpha")),
      `expected the slug tag, got ${JSON.stringify(tags)}`
    );
  });
});
```

- [ ] **Step 4: Run it and confirm it fails for the right reason**

Run: `npx tsx --test src/scanning/DailyScanner.nodetest.ts`
Expected: cannot resolve `./DailyScanner.js`.

- [ ] **Step 5: Implement**

Create `src/scanning/DailyScanner.ts`:

```ts
/**
 * One end-of-day scan across every enabled repository.
 *
 * This class ORCHESTRATES and does not format: work items come from
 * GitWorkAnalyzer (which groups via the injected CommitGrouper), rendering and
 * creation go through the canonical renderer via createRenderedTasks, and the
 * destination comes from DestinationResolver. If this file ever starts building
 * a task name, the canonical pipeline has been bypassed and preview/created
 * parity is broken again.
 *
 * Per-repo isolation is the rule: a repo that fails to fetch, fails to analyse,
 * or whose ClickUp list rejects a task must never prevent the remaining repos
 * from being processed. Every outcome lands in the summary, because an
 * unattended job whose failures are invisible is worse than no job.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { discoverRepos, DiscoveryResult, SkippedDir } from "./RepoDiscovery.js";
import { ScanRegistry } from "./ScanRegistry.js";
import { GitWorkAnalyzer } from "../services/GitWorkAnalyzer.js";
import { ClickUpService } from "../services/ClickUpService.js";
import {
  annotateStatusMapping,
  buildPreview,
  createRenderedTasks,
} from "../routes/tasks.routes.js";
import { workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import type { CommitGrouper } from "../grouping/CommitGrouper.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";
import type { ClickUpConfig } from "../types/index.js";

const execFileAsync = promisify(execFile);

/** A fetch needing credentials must fail, not hang the whole run. */
const FETCH_TIMEOUT_MS = 60_000;

export interface RepoScanResult {
  slug: string;
  commits: number;
  workItems: number;
  tasksCreated: number;
  destination: string | null;
  fetchFailed?: string;
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
}

export interface ScanRunSummary {
  date: string;
  dryRun: boolean;
  repos: RepoScanResult[];
  skipped: SkippedDir[];
  totalTasksCreated: number;
}

export interface DailyScannerDeps {
  registry: ScanRegistry;
  resolver: DestinationResolver;
  grouper: CommitGrouper;
  analyzerFactory?: (projectPath: string) => GitWorkAnalyzer;
  clickUpFactory?: (config: ClickUpConfig) => ClickUpService;
  discover?: typeof discoverRepos;
  fetchRepo?: (path: string) => Promise<void>;
}

async function gitFetch(path: string): Promise<void> {
  await execFileAsync("git", ["fetch", "--all", "--prune"], {
    cwd: path,
    timeout: FETCH_TIMEOUT_MS,
  });
}

export class DailyScanner {
  constructor(private deps: DailyScannerDeps) {}

  async run(
    userId: string,
    opts: { date: string; dryRun?: boolean }
  ): Promise<ScanRunSummary> {
    const dryRun = opts.dryRun === true;
    const settings = this.deps.registry.getSettings(userId);
    const discover = this.deps.discover ?? discoverRepos;
    const fetchRepo = this.deps.fetchRepo ?? gitFetch;

    const discovery: DiscoveryResult = await discover(settings.root, settings.owner);
    const results: RepoScanResult[] = [];

    // Sequential: ClickUp rate-limits, and it keeps the failure report readable.
    for (const repo of discovery.repos) {
      const binding = this.deps.registry.getBinding(userId, repo.slug);
      if (binding && !binding.enabled) continue;

      const result: RepoScanResult = {
        slug: repo.slug,
        commits: 0,
        workItems: 0,
        tasksCreated: 0,
        destination: null,
      };

      try {
        try {
          await fetchRepo(repo.path);
        } catch (error) {
          // Recorded, not fatal: stale local history is still worth scanning,
          // and the flag tells the user why a repo may look thin.
          result.fetchFailed = error instanceof Error ? error.message : String(error);
        }

        const analyzer =
          this.deps.analyzerFactory?.(repo.path) ??
          new GitWorkAnalyzer(repo.path, undefined, this.deps.grouper);

        // "--all" is load-bearing: git log with no revision argument walks HEAD
        // only, so work on a branch that is not checked out would be invisible.
        const analysis = await analyzer.analyzeWork(
          opts.date,
          opts.date,
          settings.authorIdentities.length > 0 ? settings.authorIdentities : undefined,
          "--all",
          false
        );

        result.commits = analysis.totalCommits;
        result.workItems = analysis.detectedWork.length;

        if (analysis.detectedWork.length === 0) {
          results.push(result);
          continue;
        }

        const resolved = this.deps.resolver.resolve(
          userId,
          binding?.destinationId,
          binding?.templateId
        );
        result.destination = resolved.destination?.name ?? null;

        const items = workItemsFromAnalysis(analysis, repo.slug).map((item) => ({
          ...item,
          tags: [...item.tags, repo.slug],
        }));

        // buildPreview + annotateStatusMapping rather than renderTasks directly,
        // for one load-bearing reason: git-derived items carry
        // status "complete", and ClickUp answers 400 "Status not found" for a
        // status the target list does not define. A list whose statuses are
        // e.g. [researching, developing, deployed] would reject EVERY task.
        // These are the same two functions the HTTP routes use, so the scan
        // cannot drift from them.
        let preview = buildPreview(items, resolved.template);
        if (resolved.listId) {
          try {
            const statuses = await resolved.clickUp.getListStatuses(resolved.listId);
            preview = annotateStatusMapping(preview, statuses);
          } catch (error) {
            // Unknown statuses: send what was rendered, which is the
            // pre-slice-2 behaviour, and say so rather than failing the repo.
            result.error = `Could not read list statuses: ${
              error instanceof Error ? error.message : error
            }`;
          }
        }
        const rendered = preview.items;

        if (dryRun) {
          result.wouldCreate = rendered.map((entry) => ({
            name: entry.task.name,
            description: entry.task.description ?? "",
          }));
          results.push(result);
          continue;
        }

        const clickUp =
          this.deps.clickUpFactory?.(resolved.config) ?? resolved.clickUp;
        const outcome = await createRenderedTasks(rendered, clickUp, resolved.listId);
        result.tasksCreated = outcome.created.length;
        if (outcome.failed.length > 0) {
          result.error = `${outcome.failed.length} task(s) rejected: ${outcome.failed
            .map((f) => f.reason)
            .join("; ")}`;
        }

        // Only a real run records progress. A dry run that marked commits
        // processed would make the first real run create nothing.
        analyzer.markScanCommitsProcessed(analysis, repo.path);
        this.deps.registry.markScanned(userId, repo.slug, opts.date);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      }

      results.push(result);
    }

    return {
      date: opts.date,
      dryRun,
      repos: results,
      skipped: discovery.skipped,
      totalTasksCreated: results.reduce((sum, r) => sum + r.tasksCreated, 0),
    };
  }
}
```

Then add the one method the scanner needs on `GitWorkAnalyzer`, beside
`createTasksFromWork`:

```ts
  /**
   * Records the analysed commits as processed, without creating tasks.
   *
   * The scanner creates tasks itself through the canonical renderer, so it
   * cannot use createTasksFromWork — but the dedup bookkeeping that method
   * performs is exactly what makes a second run of the same day a no-op. This
   * exposes only that half.
   */
  markScanCommitsProcessed(analysis: WorkAnalysisResult, projectPath: string): void {
    const commits = analysis.detectedWork.flatMap((work) => work.commits);
    if (commits.length === 0) return;
    this.historyService.markCommitsAsProcessed(commits, projectPath);
  }
```

- [ ] **Step 6: Run the test and confirm every case passes**

Run: `npx tsx --test src/scanning/DailyScanner.nodetest.ts` → 11 pass.
If "finds a commit on a branch that is not checked out" fails, `--all` is not reaching git. If "a second run creates nothing" fails, Task 2's dedup fix or `markScanCommitsProcessed` is not wired.

- [ ] **Step 7: Mutation-test the two properties that matter most**

1. Change `"--all"` to `undefined` in the `analyzeWork` call. Confirm ONLY the non-checked-out-branch test goes red. Restore.
2. Remove the `markScanCommitsProcessed` call. Confirm ONLY the second-run test goes red. Restore.

Report both outputs. These are the two silent-failure modes in this task.

- [ ] **Step 8: Run the full suites and commit**

```bash
bun test && bun run test:db && bun run build 2>&1 | grep "error TS"
git add src/scanning/DailyScanner.ts src/scanning/DailyScanner.nodetest.ts src/services/GitWorkAnalyzer.ts
git commit -m "feat(scanning): scan every org repo and create the day's tasks

<trailer>"
```

---

### Task 6: Scheduler with startup catch-up

**Files:**
- Create: `src/scanning/ScanScheduler.ts`
- Test: `src/scanning/ScanScheduler.nodetest.ts`

**Interfaces:**
- Consumes: `ScanRegistry` (Task 4), `DailyScanner` (Task 5).
- Produces:
  ```ts
  export interface ScanSchedulerDeps {
    registry: ScanRegistry;
    runScan: (userId: string, date: string) => Promise<void>;
    now?: () => Date;          // injected so tests need no timers
    userIds: () => string[];
  }
  export class ScanScheduler {
    constructor(deps: ScanSchedulerDeps);
    /** Runs any run that is due. Idempotent — safe to call repeatedly. */
    tick(): Promise<void>;
    start(intervalMs?: number): void;
    stop(): void;
  }
  ```
  Task 8 mounts it.

`now` is injected rather than using fake timers: date arithmetic is the logic under test, and a test that manipulates real time is slow and flaky.

- [ ] **Step 1: Write the failing test**

Create `src/scanning/ScanScheduler.nodetest.ts`:

```ts
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanRegistry } from "./ScanRegistry.js";
import { ScanScheduler } from "./ScanScheduler.js";

let dir: string;
let registry: ScanRegistry;
let runs: Array<{ userId: string; date: string }>;

function scheduler(now: string): ScanScheduler {
  return new ScanScheduler({
    registry,
    userIds: () => ["user-1"],
    now: () => new Date(now),
    runScan: async (userId, date) => {
      runs.push({ userId, date });
      registry.saveSettings(userId, { lastCompletedDate: date });
    },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-sched-"));
  registry = new ScanRegistry(join(dir, "test.db"));
  runs = [];
});

afterEach(() => {
  registry.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("ScanScheduler", () => {
  test("does nothing while scanning is disabled", async () => {
    registry.saveSettings("user-1", { enabled: false, scanTime: "18:00" });
    await scheduler("2026-08-04T23:00:00").tick();
    assert.deepEqual(runs, []);
  });

  test("does nothing before the configured time", async () => {
    registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    await scheduler("2026-08-04T17:59:00").tick();
    assert.deepEqual(runs, []);
  });

  test("runs today once the configured time has passed", async () => {
    registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    await scheduler("2026-08-04T18:01:00").tick();
    assert.deepEqual(runs, [{ userId: "user-1", date: "2026-08-04" }]);
  });

  test("does not run twice for the same day", async () => {
    registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    const s = scheduler("2026-08-04T18:01:00");
    await s.tick();
    await s.tick();
    assert.equal(runs.length, 1);
  });

  test("catches up a missed day, once", async () => {
    // The scheduler only fires while the server runs, so a missed day is the
    // expected case, not an edge case.
    registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-01",
    });

    const s = scheduler("2026-08-04T09:00:00");
    await s.tick();
    await s.tick();

    assert.deepEqual(runs, [{ userId: "user-1", date: "2026-08-04" }]);
  });

  test("a failing run does not record the day as completed", async () => {
    registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    const s = new ScanScheduler({
      registry,
      userIds: () => ["user-1"],
      now: () => new Date("2026-08-04T18:01:00"),
      runScan: async () => {
        throw new Error("scan blew up");
      },
    });

    await s.tick();

    assert.equal(registry.getSettings("user-1").lastCompletedDate, undefined);
  });

  test("one user's failure does not prevent another user's run", async () => {
    registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    registry.saveSettings("user-2", { enabled: true, scanTime: "18:00" });

    const s = new ScanScheduler({
      registry,
      userIds: () => ["user-1", "user-2"],
      now: () => new Date("2026-08-04T18:01:00"),
      runScan: async (userId, date) => {
        if (userId === "user-1") throw new Error("boom");
        runs.push({ userId, date });
      },
    });

    await s.tick();
    assert.deepEqual(runs, [{ userId: "user-2", date: "2026-08-04" }]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `npx tsx --test src/scanning/ScanScheduler.nodetest.ts`
Expected: cannot resolve `./ScanScheduler.js`.

- [ ] **Step 3: Implement**

Create `src/scanning/ScanScheduler.ts`:

```ts
/**
 * Fires the daily scan at a configured local time, and catches up one missed
 * day on startup.
 *
 * A plain interval timer rather than a cron dependency: the granularity is a
 * day, and `tick` is idempotent, so re-checking every few minutes costs nothing
 * and needs no schedule parsing.
 *
 * Catch-up matters because this scheduler only fires while the server is
 * running. A laptop closed at 17:00 is the normal case, not an edge case.
 */

import { ScanRegistry } from "./ScanRegistry.js";

export interface ScanSchedulerDeps {
  registry: ScanRegistry;
  runScan: (userId: string, date: string) => Promise<void>;
  /** Injected so the date logic is testable without touching real time. */
  now?: () => Date;
  userIds: () => string[];
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesInto(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseScanTime(scanTime: string): number {
  const [hours, minutes] = scanTime.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export class ScanScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private deps: ScanSchedulerDeps) {}

  async tick(): Promise<void> {
    const now = (this.deps.now ?? (() => new Date()))();
    const today = localDate(now);

    for (const userId of this.deps.userIds()) {
      const settings = this.deps.registry.getSettings(userId);
      if (!settings.enabled) continue;
      if (settings.lastCompletedDate === today) continue;
      if (minutesInto(now) < parseScanTime(settings.scanTime)) continue;

      try {
        await this.deps.runScan(userId, today);
        // Recorded by the caller on success. Recording it here regardless would
        // mark a failed day as done and skip it forever.
      } catch (error) {
        console.error(
          `Daily scan failed for ${userId} on ${today}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // Do not hold the process open for the sake of a timer.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
```

Note `runScan` is responsible for recording `lastCompletedDate` on success — the
scheduler deliberately does not, so a thrown scan is retried rather than marked
done. The test "a failing run does not record the day as completed" pins that.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx tsx --test src/scanning/ScanScheduler.nodetest.ts` → 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/scanning/ScanScheduler.ts src/scanning/ScanScheduler.nodetest.ts
git commit -m "feat(scanning): daily scheduler with startup catch-up

<trailer>"
```

---

### Task 7: HTTP API

**Files:**
- Create: `src/routes/scanning.routes.ts`
- Test: `src/routes/scanning.routes.nodetest.ts`

**Interfaces:**
- Consumes: `ScanRegistry` (Task 4), `DailyScanner` (Task 5), `discoverRepos` (Task 3).
- Produces: `export function createScanningRouter(deps: ScanningRouterDeps): Router` with
  ```ts
  export interface ScanningRouterDeps {
    registry: ScanRegistry;
    scanner: DailyScanner;
    discover?: typeof discoverRepos;
  }
  ```
  Routes: `GET /settings`, `PUT /settings`, `GET /repos`, `PUT /repos/:owner/:name`, `POST /run`, `GET /last-run`.
  Task 8 mounts it at `/api/scanning`; Task 9 consumes it.

`:slug` contains a slash (`owner/name`), which Express will not match with a
plain `:slug` parameter. Use a wildcard and reassemble.

- [ ] **Step 1: Write the failing test**

Create `src/routes/scanning.routes.nodetest.ts`:

```ts
/**
 * Runs under `tsx --test`: `authenticate` constructs a real AuthService, which
 * opens better-sqlite3. Own temp cwd, because DatabaseService writes to
 * process.cwd()/.database and node --test runs files in parallel.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createScanningRouter } from "./scanning.routes.js";
import { ScanRegistry } from "../scanning/ScanRegistry.js";
import { JWTService } from "../services/JWTService.js";
import type { DailyScanner, ScanRunSummary } from "../scanning/DailyScanner.js";

const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-scanroutes-"));
process.chdir(tmpDbDir);

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let authHeader: string;
let registry: ScanRegistry;
let runCalls: Array<{ userId: string; date: string; dryRun?: boolean }>;

before(() => {
  registry = new ScanRegistry(join(tmpDbDir, "registry.db"));
  runCalls = [];

  const scanner = {
    run: async (userId: string, opts: { date: string; dryRun?: boolean }) => {
      runCalls.push({ userId, ...opts });
      return {
        date: opts.date,
        dryRun: opts.dryRun === true,
        repos: [],
        skipped: [],
        totalTasksCreated: 0,
      } satisfies ScanRunSummary;
    },
  } as unknown as DailyScanner;

  const app = express();
  app.use(express.json());
  app.use(
    "/api/scanning",
    createScanningRouter({
      registry,
      scanner,
      discover: async () => ({
        repos: [
          { path: "/x/alpha", slug: "kailasa-ngpt/alpha", owner: "kailasa-ngpt", name: "alpha" },
        ],
        skipped: [{ path: "/x/other", reason: "Different owner: someone-else" }],
      }),
    })
  );

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/scanning`;
  const { accessToken } = JWTService.generateTokenPair({
    userId: "user-1",
    email: "test@example.com",
    role: "user",
    fullName: "Test User",
  });
  authHeader = `Bearer ${accessToken}`;
});

after(() => {
  server.close();
  registry.close();
  process.chdir(originalCwd);
  rmSync(tmpDbDir, { recursive: true, force: true });
});

const authed = (path: string, init: RequestInit = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...(init.headers ?? {}),
    },
  });

describe("scanning routes", () => {
  test("every route requires authentication", async () => {
    for (const path of ["/settings", "/repos"]) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 401, path);
    }
    const run = await fetch(`${baseUrl}/run`, { method: "POST" });
    assert.equal(run.status, 401);
  });

  test("GET /settings returns defaults, disabled", async () => {
    const res = await authed("/settings");
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.equal(data.enabled, false);
    assert.equal(data.owner, "kailasa-ngpt");
  });

  test("PUT /settings saves and echoes the result", async () => {
    const res = await authed("/settings", {
      method: "PUT",
      body: JSON.stringify({ scanTime: "19:30", authorIdentities: ["a@b.com"] }),
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.equal(data.scanTime, "19:30");
    assert.deepEqual(data.authorIdentities, ["a@b.com"]);
  });

  test("PUT /settings rejects a malformed scan time", async () => {
    const res = await authed("/settings", {
      method: "PUT",
      body: JSON.stringify({ scanTime: "7pm" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /HH:MM/);
  });

  test("PUT /settings rejects a non-array authorIdentities", async () => {
    const res = await authed("/settings", {
      method: "PUT",
      body: JSON.stringify({ authorIdentities: "a@b.com" }),
    });
    assert.equal(res.status, 400);
  });

  test("GET /repos merges discovery with stored bindings and lists skips", async () => {
    const { data } = await (await authed("/repos")).json();

    assert.equal(data.repos.length, 1);
    assert.equal(data.repos[0].slug, "kailasa-ngpt/alpha");
    assert.equal(data.repos[0].enabled, true, "an unbound repo defaults to enabled");
    assert.equal(data.skipped.length, 1);
    assert.match(data.skipped[0].reason, /Different owner/);
  });

  test("PUT /repos/:owner/:name saves a binding for a slug containing a slash", async () => {
    const res = await authed("/repos/kailasa-ngpt/alpha", {
      method: "PUT",
      body: JSON.stringify({ destinationId: "dest-1", enabled: false }),
    });
    assert.equal(res.status, 200);

    const stored = registry.getBinding("user-1", "kailasa-ngpt/alpha")!;
    assert.equal(stored.destinationId, "dest-1");
    assert.equal(stored.enabled, false);
  });

  test("POST /run passes dryRun through and defaults it to false", async () => {
    runCalls.length = 0;
    await authed("/run", { method: "POST", body: JSON.stringify({ dryRun: true }) });
    assert.equal(runCalls[0]!.dryRun, true);

    runCalls.length = 0;
    await authed("/run", { method: "POST", body: JSON.stringify({}) });
    assert.equal(runCalls[0]!.dryRun, undefined);
  });

  test("POST /run defaults the date to today and accepts an explicit one", async () => {
    runCalls.length = 0;
    await authed("/run", { method: "POST", body: JSON.stringify({ date: "2026-07-30" }) });
    assert.equal(runCalls[0]!.date, "2026-07-30");

    runCalls.length = 0;
    await authed("/run", { method: "POST", body: JSON.stringify({}) });
    assert.match(runCalls[0]!.date, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("GET /last-run returns the most recent real run", async () => {
    // Same user across this file, so assert on a date this test owns rather
    // than on emptiness.
    await authed("/run", { method: "POST", body: JSON.stringify({ date: "2026-07-31" }) });

    const { data } = await (await authed("/last-run")).json();
    assert.equal(data.summary.date, "2026-07-31");
    assert.match(data.ranAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  test("a dry run does not overwrite the last real run's summary", async () => {
    await authed("/run", { method: "POST", body: JSON.stringify({ date: "2026-07-31" }) });
    await authed("/run", {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-01", dryRun: true }),
    });

    const { data } = await (await authed("/last-run")).json();
    assert.equal(data.summary.date, "2026-07-31", "a dry run must not hide the real run");
  });

  test("POST /run rejects a malformed date rather than scanning the wrong day", async () => {
    const res = await authed("/run", {
      method: "POST",
      body: JSON.stringify({ date: "04-08-2026" }),
    });
    assert.equal(res.status, 400);
    assert.equal(runCalls.at(-1)?.date, undefined);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `npx tsx --test src/routes/scanning.routes.nodetest.ts`
Expected: cannot resolve `./scanning.routes.js`.

- [ ] **Step 3: Implement**

Create `src/routes/scanning.routes.ts`:

```ts
/**
 * Configuration and manual triggering for the org-wide daily scan.
 *
 * GET /repos deliberately merges live discovery with stored bindings rather than
 * serving a cached list: a repo cloned five minutes ago should appear without a
 * restart, and a repo the user expected but which is skipped should say why.
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { ScanRegistry } from "../scanning/ScanRegistry.js";
import { DailyScanner } from "../scanning/DailyScanner.js";
import { discoverRepos } from "../scanning/RepoDiscovery.js";

export interface ScanningRouterDeps {
  registry: ScanRegistry;
  scanner: DailyScanner;
  discover?: typeof discoverRepos;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createScanningRouter(deps: ScanningRouterDeps): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user!.userId;
  const discover = deps.discover ?? discoverRepos;

  const fail = (res: any, error: string, status = 400): void => {
    res.status(status).json({ success: false, error });
  };

  router.get("/settings", authenticate, (req, res) => {
    res.json({ success: true, data: deps.registry.getSettings(userIdOf(req)) });
  });

  router.put("/settings", authenticate, (req, res) => {
    const { root, owner, authorIdentities, scanTime, enabled } = req.body ?? {};

    if (scanTime !== undefined && !TIME_PATTERN.test(String(scanTime))) {
      return fail(res, "scanTime must be HH:MM in 24-hour local time");
    }
    if (authorIdentities !== undefined && !Array.isArray(authorIdentities)) {
      return fail(res, "authorIdentities must be an array of emails or names");
    }

    res.json({
      success: true,
      data: deps.registry.saveSettings(userIdOf(req), {
        root,
        owner,
        authorIdentities,
        scanTime,
        enabled,
      }),
    });
  });

  router.get("/repos", authenticate, async (req, res) => {
    try {
      const userId = userIdOf(req);
      const settings = deps.registry.getSettings(userId);
      const { repos, skipped } = await discover(settings.root, settings.owner);

      res.json({
        success: true,
        data: {
          repos: repos.map((repo) => {
            const binding = deps.registry.getBinding(userId, repo.slug);
            return {
              slug: repo.slug,
              path: repo.path,
              // Unbound means enabled: a newly cloned repo should be scanned
              // without the user having to opt each one in.
              enabled: binding?.enabled ?? true,
              destinationId: binding?.destinationId ?? null,
              templateId: binding?.templateId ?? null,
              lastScannedDate: binding?.lastScannedDate ?? null,
            };
          }),
          skipped,
        },
      });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "Discovery failed", 500);
    }
  });

  // The slug contains a slash, which a single :param will not match.
  router.put("/repos/:owner/:name", authenticate, (req, res) => {
    const slug = `${req.params.owner}/${req.params.name}`;
    const { destinationId, templateId, enabled } = req.body ?? {};
    res.json({
      success: true,
      data: deps.registry.saveBinding(userIdOf(req), slug, {
        destinationId,
        templateId,
        enabled,
      }),
    });
  });

  /**
   * The last run's summary, including a SCHEDULED one. Without this a scheduled
   * run's failures exist only in the server log, and an unattended job whose
   * errors are invisible is worse than no job.
   */
  router.get("/last-run", authenticate, (req, res) => {
    res.json({ success: true, data: deps.registry.getLastRun(userIdOf(req)) });
  });

  router.post("/run", authenticate, async (req, res) => {
    const { date, dryRun } = req.body ?? {};
    if (date !== undefined && !DATE_PATTERN.test(String(date))) {
      return fail(res, "date must be YYYY-MM-DD");
    }

    try {
      const userId = userIdOf(req);
      const summary = await deps.scanner.run(userId, {
        date: date ?? new Date().toISOString().split("T")[0]!,
        dryRun: dryRun === true ? true : undefined,
      });
      // A dry run is not a run: persisting it would overwrite the last real
      // run's summary, hiding the failures the user actually needs to see.
      if (!summary.dryRun) deps.registry.saveRun(userId, summary);
      res.json({ success: true, data: summary });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "Scan failed", 500);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx tsx --test src/routes/scanning.routes.nodetest.ts` → 11 pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/scanning.routes.ts src/routes/scanning.routes.nodetest.ts
git commit -m "feat(scanning): settings, repo binding, and run API

<trailer>"
```

---

### Task 8: Wire the subsystem into the server

**Files:**
- Modify: `src/webhook-server.ts` (store construction around line 130, router mounts around 135, `grouper` construction around 153)

**Interfaces:**
- Consumes: everything from Tasks 4-7.
- Produces: `/api/scanning/*` mounted; the scheduler started.

- [ ] **Step 1: Construct the registry, scanner and scheduler, and mount the router**

In `startWebhookServer`, after the `resolver` and `grouper` are built (they are
both required by the scanner), add:

```ts
    // Org-wide daily scan. The registry shares the one database, so a repo
    // binding and the destination it names cannot land in different files.
    const scanRegistry = new ScanRegistry(dbPath);
    const dailyScanner = new DailyScanner({
      registry: scanRegistry,
      resolver,
      grouper,
    });

    app.use(
      "/api/scanning",
      createScanningRouter({ registry: scanRegistry, scanner: dailyScanner })
    );

    // The scheduler records lastCompletedDate itself, on success only, so a
    // failed scan is retried rather than marked done.
    const scanScheduler = new ScanScheduler({
      registry: scanRegistry,
      userIds: () => {
        // getAllUsers is paginated (limit defaults to 50); pass an explicit
        // large limit so a growing user table does not silently stop being
        // scheduled past the default page.
        const authService = new AuthService();
        try {
          return authService.db.getAllUsers(10_000, 0).map((user: { id: string }) => user.id);
        } finally {
          authService.close();
        }
      },
      runScan: async (userId, date) => {
        const summary = await dailyScanner.run(userId, { date });
        // Persist BEFORE marking the day complete: the summary is the only
        // record a scheduled run leaves, and it must survive even if the
        // settings write fails.
        scanRegistry.saveRun(userId, summary);
        scanRegistry.saveSettings(userId, { lastCompletedDate: date });
        console.log(
          `📅 Daily scan for ${date}: ${summary.totalTasksCreated} task(s) across ${summary.repos.length} repo(s)`
        );
      },
    });
    scanScheduler.start();
```

Add the imports:

```ts
import { ScanRegistry } from "./scanning/ScanRegistry.js";
import { DailyScanner } from "./scanning/DailyScanner.js";
import { ScanScheduler } from "./scanning/ScanScheduler.js";
import { createScanningRouter } from "./routes/scanning.routes.js";
```

- [ ] **Step 2: Confirm `getAllUsers` exists, and add it if it does not**

Run: `grep -n "getAllUsers" src/services/AuthDatabaseService.ts`

If absent, add it — the scheduler needs to know whose scans to run:

```ts
  /** Every user id, for subsystems that run per-user work on a schedule. */
  getAllUsers(): Array<{ id: string }> {
    return this.db.prepare(`SELECT id FROM users`).all() as Array<{ id: string }>;
  }
```

- [ ] **Step 3: Verify the server boots and the routes are mounted**

```bash
bun run webhook > /tmp/scan-boot.log 2>&1 &
sleep 12
curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3009/api/health
curl -s -o /dev/null -w "scanning/settings unauth %{http_code}\n" http://localhost:3009/api/scanning/settings
pkill -f webhook
```
Expected: `health 200` and `scanning/settings unauth 401`. A **404** means the
router is not mounted; a 500 means construction threw.

- [ ] **Step 4: Full suites, then commit**

```bash
bun test && bun run test:db && bun run build 2>&1 | grep "error TS"
git add src/webhook-server.ts src/services/AuthDatabaseService.ts
git commit -m "feat(scanning): mount the scanning API and start the scheduler

<trailer>"
```

---

### Task 9: Settings UI

**Files:**
- Create: `ui/app/settings/scanning/page.tsx`
- Modify: `ui/app/settings/page.tsx` (add a link, beside the Templates and Destinations links)
- Modify: `ui/types/index.ts` (add the types below)

**Interfaces:**
- Consumes: `/api/scanning/*` (Task 7), `/api/destinations` and `/api/templates` for the two selects.
- Produces: nothing consumed by later tasks.

Match `ui/app/settings/destinations/page.tsx` exactly: `'use client'`, `useAuth()`
for `accessToken`, `Card`/`Button`/`Input`/`LoadingSpinner` from
`@/lib/components/ui`, `toast` from `react-hot-toast`, `ProtectedRoute`, and
`const BACKEND_URL = 'http://localhost:3009'`.

- [ ] **Step 1: Add the shared types**

In `ui/types/index.ts`:

```ts
export interface ScanSettings {
  root: string;
  owner: string;
  authorIdentities: string[];
  scanTime: string;
  enabled: boolean;
  lastCompletedDate?: string;
}

export interface ScannedRepo {
  slug: string;
  path: string;
  enabled: boolean;
  destinationId: string | null;
  templateId: string | null;
  lastScannedDate: string | null;
}

export interface SkippedDir {
  path: string;
  reason: string;
}

export interface RepoScanResult {
  slug: string;
  commits: number;
  workItems: number;
  tasksCreated: number;
  destination: string | null;
  fetchFailed?: string;
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
}

export interface ScanRunSummary {
  date: string;
  dryRun: boolean;
  repos: RepoScanResult[];
  skipped: SkippedDir[];
  totalTasksCreated: number;
}
```

- [ ] **Step 2: Build the page**

Create `ui/app/settings/scanning/page.tsx` with:

Data layer, to be written first so the markup has something to render:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Button, Input, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  Destination,
  ScanRunSummary,
  ScanSettings,
  ScannedRepo,
  SkippedDir,
  Template,
} from '@/types';

const BACKEND_URL = 'http://localhost:3009';

export default function ScanningSettingsPage() {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<ScanSettings | null>(null);
  const [repos, setRepos] = useState<ScannedRepo[]>([]);
  const [skipped, setSkipped] = useState<SkippedDir[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [summary, setSummary] = useState<ScanRunSummary | null>(null);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(init.headers ?? {}),
        },
        credentials: 'include',
      });
      return { ok: res.ok, status: res.status, body: await res.json() };
    },
    [accessToken]
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [s, r, d, t, last] = await Promise.all([
        api('/api/scanning/settings'),
        api('/api/scanning/repos'),
        api('/api/destinations'),
        api('/api/templates'),
        api('/api/scanning/last-run'),
      ]);
      setSettings(s.body.data ?? null);
      setRepos(r.body.data?.repos ?? []);
      setSkipped(r.body.data?.skipped ?? []);
      setDestinations(d.body.data ?? []);
      setTemplates(t.body.data ?? []);
      // The persisted summary, so a SCHEDULED run's failures are visible
      // without re-running anything.
      setSummary(last.body.data?.summary ?? null);
    } catch {
      toast.error('Could not load scan settings');
    } finally {
      setLoading(false);
    }
  }, [accessToken, api]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (patch: Partial<ScanSettings>) => {
    const { ok, body } = await api('/api/scanning/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!ok) {
      // Render the server's reason. Swallowing it wastes the validation.
      toast.error(body.error ?? 'Could not save');
      return;
    }
    setSettings(body.data);
    toast.success('Saved');
  };

  const saveBinding = async (slug: string, patch: Partial<ScannedRepo>) => {
    const { ok, body } = await api(`/api/scanning/repos/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (!ok) {
      toast.error(body.error ?? 'Could not save');
      return;
    }
    setRepos((current) =>
      current.map((repo) => (repo.slug === slug ? { ...repo, ...patch } : repo))
    );
  };

  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const { ok, body } = await api('/api/scanning/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun }),
      });
      if (!ok) {
        toast.error(body.error ?? 'Scan failed');
        return;
      }
      setSummary(body.data);
      toast.success(
        dryRun
          ? 'Dry run complete — nothing was created'
          : `Created ${body.data.totalTasksCreated} task(s)`
      );
      await load();
    } finally {
      setRunning(false);
    }
  };

  // ... markup below, following ui/app/settings/destinations/page.tsx
}
```

Then the markup:

- **Settings card:** scan root (`Input`), organisation (`Input`), scan time
  (`<input type="time">`), an enabled checkbox, and an author-identities editor
  (a list with a text input and Add/Remove). Save posts `PUT /api/scanning/settings`
  and renders `result.error` on a 400 rather than swallowing it.
- **Repos table** from `GET /api/scanning/repos`: slug, last scanned, an enabled
  checkbox, a destination `<select>` (options from `GET /api/destinations`, plus a
  "Default destination" empty option), and a template `<select>` (options from
  `GET /api/templates`, plus "Destination default"). Each change immediately
  `PUT /api/scanning/repos/<slug>` — the slug goes into the path unescaped
  because the route is `/repos/:owner/:name`.
- **Skipped directories** listed below the table with their reasons, so a missing
  repo is explained rather than absent.
- **Two buttons:** "Dry run" (`POST /run` with `{ dryRun: true }`) and "Run now"
  (`POST /run` with `{}`). Both show a `LoadingSpinner` while in flight — a real
  run across many repos is slow.
- **Summary panel** rendering the returned `ScanRunSummary`, and on page load
  the persisted one from `GET /api/scanning/last-run` (so a scheduled run's
  failures are visible without re-running anything): per repo, the counts
  and any `fetchFailed`/`error`; for a dry run, the `wouldCreate` names. Guard
  every optional array with `?? []` before mapping.

Copy rules: the enabled checkbox label reads
`Run automatically at the scheduled time`, and next to it, when `enabled` is
false, the text `Disabled — nothing will be created automatically.`

- [ ] **Step 3: Add the navigation link**

In `ui/app/settings/page.tsx`, beside the existing Templates and Destinations
links, add one to `/settings/scanning` labelled `Daily repo scan`.

- [ ] **Step 4: Verify the UI builds and lints**

```bash
cd ui && bun run build && bun run lint
```
Expected: compiled successfully, `/settings/scanning` in the route table, and
**zero** `Error:` lines from lint. `next build` gates on ESLint, so an unescaped
apostrophe or an `any` fails the build.

- [ ] **Step 5: Verify in a browser**

Start the backend and `cd ui && bun run dev`, log in, and confirm:

1. `/settings/scanning` loads with scanning **disabled** by default.
2. The repos table lists your `kailasa-ngpt` clones; directories that are not
   in the org appear under skipped, with reasons.
3. **Dry run** returns a summary and creates **nothing** in ClickUp — verify by
   checking the target list is unchanged.
4. Binding a repo to a destination persists across a reload.

Do NOT click "Run now" against a live working list unless you have bound the
repos to a scratch destination first. If you cannot log in, report where you got
blocked rather than skipping this step.

- [ ] **Step 6: Commit**

```bash
git add ui/app/settings/scanning/page.tsx ui/app/settings/page.tsx ui/types/index.ts
git commit -m "feat(ui): daily repo scan settings page

<trailer>"
```

---

### Task 10: Documentation and env

**Files:**
- Modify: `README.md`
- Modify: `env.example`

- [ ] **Step 1: Document the feature**

Add a README section covering: what the daily scan does, that it reads local
clones and needs no GitHub token, that organisation membership comes from each
clone's git remote, that it ships disabled, how to configure it at
`/settings/scanning`, and that dry run is the safe way to try it.

State plainly that a repo must be cloned locally to be scanned, and that a repo
whose fetch fails is still scanned against possibly-stale local history.

- [ ] **Step 2: Note the absence of new env vars**

The scan is configured in the database, not the environment, so `env.example`
needs no new key. Add a comment under the existing ClickUp section pointing at
`/settings/scanning`, so someone reading only `env.example` does not conclude the
feature needs configuring there.

- [ ] **Step 3: Commit**

```bash
git add README.md env.example
git commit -m "docs: document the org-wide daily scan

<trailer>"
```

---

## Definition of Done

- [ ] `/settings/scanning` lists local `kailasa-ngpt` repos and binds each to a destination and template.
- [ ] Dry run reports what would be created, touching neither ClickUp nor the database — proven by a second dry run reporting the same work.
- [ ] A real run creates tasks in each repo's bound destination, tagged with the repo slug.
- [ ] A second run the same day creates nothing.
- [ ] A repo whose fetch fails is still scanned and the failure appears in the summary.
- [ ] One repo's failure does not prevent another repo's tasks.
- [ ] Commits on a branch that is not checked out are found (`--all`).
- [ ] Author matching works across at least two configured identities and excludes others'.
- [ ] The scheduler catches up one missed day, once, and a failed run is not marked completed.
- [ ] Scanning is disabled by default.
- [ ] A scheduled run's summary is persisted and visible at `/settings/scanning` without re-running.
- [ ] A dry run does not overwrite the last real run's summary.
- [ ] `getCommitsForDateRange` no longer interpolates into a shell string.
- [ ] Commit dedup keys on the hash alone; a commit recorded under one path is processed under another.
- [ ] `bun test`, `bun run test:db`, `bun run build` (3 baseline errors), `cd ui && bun run build`, and `bun run e2e:clickup` all pass.
