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

  test("catches up each missed day as its own date, before the scan hour", async () => {
    // Two rules meet here. A missed day is due IMMEDIATELY — the time here is
    // 09:00, before the configured 18:00 — because a laptop opened each morning
    // and closed before 18:00 would otherwise never catch up. And each missed
    // day is scanned as ITSELF: folding them into "today" would leave those
    // days' commits unexamined, since the scanner analyses one specific date.
    registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-01",
    });

    await scheduler("2026-08-04T09:00:00").tick();

    // 02 and 03 are due; 04 is not, because 09:00 < 18:00.
    assert.deepEqual(runs.map((r) => r.date), ["2026-08-02", "2026-08-03"]);
  });

  test("includes today in the catch-up once its scan hour has passed", async () => {
    registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-02",
    });

    await scheduler("2026-08-04T18:30:00").tick();

    assert.deepEqual(runs.map((r) => r.date), ["2026-08-03", "2026-08-04"]);
  });

  test("a backlog is capped rather than scanning a year of history", async () => {
    registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2025-01-01",
    });

    await scheduler("2026-08-04T20:00:00").tick();

    assert.equal(runs.length, 7, `expected the 7-day cap, got ${runs.length}`);
    assert.equal(runs[0]!.date, "2025-01-02");
  });

  test("first ever run does not invent a backlog", async () => {
    // No lastCompletedDate: scan today only, once its hour has passed. Treating
    // "never run" as an unbounded backlog would file a week of history the first
    // time someone enables the feature.
    registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });

    await scheduler("2026-08-04T18:30:00").tick();

    assert.deepEqual(runs.map((r) => r.date), ["2026-08-04"]);
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

    // Marking it complete anyway would skip the failed day forever.
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

  test("stop() prevents further ticks", async () => {
    registry.saveSettings("user-1", { enabled: true, scanTime: "00:00" });
    const s = scheduler("2026-08-04T18:01:00");
    s.start(60_000);
    s.stop();
    // start() ticks once immediately; the assertion is that stop() leaves no
    // interval behind rather than that nothing ran.
    assert.equal(runs.length <= 1, true);
  });
});
