import { describe, expect, test } from "bun:test";
import { makeWorkItem, WorkItem } from "../domain/WorkItem.js";
import { NotesProcessor } from "../services/NotesProcessor.js";
import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";
import { renderMarkdown } from "./MarkdownRenderer.js";

const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;

describe("renderMarkdown", () => {
  test("emits numbered task blocks separated by ---", () => {
    const md = renderMarkdown(
      [makeWorkItem({ title: "First" }), makeWorkItem({ title: "Second" })],
      standard
    );
    expect(md).toContain("Task 1: First");
    expect(md).toContain("Task 2: Second");
    expect(md.split("\n---\n").length).toBe(2);
  });

  test("emits the metadata fields NotesProcessor parses", () => {
    const md = renderMarkdown(
      [
        makeWorkItem({
          title: "Fix login",
          priority: "urgent",
          estimateHours: 4,
          status: "complete",
          completedDate: "2026-07-29",
        }),
      ],
      standard
    );
    expect(md).toContain("Priority: CRITICAL");
    expect(md).toContain("Estimate: 4 hours");
    expect(md).toContain("Status: complete");
    expect(md).toContain("Completed: 2026-07-29");
    expect(md).toContain("Description:");
  });

  test("omits Status and Completed lines when absent", () => {
    const md = renderMarkdown([makeWorkItem()], standard);
    expect(md).not.toContain("Status:");
    expect(md).not.toContain("Completed:");
  });

  test("includes an optional header without breaking the first task block", () => {
    const md = renderMarkdown([makeWorkItem({ title: "Only" })], standard, {
      title: "3-Week Report",
      period: "2026-07-10 → 2026-08-02",
    });
    expect(md.startsWith("# 3-Week Report")).toBe(true);
    expect(md).toContain("2026-07-10 → 2026-08-02");
    expect(md).toContain("Task 1: Only");
  });
});

describe("round trip through NotesProcessor", () => {
  const items: WorkItem[] = [
    makeWorkItem({
      title: "Fix login",
      description: "Users were locked out after an update.\nKeychain entry was invalidated.",
      priority: "urgent",
      estimateHours: 6,
      status: "complete",
      completedDate: "2026-07-30",
    }),
    makeWorkItem({
      title: "Add voice input to chat",
      description: "Voice and image input in the mobile composer.",
      priority: "high",
      estimateHours: 10,
      status: "complete",
      completedDate: "2026-07-19",
    }),
    makeWorkItem({
      title: "Document the release process",
      description: "Write the publish runbook.",
      priority: "low",
      estimateHours: 2,
    }),
  ];

  test("re-parsing rendered markdown recovers the parseable fields", async () => {
    const md = renderMarkdown(items, standard);
    const parsed = await new NotesProcessor().processNotes(md);

    expect(parsed.tasks.length).toBe(items.length);

    for (let index = 0; index < items.length; index += 1) {
      const original = items[index]!;
      const actual = parsed.tasks[index]! as unknown as {
        name: string;
        priority: string;
        estimatedHours: number;
        status?: string;
        completedDate?: string;
      };

      expect(actual.name).toBe(original.title);
      expect(actual.priority).toBe(original.priority);
      expect(actual.estimatedHours).toBe(original.estimateHours);
      expect(actual.status).toBe(original.status);
      expect(actual.completedDate).toBe(original.completedDate);
    }
  });

  test("the parsed description has no leftover label prefix", async () => {
    const md = renderMarkdown([items[0]!], standard);
    const parsed = await new NotesProcessor().processNotes(md);
    // Exact equality, not toContain: a "Description: " prefix leaking into the
    // parsed body is precisely the bug this guards.
    expect(parsed.tasks[0]!.description.startsWith("Description:")).toBe(false);
    expect(parsed.tasks[0]!.description).toContain("Users were locked out after an update.");
    expect(parsed.tasks[0]!.description).toContain("Keychain entry was invalidated.");
  });
});
