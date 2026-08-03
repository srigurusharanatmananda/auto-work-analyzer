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

  /**
   * Unstructured notes are the gap the tests above missed: they all use the
   * structured format, which is the one path where `priority` is already set.
   * NotesProcessor's bullet/free-form paths set `complexity` only, and
   * structured parsing needs BOTH a "---" and a "Task N:" heading — so a plain
   * bullet list has no `priority` at all, and reading only that field collapsed
   * every item to "normal", discarding the low/medium/high the source derived
   * and flattening the created task's ClickUp priority with it.
   */
  describe("unstructured (plain bullet) notes derive priority from complexity", () => {
    test("a high-complexity bullet becomes priority high", async () => {
      const items = await workItemsFromNotes(
        "- Refactor the database architecture for the payment system\n"
      );
      expect(items.length).toBe(1);
      expect(items[0]!.priority).toBe("high");
    });

    test("a low-complexity bullet becomes priority low", async () => {
      const items = await workItemsFromNotes("- Fix a simple typo in the footer label\n");
      expect(items[0]!.priority).toBe("low");
    });

    test("a medium-complexity bullet becomes priority normal", async () => {
      const items = await workItemsFromNotes(
        "- Add a new endpoint for retrieving user notification preferences\n"
      );
      expect(items[0]!.priority).toBe("normal");
    });

    test("high and low are distinguished, not flattened to a single value", async () => {
      // The regression this guards is specifically the *loss of distinction*:
      // before the fix both of these returned "normal".
      const [high] = await workItemsFromNotes("- Rewrite the integration layer\n");
      const [low] = await workItemsFromNotes("- Update a small text label\n");
      expect(high!.priority).not.toBe(low!.priority);
    });
  });

  test("an explicit Priority: line wins over the complexity fallback", async () => {
    // "urgent" is the discriminator: complexity has only three levels and the
    // fallback can never produce it, so getting "urgent" proves the explicit
    // branch ran. This item's complexity is "high", so the fallback would have
    // returned "high" — a different, wrong answer.
    const items = await workItemsFromNotes(
      "Task 1: Fix payment processing\nPriority: CRITICAL\nEstimate: 4 hours\nDescription: x.\n\n---\n"
    );
    expect(items[0]!.priority).toBe("urgent");
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

  /**
   * Git-derived work is completed by definition — the commits exist — and the
   * old inline formatter in GitWorkAnalyzer.createTasksFromWork encoded that by
   * setting `status: "complete"` and tagging every task with
   * [type, "git-analyzed", analysisDate, ...ownTags]. Once that path started
   * rendering through a template, both came from the WorkItem instead, and this
   * source supplied neither: completed work landed in the destination list's
   * default (usually open) status and lost two tags. The faithful population of
   * the canonical item belongs here, in the source.
   */
  describe("populates the fields the old inline git formatter used to set", () => {
    test("marks git-derived items complete", () => {
      expect(workItemsFromAnalysis(analysis)[0]!.status).toBe("complete");
    });

    test("an explicit status on the detected work wins", () => {
      const explicit: WorkAnalysisResult = {
        ...analysis,
        detectedWork: [
          { ...analysis.detectedWork[0]!, status: "in progress" } as (typeof analysis.detectedWork)[0],
        ],
      };
      expect(workItemsFromAnalysis(explicit)[0]!.status).toBe("in progress");
    });

    test("tags with the type, git-analyzed, the analysis date, and the item's own tags", () => {
      expect(workItemsFromAnalysis(analysis)[0]!.tags).toEqual([
        "bug-fix",
        "git-analyzed",
        "2026-07-29",
        "mobile",
      ]);
    });

    test("does not duplicate a tag the detected work already carries", () => {
      const dupes: WorkAnalysisResult = {
        ...analysis,
        detectedWork: [
          { ...analysis.detectedWork[0]!, tags: ["bug-fix", "2026-07-29", "mobile"] },
        ],
      };
      expect(workItemsFromAnalysis(dupes)[0]!.tags).toEqual([
        "bug-fix",
        "git-analyzed",
        "2026-07-29",
        "mobile",
      ]);
    });

    test("tolerates detected work with no tags at all", () => {
      const untagged: WorkAnalysisResult = {
        ...analysis,
        detectedWork: [{ ...analysis.detectedWork[0]!, tags: undefined as unknown as string[] }],
      };
      expect(workItemsFromAnalysis(untagged)[0]!.tags).toEqual([
        "bug-fix",
        "git-analyzed",
        "2026-07-29",
      ]);
    });
  });
});
