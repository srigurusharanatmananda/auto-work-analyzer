import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TemplateStore, TemplateStoreError } from "./TemplateStore.js";
import { DEFAULT_TEMPLATE_OPTIONS } from "../formatting/Template.js";

/** Runs `fn`, asserts it throws a TemplateStoreError, and returns its `.code`. */
function codeOf(fn: () => unknown): TemplateStoreError["code"] {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof TemplateStoreError, "expected a TemplateStoreError");
    return (error as TemplateStoreError).code;
  }
  throw new assert.AssertionError({ message: "expected fn to throw" });
}

// Runs under `tsx --test` (Node), not `bun test` — better-sqlite3 cannot open
// a database under this repo's Bun version (see task-7-report.md), but Node
// is exactly the runtime production runs under (webhook-server.ts via tsx),
// so this exercises the real driver on the real runtime.

let dir: string;
let store: TemplateStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-templates-"));
  store = new TemplateStore(join(dir, "test.db"));
});

afterEach(() => {
  store.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("TemplateStore", () => {
  test("seeds the built-in templates on first open", () => {
    const templates = store.list("user-1");
    const builtins = templates.filter((t) => t.isBuiltin);
    assert.equal(builtins.length, 3);
    assert.deepEqual(
      builtins.map((t) => t.id).sort(),
      ["builtin-commit-log", "builtin-standard", "builtin-terse"]
    );
  });

  test("seeding is idempotent across reopens", () => {
    store.close();
    const reopened = new TemplateStore(join(dir, "test.db"));
    assert.equal(reopened.list("user-1").filter((t) => t.isBuiltin).length, 3);
    reopened.close();
  });

  test("creates and reads back a user template", () => {
    const created = store.create("user-1", {
      name: "Mine",
      nameTemplate: "{{title}}",
      descriptionTemplate: "{{description}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    assert.ok(created.id);
    assert.equal(created.isBuiltin, false);

    const fetched = store.get(created.id);
    assert.equal(fetched!.name, "Mine");
    assert.equal(fetched!.options.dueDateSource, "completedDate");
  });

  test("list returns built-ins plus only the caller's templates", () => {
    store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });

    const names = store.list("user-1").map((t) => t.name);
    assert.ok(names.includes("Mine"));
    assert.ok(!names.includes("Theirs"));
  });

  test("update changes a user template", () => {
    const created = store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    const updated = store.update(created.id, "user-1", { name: "Renamed" });
    assert.equal(updated.name, "Renamed");
    assert.equal(updated.nameTemplate, "{{title}}");
  });

  test("update refuses to modify a built-in", () => {
    assert.throws(
      () => store.update("builtin-standard", "user-1", { name: "Hacked" }),
      /built-in/i
    );
  });

  test("update refuses to modify another user's template", () => {
    const created = store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    assert.throws(() => store.update(created.id, "user-1", { name: "Stolen" }), /not found/i);
  });

  test("remove deletes a user template but refuses built-ins", () => {
    const created = store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    store.remove(created.id, "user-1");
    assert.equal(store.get(created.id), null);
    assert.throws(() => store.remove("builtin-standard", "user-1"), /built-in/i);
  });

  // Fix round 2: the route layer maps TemplateStoreError.code to an HTTP
  // status without parsing error.message, so the store must carry that
  // code on every rejection path — pinned here for both update and remove.
  test("update's thrown error carries the right .code for both rejection reasons", () => {
    assert.equal(
      codeOf(() => store.update("builtin-standard", "user-1", { name: "Hacked" })),
      "builtin_immutable"
    );
    assert.equal(
      codeOf(() => store.update("no-such-id", "user-1", { name: "X" })),
      "not_found"
    );
  });

  test("remove refuses to delete another user's template (.code: not_found)", () => {
    const created = store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    assert.throws(() => store.remove(created.id, "user-1"), /not found/i);
    assert.equal(codeOf(() => store.remove(created.id, "user-1")), "not_found");
  });

  test("remove's thrown error carries the right .code for both rejection reasons", () => {
    assert.equal(
      codeOf(() => store.remove("builtin-standard", "user-1")),
      "builtin_immutable"
    );
    assert.equal(codeOf(() => store.remove("no-such-id", "user-1")), "not_found");
  });
});
