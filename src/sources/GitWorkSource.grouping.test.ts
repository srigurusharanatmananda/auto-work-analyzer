import { describe, expect, test } from "bun:test";
import { workItemsFromCommits } from "./GitWorkSource.js";
import { workItemsFromAnalysis } from "./GitWorkSource.js";
import { HeuristicCommitGrouper } from "../grouping/HeuristicCommitGrouper.js";
import { AiCommitGrouper } from "../grouping/AiCommitGrouper.js";
import { AiClient } from "../ai/AiClient.js";
import type { GitCommit, WorkAnalysisResult } from "../types/index.js";

const commits: GitCommit[] = [
  { hash: "aaa1111", author: "d", date: "2026-07-29", message: "fix: crash on launch", files: ["a.ts"], insertions: 3, deletions: 1 },
];

const context = { analysisDate: "2026-07-29", repository: "repo" };

const aiResponse = JSON.stringify({
  groups: [
    {
      title: "Fix the launch crash",
      description: "The app crashed on cold start.",
      type: "bug-fix",
      priority: "urgent",
      estimateHours: 2,
      commitHashes: ["aaa1111"],
    },
  ],
});

describe("workItemsFromCommits", () => {
  test("uses the supplied grouper and reports its mode", async () => {
    const result = await workItemsFromCommits(commits, context, new HeuristicCommitGrouper());
    expect(result.mode).toBe("heuristic");
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("reports ai mode and no fallbackReason on the AI path", async () => {
    const client = new AiClient([{ name: "fake", generate: async () => aiResponse }]);
    const result = await workItemsFromCommits(commits, context, new AiCommitGrouper(client));
    expect(result.mode).toBe("ai");
    expect(result.fallbackReason).toBeUndefined();
    expect(result.items[0]!.title).toBe("Fix the launch crash");
  });

  test("surfaces the fallback reason when the AI path fails", async () => {
    const client = new AiClient([{ name: "fake", generate: async () => "garbage" }]);
    const result = await workItemsFromCommits(commits, context, new AiCommitGrouper(client));
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toBeTruthy();
  });

  test("covers every commit exactly once whichever grouper ran", async () => {
    const groupers = [
      new HeuristicCommitGrouper(),
      new AiCommitGrouper(new AiClient([{ name: "fake", generate: async () => aiResponse }])),
      new AiCommitGrouper(new AiClient([])),
    ];

    for (const grouper of groupers) {
      const result = await workItemsFromCommits(commits, context, grouper);
      const covered = result.items.flatMap((item) => item.provenance.commits.map((c) => c.hash));
      expect(covered).toEqual(["aaa1111"]);
    }
  });

  test("returns no items for no commits, without a fallbackReason", async () => {
    const result = await workItemsFromCommits([], context, new HeuristicCommitGrouper());
    expect(result.items).toEqual([]);
    expect(result.fallbackReason).toBeUndefined();
  });
});

/**
 * workItemsFromAnalysis is Slice 1's adapter for already-grouped input. Adding
 * the commits entry point must not have changed it — callers pass a
 * WorkAnalysisResult and depend on it behaving as it did.
 */
describe("workItemsFromAnalysis is unchanged", () => {
  test("still adapts a WorkAnalysisResult synchronously, returning a bare array", () => {
    const analysis: WorkAnalysisResult = {
      date: "2026-07-29",
      totalCommits: 1,
      totalFilesChanged: 1,
      totalLinesAdded: 3,
      totalLinesDeleted: 1,
      detectedWork: [
        {
          type: "bug-fix",
          name: "crash on launch",
          description: "desc",
          files: ["a.ts"],
          commits,
          complexity: "low",
          estimatedHours: 1,
          tags: ["backend"],
        },
      ],
      summary: "s",
    };

    const items = workItemsFromAnalysis(analysis, "repo");
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0]!.title).toBe("crash on launch");
    expect(items[0]!.type).toBe("bug-fix");
    expect(items[0]!.completedDate).toBe("2026-07-29");
    expect(items[0]!.tags).toContain("git-analyzed");
    expect(items[0]!.provenance.repository).toBe("repo");
  });
});
