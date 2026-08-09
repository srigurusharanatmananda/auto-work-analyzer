import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ScanRegistry } from "./ScanRegistry.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";

let db: TestDatabase;
let registry: ScanRegistry;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.sql`TRUNCATE scan_settings, scanned_repos, scan_runs`;
  registry = new ScanRegistry(db);
});

afterEach(() => {
  registry.close();
});

describe("ScanRegistry settings", () => {
  test("defaults are safe: disabled, with a sensible root and owner", async () => {
    const settings = await registry.getSettings("user-1");

    // Disabled by default is a safety property, not a preference: nothing may
    // create ClickUp tasks unattended until the user opts in.
    assert.equal(settings.enabled, false);
    assert.match(settings.root, /GitHub$/);
    assert.equal(settings.owner, "kailasa-ngpt");
    assert.equal(settings.scanTime, "18:00");
    assert.deepEqual(settings.authorIdentities, []);
    assert.equal(settings.lastCompletedDate, undefined);
  });

  test("saves and round-trips the author identity list", async () => {
    await registry.saveSettings("user-1", { authorIdentities: ["a@example.com", "b@example.com"] });
    assert.deepEqual((await registry.getSettings("user-1")).authorIdentities, [
      "a@example.com",
      "b@example.com",
    ]);
  });

  test("a patch leaves unmentioned fields alone", async () => {
    await registry.saveSettings("user-1", { scanTime: "21:30", enabled: true });
    await registry.saveSettings("user-1", { owner: "another-org" });

    const settings = await registry.getSettings("user-1");
    assert.equal(settings.scanTime, "21:30");
    assert.equal(settings.enabled, true);
    assert.equal(settings.owner, "another-org");
  });

  test("settings are per user", async () => {
    await registry.saveSettings("user-1", { scanTime: "07:00" });
    assert.equal((await registry.getSettings("user-2")).scanTime, "18:00");
  });

  // Under SQLite this reopened the file. The equivalent property with a shared
  // pool is that the state lives in the database and not in the instance: a
  // second registry over the same connection must see the first one's writes.
  test("a second registry sees settings written by the first", async () => {
    await registry.saveSettings("user-1", { scanTime: "05:45", enabled: true });

    const other = new ScanRegistry(db);
    assert.equal((await other.getSettings("user-1")).scanTime, "05:45");
    assert.equal((await other.getSettings("user-1")).enabled, true);
  });
});

describe("ScanRegistry bindings", () => {
  test("an unbound repo reports no binding", async () => {
    assert.equal(await registry.getBinding("user-1", "kailasa-ngpt/x"), null);
  });

  test("saves a destination and template per repo", async () => {
    await registry.saveBinding("user-1", "kailasa-ngpt/x", {
      destinationId: "dest-1",
      templateId: "builtin-terse",
      enabled: true,
    });

    const binding = await registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.templateId, "builtin-terse");
    assert.equal(binding.enabled, true);
  });

  test("clears a destination when explicitly set to null", async () => {
    // null means "unbind, fall back to the default destination"; undefined means
    // "leave it alone". Conflating them is the bug slice 2 hit in
    // DestinationStore.update, where moving a destination out of a folder
    // silently kept the old folder.
    await registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1" });
    await registry.saveBinding("user-1", "kailasa-ngpt/x", {
      destinationId: null as unknown as undefined,
    });

    assert.equal((await registry.getBinding("user-1", "kailasa-ngpt/x"))!.destinationId, undefined);
  });

  test("a patch leaves the other binding fields alone", async () => {
    await registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1", enabled: true });
    await registry.saveBinding("user-1", "kailasa-ngpt/x", { templateId: "builtin-terse" });

    const binding = await registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.enabled, true);
  });

  test("an unbound repo defaults to enabled", async () => {
    // A newly cloned repo should be scanned without the user opting each one in.
    const binding = await registry.saveBinding("user-1", "kailasa-ngpt/fresh", {});
    assert.equal(binding.enabled, true);
  });

  test("bindings are per user", async () => {
    await registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1" });
    assert.equal(await registry.getBinding("user-2", "kailasa-ngpt/x"), null);
    assert.deepEqual(await registry.listBindings("user-2"), []);
  });

  test("markScanned records the date without disturbing the binding", async () => {
    await registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1", enabled: true });
    await registry.markScanned("user-1", "kailasa-ngpt/x", "2026-08-04");

    const binding = await registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.lastScannedDate, "2026-08-04");
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.enabled, true);
  });

  test("markScanned creates a row for a repo with no binding yet", async () => {
    await registry.markScanned("user-1", "kailasa-ngpt/new", "2026-08-04");
    assert.equal((await registry.getBinding("user-1", "kailasa-ngpt/new"))!.lastScannedDate, "2026-08-04");
  });

  test("listBindings is sorted by slug", async () => {
    await registry.saveBinding("user-1", "kailasa-ngpt/zeta", {});
    await registry.saveBinding("user-1", "kailasa-ngpt/alpha", {});
    assert.deepEqual(
      (await registry.listBindings("user-1")).map((b) => b.slug),
      ["kailasa-ngpt/alpha", "kailasa-ngpt/zeta"]
    );
  });
});

/**
 * The lost update. Both writers here are real and routinely concurrent: the
 * scheduler records progress while the user is on the settings page.
 *
 * Read-modify-write in TypeScript made each writer send a full row built from
 * what it had read *before* the other's write existed, so whichever landed
 * second reverted the other's field. The merge is now one statement, and a
 * column not named by a patch is not written at all.
 */
describe("ScanRegistry concurrent writers", () => {
  test("a progress write does not revert a settings change made beside it", async () => {
    await registry.saveSettings("user-1", { enabled: true, scanTime: "18:00" });

    // Both writers read the same starting state, then write.
    await Promise.all([
      registry.saveSettings("user-1", { lastCompletedDate: "2026-08-07" }),
      registry.saveSettings("user-1", { enabled: false }),
    ]);

    const settings = await registry.getSettings("user-1");
    assert.equal(settings.enabled, false, "the user's disable was reverted");
    assert.equal(settings.lastCompletedDate, "2026-08-07", "the completion date was lost");
    assert.equal(settings.scanTime, "18:00", "an untouched field changed");
  });

  test("a patch leaves fields it does not name alone", async () => {
    await registry.saveSettings("user-1", {
      root: "/srv/code",
      owner: "acme",
      scanTime: "09:30",
      enabled: true,
      authorIdentities: ["a@example.com"],
    });

    await registry.saveSettings("user-1", { scanTime: "21:00" });

    const settings = await registry.getSettings("user-1");
    assert.equal(settings.scanTime, "21:00");
    assert.equal(settings.root, "/srv/code");
    assert.equal(settings.owner, "acme");
    assert.equal(settings.enabled, true);
    assert.deepEqual(settings.authorIdentities, ["a@example.com"]);
  });

  /** Null still has to mean "clear this", which is why COALESCE is not enough. */
  test("an explicit null clears the completion date", async () => {
    await registry.saveSettings("user-1", { lastCompletedDate: "2026-08-07" });
    await registry.saveSettings("user-1", { lastCompletedDate: null });

    assert.equal((await registry.getSettings("user-1")).lastCompletedDate, undefined);
  });

  test("markScanned does not revert a binding edited beside it", async () => {
    await registry.saveBinding("user-1", "acme/api", { destinationId: "dest-1", enabled: true });

    await Promise.all([
      registry.markScanned("user-1", "acme/api", "2026-08-07"),
      registry.saveBinding("user-1", "acme/api", { enabled: false }),
    ]);

    const binding = await registry.getBinding("user-1", "acme/api");
    assert.equal(binding?.enabled, false, "the user's disable was reverted");
    assert.equal(binding?.lastScannedDate, "2026-08-07", "the scan date was lost");
    assert.equal(binding?.destinationId, "dest-1", "an untouched field changed");
  });

  test("an explicit null unsets a binding's destination", async () => {
    await registry.saveBinding("user-1", "acme/api", { destinationId: "dest-1" });
    await registry.saveBinding("user-1", "acme/api", { destinationId: null });

    assert.equal((await registry.getBinding("user-1", "acme/api"))?.destinationId, undefined);
  });
});

describe("ScanRegistry run history", () => {
  test("no run recorded yet reports null", async () => {
    assert.equal(await registry.getLastRun("user-1"), null);
  });

  test("stores and returns the latest summary, per user", async () => {
    await registry.saveRun("user-1", { date: "2026-08-04", totalTasksCreated: 3 });
    await registry.saveRun("user-1", { date: "2026-08-05", totalTasksCreated: 7 });

    const last = await registry.getLastRun("user-1")!;
    assert.equal((last.summary as { totalTasksCreated: number }).totalTasksCreated, 7);
    assert.match(last.ranAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(await registry.getLastRun("user-2"), null);
  });
});
