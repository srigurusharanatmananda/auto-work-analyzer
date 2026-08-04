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
