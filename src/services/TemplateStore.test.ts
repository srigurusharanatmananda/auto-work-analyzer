import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TemplateStore } from "./TemplateStore.js";
import { DEFAULT_TEMPLATE_OPTIONS } from "../formatting/Template.js";

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
    expect(builtins.length).toBe(3);
    expect(builtins.map((t) => t.id).sort()).toEqual([
      "builtin-commit-log",
      "builtin-standard",
      "builtin-terse",
    ]);
  });

  test("seeding is idempotent across reopens", () => {
    store.close();
    const reopened = new TemplateStore(join(dir, "test.db"));
    expect(reopened.list("user-1").filter((t) => t.isBuiltin).length).toBe(3);
    reopened.close();
  });

  test("creates and reads back a user template", () => {
    const created = store.create("user-1", {
      name: "Mine",
      nameTemplate: "{{title}}",
      descriptionTemplate: "{{description}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    expect(created.id).toBeTruthy();
    expect(created.isBuiltin).toBe(false);

    const fetched = store.get(created.id);
    expect(fetched!.name).toBe("Mine");
    expect(fetched!.options.dueDateSource).toBe("completedDate");
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
    expect(names).toContain("Mine");
    expect(names).not.toContain("Theirs");
  });

  test("update changes a user template", () => {
    const created = store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    const updated = store.update(created.id, "user-1", { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(updated.nameTemplate).toBe("{{title}}");
  });

  test("update refuses to modify a built-in", () => {
    expect(() => store.update("builtin-standard", "user-1", { name: "Hacked" })).toThrow(
      /built-in/i
    );
  });

  test("update refuses to modify another user's template", () => {
    const created = store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    expect(() => store.update(created.id, "user-1", { name: "Stolen" })).toThrow(/not found/i);
  });

  test("remove deletes a user template but refuses built-ins", () => {
    const created = store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    store.remove(created.id, "user-1");
    expect(store.get(created.id)).toBeNull();
    expect(() => store.remove("builtin-standard", "user-1")).toThrow(/built-in/i);
  });
});
