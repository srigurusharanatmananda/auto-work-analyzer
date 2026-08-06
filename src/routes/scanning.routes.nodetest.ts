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
  authHeader = (await createTestUser()).authHeader;
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
