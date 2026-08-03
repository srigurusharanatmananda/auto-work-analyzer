/**
 * Tests the pure pieces of the tasks router — the preview builder and the
 * batched creator — rather than the HTTP layer. Neither touches a database, so
 * these run under `bun test`; the HTTP-level status/envelope assertions live in
 * tasks.routes.envelope.nodetest.ts, which needs `authenticate` to really
 * succeed and therefore needs Node (better-sqlite3 cannot open a database
 * under this repo's Bun version).
 */
import { describe, expect, test } from "bun:test";
import { buildPreview, createRenderedTasks } from "./tasks.routes.js";
import { makeWorkItem } from "../domain/WorkItem.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import type { RenderedTask } from "../formatting/ClickUpRenderer.js";
import type { ClickUpService } from "../services/ClickUpService.js";

const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;

describe("buildPreview", () => {
  test("returns rendered tasks and markdown for the same items", () => {
    const preview = buildPreview(
      [makeWorkItem({ title: "Fix login", completedDate: "2026-07-30" })],
      standard
    );
    expect(preview.items.length).toBe(1);
    expect(preview.items[0]!.task.name).toBe("Fix login");
    expect(preview.markdown).toContain("Task 1: Fix login");
    expect(preview.template.id).toBe("builtin-standard");
    expect(preview.warnings).toEqual([]);
  });

  test("warns when there is nothing to create", () => {
    const preview = buildPreview([], standard);
    expect(preview.items).toEqual([]);
    expect(preview.warnings.some((w) => w.includes("No work items"))).toBe(true);
  });

  test("surfaces a template error as a warning-free throw", () => {
    const broken = { ...standard, nameTemplate: "{{nonexistent}}" };
    expect(() => buildPreview([makeWorkItem()], broken)).toThrow(/nonexistent/);
  });
});

/** Minimal stand-in for ClickUpService — only `createTask` is ever called. */
function fakeClickUp(
  behaviour: (task: { name: string }) => { id: string; name: string; url: string }
): ClickUpService {
  return {
    createTask: async (task: { name: string }) => behaviour(task),
  } as unknown as ClickUpService;
}

function renderedNamed(...names: string[]): RenderedTask[] {
  return names.map((name) => ({
    task: { name },
    workItem: makeWorkItem({ title: name }),
  })) as RenderedTask[];
}

describe("createRenderedTasks", () => {
  test("returns every created task with id, name and url", async () => {
    const outcome = await createRenderedTasks(
      renderedNamed("one", "two"),
      fakeClickUp((task) => ({ id: `id-${task.name}`, name: task.name, url: `http://x/${task.name}` }))
    );

    expect(outcome.failed).toEqual([]);
    expect(outcome.created).toEqual([
      { id: "id-one", name: "one", url: "http://x/one" },
      { id: "id-two", name: "two", url: "http://x/two" },
    ]);
  });

  test("isolates a single failure instead of losing the whole batch", async () => {
    const outcome = await createRenderedTasks(
      renderedNamed("ok-1", "explodes", "ok-2"),
      fakeClickUp((task) => {
        if (task.name === "explodes") throw new Error("ClickUp said no");
        return { id: `id-${task.name}`, name: task.name, url: "http://x" };
      })
    );

    expect(outcome.created.map((c) => c.name)).toEqual(["ok-1", "ok-2"]);
    expect(outcome.failed).toEqual([{ name: "explodes", reason: "ClickUp said no" }]);
  });

  test("creates across more than one batch (BATCH_SIZE is 5)", async () => {
    const names = Array.from({ length: 12 }, (_, i) => `task-${i}`);
    const outcome = await createRenderedTasks(
      renderedNamed(...names),
      fakeClickUp((task) => ({ id: task.name, name: task.name, url: "http://x" }))
    );

    expect(outcome.created.length).toBe(12);
    // Order must survive batching — callers report "created N tasks" against it.
    expect(outcome.created.map((c) => c.name)).toEqual(names);
  });

  test("an empty list makes no ClickUp calls", async () => {
    let calls = 0;
    const outcome = await createRenderedTasks(
      [],
      fakeClickUp(() => {
        calls += 1;
        return { id: "x", name: "x", url: "x" };
      })
    );

    expect(calls).toBe(0);
    expect(outcome).toEqual({ created: [], failed: [] });
  });
});
