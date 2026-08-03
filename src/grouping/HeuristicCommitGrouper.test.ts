import { describe, expect, test } from "bun:test";
import { HeuristicCommitGrouper } from "./HeuristicCommitGrouper.js";
import type { GitCommit } from "../types/index.js";

const commit = (overrides: Partial<GitCommit> = {}): GitCommit => ({
  hash: "abc1234567",
  author: "dev@example.com",
  date: "2026-07-29",
  message: "feat: add a thing",
  files: ["src/thing.ts"],
  insertions: 10,
  deletions: 1,
  ...overrides,
});

const context = { analysisDate: "2026-07-29", repository: "repo" };

describe("HeuristicCommitGrouper", () => {
  test("reports heuristic mode", async () => {
    const result = await new HeuristicCommitGrouper().group([commit()], context);
    expect(result.mode).toBe("heuristic");
  });

  test("reports no fallbackReason — it is nobody's fallback", async () => {
    const result = await new HeuristicCommitGrouper().group([commit()], context);
    expect(result.fallbackReason).toBeUndefined();
  });

  test("returns no items for no commits", async () => {
    const result = await new HeuristicCommitGrouper().group([], context);
    expect(result.items).toEqual([]);
  });

  test("classifies a fix commit as a bug-fix", async () => {
    const result = await new HeuristicCommitGrouper().group(
      [commit({ message: "fix: resolve the crash on launch" })],
      context
    );
    expect(result.items[0]!.type).toBe("bug-fix");
  });

  test("classifies a feat commit as a feature", async () => {
    const result = await new HeuristicCommitGrouper().group(
      [commit({ message: "feat: add voice input" })],
      context
    );
    expect(result.items[0]!.type).toBe("feature");
  });

  test("attaches git provenance to every item", async () => {
    const result = await new HeuristicCommitGrouper().group([commit()], context);
    const item = result.items[0]!;
    expect(item.provenance.source).toBe("git");
    expect(item.provenance.repository).toBe("repo");
    expect(item.provenance.commits.length).toBeGreaterThan(0);
  });

  test("covers every input commit exactly once", async () => {
    const commits = [
      commit({ hash: "aaa1111", message: "feat: one" }),
      commit({ hash: "bbb2222", message: "fix: two" }),
      commit({ hash: "ccc3333", message: "docs: three" }),
    ];
    const result = await new HeuristicCommitGrouper().group(commits, context);
    const covered = result.items.flatMap((item) => item.provenance.commits.map((c) => c.hash));
    expect(covered.sort()).toEqual(["aaa1111", "bbb2222", "ccc3333"]);
  });

  test("derives completedDate from the latest covered commit", async () => {
    const result = await new HeuristicCommitGrouper().group(
      [
        commit({ hash: "a", date: "2026-07-12", message: "feat: early" }),
        commit({ hash: "b", date: "2026-07-29", message: "feat: late" }),
      ],
      context
    );
    for (const item of result.items) {
      const dates = item.provenance.commits.map((c) => c.date).sort();
      expect(item.completedDate).toBe(dates[dates.length - 1]);
    }
  });

  test("merges near-identical work into one item, still covering both commits", async () => {
    const result = await new HeuristicCommitGrouper().group(
      [
        commit({ hash: "aaa1111", message: "fix resolve the login timeout" }),
        commit({ hash: "bbb2222", message: "fix resolve the login timeouts" }),
      ],
      context
    );
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.provenance.commits.map((c) => c.hash).sort()).toEqual([
      "aaa1111",
      "bbb2222",
    ]);
  });

  test("covers a large mixed commit set exactly once, losing and duplicating nothing", async () => {
    const messages = [
      "feat: add search",
      "fix resolve the crash",
      "docs: update readme",
      "refactor: update the client",
      "test: add unit test",
      "chore: bump deps",
    ];
    const commits = Array.from({ length: 60 }, (_, index) =>
      commit({
        hash: `hash${String(index).padStart(3, "0")}`,
        message: `${messages[index % messages.length]} ${index}`,
        date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      })
    );

    const result = await new HeuristicCommitGrouper().group(commits, context);
    const covered = result.items.flatMap((item) => item.provenance.commits.map((c) => c.hash));

    expect(covered.length).toBe(60);
    expect(new Set(covered).size).toBe(60);
    expect(covered.sort()).toEqual(commits.map((c) => c.hash).sort());
  });
});
