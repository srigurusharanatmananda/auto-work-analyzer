/**
 * Commit dedup: keyed on (user, hash), never on the path.
 *
 * Runs against a real Postgres schema of its own, under `tsx --test`.
 *
 * Two independent rules are tested here and they pull in opposite directions,
 * which is why both need pinning:
 *
 *  - The PATH is not part of the identity. Two clones of one repository must
 *    dedup against each other, or the same commit is filed twice.
 *  - The USER is. "Already filed" is a claim about somebody's ClickUp list, and
 *    one person's list containing a task says nothing about another's.
 */
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { HistoryService } from "./HistoryService.js";
import { LEGACY_COMMIT_OWNER } from "../db/schema.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import type { GitCommit } from "../types/index.js";

const ALICE = "user-alice";
const BOB = "user-bob";

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

describe("the repository path is not part of the identity", () => {
  /**
   * The bug this pins: the predicate filtered on project_path while writes used
   * INSERT OR REPLACE, so two clones of one repo flip-flopped forever, each run
   * re-creating the other's commits, with nothing thrown and nothing logged.
   */
  test("a commit recorded under one path is processed when queried under another", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one", ALICE);

    assert.equal(await history.isCommitProcessed("abc1230000", ALICE), true);
    assert.deepEqual(
      await history.filterUnprocessedCommits([commit("abc1230000")], ALICE, "/clone/two"),
      [],
      "a second clone must not re-create tasks for a commit already processed"
    );
  });

  test("recording under a second path does not un-process the first", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one", ALICE);
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/two", ALICE);

    assert.equal(await history.isCommitProcessed("abc1230000", ALICE), true);
  });

  test("an unrecorded commit is still unprocessed", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/clone/one", ALICE);

    assert.equal(await history.isCommitProcessed("zzz9990000", ALICE), false);
    assert.deepEqual(
      (
        await history.filterUnprocessedCommits(
          [commit("abc1230000"), commit("zzz9990000")],
          ALICE
        )
      ).map((c) => c.hash),
      ["zzz9990000"]
    );
  });
});

describe("the user IS part of the identity", () => {
  /**
   * The change this file exists to pin. Dedup used to be global, so the first
   * person to scan a shared repository consumed every commit and everyone else
   * got an empty report with no indication why.
   */
  test("one user's filing does not mark it processed for another", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/repo", ALICE);

    assert.equal(await history.isCommitProcessed("abc1230000", ALICE), true);
    assert.equal(
      await history.isCommitProcessed("abc1230000", BOB),
      false,
      "Bob has no such task in his list, so the commit is still his to file"
    );
  });

  test("both users can file the same commit, and each is recorded once", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/repo", ALICE);
    await history.markCommitsAsProcessed([commit("abc1230000")], "/repo", BOB);

    assert.equal(await history.isCommitProcessed("abc1230000", ALICE), true);
    assert.equal(await history.isCommitProcessed("abc1230000", BOB), true);

    const [{ count }] = await db.sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM processed_commits WHERE hash = 'abc1230000'
    `;
    assert.equal(count, "2", "one row per owner, and re-filing must not add more");
  });

  /** A second run for the same user is still a no-op — upsert, not insert. */
  test("re-filing for the same user does not add a row", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/repo", ALICE);
    await history.markCommitsAsProcessed([commit("abc1230000")], "/repo", ALICE);

    const [{ count }] = await db.sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM processed_commits WHERE hash = 'abc1230000'
    `;
    assert.equal(count, "1");
  });

  test("filterUnprocessedCommits is scoped too", async () => {
    await history.markCommitsAsProcessed([commit("abc1230000")], "/repo", ALICE);

    assert.deepEqual(await history.filterUnprocessedCommits([commit("abc1230000")], ALICE), []);
    assert.deepEqual(
      (await history.filterUnprocessedCommits([commit("abc1230000")], BOB)).map((c) => c.hash),
      ["abc1230000"]
    );
  });

  test("getProcessedCommits returns only the caller's rows", async () => {
    await history.markCommitsAsProcessed([commit("aaa1110000")], "/repo", ALICE);
    await history.markCommitsAsProcessed([commit("bbb2220000")], "/repo", BOB);

    assert.deepEqual((await history.getProcessedCommits(ALICE)).map((c) => c.hash), [
      "aaa1110000",
    ]);
  });
});

describe("rows written before scoping", () => {
  /**
   * Legacy rows record only that a commit was filed at all — by whom is
   * unrecoverable. If they counted for nobody, the first scan after the
   * migration would re-file the entire history as new work: hundreds of
   * duplicate ClickUp tasks, which is far worse than the alternative.
   */
  test("count as processed for everyone", async () => {
    await history.markCommitsAsProcessed([commit("old1230000")], "/repo", LEGACY_COMMIT_OWNER);

    assert.equal(await history.isCommitProcessed("old1230000", ALICE), true);
    assert.equal(await history.isCommitProcessed("old1230000", BOB), true);
  });

  test("do not stop a user recording their own row", async () => {
    await history.markCommitsAsProcessed([commit("old1230000")], "/repo", LEGACY_COMMIT_OWNER);
    await history.markCommitsAsProcessed([commit("old1230000")], "/repo", ALICE);

    const [{ count }] = await db.sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM processed_commits WHERE hash = 'old1230000'
    `;
    assert.equal(count, "2");
  });

  test("are included in a user's own listing", async () => {
    await history.markCommitsAsProcessed([commit("old1230000")], "/repo", LEGACY_COMMIT_OWNER);

    assert.deepEqual((await history.getProcessedCommits(ALICE)).map((c) => c.hash), [
      "old1230000",
    ]);
  });
});
