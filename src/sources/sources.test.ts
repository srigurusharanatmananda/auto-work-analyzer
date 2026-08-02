import { describe, expect, test } from "bun:test";
import { workItemsFromNotes } from "./NotesWorkSource.js";
import { workItemsFromAnalysis } from "./GitWorkSource.js";
import { WorkAnalysisResult } from "../types/index.js";

describe("workItemsFromNotes", () => {
  const notes = [
    "Task 1: Fix payment processing",
    "Priority: CRITICAL",
    "Estimate: 4 hours",
    "Status: complete",
    "Completed: 2026-07-30",
    "Description: Payments failed for certain card types.",
    "",
    "---",
    "",
    "Task 2: Write API documentation",
    "Priority: LOW",
    "Estimate: 2 hours",
    "Description: Document all REST endpoints.",
  ].join("\n");

  test("maps structured notes onto WorkItems", async () => {
    const items = await workItemsFromNotes(notes);
    expect(items.length).toBe(2);

    expect(items[0]!.title).toBe("Fix payment processing");
    expect(items[0]!.priority).toBe("urgent");
    expect(items[0]!.estimateHours).toBe(4);
    expect(items[0]!.status).toBe("complete");
    expect(items[0]!.completedDate).toBe("2026-07-30");
    expect(items[0]!.description).toBe("Payments failed for certain card types.");
    expect(items[0]!.provenance.source).toBe("notes");
    expect(items[0]!.provenance.commits).toEqual([]);
  });

  test("defaults priority to normal when the field is absent", async () => {
    const items = await workItemsFromNotes(
      "Task 1: Something\nEstimate: 1 hours\nDescription: Do it.\n\n---\n\nTask 2: Other\nDescription: Also.",
    );
    expect(items[0]!.priority).toBe("normal");
  });

  test("strips the Description: label whichever form the note uses", async () => {
    const inline = await workItemsFromNotes(
      "Task 1: A\nPriority: HIGH\nDescription: Inline body.\n\n---\n\nTask 2: B\nDescription: Other."
    );
    expect(inline[0]!.description).toBe("Inline body.");

    const labelled = await workItemsFromNotes(
      "Task 1: A\nPriority: HIGH\nDescription:\nBody on its own line.\n\n---\n\nTask 2: B\nDescription: Other."
    );
    expect(labelled[0]!.description).toBe("Body on its own line.");
  });
});

describe("workItemsFromAnalysis", () => {
  const analysis: WorkAnalysisResult = {
    date: "2026-07-29",
    totalCommits: 2,
    totalFilesChanged: 3,
    totalLinesAdded: 100,
    totalLinesDeleted: 20,
    summary: "Two things happened.",
    detectedWork: [
      {
        type: "bug-fix",
        name: "Stabilize the meditation player layout",
        description: "The player jumped on rotation.",
        files: ["player.dart", "layout.dart"],
        complexity: "high",
        estimatedHours: 5,
        tags: ["mobile"],
        commits: [
          {
            hash: "3b912cd0aa",
            author: "dev@example.com",
            date: "2026-07-29",
            message: "fix(meditation): stabilize player layout",
            files: ["player.dart"],
            insertions: 40,
            deletions: 10,
          },
        ],
      },
    ],
  };

  test("maps detected work onto WorkItems with git provenance", () => {
    const items = workItemsFromAnalysis(analysis, "ask_nithyananda_app");
    expect(items.length).toBe(1);

    const item = items[0]!;
    expect(item.title).toBe("Stabilize the meditation player layout");
    expect(item.type).toBe("bug-fix");
    expect(item.estimateHours).toBe(5);
    expect(item.provenance.source).toBe("git");
    expect(item.provenance.repository).toBe("ask_nithyananda_app");
    expect(item.provenance.commits.length).toBe(1);
    expect(item.provenance.files).toEqual(["player.dart", "layout.dart"]);
  });

  test("derives priority from complexity when none is supplied", () => {
    expect(workItemsFromAnalysis(analysis)[0]!.priority).toBe("high");
  });

  test("derives completedDate from the latest commit", () => {
    expect(workItemsFromAnalysis(analysis)[0]!.completedDate).toBe("2026-07-29");
  });

  test("falls back to the analysis date when a work item has no commits", () => {
    const withoutCommits: WorkAnalysisResult = {
      ...analysis,
      detectedWork: [{ ...analysis.detectedWork[0]!, commits: [] }],
    };
    expect(workItemsFromAnalysis(withoutCommits)[0]!.completedDate).toBe("2026-07-29");
  });
});
