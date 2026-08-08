/**
 * The lease, against a real Postgres.
 *
 * Deliberately not unit-tested against a fake. The whole mechanism *is* the
 * `ON CONFLICT ... WHERE` clause — a stub would be asserting that my mental
 * model of that clause is right, which is the thing actually in doubt. Two real
 * stores against one real table is the only version of this test worth having.
 *
 * `now` is injected throughout so expiry can be reached without waiting.
 */

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ScanLeaseStore, LEASE_TTL_MS } from "./ScanLeaseStore.js";
import { getPool } from "../db/pool.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";

let pg: TestDatabase;

/** A store with a clock the test drives. */
function storeAt(clock: { now: number }): ScanLeaseStore {
  return new ScanLeaseStore({ now: () => clock.now });
}

before(async () => {
  pg = await createTestDatabase();
});

after(async () => {
  await pg?.drop();
});

beforeEach(async () => {
  await getPool().sql`DELETE FROM scan_leases`;
});

describe("ScanLeaseStore — claiming", () => {
  test("the first claimant gets the day", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };

    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "alpha"), true);
  });

  /**
   * The bug this exists for. Two schedulers, one day: exactly one may proceed,
   * because both proceeding means every ClickUp task created twice.
   */
  test("a second process is refused while the first holds it", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    const beta = storeAt(clock);

    assert.equal(await alpha.claim("u1", "2026-08-07", "alpha"), true);
    assert.equal(await beta.claim("u1", "2026-08-07", "beta"), false);
  });

  /** The real shape of the race: both arrive at once, not one after the other. */
  test("exactly one of many simultaneous claimants wins", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        storeAt(clock).claim("u1", "2026-08-07", `proc-${index}`)
      )
    );

    assert.equal(results.filter(Boolean).length, 1);
  });

  test("different days do not block each other", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const store = storeAt(clock);

    assert.equal(await store.claim("u1", "2026-08-06", "alpha"), true);
    assert.equal(await store.claim("u1", "2026-08-07", "alpha"), true);
  });

  test("different users do not block each other", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const store = storeAt(clock);

    assert.equal(await store.claim("u1", "2026-08-07", "alpha"), true);
    assert.equal(await store.claim("u2", "2026-08-07", "alpha"), true);
  });
});

describe("ScanLeaseStore — expiry", () => {
  /**
   * A process killed mid-scan must not block its day forever. This is the case
   * that rules out simply inserting a row and never expiring it.
   */
  test("an abandoned claim can be taken once it lapses", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "died"), true);

    const later = { now: clock.now + LEASE_TTL_MS + 1000 };
    assert.equal(await storeAt(later).claim("u1", "2026-08-07", "alpha"), true);
  });

  test("a claim that has not yet lapsed is still refused", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "alpha"), true);

    const later = { now: clock.now + LEASE_TTL_MS - 1000 };
    assert.equal(await storeAt(later).claim("u1", "2026-08-07", "beta"), false);
  });

  /**
   * The heartbeat's reason to exist: a scan slower than the TTL keeps its day.
   * Without this a long scan is stolen and the duplicate reappears — and only
   * under load, which is the worst time to discover it.
   */
  test("a refreshed claim survives past the original expiry", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    assert.equal(await alpha.claim("u1", "2026-08-07", "alpha"), true);

    // Still working, four minutes in.
    clock.now += 4 * 60 * 1000;
    assert.equal(await alpha.heartbeat("u1", "2026-08-07", "alpha"), true);

    // Past the original expiry, but not the refreshed one.
    const beta = storeAt({ now: clock.now + 2 * 60 * 1000 });
    assert.equal(await beta.claim("u1", "2026-08-07", "beta"), false);
  });

  test("only the holder can refresh", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const store = storeAt(clock);
    await store.claim("u1", "2026-08-07", "alpha");

    assert.equal(await store.heartbeat("u1", "2026-08-07", "beta"), false);
  });
});

describe("ScanLeaseStore — finishing", () => {
  /**
   * A completed day stays claimed. Releasing it would reopen the race against a
   * scheduler that worked out its due-dates before this scan finished and is
   * still holding that date — `lastCompletedDate` cannot help, because that
   * process read it too early.
   */
  test("a completed day is never reclaimed, even long after expiry", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    await alpha.claim("u1", "2026-08-07", "alpha");
    await alpha.complete("u1", "2026-08-07", "alpha");

    const muchLater = { now: clock.now + 30 * 24 * 60 * 60 * 1000 };
    assert.equal(await storeAt(muchLater).claim("u1", "2026-08-07", "beta"), false);
  });

  test("only the holder can complete a day", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const store = storeAt(clock);
    await store.claim("u1", "2026-08-07", "alpha");

    await store.complete("u1", "2026-08-07", "beta");

    // Not completed, so it is still merely claimed — and reclaimable on expiry.
    const later = { now: clock.now + LEASE_TTL_MS + 1000 };
    assert.equal(await storeAt(later).claim("u1", "2026-08-07", "beta"), true);
  });

  /** A failed day must be retried, not written off until the TTL lapses. */
  test("a released day is immediately available again", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    await alpha.claim("u1", "2026-08-07", "alpha");
    await alpha.release("u1", "2026-08-07", "alpha");

    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "beta"), true);
  });

  test("releasing someone else's claim does nothing", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const store = storeAt(clock);
    await store.claim("u1", "2026-08-07", "alpha");

    await store.release("u1", "2026-08-07", "beta");

    assert.equal(await store.claim("u1", "2026-08-07", "beta"), false);
  });

  test("a completed day cannot be released", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const store = storeAt(clock);
    await store.claim("u1", "2026-08-07", "alpha");
    await store.complete("u1", "2026-08-07", "alpha");

    await store.release("u1", "2026-08-07", "alpha");

    assert.equal(await store.claim("u1", "2026-08-07", "beta"), false);
  });
});

describe("ScanLeaseStore — withLease", () => {
  test("runs the work and marks the day done", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    let ran = 0;

    const acted = await storeAt(clock).withLease("u1", "2026-08-07", "alpha", async () => {
      ran += 1;
    });

    assert.equal(acted.acquired, true);
    assert.equal(ran, 1);
    // Done means done, whatever the clock says later.
    const muchLater = { now: clock.now + 30 * 24 * 60 * 60 * 1000 };
    assert.equal(await storeAt(muchLater).claim("u1", "2026-08-07", "beta"), false);
  });

  /**
   * The whole point, stated as one assertion: the work runs once even when two
   * processes both believe the day is due.
   */
  test("the work runs once when two processes race for the same day", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    let ran = 0;
    const work = async () => {
      ran += 1;
    };

    const [a, b] = await Promise.all([
      storeAt(clock).withLease("u1", "2026-08-07", "alpha", work),
      storeAt(clock).withLease("u1", "2026-08-07", "beta", work),
    ]);

    assert.equal(ran, 1);
    assert.equal([a, b].filter((outcome) => outcome.acquired).length, 1);
  });

  test("does not run the work at all when the day is taken", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    await storeAt(clock).claim("u1", "2026-08-07", "alpha");

    let ran = false;
    const acted = await storeAt(clock).withLease("u1", "2026-08-07", "beta", async () => {
      ran = true;
    });

    assert.equal(acted.acquired, false);
    assert.equal(ran, false);
  });

  /** A crash must give the day back, or a transient failure costs a whole day. */
  test("a failing scan releases the day and rethrows", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };

    await assert.rejects(
      storeAt(clock).withLease("u1", "2026-08-07", "alpha", async () => {
        throw new Error("git fetch failed");
      }),
      /git fetch failed/
    );

    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "beta"), true);
  });
});

describe("ScanLeaseStore — markComplete", () => {
  /**
   * The regression this exists for. A manual run of a day still in progress
   * used to mark that day complete, and because the scheduler never passes
   * `redoCompleted`, its evening run was refused forever — so every commit
   * made after the manual run was silently never filed.
   */
  test("a run that does not complete the day leaves it claimable", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };

    const acted = await storeAt(clock).withLease(
      "u1",
      "2026-08-07",
      "person",
      async () => "scanned",
      { markComplete: false }
    );

    assert.equal(acted.acquired, true);
    // The scheduler's ordinary claim — no redoCompleted — must still win it.
    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "scheduler"), true);
  });

  /** Not completing must not mean not excluding: the day is still held while it runs. */
  test("the day is still held for the duration of the work", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    let sawDuring: boolean | undefined;

    await storeAt(clock).withLease(
      "u1",
      "2026-08-07",
      "person",
      async () => {
        sawDuring = await storeAt(clock).claim("u1", "2026-08-07", "scheduler");
      },
      { markComplete: false }
    );

    assert.equal(sawDuring, false);
  });

  test("the default is still to complete the day", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    await storeAt(clock).withLease("u1", "2026-08-07", "alpha", async () => "done");

    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "scheduler"), false);
  });
});

describe("ScanLeaseStore — redoCompleted", () => {
  /**
   * The manual re-run. Someone who has just fixed the settings that made this
   * morning's scan wrong must be able to run it again; a completed row that
   * blocked that forever would be answering a question nobody asked.
   */
  test("a completed day can be retaken deliberately", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    await alpha.claim("u1", "2026-08-07", "alpha");
    await alpha.complete("u1", "2026-08-07", "alpha");

    assert.equal(
      await storeAt(clock).claim("u1", "2026-08-07", "person", { redoCompleted: true }),
      true
    );
  });

  /**
   * The line that must not move. Concurrency is what duplicates tasks, and no
   * amount of "the user asked for it" makes two simultaneous scans of one day
   * correct — so a LIVE claim is off limits in both modes.
   */
  test("a live claim cannot be overridden, even deliberately", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    await storeAt(clock).claim("u1", "2026-08-07", "scheduler");

    assert.equal(
      await storeAt(clock).claim("u1", "2026-08-07", "person", { redoCompleted: true }),
      false
    );
  });

  test("retaking a completed day puts it back in progress", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    await alpha.claim("u1", "2026-08-07", "alpha");
    await alpha.complete("u1", "2026-08-07", "alpha");
    await storeAt(clock).claim("u1", "2026-08-07", "person", { redoCompleted: true });

    // In progress means a third party is refused, not waved through.
    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "other"), false);
    // And the scheduler's ordinary claim still sees it as unfinished work.
    const later = { now: clock.now + LEASE_TTL_MS + 1000 };
    assert.equal(await storeAt(later).claim("u1", "2026-08-07", "other"), true);
  });

  test("the scheduler's ordinary claim still refuses a completed day", async () => {
    const clock = { now: Date.parse("2026-08-07T18:00:00Z") };
    const alpha = storeAt(clock);
    await alpha.claim("u1", "2026-08-07", "alpha");
    await alpha.complete("u1", "2026-08-07", "alpha");

    assert.equal(await storeAt(clock).claim("u1", "2026-08-07", "scheduler"), false);
  });
});
