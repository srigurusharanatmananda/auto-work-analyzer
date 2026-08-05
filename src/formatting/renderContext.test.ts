import { describe, expect, test } from "bun:test";
import { makeWorkItem } from "../domain/WorkItem.js";
import { buildRenderContext, WORK_ITEM_SCHEMA } from "./renderContext.js";
import { validateTemplate } from "./TemplateEngine.js";
import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";

describe("buildRenderContext", () => {
  test("exposes labels derived from the work item", () => {
    const context = buildRenderContext(
      makeWorkItem({ type: "bug-fix", priority: "urgent", estimateHours: 4 })
    );
    expect(context.typeLabel).toBe("Bug Fix");
    expect(context.typeEmoji).toBe("🐛");
    expect(context.priorityLabel).toBe("CRITICAL");
    expect(context.estimateHours).toBe(4);
  });

  test("exposes commit fields including a short hash", () => {
    const item = makeWorkItem({
      provenance: {
        source: "git",
        files: ["a.ts", "b.ts"],
        commits: [
          {
            hash: "3b912cd0aa11bb22cc33",
            author: "dev@example.com",
            date: "2026-07-29",
            message: "fix(meditation): stabilize player layout",
            files: ["a.ts"],
            insertions: 10,
            deletions: 2,
          },
        ],
      },
    });
    const context = buildRenderContext(item);
    const commits = context.commits as Array<Record<string, unknown>>;
    expect(commits.length).toBe(1);
    expect(commits[0]!.shortHash).toBe("3b912cd");
    expect(commits[0]!.message).toBe("fix(meditation): stabilize player layout");
    expect(context.commitCount).toBe(1);
    expect(context.fileCount).toBe(2);
  });

  test("dateRange is empty when there are no commits", () => {
    expect(buildRenderContext(makeWorkItem()).dateRange).toBe("");
  });

  test("dateRange spans the earliest and latest commit dates", () => {
    const commit = (date: string, hash: string) => ({
      hash, author: "d", date, message: "m", files: [], insertions: 0, deletions: 0,
    });
    const context = buildRenderContext(
      makeWorkItem({
        provenance: {
          source: "git",
          files: [],
          commits: [commit("2026-07-29", "a"), commit("2026-07-12", "b")],
        },
      })
    );
    expect(context.dateRange).toBe("2026-07-12 → 2026-07-29");
  });

  test("a single commit date yields that date alone", () => {
    const context = buildRenderContext(
      makeWorkItem({
        provenance: {
          source: "git",
          files: [],
          commits: [{ hash: "a", author: "d", date: "2026-07-29", message: "m", files: [], insertions: 0, deletions: 0 }],
        },
      })
    );
    expect(context.dateRange).toBe("2026-07-29");
  });
});

describe("BUILTIN_TEMPLATES", () => {
  test("all built-ins validate against the work item schema", () => {
    expect(BUILTIN_TEMPLATES.length).toBe(3);
    for (const template of BUILTIN_TEMPLATES) {
      expect(validateTemplate(template.nameTemplate, WORK_ITEM_SCHEMA)).toEqual([]);
      expect(validateTemplate(template.descriptionTemplate, WORK_ITEM_SCHEMA)).toEqual([]);
      expect(template.isBuiltin).toBe(true);
    }
  });

  test("the standard template is the documented default", () => {
    const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard");
    expect(standard).toBeDefined();
    expect(standard!.nameTemplate).toBe("{{title}}");
    expect(standard!.options.dueDateSource).toBe("completedDate");
  });
});
