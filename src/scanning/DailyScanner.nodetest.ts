/**
 * Runs under `tsx --test`: constructing a GitWorkAnalyzer opens better-sqlite3.
 *
 * Nothing here touches the network, ClickUp, or an AI provider — every
 * collaborator is injected. Real git repositories are created in temp dirs so the
 * git plumbing is exercised for real rather than mocked.
 */
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DailyScanner } from "./DailyScanner.js";
import type { DailyScannerDeps } from "./DailyScanner.js";
import { ScanRegistry } from "./ScanRegistry.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import { GitWorkAnalyzer } from "../services/GitWorkAnalyzer.js";
import { HeuristicCommitGrouper } from "../grouping/HeuristicCommitGrouper.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import type { ClickUpService } from "../services/ClickUpService.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";
import type { ClickUpConfig } from "../types/index.js";

const DATE = "2026-08-04";

let root: string;
let dbDir: string;
let originalCwd: string;
let db: TestDatabase;
let registry: ScanRegistry;
let created: string[];
let statuses: string[];

function run(cwd: string, args: string[], env: Record<string, string> = {}): void {
  execFileSync("git", args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" });
}

function commitIn(path: string, message: string, email: string, branch?: string): void {
  if (branch) run(path, ["checkout", "-q", "-b", branch]);
  writeFileSync(join(path, `${message.replace(/\W+/g, "-")}.ts`), "export const x = 1;\n");
  run(path, ["add", "-A"]);
  run(
    path,
    [
      "-c", `user.email=${email}`,
      "-c", "user.name=Dev",
      "commit", "-q", "-m", message, `--date=${DATE}T12:00:00`,
    ],
    { GIT_COMMITTER_DATE: `${DATE}T12:00:00` }
  );
}

function makeRepo(name: string, remote: string): string {
  const path = join(root, name);
  mkdirSync(path, { recursive: true });
  run(path, ["init", "-q", "-b", "main"]);
  run(path, ["remote", "add", "origin", remote]);
  return path;
}

const CONFIG: ClickUpConfig = { teamId: "t", apiKey: "unused", projectName: "test" };

function stubResolver(): DestinationResolver {
  return {
    resolve: (_userId: string, destinationId?: string, templateId?: string) => ({
      destination: destinationId ? { id: destinationId, name: destinationId } : null,
      clickUp: {
        createTask: async (task: { name: string }) => {
          created.push(task.name);
          return { id: `task-${created.length}`, name: task.name, url: "http://x" };
        },
        getListStatuses: async () => statuses,
      } as unknown as ClickUpService,
      listId: "list-1",
      template: BUILTIN_TEMPLATES.find((t) => t.id === (templateId || "builtin-standard"))!,
      config: CONFIG,
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

before(async () => {
  // The registry is on Postgres; GitWorkAnalyzer's HistoryService still writes
  // SQLite under process.cwd()/.database, hence both a fixture and a temp dir.
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  originalCwd = process.cwd();
  root = mkdtempSync(join(tmpdir(), "awa-scan-root-"));
  dbDir = mkdtempSync(join(tmpdir(), "awa-scan-db-"));
  process.chdir(dbDir);

  // processed_commits too: the scanner dedups on it, so a commit left behind by
  // the previous test makes the next one find nothing to do and fail with a
  // confusing "expected a create attempt".
  await db.sql`
    TRUNCATE scan_settings, scanned_repos, scan_runs,
             processed_commits, work_items, analysis_history CASCADE
  `;
  registry = new ScanRegistry(db);
  await registry.saveSettings("user-1", { root, owner: "kailasa-ngpt", enabled: true });
  created = [];
  statuses = ["to do", "complete"];
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
    assert.ok(summary.repos[0]!.tasksCreated > 0, `expected a task, got ${JSON.stringify(summary.repos[0])}`);
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

    let attempts = 0;
    const summary = await scanner({
      analyzerFactory: (projectPath: string) => {
        attempts += 1;
        if (projectPath.endsWith("zeta")) {
          return {
            analyzeWork: async () => {
              throw new Error("boom");
            },
          } as unknown as GitWorkAnalyzer;
        }
        return new GitWorkAnalyzer(projectPath);
      },
    }).run("user-1", { date: DATE });

    assert.equal(attempts, 2, "both repos must be attempted");
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

    await registry.saveSettings("user-1", {
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
    run(path, ["checkout", "-q", "main"]);

    const summary = await scanner().run("user-1", { date: DATE });

    assert.equal(summary.repos[0]!.commits, 2, "a non-checked-out branch must be scanned");
  });

  test("a disabled repo binding is skipped", async () => {
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");
    await registry.saveBinding("user-1", "kailasa-ngpt/alpha", { enabled: false });

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
          destination: null as { id: string; name: string } | null,
          clickUp: {
            createTask: async (task: { name: string; tags?: string[] }) => {
              tags.push(task.tags ?? []);
              return { id: "t", name: task.name, url: "u" };
            },
            getListStatuses: async () => statuses,
          } as unknown as ClickUpService,
          listId: "list-1",
          template: BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!,
          config: CONFIG,
        }),
      } as unknown as DestinationResolver,
    }).run("user-1", { date: DATE });

    assert.ok(
      tags.some((t) => t.includes("kailasa-ngpt/alpha")),
      `expected the slug tag, got ${JSON.stringify(tags)}`
    );
  });

  test("maps a status the target list does not define instead of sending it", async () => {
    // Git items carry status "complete". A list that does not define it answers
    // 400 "Status not found" and rejects every task, so the status must be
    // dropped rather than sent.
    const path = makeRepo("alpha", "git@github.com:kailasa-ngpt/alpha.git");
    commitIn(path, "feat: add the alpha thing", "dev@example.com");
    statuses = ["researching", "developing"];

    const sent: Array<string | undefined> = [];
    await new DailyScanner({
      registry,
      grouper: new HeuristicCommitGrouper(),
      fetchRepo: async () => {},
      resolver: {
        resolve: () => ({
          destination: null as { id: string; name: string } | null,
          clickUp: {
            createTask: async (task: { name: string; status?: string }) => {
              sent.push(task.status);
              return { id: "t", name: task.name, url: "u" };
            },
            getListStatuses: async () => statuses,
          } as unknown as ClickUpService,
          listId: "list-1",
          template: BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!,
          config: CONFIG,
        }),
      } as unknown as DestinationResolver,
    }).run("user-1", { date: DATE });

    assert.ok(sent.length > 0, "expected a create attempt");
    for (const status of sent) {
      assert.equal(status, undefined, `unmatched status must be dropped, got ${status}`);
    }
  });
});
