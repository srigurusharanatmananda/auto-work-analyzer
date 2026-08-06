import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TemplateStore, TemplateStoreError } from "./TemplateStore.js";
import { DEFAULT_TEMPLATE_OPTIONS } from "../formatting/Template.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";

/** Awaits `promise`, asserts it rejects with a TemplateStoreError, returns `.code`. */
async function codeOf(promise: Promise<unknown>): Promise<TemplateStoreError["code"]> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof TemplateStoreError, `expected a TemplateStoreError, got ${error}`);
    return (error as TemplateStoreError).code;
  }
  throw new assert.AssertionError({ message: "expected the call to reject" });
}

/**
 * Runs against a real Postgres schema of its own, created per test so that one
 * test's templates cannot be another's starting state.
 *
 * Still a `.nodetest.ts` under `tsx --test` rather than `bun test`. The original
 * reason (better-sqlite3 will not load under Bun) no longer applies to this
 * file, but the whole database suite moves runner together or not at all —
 * splitting it would mean two commands to trust instead of one, for no gain
 * until the last store is ported.
 */
let db: TestDatabase;
let store: TemplateStore;

before(async () => {
  // Proves Postgres is reachable once, with a clear message, rather than
  // letting every test fail with a connection error.
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  // Truncate rather than re-create the schema: same isolation, a fraction of
  // the cost.
  await db.sql`TRUNCATE task_templates`;
  store = new TemplateStore(db);
  await store.seedBuiltins();
});

afterEach(() => {
  store.close();
});

describe("TemplateStore", () => {
  test("seeds the built-in templates", async () => {
    const templates = await store.list("user-1");
    const builtins = templates.filter((t) => t.isBuiltin);
    assert.equal(builtins.length, 3);
    assert.deepEqual(
      builtins.map((t) => t.id).sort(),
      ["builtin-commit-log", "builtin-standard", "builtin-terse"]
    );
  });

  test("seeding is idempotent when run again", async () => {
    // The upsert has to survive a second start without duplicating or throwing
    // on the primary key — this is what runs on every boot.
    await store.seedBuiltins();
    await store.seedBuiltins();

    const builtins = (await store.list("user-1")).filter((t) => t.isBuiltin);
    assert.equal(builtins.length, 3);
  });

  test("seeding does not disturb a user's own templates", async () => {
    const mine = await store.create("user-1", {
      name: "Mine",
      nameTemplate: "{{title}}",
      descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });

    await store.seedBuiltins();

    const fetched = await store.get(mine.id, "user-1");
    assert.equal(fetched!.name, "Mine");
  });

  test("creates and reads back a user template", async () => {
    const created = await store.create("user-1", {
      name: "Mine",
      nameTemplate: "{{title}}",
      descriptionTemplate: "{{description}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    assert.ok(created.id);
    assert.equal(created.isBuiltin, false);

    const fetched = await store.get(created.id, "user-1");
    assert.equal(fetched!.name, "Mine");
    assert.equal(fetched!.options.dueDateSource, "completedDate");
  });

  test("list returns built-ins plus only the caller's templates", async () => {
    await store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    await store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });

    const names = (await store.list("user-1")).map((t) => t.name);
    assert.ok(names.includes("Mine"));
    assert.ok(!names.includes("Theirs"));
  });

  test("update changes a user template", async () => {
    const created = await store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    const updated = await store.update(created.id, "user-1", { name: "Renamed" });
    assert.equal(updated.name, "Renamed");
    assert.equal(updated.nameTemplate, "{{title}}");
  });

  test("update refuses to modify a built-in", async () => {
    await assert.rejects(
      () => store.update("builtin-standard", "user-1", { name: "Hacked" }),
      /built-in/i
    );
  });

  test("update refuses to modify another user's template", async () => {
    const created = await store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    await assert.rejects(() => store.update(created.id, "user-1", { name: "Stolen" }), /not found/i);
  });

  test("remove deletes a user template but refuses built-ins", async () => {
    const created = await store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    await store.remove(created.id, "user-1");
    assert.equal(await store.get(created.id, "user-1"), null);
    await assert.rejects(() => store.remove("builtin-standard", "user-1"), /built-in/i);
  });

  // Fix round 2: the route layer maps TemplateStoreError.code to an HTTP
  // status without parsing error.message, so the store must carry that
  // code on every rejection path — pinned here for both update and remove.
  test("update's thrown error carries the right .code for both rejection reasons", async () => {
    assert.equal(
      await codeOf(store.update("builtin-standard", "user-1", { name: "Hacked" })),
      "builtin_immutable"
    );
    assert.equal(await codeOf(store.update("no-such-id", "user-1", { name: "X" })), "not_found");
  });

  test("remove refuses to delete another user's template (.code: not_found)", async () => {
    const created = await store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    await assert.rejects(() => store.remove(created.id, "user-1"), /not found/i);
    assert.equal(await codeOf(store.remove(created.id, "user-1")), "not_found");
  });

  test("remove's thrown error carries the right .code for both rejection reasons", async () => {
    assert.equal(await codeOf(store.remove("builtin-standard", "user-1")), "builtin_immutable");
    assert.equal(await codeOf(store.remove("no-such-id", "user-1")), "not_found");
  });

  /**
   * `get` was the one unscoped read on this store. Without a userId, any
   * authenticated caller who knew another user's template uuid could render with
   * it through /api/preview-tasks, /api/create-tasks and /api/notes. list,
   * update and remove were all scoped; nothing covered get.
   */
  test("get refuses another user's template but still serves built-ins", async () => {
    const mine = await store.create("user-1", {
      name: "Mine",
      nameTemplate: "{{title}}",
      descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });

    assert.equal((await store.get(mine.id, "user-1"))!.name, "Mine");
    assert.equal(
      await store.get(mine.id, "user-2"),
      null,
      "user-2 must not read user-1's template"
    );
    // Built-ins have user_id NULL and must stay readable by everyone — the
    // reason this method was unscoped in the first place.
    assert.ok(await store.get("builtin-standard", "user-2"));
  });

  /**
   * The SQLite version stored is_builtin as 0/1 and compared with `=== 1`;
   * Postgres returns a real boolean. A driver returning the string "t" or "f",
   * or the mapping being dropped, would make every built-in look user-owned —
   * and `list` would then hide them from everyone.
   */
  test("is_builtin arrives as a boolean, not a truthy string", async () => {
    const builtin = await store.get("builtin-standard", "user-1");
    assert.equal(builtin!.isBuiltin, true);
    assert.equal(typeof builtin!.isBuiltin, "boolean");

    const mine = await store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    assert.equal(mine.isBuiltin, false);
    assert.equal(typeof mine.isBuiltin, "boolean");
  });
});
