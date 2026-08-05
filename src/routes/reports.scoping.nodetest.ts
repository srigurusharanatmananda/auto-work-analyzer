/**
 * Cross-user isolation for saved analyses.
 *
 * `analysis_history` had no owner column, so GET /api/reports, /api/reports/:id
 * and /api/history returned every user's rows to any authenticated caller. On
 * the commit before the fix, the first test in "one user's reports are not
 * another's" fails by returning two reports instead of one — and it is worth
 * being precise about why it is the interesting one: a naive version of this
 * test passes on the broken code, because with a single user in the database
 * "all reports" and "my reports" are the same set. Two users are the whole
 * point.
 *
 * Runs under `tsx --test` (Node), not `bun test`: better-sqlite3 cannot run
 * under Bun (oven-sh/bun#4290). Own temp cwd, because DatabaseService and
 * AuthDatabaseService both resolve their file from process.cwd().
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createReportsRouter } from "./reports.routes.js";
import { DatabaseService } from "../services/DatabaseService.js";
import { createTestUser } from "../testing/authFixture.js";
import { resetSharedAuthService } from "../services/AuthService.js";

const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-reports-"));
process.chdir(tmpDbDir);

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;

let alice: ReturnType<typeof createTestUser>;
let bob: ReturnType<typeof createTestUser>;
let admin: ReturnType<typeof createTestUser>;

before(() => {
  const app = express();
  app.use(express.json());
  app.use("/api", createReportsRouter());

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api`;

  alice = createTestUser({ userId: "alice", role: "user" });
  bob = createTestUser({ userId: "bob", role: "user" });
  admin = createTestUser({ userId: "root", role: "admin" });
});

after(() => {
  server.close();
  resetSharedAuthService();
  process.chdir(originalCwd);
  rmSync(tmpDbDir, { recursive: true, force: true });
});

beforeEach(() => {
  const db = new DatabaseService();
  try {
    db.clearAllData();
  } finally {
    db.close();
  }
});

async function call(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

/** Saves a one-item report as the given user and returns its analysis id. */
async function saveReport(user: ReturnType<typeof createTestUser>, name: string) {
  const result = await call("POST", "/save-report", user.authHeader, {
    projectPath: `/repos/${user.userId}`,
    date: "2026-08-05",
    workItems: [{ name, type: "feature", estimatedHours: 1 }],
    summary: { summary: name, totalCommits: 1 },
  });

  assert.equal(result.status, 200, `save failed: ${JSON.stringify(result.body)}`);
  return result.body.data.analysisId as string;
}

/** Writes a row with no owner, as the pre-column data and the webhook do. */
function saveUnownedReport(id: string): void {
  const db = new DatabaseService();
  try {
    db.saveAnalysis({
      id,
      timestamp: new Date().toISOString(),
      projectPath: "/repos/legacy",
      date: "2026-01-01",
      totalCommits: 3,
      totalWorkItems: 1,
      tasksCreated: 0,
      summary: "written before analysis_history had an owner",
    });
  } finally {
    db.close();
  }
}

describe("one user's reports are not another's", () => {
  test("GET /reports returns only the caller's rows", async () => {
    await saveReport(alice, "alice's work");
    await saveReport(bob, "bob's work");

    const seen = await call("GET", "/reports", alice.authHeader);

    assert.equal(seen.status, 200);
    assert.equal(seen.body.data.reports.length, 1, "bob's report must not appear");
    assert.equal(seen.body.data.reports[0].analysis.summary, "alice's work");
  });

  test("the report count in the envelope is the caller's count too", async () => {
    await saveReport(alice, "alice's work");
    await saveReport(bob, "bob one");
    await saveReport(bob, "bob two");

    const seen = await call("GET", "/reports", alice.authHeader);

    // `total` comes from getStatistics, a separate query — scoping the list but
    // not the count would leak the existence of other users' work.
    assert.equal(seen.body.data.total, 1);
  });

  test("GET /reports/:id on someone else's report is 404, not 403", async () => {
    const bobsId = await saveReport(bob, "bob's work");

    const seen = await call("GET", `/reports/${bobsId}`, alice.authHeader);

    // 404 rather than 403 deliberately: a 403 would confirm the id exists and
    // turn the endpoint into an oracle for enumerating other people's reports.
    assert.equal(seen.status, 404);
  });

  test("the owner can still read their own report by id", async () => {
    const id = await saveReport(alice, "alice's work");

    const seen = await call("GET", `/reports/${id}`, alice.authHeader);

    assert.equal(seen.status, 200);
    assert.equal(seen.body.data.analysis.id, id);
    assert.equal(seen.body.data.workItems.length, 1);
  });

  test("GET /history is scoped, and so are its statistics", async () => {
    await saveReport(alice, "alice's work");
    await saveReport(bob, "bob's work");

    const seen = await call("GET", "/history", alice.authHeader);

    assert.equal(seen.status, 200);
    assert.equal(seen.body.data.history.length, 1);
    assert.equal(seen.body.data.statistics.totalAnalyses, 1);
  });

  test("a user with no reports sees an empty list, not everyone's", async () => {
    await saveReport(alice, "alice's work");
    await saveReport(bob, "bob's work");

    const seen = await call("GET", "/reports", admin.authHeader);
    const mine = seen.body.data.reports.filter(
      (r: any) => r.analysis.userId === "root"
    );

    assert.equal(mine.length, 0);
    // The admin sees no other user's reports either — the admin exception is
    // for unowned rows only, not for other people's work.
    assert.equal(seen.body.data.reports.length, 0);
  });
});

describe("rows with no owner", () => {
  test("are invisible to an ordinary user", async () => {
    saveUnownedReport("legacy-1");
    await saveReport(alice, "alice's work");

    const seen = await call("GET", "/reports", alice.authHeader);

    assert.equal(seen.body.data.reports.length, 1);
    assert.equal(seen.body.data.reports[0].analysis.summary, "alice's work");
  });

  test("are visible to an admin, so nothing is orphaned", async () => {
    saveUnownedReport("legacy-1");

    const seen = await call("GET", "/reports", admin.authHeader);

    assert.equal(seen.body.data.reports.length, 1);
    assert.equal(seen.body.data.reports[0].analysis.id, "legacy-1");
  });

  test("an admin can open one by id; an ordinary user gets 404", async () => {
    saveUnownedReport("legacy-1");

    assert.equal((await call("GET", "/reports/legacy-1", admin.authHeader)).status, 200);
    assert.equal((await call("GET", "/reports/legacy-1", alice.authHeader)).status, 404);
  });
});

describe("saving", () => {
  test("a saved report is stamped with the caller's id", async () => {
    const id = await saveReport(alice, "alice's work");

    const db = new DatabaseService();
    try {
      const row = db.getAnalysisById(id, { userId: "alice" });
      assert.equal(row?.userId, "alice");
    } finally {
      db.close();
    }
  });

  test("a missing required field is still a 400", async () => {
    const result = await call("POST", "/save-report", alice.authHeader, {
      date: "2026-08-05",
      workItems: [],
    });
    assert.equal(result.status, 400);
  });
});
