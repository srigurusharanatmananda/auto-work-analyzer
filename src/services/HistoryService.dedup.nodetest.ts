/**
 * Runs against a real Postgres schema of its own, under `tsx --test`.
 *
 * DatabaseService no longer opens a file under `process.cwd()/.database`, so
 * the temp-cwd dance this used for isolation is gone; the fixture provides it.
 */
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { HistoryService } from "./HistoryService.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
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

let db: TestDatabase;
let history: HistoryService;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.sql`TRUNCATE processed_commits`;
  history = new HistoryService(db);
});

afterEach(() => {
  history.close();
});

describe("commit dedup keys on the hash alone", () => {
  /**
   * The bug: `hash` is the PRIMARY KEY, so a hash exists at most once — but the
   * predicate also filtered on project_path and writes used INSERT OR REPLACE.
   * Two clones of one repo flip-flopped forever, each run re-creating the
   * other's commits, with nothing thrown and nothing logged.
   */
  test("a commit recorded under one path is processed when queried under another", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");

    assert.equal(await history.isCommitProcessed("abc1230000", "/clone/one"), true);
    assert.equal(
      await history.isCommitProcessed("abc1230000", "/clone/two"),
      true,
      "a second clone must not re-create tasks for a commit already processed"
    );
  });

  test("filterUnprocessedCommits drops it regardless of the path passed", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");

    assert.deepEqual(await history.filterUnprocessedCommits([commit("abc1230000")], "/clone/two"), []);
    assert.deepEqual(await history.filterUnprocessedCommits([commit("abc1230000")]), []);
  });

  test("recording under a second path does not un-process the first", async () => {
    // INSERT OR REPLACE rewrites the single row; with the path out of the
    // predicate that no longer matters, which is the whole point.
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/two");

    assert.equal(await history.isCommitProcessed("abc1230000", "/clone/one"), true);
    assert.equal(await history.isCommitProcessed("abc1230000", "/clone/two"), true);
  });

  test("an unrecorded commit is still unprocessed", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one");

    assert.equal(await history.isCommitProcessed("zzz9990000", "/clone/one"), false);
    assert.deepEqual(
      (await history.filterUnprocessedCommits([commit("abc1230000"), commit("zzz9990000")])).map(
        (c) => c.hash
      ),
      ["zzz9990000"]
    );
  });
});
