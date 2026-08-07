/**
 * Coverage for GitWorkAnalyzer.createTasksFromWork — the legacy `{workAnalysis}`
 * creation path, both with and without a template.
 *
 * Runs under `tsx --test` (Node), not `bun test`: constructing a
 * GitWorkAnalyzer builds a HistoryService, which builds a DatabaseService,
 * which opens better-sqlite3 — and `bun test` dies on the import with
 * "'better-sqlite3' is not yet supported in Bun" (verified by probe).
 *
 * Two seams, neither of them a production API change:
 *   - `globalThis.fetch` is stubbed, so ClickUpService is exercised for real but
 *     never reaches the network. Every request payload is recorded, which is
 *     what lets these tests assert on the *created task*, not just on the render.
 *   - the analyzer's private `historyService` is swapped for a recorder after
 *     construction, so no row is written and `markCommitsAsProcessed`'s
 *     taskMapping — the thing finding I1 is about — becomes observable.
 *
 * `process.chdir` into a temp dir first because DatabaseService hardcodes
 * `process.cwd()/.database`; the swap above happens too late to stop the
 * constructor from opening a file.
 */

import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { GitWorkAnalyzer } from "./GitWorkAnalyzer.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { DEFAULT_TEMPLATE_OPTIONS } from "../formatting/Template.js";
import type { Template } from "../formatting/Template.js";
import type { ClickUpConfig, GitCommit, WorkAnalysisResult } from "../types/index.js";

const CONFIG: ClickUpConfig = {
  apiKey: "unused-in-tests",
  teamId: "team-1",
  defaultListId: "list-1",
  projectName: "auto-work-analyzer",
};

function builtin(id: string): Template {
  const template = BUILTIN_TEMPLATES.find((t) => t.id === id);
  assert.ok(template, `no builtin template ${id}`);
  return template;
}

function commit(hash: string, date: string, message: string): GitCommit {
  return {
    hash,
    author: "dev@example.com",
    date,
    message,
    files: ["a.ts"],
    insertions: 5,
    deletions: 1,
  };
}

/** Two same-type items, so a `{{typeLabel}}` name collapses them onto one string. */
function analysisWithTwoItems(names: [string, string]): WorkAnalysisResult {
  return {
    date: "2026-08-01",
    totalCommits: 2,
    totalFilesChanged: 2,
    totalLinesAdded: 10,
    totalLinesDeleted: 2,
    summary: "Two things happened.",
    detectedWork: [
      {
        type: "feature",
        name: names[0],
        description: "First description.",
        files: ["one.ts"],
        complexity: "high",
        estimatedHours: 2,
        tags: ["mobile"],
        commits: [commit("aaa1110000", "2026-07-27", "feat: one")],
      },
      {
        type: "feature",
        name: names[1],
        description: "Second description.",
        files: ["two.ts"],
        complexity: "low",
        estimatedHours: 1,
        tags: [],
        commits: [commit("bbb2220000", "2026-07-28", "feat: two")],
      },
    ],
  };
}

interface HistoryRecorder {
  analyses: number;
  workItems: unknown[][];
  markCalls: {
    commits: GitCommit[];
    projectPath: string;
    /** Whose dedup ledger the analyzer wrote to. */
    userId: string;
    taskMapping: Map<string, { id: string; name: string }>;
  }[];
}

interface FetchRecorder {
  /** Top-level task creations, in the order ClickUp received them. */
  tasks: Record<string, any>[];
  /** Subtask creations (they carry a `parent`), kept separate. */
  subtasks: Record<string, any>[];
}

let dir: string;
let originalCwd: string;
let originalFetch: typeof globalThis.fetch;
let analyzer: GitWorkAnalyzer;
let history: HistoryRecorder;
let requests: FetchRecorder;

beforeEach(() => {
  originalCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "awa-analyzer-"));
  process.chdir(dir);

  analyzer = new GitWorkAnalyzer(dir);

  history = { analyses: 0, workItems: [], markCalls: [] };
  (analyzer as any).historyService = {
    addAnalysisHistory: () => {
      history.analyses += 1;
      return `analysis-${history.analyses}`;
    },
    saveWorkItem: (...args: unknown[]) => {
      history.workItems.push(args);
    },
    // Positional order matters: `userId` sits BEFORE `taskMapping`, and a stub
    // left on the old signature silently records the Map as the user id and
    // undefined as the mapping — which is how these four tests failed.
    markCommitsAsProcessed: (
      commits: GitCommit[],
      projectPath: string,
      userId: string,
      taskMapping: Map<string, { id: string; name: string }>
    ) => {
      history.markCalls.push({ commits, projectPath, userId, taskMapping });
    },
  };

  requests = { tasks: [], subtasks: [] };
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const payload = JSON.parse(init.body) as Record<string, any>;
    if (payload.parent) {
      requests.subtasks.push(payload);
    } else {
      requests.tasks.push(payload);
    }
    const id = payload.parent
      ? `sub-${requests.subtasks.length}`
      : `task-${requests.tasks.length}`;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ id, name: payload.name }),
      text: async () => "",
    };
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.chdir(originalCwd);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

/** Everything after the `📊 Daily Work Summary` parent, in creation order. */
function individualTaskPayloads(): Record<string, any>[] {
  return requests.tasks.slice(1);
}

describe("createTasksFromWork with a template", () => {
  test("formats the individual tasks with the template, not the old inline logic", async () => {
    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    const created = await analyzer.createTasksFromWork(analysis, CONFIG, 1, {
      template: builtin("builtin-terse"),
    });

    // N + 1: the summary parent is still created.
    assert.equal(created.length, 3);
    const individual = individualTaskPayloads();
    assert.equal(individual.length, 2);

    // builtin-terse is `{{title}}` / `{{description}}` with no tags — the old
    // inline path would have produced "✅ Add the meditation timer".
    assert.equal(individual[0].name, "Add the meditation timer");
    assert.equal(individual[0].description, "First description.");
    assert.deepEqual(individual[0].tags, []);
  });

  /**
   * batchSize 1 makes `renderedTasks[i + batchIndex]` load-bearing: with two
   * items there are two batches, so a `renderedTasks[batchIndex]` slip would
   * render item 0 twice and this assertion goes red.
   */
  test("pairs each work item with its own rendered task across batches", async () => {
    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, {
      template: builtin("builtin-terse"),
    });

    const individual = individualTaskPayloads();
    assert.equal(individual[0].name, "Add the meditation timer");
    assert.equal(individual[0].description, "First description.");
    assert.equal(individual[1].name, "Add the pranayama timer");
    assert.equal(individual[1].description, "Second description.");
  });

  /**
   * Finding I4. The old inline path set `status: "complete"` and four tags. Once
   * the route started passing a template unconditionally, this became the path
   * every HTTP {workAnalysis} body takes, so losing either is a functional
   * regression to a public endpoint — completed work landing in the ClickUp
   * list's default (open) status.
   */
  test("still sends status complete and the git provenance tags", async () => {
    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, {
      template: builtin("builtin-standard"),
    });

    const individual = individualTaskPayloads();
    assert.equal(individual[0].status, "complete");
    assert.deepEqual(individual[0].tags, ["feature", "git-analyzed", "2026-08-01", "mobile"]);
    assert.equal(individual[1].status, "complete");
    assert.deepEqual(individual[1].tags, ["feature", "git-analyzed", "2026-08-01"]);
  });

  test("keeps all three history calls firing exactly once", async () => {
    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, {
      template: builtin("builtin-terse"),
    });

    assert.equal(history.analyses, 1);
    assert.equal(history.workItems.length, 2);
    assert.equal(history.markCalls.length, 1);
    assert.deepEqual(
      history.markCalls[0].commits.map((c) => c.hash),
      ["aaa1110000", "bbb2220000"]
    );
  });

  /**
   * Finding I1, scenario B — and it is reachable with a BUILT-IN template, no
   * template picker required: two work items sharing a 30-character prefix.
   * `createdTasks.find(t => t.name.includes(work.name.substring(0, 30)))`
   * returns the FIRST match for both, so item 1's commits were recorded against
   * item 0's ClickUp task id.
   */
  test("maps commits to their own task when two work items share a 30-char prefix", async () => {
    const analysis = analysisWithTwoItems([
      "Stabilize the meditation player layout",
      "Stabilize the meditation player layout v2",
    ]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, {
      template: builtin("builtin-standard"),
    });

    const mapping = history.markCalls[0].taskMapping;
    assert.equal(mapping.get("aaa1110000")?.id, "task-2");
    assert.equal(mapping.get("bbb2220000")?.id, "task-3");
  });

  /**
   * Finding I1, scenario A: a template whose nameTemplate drops `{{title}}`
   * collapses every task onto one name, so the name match found nothing at all
   * and the commit→task link vanished from processed_commits — silently, with
   * markCommitsAsProcessed still writing every commit with taskId undefined.
   */
  test("maps commits to their own task when the template drops the title", async () => {
    const collapsing: Template = {
      id: "user-collapsing",
      name: "Type only",
      description: "Names every task after its type.",
      nameTemplate: "{{typeLabel}}",
      descriptionTemplate: "{{description}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
      isBuiltin: false,
    };

    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, { template: collapsing });

    const individual = individualTaskPayloads();
    assert.equal(individual[0].name, "New Feature");
    assert.equal(individual[1].name, "New Feature");

    const mapping = history.markCalls[0].taskMapping;
    assert.equal(mapping.size, 2);
    assert.equal(mapping.get("aaa1110000")?.id, "task-2");
    assert.equal(mapping.get("bbb2220000")?.id, "task-3");
  });
});

describe("createTasksFromWork without a template", () => {
  /**
   * The seven non-HTTP callers (cli.ts ×4, index.ts and its exported wrapper,
   * webhook-server.ts ×2) pass no opts and must keep the pre-template output
   * byte for byte.
   */
  test("keeps the old inline formatting", async () => {
    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    const created = await analyzer.createTasksFromWork(analysis, CONFIG, 1);

    assert.equal(created.length, 3);
    const individual = individualTaskPayloads();
    assert.equal(individual[0].name, "✅ Add the meditation timer");
    assert.equal(individual[0].description, "First description.");
    assert.equal(individual[0].status, "complete");
    assert.deepEqual(individual[0].tags, ["feature", "git-analyzed", "2026-08-01", "mobile"]);
    assert.equal(individual[0].time_estimate, 2 * 60 * 60 * 1000);
    assert.equal(individual[0].due_date, new Date("2026-07-27").getTime());
  });

  test("still maps commits to their created tasks", async () => {
    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1);

    const mapping = history.markCalls[0].taskMapping;
    assert.equal(mapping.get("aaa1110000")?.id, "task-2");
    assert.equal(mapping.get("bbb2220000")?.id, "task-3");
  });

  /**
   * The name-collision mis-attribution needs no template at all — it was never
   * specific to the rendered path. `name.includes(name.substring(0, 30))` makes
   * the shorter name a prefix of the longer one, so `find` returned item 0's
   * task for item 1's commits and those commits were recorded in
   * processed_commits against the wrong ClickUp task id, silently. This is the
   * path every non-HTTP caller uses (cli.ts, webhook-server.ts, the exported
   * createTasksFromWork wrapper), so it was a live data-correctness bug there.
   */
  test("maps commits to their own task when two names collide, with no template", async () => {
    const analysis = analysisWithTwoItems([
      "Stabilize the meditation player layout",
      "Stabilize the meditation player layout v2",
    ]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1);

    const mapping = history.markCalls[0].taskMapping;
    assert.equal(
      mapping.get("bbb2220000")?.id,
      "task-3",
      "item 1's commit must map to item 1's task, not item 0's"
    );
    assert.equal(mapping.get("aaa1110000")?.id, "task-2");
  });
});

describe("createTasksFromWork repository threading", () => {
  /**
   * Finding I2: /api/preview-tasks passes `repository` into
   * workItemsFromAnalysis, but the create path did not, so a template using
   * {{repository}} previewed the repo name and then created an empty string —
   * the preview/created divergence Task 9A exists to remove.
   */
  test("a {{repository}} template renders the repository on the create path", async () => {
    const repoTemplate: Template = {
      id: "user-repo",
      name: "With repo",
      description: "Puts the repository in the description.",
      nameTemplate: "{{title}}",
      descriptionTemplate: "{{description}}\n\nRepo: {{repository}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
      isBuiltin: false,
    };

    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, {
      template: repoTemplate,
      repository: "kailasa-ngpt/ask_nithyananda_app",
    });

    const individual = individualTaskPayloads();
    assert.match(individual[0].description, /Repo: kailasa-ngpt\/ask_nithyananda_app/);
  });

  test("omitting repository still renders, leaving the placeholder empty", async () => {
    const repoTemplate: Template = {
      id: "user-repo",
      name: "With repo",
      description: "Puts the repository in the description.",
      nameTemplate: "{{title}}",
      descriptionTemplate: "Repo: {{repository}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
      isBuiltin: false,
    };

    const analysis = analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

    await analyzer.createTasksFromWork(analysis, CONFIG, 1, { template: repoTemplate });

    assert.equal(individualTaskPayloads()[0].description, "Repo:");
  });
});

/**
 * Slice 2's headline fix had no test at all: nothing in src/ mentioned
 * `availableStatuses` or `mapRenderedStatuses` outside the two files that
 * implement them. It matters because on the real list slice 2 browsed
 * ([researching, developing, testing, deployed]) EVERY create failed before the
 * fix — ClickUp answers 400 "Status not found" for a status a list does not
 * define — and the e2e missed it because a freshly created list happens to
 * include "complete".
 */
describe("createTasksFromWork status mapping", () => {
  const analysis = () =>
    analysisWithTwoItems(["Add the meditation timer", "Add the pranayama timer"]);

  test("rewrites the status to the list's real name", async () => {
    await analyzer.createTasksFromWork(analysis(), CONFIG, 1, {
      template: builtin("builtin-standard"),
      availableStatuses: ["researching", "Closed"],
    });

    // Git items carry status "complete", which is a synonym of "closed", so the
    // payload must carry the list's own capitalisation rather than "complete" —
    // ClickUp rejects a status the list does not define, and the list here does
    // not define "complete".
    for (const payload of individualTaskPayloads()) {
      assert.equal(payload.status, "Closed");
    }
  });

  test("omits the status entirely when the list defines nothing close", async () => {
    await analyzer.createTasksFromWork(analysis(), CONFIG, 1, {
      template: builtin("builtin-standard"),
      // Neither is a synonym of "complete", and both are far outside the fuzzy
      // threshold, so the mapper must refuse to guess.
      availableStatuses: ["researching", "developing"],
    });

    for (const payload of individualTaskPayloads()) {
      assert.ok(
        !("status" in payload),
        `status must be absent so ClickUp applies the list default, got ${JSON.stringify(payload.status)}`
      );
    }
  });

  test("an empty status list drops the status rather than sending it", async () => {
    // [] means "read the list, it defines no statuses" — distinct from null
    // ("could not read"). Conflating them made the preview promise a dropped
    // status while the create sent it anyway.
    await analyzer.createTasksFromWork(analysis(), CONFIG, 1, {
      template: builtin("builtin-standard"),
      availableStatuses: [],
    });

    for (const payload of individualTaskPayloads()) {
      assert.ok(!("status" in payload), "an empty status list must drop the status");
    }
  });

  test("omitting availableStatuses leaves the status untouched", async () => {
    // The pre-slice-2 path: unknown statuses, so send what we rendered.
    await analyzer.createTasksFromWork(analysis(), CONFIG, 1, {
      template: builtin("builtin-standard"),
    });

    for (const payload of individualTaskPayloads()) {
      assert.equal(payload.status, "complete");
    }
  });
});
