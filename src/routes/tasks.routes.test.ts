/**
 * Tests the pure pieces of the tasks router — the preview builder and the
 * batched creator — rather than the HTTP layer. Neither touches a database, so
 * these run under `bun test`; the HTTP-level status/envelope assertions live in
 * tasks.routes.envelope.nodetest.ts, which needs `authenticate` to really
 * succeed and therefore needs Node (better-sqlite3 cannot open a database
 * under this repo's Bun version).
 */
import { describe, expect, test } from "bun:test";
import { annotateStatusMapping, buildPreview, createRenderedTasks } from "./tasks.routes.js";
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

  /**
   * The failure this guards against is silent and total: grouped items live in
   * `subitems`, and a template with `emitSubtasks: false` renders the parents
   * and drops every child. The preview looks identical either way, so nobody
   * finds out until they open the empty parent in ClickUp.
   */
  describe("grouped items", () => {
    const grouped = () =>
      makeWorkItem({
        title: "Client document pack",
        subitems: [makeWorkItem({ title: "Send the NDA" }), makeWorkItem({ title: "Share policy" })],
      });

    test("emits subtasks even when the template turns them off", () => {
      const noSubtasks = { ...standard, options: { ...standard.options, emitSubtasks: false } };

      const preview = buildPreview([grouped()], noSubtasks);

      expect(preview.items[0]!.task.subtasks).toHaveLength(2);
      expect(preview.items[0]!.task.subtasks!.map((sub) => sub.name)).toEqual([
        "Send the NDA",
        "Share policy",
      ]);
    });

    test("says that it overrode the template", () => {
      const noSubtasks = { ...standard, options: { ...standard.options, emitSubtasks: false } };

      const preview = buildPreview([grouped()], noSubtasks);

      expect(preview.warnings.some((w) => w.includes("subtasks were enabled"))).toBe(true);
    });

    /** The override is for nesting only; a flat list must not silently change. */
    test("leaves an ungrouped list alone", () => {
      const noSubtasks = { ...standard, options: { ...standard.options, emitSubtasks: false } };

      const preview = buildPreview([makeWorkItem({ title: "Standalone" })], noSubtasks);

      expect(preview.items[0]!.task.subtasks).toBeUndefined();
      expect(preview.warnings).toEqual([]);
    });

    test("does not warn when the template already emits subtasks", () => {
      const withSubtasks = { ...standard, options: { ...standard.options, emitSubtasks: true } };

      const preview = buildPreview([grouped()], withSubtasks);

      expect(preview.items[0]!.task.subtasks).toHaveLength(2);
      expect(preview.warnings).toEqual([]);
    });
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

/**
 * The point of this pass is that a status the target list does not define never
 * reaches ClickUp: sending one fails the whole create, so an unmatched status is
 * dropped (ClickUp then applies the list default) and the drop is reported.
 */
describe("annotateStatusMapping", () => {
  test("rewrites statuses to the list's real names", () => {
    const preview = buildPreview([makeWorkItem({ status: "done" })], standard);
    const annotated = annotateStatusMapping(preview, ["to do", "Complete"]);
    expect(annotated.items[0]!.task.status).toBe("Complete");
    expect(annotated.statusMapping[0]!.method).toBe("synonym");
  });

  test("removes an unmatched status and warns", () => {
    const preview = buildPreview([makeWorkItem({ status: "nonsense-status" })], standard);
    const annotated = annotateStatusMapping(preview, ["to do", "Complete"]);
    expect(annotated.items[0]!.task.status).toBeUndefined();
    expect(annotated.warnings.some((w) => w.includes("nonsense-status"))).toBe(true);
  });

  test("leaves items without a status untouched", () => {
    const preview = buildPreview([makeWorkItem()], standard);
    const annotated = annotateStatusMapping(preview, ["to do"]);
    expect(annotated.items[0]!.task.status).toBeUndefined();
    expect(annotated.statusMapping).toEqual([]);
  });

  test("drops every status when the list reports none", () => {
    const preview = buildPreview([makeWorkItem({ status: "complete" })], standard);
    const annotated = annotateStatusMapping(preview, []);
    expect(annotated.items[0]!.task.status).toBeUndefined();
  });

  test("reports a repeated status once but rewrites every item", () => {
    const preview = buildPreview(
      [makeWorkItem({ title: "A", status: "done" }), makeWorkItem({ title: "B", status: "done" })],
      standard
    );
    const annotated = annotateStatusMapping(preview, ["Complete"]);
    expect(annotated.items.map((i) => i.task.status)).toEqual(["Complete", "Complete"]);
    expect(annotated.statusMapping.length).toBe(1);
  });

  test("does not mutate the preview it was given", () => {
    const preview = buildPreview([makeWorkItem({ status: "done" })], standard);
    annotateStatusMapping(preview, ["Complete"]);
    expect(preview.items[0]!.task.status).toBe("done");
    expect(preview.warnings).toEqual([]);
  });

  test("keeps warnings the preview already carried", () => {
    const preview = buildPreview([], standard);
    const annotated = annotateStatusMapping(preview, ["Complete"]);
    expect(annotated.warnings.some((w) => w.includes("No work items"))).toBe(true);
  });
});
