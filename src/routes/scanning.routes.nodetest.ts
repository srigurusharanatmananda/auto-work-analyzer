/**
 * Runs under `tsx --test`: `authenticate` constructs a real AuthService, which
 * opens better-sqlite3. Own temp cwd, because DatabaseService writes to
 * process.cwd()/.database.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createScanningRouter } from "./scanning.routes.js";
import { ScanLeaseStore } from "../scanning/ScanLeaseStore.js";
import { ScanRegistry } from "../scanning/ScanRegistry.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import { createTestUser } from "../testing/authFixture.js";
import type { DailyScanner, ScanRunSummary } from "../scanning/DailyScanner.js";

const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-scanroutes-"));
process.chdir(tmpDbDir);

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let authHeader: string;
/** The caller's id — the leases in these tests must be filed against them. */
let userId: string;
let db: TestDatabase;
let registry: ScanRegistry;
let runCalls: Array<{ userId: string; date: string; dryRun?: boolean }>;

before(async () => {
  db = await createTestDatabase();
  registry = new ScanRegistry(db);
  runCalls = [];

  const scanner = {
    run: async (userId: string, opts: { date: string; dryRun?: boolean }) => {
      runCalls.push({ userId, ...opts });
      const summary: ScanRunSummary = {
        date: opts.date,
        dryRun: opts.dryRun === true,
        repos: [],
        skipped: [],
        totalTasksCreated: 0,
      };
      return summary;
    },
  } as unknown as DailyScanner;

  const app = express();
  app.use(express.json());
  app.use(
    "/api/scanning",
    createScanningRouter({
      registry,
      scanner,
      // Pointed at the test schema, exactly as `registry` is. A router left to
      // build its own store reaches for the global pool — a different database
      // entirely, and the failure mode is a hang rather than an error.
      leases: new ScanLeaseStore({ sql: db }),
      owner: "test-request",
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
  // A real user row, not just a signature: `authenticate` re-reads the user on
  // every request, so a token for an id that exists in no users table is
  // correctly rejected.
  const user = await createTestUser();
  authHeader = user.authHeader;
  userId = user.userId;
});

after(async () => {
  server.close();
  registry.close();
  await db?.drop();
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
    for (const path of ["/settings", "/repos", "/last-run"]) {
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

    const stored = (await registry.getBinding("user-1", "kailasa-ngpt/alpha"))!;
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
    runCalls.length = 0;
    const res = await authed("/run", {
      method: "POST",
      body: JSON.stringify({ date: "04-08-2026" }),
    });
    assert.equal(res.status, 400);
    assert.equal(runCalls.length, 0, "nothing may be scanned on a rejected date");
  });
});

describe("POST /run — not while another scan holds the day", () => {
  /**
   * Dates that no other test in this file touches.
   *
   * Not fussiness: the first version of these used today's date, which an
   * earlier test had already scanned and COMPLETED. The setup claim then
   * silently returned false, nothing was held, and the assertion failed for a
   * reason that had nothing to do with the code. Hence `hold()` asserting that
   * the claim it just made actually took.
   */
  const HELD = "2026-08-11";
  const FINISHED = "2026-08-12";
  const PREVIEWED = "2026-08-13";
  const CONTESTED = "2026-08-14";

  /** Claims a day as if a scheduler in another process were scanning it. */
  async function hold(scanDate: string, complete = false): Promise<ScanLeaseStore> {
    const store = new ScanLeaseStore({ sql: db });
    assert.equal(
      await store.claim(userId, scanDate, "the-scheduler"),
      true,
      `setup failed: could not claim ${scanDate}`
    );
    if (complete) await store.complete(userId, scanDate, "the-scheduler");
    return store;
  }

  const run = (body: unknown) =>
    fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    });

  /**
   * The hole the scheduler's lease left open.
   *
   * Two schedulers can no longer scan one day twice — but one scheduler and one
   * impatient person could, and the manual button is the easiest way to reach
   * it. Both scans create every task, because dedup reads `processed_commits`
   * before either has written.
   */
  test("refuses with 409 while the scheduler holds the day", async () => {
    await hold(HELD);

    const before = runCalls.length;
    const response = await run({ date: HELD });

    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /already running/);
    assert.equal(runCalls.length, before, "the scan must not have run at all");
  });

  /**
   * A deliberate re-run, usually straight after fixing the settings that made
   * the first one wrong. The completed row must not block this forever.
   */
  test("allows re-running a day that already finished", async () => {
    await hold(FINISHED, true);

    const before = runCalls.length;
    const response = await run({ date: FINISHED });

    assert.equal(response.status, 200);
    assert.equal(runCalls.length, before + 1);
  });

  /**
   * A dry run creates nothing, so it takes no lease at all. Leasing it would
   * let a preview block the real scan behind it — and a dry run that
   * "completed" the day would stop the scan about to do the actual work.
   */
  test("a dry run is allowed even while the day is held, and claims nothing", async () => {
    await hold(PREVIEWED);

    const response = await run({ date: PREVIEWED, dryRun: true });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.dryRun, true);

    // The scheduler still owns the day; the preview did not touch the claim.
    const rows = await db.sql<Array<{ owner: string }>>`
      SELECT owner FROM scan_leases WHERE user_id = ${userId} AND scan_date = ${PREVIEWED}
    `;
    assert.equal(rows[0]?.owner, "the-scheduler");
  });

  /** Two people hitting the button at once is the same race, from one process. */
  test("two simultaneous manual runs scan the day once", async () => {
    const before = runCalls.length;

    const [a, b] = await Promise.all([run({ date: CONTESTED }), run({ date: CONTESTED })]);
    const statuses = [a.status, b.status].sort();

    assert.deepEqual(statuses, [200, 409]);
    assert.equal(runCalls.length, before + 1);
  });
});
