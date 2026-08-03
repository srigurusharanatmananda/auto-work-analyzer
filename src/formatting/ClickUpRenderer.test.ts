import { describe, expect, test } from "bun:test";
import { makeWorkItem } from "../domain/WorkItem.js";
import { renderTasks } from "./ClickUpRenderer.js";
import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";
import { DEFAULT_TEMPLATE_OPTIONS, Template } from "./Template.js";

const template = (overrides: Partial<Template> = {}): Template => ({
  id: "t1",
  name: "Test",
  nameTemplate: "{{title}}",
  descriptionTemplate: "{{description}}",
  options: { ...DEFAULT_TEMPLATE_OPTIONS },
  isBuiltin: false,
  ...overrides,
});

describe("renderTasks", () => {
  test("renders name and description through the template", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ title: "Fix login", description: "Users were locked out." })],
      template({ nameTemplate: "{{typeEmoji}} {{title}}" })
    );
    expect(rendered!.task.name).toBe("✅ Fix login");
    expect(rendered!.task.description).toBe("Users were locked out.");
  });

  test("applyPriority false omits priority", () => {
    const [withPriority] = renderTasks([makeWorkItem({ priority: "urgent" })], template());
    expect(withPriority!.task.priority).toBe("urgent");

    const [without] = renderTasks(
      [makeWorkItem({ priority: "urgent" })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, applyPriority: false } })
    );
    expect(without!.task.priority).toBeUndefined();
  });

  test("applyTimeEstimate converts hours to milliseconds", () => {
    const [rendered] = renderTasks([makeWorkItem({ estimateHours: 4 })], template());
    expect(rendered!.task.timeEstimate).toBe(4 * 60 * 60 * 1000);

    const [without] = renderTasks(
      [makeWorkItem({ estimateHours: 4 })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, applyTimeEstimate: false } })
    );
    expect(without!.task.timeEstimate).toBeUndefined();
  });

  /**
   * The engine treated only null/undefined/false/"" as empty, so `{{#commitCount}}`
   * was truthy at 0 and every notes-sourced task shipped a literal
   * "**Commits:** 0 across 0 files" line to ClickUp. The engine-level fix is
   * pinned in TemplateEngine.test.ts, but nothing asserted it at the level a
   * user could see — which is exactly why it survived Task 2's review with a
   * green suite. This is that assertion: a real built-in template, a real
   * 0-commit item, and the rendered description a user would read.
   */
  describe("zero-commit items (notes-sourced) omit commit metadata", () => {
    const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;

    test("builtin-standard emits no Commits line for a 0-commit item", () => {
      const [rendered] = renderTasks([makeWorkItem()], standard);
      expect(rendered!.task.description).not.toContain("Commits:");
      expect(rendered!.task.description).not.toContain("0 across 0 files");
    });

    test("builtin-standard still emits the Commits line when commits exist", () => {
      const [rendered] = renderTasks(
        [
          makeWorkItem({
            provenance: {
              source: "git",
              files: ["a.ts"],
              commits: [
                {
                  hash: "abc1234",
                  author: "d",
                  date: "2026-07-29",
                  message: "m",
                  files: ["a.ts"],
                  insertions: 1,
                  deletions: 0,
                },
              ],
            },
          }),
        ],
        standard
      );
      expect(rendered!.task.description).toContain("**Commits:** 1 across 1 files");
    });
  });

  test("statusMode fromWorkItem passes the item status through", () => {
    const [rendered] = renderTasks([makeWorkItem({ status: "complete" })], template());
    expect(rendered!.task.status).toBe("complete");
  });

  test("statusMode destinationDefault omits status entirely", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ status: "complete" })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, statusMode: "destinationDefault" } })
    );
    expect(rendered!.task.status).toBeUndefined();
  });

  test("statusMode fixed overrides the item status", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ status: "complete" })],
      template({
        options: { ...DEFAULT_TEMPLATE_OPTIONS, statusMode: "fixed", fixedStatus: "in review" },
      })
    );
    expect(rendered!.task.status).toBe("in review");
  });

  test("dueDateSource completedDate uses the completion date", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ completedDate: "2026-07-29" })],
      template()
    );
    expect(rendered!.task.dueDate).toBe("2026-07-29");
  });

  test("dueDateSource lastCommitDate uses the latest commit", () => {
    const commit = (date: string) => ({
      hash: date, author: "d", date, message: "m", files: [], insertions: 0, deletions: 0,
    });
    const [rendered] = renderTasks(
      [
        makeWorkItem({
          completedDate: "2026-01-01",
          provenance: { source: "git", files: [], commits: [commit("2026-07-12"), commit("2026-07-29")] },
        }),
      ],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, dueDateSource: "lastCommitDate" } })
    );
    expect(rendered!.task.dueDate).toBe("2026-07-29");
  });

  test("dueDateSource none omits the due date", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ completedDate: "2026-07-29" })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, dueDateSource: "none" } })
    );
    expect(rendered!.task.dueDate).toBeUndefined();
  });

  test("tagStrategy none drops tags, fixed replaces them, merge unions them", () => {
    const item = makeWorkItem({ tags: ["api"] });

    const [none] = renderTasks(
      [item],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, tagStrategy: { mode: "none" } } })
    );
    expect(none!.task.tags).toEqual([]);

    const [fixed] = renderTasks(
      [item],
      template({
        options: { ...DEFAULT_TEMPLATE_OPTIONS, tagStrategy: { mode: "fixed", fixed: ["auto"] } },
      })
    );
    expect(fixed!.task.tags).toEqual(["auto"]);

    const [merged] = renderTasks(
      [item],
      template({
        options: { ...DEFAULT_TEMPLATE_OPTIONS, tagStrategy: { mode: "merge", fixed: ["auto", "api"] } },
      })
    );
    expect(merged!.task.tags!.sort()).toEqual(["api", "auto"]);
  });

  test("emitSubtasks controls whether subitems become subtasks", () => {
    const item = makeWorkItem({ subitems: [makeWorkItem({ title: "Sub" })] });

    const [without] = renderTasks([item], template());
    expect(without!.task.subtasks).toBeUndefined();

    const [withSubs] = renderTasks(
      [item],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, emitSubtasks: true } })
    );
    expect(withSubs!.task.subtasks!.length).toBe(1);
    expect(withSubs!.task.subtasks![0]!.name).toBe("Sub");
  });

  test("a task name longer than 500 characters is truncated", () => {
    const [rendered] = renderTasks([makeWorkItem({ title: "x".repeat(600) })], template());
    expect(rendered!.task.name.length).toBe(500);
  });

  test("every built-in template renders without throwing", () => {
    for (const builtin of BUILTIN_TEMPLATES) {
      const [rendered] = renderTasks([makeWorkItem()], builtin);
      expect(rendered!.task.name.length).toBeGreaterThan(0);
    }
  });
});
