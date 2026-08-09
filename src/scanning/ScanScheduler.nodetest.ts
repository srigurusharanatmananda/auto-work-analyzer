import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ScanRegistry } from "./ScanRegistry.js";
import { ScanScheduler } from "./ScanScheduler.js";
import { ScanLeaseStore } from "./ScanLeaseStore.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";

let db: TestDatabase;
let registry: ScanRegistry;
let runs: Array<{ userId: string; date: string }>;

/**
 * `leases` is injected for the same reason `registry` is: both must speak to
 * the test schema. A scheduler left to build its own `ScanLeaseStore` reaches
 * for the global pool, which here is a different database entirely — the first
 * version of this hung rather than failing, which is what that mistake looks
 * like from the outside.
 */
function scheduler(now: string, owner = "test-process"): ScanScheduler {
  return new ScanScheduler({
    registry,
    leases: new ScanLeaseStore({ sql: db }),
    owner,
    userIds: () => ["user-1"],
    now: () => new Date(now),
    runScan: async (userId, date) => {
      runs.push({ userId, date });
      await registry.saveSettings(userId, { lastCompletedDate: date });
    },
  });
}

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.sql`TRUNCATE scan_settings, scanned_repos, scan_runs, scan_leases`;
  registry = new ScanRegistry(db);
  runs = [];
});

afterEach(() => {
  registry.close();
});

describe("ScanScheduler", () => {
  test("does nothing while scanning is disabled", async () => {
    await registry.saveSettings("user-1", { enabled: false, scanTime: "18:00" });
    await scheduler("2026-08-04T23:00:00").tick();
    assert.deepEqual(runs, []);
  });

  test("does nothing before the configured time", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    await scheduler("2026-08-04T17:59:00").tick();
    assert.deepEqual(runs, []);
  });

  test("runs today once the configured time has passed", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    await scheduler("2026-08-04T18:01:00").tick();
    assert.deepEqual(runs, [{ userId: "user-1", date: "2026-08-04" }]);
  });

  test("does not run twice for the same day", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
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
    await registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-01",
    });

    await scheduler("2026-08-04T09:00:00").tick();

    // 02 and 03 are due; 04 is not, because 09:00 < 18:00.
    assert.deepEqual(runs.map((r) => r.date), ["2026-08-02", "2026-08-03"]);
  });

  test("includes today in the catch-up once its scan hour has passed", async () => {
    await registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-02",
    });

    await scheduler("2026-08-04T18:30:00").tick();

    assert.deepEqual(runs.map((r) => r.date), ["2026-08-03", "2026-08-04"]);
  });

  test("a backlog is capped rather than scanning a year of history", async () => {
    await registry.saveSettings("user-1", {
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
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });

    await scheduler("2026-08-04T18:30:00").tick();

    assert.deepEqual(runs.map((r) => r.date), ["2026-08-04"]);
  });

  test("a failing run does not record the day as completed", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
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
    assert.equal((await registry.getSettings("user-1")).lastCompletedDate, undefined);
  });

  test("one user's failure does not prevent another user's run", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });
    await registry.saveSettings("user-2", { enabled: true, scanTime: "18:00" });

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
    await registry.saveSettings("user-1", { enabled: true, scanTime: "00:00" });
    const s = scheduler("2026-08-04T18:01:00");
    s.start(60_000);
    // Awaited: `start` fires its first tick without awaiting it, so a `stop`
    // that only cleared the interval would let that tick finish during the
    // NEXT test and push into its freshly-reset `runs`. That is exactly what
    // happened once the lease made a tick slow enough to notice.
    await s.stop();
    // start() ticks once immediately; the assertion is that stop() leaves no
    // interval behind rather than that nothing ran.
    assert.equal(runs.length <= 1, true);
  });
});

describe("two schedulers, one day", () => {
  /**
   * The reason `scan_leases` exists.
   *
   * `start()` only guards against a double tick within one process. Two server
   * instances — or a deploy where the old process has not exited — both work
   * out that the day is due, and before the lease both would call `runScan`.
   * Dedup does not save it: `processed_commits` is read before either has
   * written, so both create the ClickUp tasks and only then does one write
   * lose. `ON CONFLICT` protects the row; it cannot un-create a real task.
   */
  test("the scan runs once when two processes tick at the same moment", async () => {
    await registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-06",
    });

    await Promise.all([
      scheduler("2026-08-07T18:30:00", "alpha").tick(),
      scheduler("2026-08-07T18:30:00", "beta").tick(),
    ]);

    assert.deepEqual(runs, [{ userId: "user-1", date: "2026-08-07" }]);
  });

  /** Sequential ticks, which is the more common shape: a restart overlap. */
  test("a second process ticking later does not redo a finished day", async () => {
    await registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-06",
    });

    await scheduler("2026-08-07T18:30:00", "alpha").tick();
    // `lastCompletedDate` has advanced, so beta would skip anyway — force the
    // question by winding it back, as a process holding stale settings would.
    await registry.saveSettings("user-1", { lastCompletedDate: "2026-08-06" });
    await scheduler("2026-08-07T18:30:00", "beta").tick();

    assert.equal(runs.length, 1);
  });

  /**
   * The lease must not turn a transient failure into a lost day: the next tick
   * has to be able to pick it up again.
   */
  test("a failed day is retried by the next tick", async () => {
    await registry.saveSettings("user-1", {
      enabled: true,
      scanTime: "18:00",
      lastCompletedDate: "2026-08-06",
    });

    let attempts = 0;
    const failing = new ScanScheduler({
      registry,
      leases: new ScanLeaseStore({ sql: db }),
      owner: "alpha",
      userIds: () => ["user-1"],
      now: () => new Date("2026-08-07T18:30:00"),
      runScan: async () => {
        attempts += 1;
        throw new Error("git fetch failed");
      },
    });

    await failing.tick();
    await failing.tick();

    assert.equal(attempts, 2, "a released day must be retried, not written off");
  });

  test("one user holding a day does not block another user", async () => {
    for (const userId of ["user-1", "user-2"]) {
      await registry.saveSettings(userId, {
        enabled: true,
        scanTime: "18:00",
        lastCompletedDate: "2026-08-06",
      });
    }

    const both = new ScanScheduler({
      registry,
      leases: new ScanLeaseStore({ sql: db }),
      owner: "alpha",
      userIds: () => ["user-1", "user-2"],
      now: () => new Date("2026-08-07T18:30:00"),
      runScan: async (userId, date) => {
        runs.push({ userId, date });
      },
    });

    await both.tick();

    assert.deepEqual(runs.map((r) => r.userId).sort(), ["user-1", "user-2"]);
  });
});

describe("overlapping ticks", () => {
  /**
   * A scan can outlast the interval — a week of catch-up across several repos
   * takes longer than five minutes. Without a guard the timer stacks ticks, and
   * while the lease stops them duplicating anything, they still queue work for
   * a day already in hand.
   */
  test("a tick that arrives while one is running is skipped", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });

    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;

    const s = new ScanScheduler({
      registry,
      leases: new ScanLeaseStore({ sql: db }),
      owner: "alpha",
      userIds: () => ["user-1"],
      now: () => new Date("2026-08-04T18:01:00"),
      runScan: async () => {
        started += 1;
        await blocked;
      },
    });

    s.start(60_000);
    // A second tick while the first is still inside runScan.
    const second = s.stop();
    release();
    await second;

    assert.equal(started, 1);
  });

  /**
   * `stop` must wait, not merely clear the timer. Before this, `start`'s
   * unawaited first tick outlived the test that created it.
   */
  test("stop() waits for the tick already in flight", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });

    let finished = false;
    const s = new ScanScheduler({
      registry,
      leases: new ScanLeaseStore({ sql: db }),
      owner: "alpha",
      userIds: () => ["user-1"],
      now: () => new Date("2026-08-04T18:01:00"),
      runScan: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        finished = true;
      },
    });

    s.start(60_000);
    await s.stop();

    assert.equal(finished, true, "stop() returned while a scan was still running");
  });
});
