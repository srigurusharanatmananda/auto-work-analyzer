import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanRegistry } from "./ScanRegistry.js";

let dir: string;
let registry: ScanRegistry;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-scanreg-"));
  registry = new ScanRegistry(join(dir, "test.db"));
});

afterEach(() => {
  registry.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("ScanRegistry settings", () => {
  test("defaults are safe: disabled, with a sensible root and owner", () => {
    const settings = registry.getSettings("user-1");

    // Disabled by default is a safety property, not a preference: nothing may
    // create ClickUp tasks unattended until the user opts in.
    assert.equal(settings.enabled, false);
    assert.match(settings.root, /GitHub$/);
    assert.equal(settings.owner, "kailasa-ngpt");
    assert.equal(settings.scanTime, "18:00");
    assert.deepEqual(settings.authorIdentities, []);
    assert.equal(settings.lastCompletedDate, undefined);
  });

  test("saves and round-trips the author identity list", () => {
    registry.saveSettings("user-1", { authorIdentities: ["a@example.com", "b@example.com"] });
    assert.deepEqual(registry.getSettings("user-1").authorIdentities, [
      "a@example.com",
      "b@example.com",
    ]);
  });

  test("a patch leaves unmentioned fields alone", () => {
    registry.saveSettings("user-1", { scanTime: "21:30", enabled: true });
    registry.saveSettings("user-1", { owner: "another-org" });

    const settings = registry.getSettings("user-1");
    assert.equal(settings.scanTime, "21:30");
    assert.equal(settings.enabled, true);
    assert.equal(settings.owner, "another-org");
  });

  test("settings are per user", () => {
    registry.saveSettings("user-1", { scanTime: "07:00" });
    assert.equal(registry.getSettings("user-2").scanTime, "18:00");
  });

  test("survives a reopen", () => {
    registry.saveSettings("user-1", { scanTime: "05:45", enabled: true });
    registry.close();

    registry = new ScanRegistry(join(dir, "test.db"));
    assert.equal(registry.getSettings("user-1").scanTime, "05:45");
    assert.equal(registry.getSettings("user-1").enabled, true);
  });
});

describe("ScanRegistry bindings", () => {
  test("an unbound repo reports no binding", () => {
    assert.equal(registry.getBinding("user-1", "kailasa-ngpt/x"), null);
  });

  test("saves a destination and template per repo", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", {
      destinationId: "dest-1",
      templateId: "builtin-terse",
      enabled: true,
    });

    const binding = registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.templateId, "builtin-terse");
    assert.equal(binding.enabled, true);
  });

  test("clears a destination when explicitly set to null", () => {
    // null means "unbind, fall back to the default destination"; undefined means
    // "leave it alone". Conflating them is the bug slice 2 hit in
    // DestinationStore.update, where moving a destination out of a folder
    // silently kept the old folder.
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1" });
    registry.saveBinding("user-1", "kailasa-ngpt/x", {
      destinationId: null as unknown as undefined,
    });

    assert.equal(registry.getBinding("user-1", "kailasa-ngpt/x")!.destinationId, undefined);
  });

  test("a patch leaves the other binding fields alone", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1", enabled: true });
    registry.saveBinding("user-1", "kailasa-ngpt/x", { templateId: "builtin-terse" });

    const binding = registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.enabled, true);
  });

  test("an unbound repo defaults to enabled", () => {
    // A newly cloned repo should be scanned without the user opting each one in.
    const binding = registry.saveBinding("user-1", "kailasa-ngpt/fresh", {});
    assert.equal(binding.enabled, true);
  });

  test("bindings are per user", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1" });
    assert.equal(registry.getBinding("user-2", "kailasa-ngpt/x"), null);
    assert.deepEqual(registry.listBindings("user-2"), []);
  });

  test("markScanned records the date without disturbing the binding", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/x", { destinationId: "dest-1", enabled: true });
    registry.markScanned("user-1", "kailasa-ngpt/x", "2026-08-04");

    const binding = registry.getBinding("user-1", "kailasa-ngpt/x")!;
    assert.equal(binding.lastScannedDate, "2026-08-04");
    assert.equal(binding.destinationId, "dest-1");
    assert.equal(binding.enabled, true);
  });

  test("markScanned creates a row for a repo with no binding yet", () => {
    registry.markScanned("user-1", "kailasa-ngpt/new", "2026-08-04");
    assert.equal(registry.getBinding("user-1", "kailasa-ngpt/new")!.lastScannedDate, "2026-08-04");
  });

  test("listBindings is sorted by slug", () => {
    registry.saveBinding("user-1", "kailasa-ngpt/zeta", {});
    registry.saveBinding("user-1", "kailasa-ngpt/alpha", {});
    assert.deepEqual(
      registry.listBindings("user-1").map((b) => b.slug),
      ["kailasa-ngpt/alpha", "kailasa-ngpt/zeta"]
    );
  });
});

describe("ScanRegistry run history", () => {
  test("no run recorded yet reports null", () => {
    assert.equal(registry.getLastRun("user-1"), null);
  });

  test("stores and returns the latest summary, per user", () => {
    registry.saveRun("user-1", { date: "2026-08-04", totalTasksCreated: 3 });
    registry.saveRun("user-1", { date: "2026-08-05", totalTasksCreated: 7 });

    const last = registry.getLastRun("user-1")!;
    assert.equal((last.summary as { totalTasksCreated: number }).totalTasksCreated, 7);
    assert.match(last.ranAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(registry.getLastRun("user-2"), null);
  });
});
