import { describe, expect, test } from "bun:test";
import { AiCommitGrouper } from "./AiCommitGrouper.js";
import { validateGroupResponse } from "./groupingSchema.js";
import { AiClient } from "../ai/AiClient.js";
import type { AiProvider } from "../ai/AiClient.js";
import type { GitCommit } from "../types/index.js";

const commits: GitCommit[] = [
  { hash: "aaa1111", author: "d", date: "2026-07-12", message: "feat: part one", files: ["a.ts"], insertions: 5, deletions: 0 },
  { hash: "bbb2222", author: "d", date: "2026-07-29", message: "feat: part two", files: ["b.ts"], insertions: 7, deletions: 1 },
];

const context = { analysisDate: "2026-07-29", repository: "repo" };

const clientReturning = (text: string): AiClient => {
  const provider: AiProvider = { name: "fake", generate: async () => text };
  return new AiClient([provider]);
};

const validResponse = JSON.stringify({
  groups: [
    {
      title: "Build the two-part feature",
      description: "Delivered in two commits.",
      type: "feature",
      priority: "high",
      estimateHours: 6,
      commitHashes: ["aaa1111", "bbb2222"],
    },
  ],
});

/** The valid group, with one field overridden. */
const groupWith = (overrides: Record<string, unknown>) => ({
  ...JSON.parse(validResponse).groups[0],
  ...overrides,
});

describe("validateGroupResponse", () => {
  test("accepts a well-formed, fully covering response", () => {
    const result = validateGroupResponse(JSON.parse(validResponse), commits);
    expect(result.ok).toBe(true);
  });

  test("rejects a hallucinated commit hash", () => {
    const result = validateGroupResponse({ groups: [groupWith({ commitHashes: ["zzz9999"] })] }, commits);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/zzz9999/);
  });

  test("rejects a response that leaves a commit uncovered", () => {
    const result = validateGroupResponse({ groups: [groupWith({ commitHashes: ["aaa1111"] })] }, commits);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/bbb2222|uncovered/i);
  });

  test("rejects the same commit claimed by two groups", () => {
    const raw = {
      groups: [
        groupWith({ title: "First", commitHashes: ["aaa1111", "bbb2222"] }),
        groupWith({ title: "Second", commitHashes: ["bbb2222"] }),
      ],
    };
    const result = validateGroupResponse(raw, commits);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/bbb2222/);
  });

  test("rejects a hash repeated inside one group", () => {
    const raw = { groups: [groupWith({ commitHashes: ["aaa1111", "aaa1111", "bbb2222"] })] };
    expect(validateGroupResponse(raw, commits).ok).toBe(false);
  });

  test("rejects an unknown type", () => {
    expect(validateGroupResponse({ groups: [groupWith({ type: "sorcery" })] }, commits).ok).toBe(false);
  });

  test("rejects an unknown priority", () => {
    expect(validateGroupResponse({ groups: [groupWith({ priority: "whenever" })] }, commits).ok).toBe(false);
  });

  test("rejects a missing title", () => {
    const group = groupWith({});
    delete group.title;
    expect(validateGroupResponse({ groups: [group] }, commits).ok).toBe(false);
  });

  test("rejects a blank title", () => {
    expect(validateGroupResponse({ groups: [groupWith({ title: "   " })] }, commits).ok).toBe(false);
  });

  test("rejects a non-positive or non-numeric estimateHours", () => {
    expect(validateGroupResponse({ groups: [groupWith({ estimateHours: 0 })] }, commits).ok).toBe(false);
    expect(validateGroupResponse({ groups: [groupWith({ estimateHours: -3 })] }, commits).ok).toBe(false);
    expect(validateGroupResponse({ groups: [groupWith({ estimateHours: "six" })] }, commits).ok).toBe(false);
    expect(validateGroupResponse({ groups: [groupWith({ estimateHours: NaN })] }, commits).ok).toBe(false);
  });

  test("rejects a group citing no commits", () => {
    expect(validateGroupResponse({ groups: [groupWith({ commitHashes: [] })] }, commits).ok).toBe(false);
  });

  test("rejects zero groups", () => {
    expect(validateGroupResponse({ groups: [] }, commits).ok).toBe(false);
  });

  test("rejects a non-object payload", () => {
    expect(validateGroupResponse("nope", commits).ok).toBe(false);
    expect(validateGroupResponse(null, commits).ok).toBe(false);
    expect(validateGroupResponse({ notGroups: [] }, commits).ok).toBe(false);
    expect(validateGroupResponse({ groups: [null] }, commits).ok).toBe(false);
  });
});

describe("AiCommitGrouper", () => {
  test("returns ai mode on a valid response", async () => {
    const grouper = new AiCommitGrouper(clientReturning(validResponse));
    const result = await grouper.group(commits, context);
    expect(result.mode).toBe("ai");
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.title).toBe("Build the two-part feature");
    expect(result.fallbackReason).toBeUndefined();
  });

  test("derives completedDate from the latest cited commit, never from the model", async () => {
    const withDate = JSON.stringify({
      groups: [groupWith({ completedDate: "1999-01-01", dueDate: "1999-01-01" })],
    });
    const result = await new AiCommitGrouper(clientReturning(withDate)).group(commits, context);
    expect(result.items[0]!.completedDate).toBe("2026-07-29");
  });

  test("attaches the cited commits as provenance", async () => {
    const grouper = new AiCommitGrouper(clientReturning(validResponse));
    const item = (await grouper.group(commits, context)).items[0]!;
    expect(item.provenance.commits.map((c) => c.hash).sort()).toEqual(["aaa1111", "bbb2222"]);
    expect(item.provenance.files.sort()).toEqual(["a.ts", "b.ts"]);
    expect(item.provenance.repository).toBe("repo");
    expect(item.provenance.source).toBe("git");
  });

  test("keeps the git-analyzed provenance tags the heuristic path attaches", async () => {
    const item = (await new AiCommitGrouper(clientReturning(validResponse)).group(commits, context))
      .items[0]!;
    expect(item.tags).toContain("git-analyzed");
    expect(item.tags).toContain("feature");
    expect(item.tags).toContain("2026-07-29");
  });

  test("tolerates a response wrapped in a markdown code fence", async () => {
    const fenced = "Here you go:\n```json\n" + validResponse + "\n```";
    const result = await new AiCommitGrouper(clientReturning(fenced)).group(commits, context);
    expect(result.mode).toBe("ai");
  });

  test("falls back to heuristics on malformed JSON", async () => {
    const result = await new AiCommitGrouper(clientReturning("not json at all")).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toBeTruthy();
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("falls back on a truncated response", async () => {
    const truncated = validResponse.slice(0, validResponse.length - 12);
    const result = await new AiCommitGrouper(clientReturning(truncated)).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toBeTruthy();
  });

  test("falls back on an empty response", async () => {
    const result = await new AiCommitGrouper(clientReturning("")).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toBeTruthy();
  });

  test("falls back on a hallucinated hash", async () => {
    const bad = JSON.stringify({ groups: [groupWith({ commitHashes: ["zzz9999"] })] });
    const result = await new AiCommitGrouper(clientReturning(bad)).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toMatch(/zzz9999/);
  });

  test("falls back when the model drops a commit", async () => {
    const bad = JSON.stringify({ groups: [groupWith({ commitHashes: ["aaa1111"] })] });
    const result = await new AiCommitGrouper(clientReturning(bad)).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toMatch(/bbb2222|uncovered/i);
  });

  test("falls back when the model duplicates a commit across groups", async () => {
    const bad = JSON.stringify({
      groups: [
        groupWith({ title: "First", commitHashes: ["aaa1111", "bbb2222"] }),
        groupWith({ title: "Second", commitHashes: ["bbb2222"] }),
      ],
    });
    const result = await new AiCommitGrouper(clientReturning(bad)).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toBeTruthy();
  });

  test("falls back when every provider fails", async () => {
    const failing = new AiClient([
      { name: "fake", generate: async () => { throw new Error("boom"); } },
    ]);
    const result = await new AiCommitGrouper(failing).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toMatch(/boom/);
  });

  test("falls back immediately when no provider is configured", async () => {
    const result = await new AiCommitGrouper(new AiClient([])).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toMatch(/No AI providers configured/);
  });

  test("returns no items and does not call the model for no commits", async () => {
    let called = false;
    const client = new AiClient([
      { name: "fake", generate: async () => { called = true; return validResponse; } },
    ]);
    const result = await new AiCommitGrouper(client).group([], context);
    expect(result.items).toEqual([]);
    expect(called).toBe(false);
  });

  test("never loses or duplicates a commit, on either path", async () => {
    const cases: Array<[string, string]> = [
      ["valid", validResponse],
      ["malformed", "garbage"],
      ["dropped commit", JSON.stringify({ groups: [groupWith({ commitHashes: ["aaa1111"] })] })],
      ["hallucinated", JSON.stringify({ groups: [groupWith({ commitHashes: ["zzz9999"] })] })],
    ];

    for (const [label, response] of cases) {
      const result = await new AiCommitGrouper(clientReturning(response)).group(commits, context);
      const covered = result.items.flatMap((item) => item.provenance.commits.map((c) => c.hash));
      expect(covered.sort(), label).toEqual(["aaa1111", "bbb2222"]);
    }
  });
});

/**
 * Chunking is where the coverage invariant is most likely to break: each chunk
 * is validated against itself, so a bug in how chunks partition the input would
 * show up as a commit covered twice or not at all.
 */
describe("AiCommitGrouper chunking", () => {
  const many: GitCommit[] = Array.from({ length: 25 }, (_, index) => ({
    hash: `hash${String(index).padStart(3, "0")}`,
    author: "d",
    // Deliberately unsorted input: chunk() sorts by date, so the chunk a commit
    // lands in is not its input position.
    date: `2026-07-${String(28 - index).padStart(2, "0")}`,
    message: `feat: thing ${index}`,
    files: [`file${index}.ts`],
    insertions: 1,
    deletions: 0,
  }));

  /** Answers every chunk with one group citing exactly that chunk's commits. */
  const chunkEchoClient = (onPrompt?: (hashes: string[]) => void): AiClient =>
    new AiClient([
      {
        name: "fake",
        generate: async (prompt: string) => {
          const hashes = many.map((c) => c.hash).filter((hash) => prompt.includes(hash));
          onPrompt?.(hashes);
          return JSON.stringify({
            groups: [
              {
                title: `Group of ${hashes.length}`,
                description: "d",
                type: "feature",
                priority: "normal",
                estimateHours: 2,
                commitHashes: hashes,
              },
            ],
          });
        },
      },
    ]);

  test("splits into chunks of at most chunkSize", async () => {
    const sizes: number[] = [];
    const grouper = new AiCommitGrouper(chunkEchoClient((hashes) => sizes.push(hashes.length)), 10);
    await grouper.group(many, context);
    expect(sizes).toEqual([10, 10, 5]);
  });

  test("covers every commit exactly once across chunk boundaries", async () => {
    const result = await new AiCommitGrouper(chunkEchoClient(), 10).group(many, context);
    expect(result.mode).toBe("ai");

    const covered = result.items.flatMap((item) => item.provenance.commits.map((c) => c.hash));
    expect(covered.length).toBe(25);
    expect(new Set(covered).size).toBe(25);
    expect(covered.sort()).toEqual(many.map((c) => c.hash).sort());
  });

  test("each item's completedDate is the latest date among its own commits", async () => {
    const result = await new AiCommitGrouper(chunkEchoClient(), 10).group(many, context);
    for (const item of result.items) {
      const latest = item.provenance.commits.map((c) => c.date).sort().pop();
      expect(item.completedDate).toBe(latest);
    }
  });

  test("a chunk size larger than the commit set issues one call", async () => {
    let calls = 0;
    const client = new AiClient([
      {
        name: "fake",
        generate: async (prompt: string) => {
          calls += 1;
          const hashes = many.map((c) => c.hash).filter((hash) => prompt.includes(hash));
          return JSON.stringify({
            groups: [{ title: "All", description: "d", type: "feature", priority: "normal", estimateHours: 2, commitHashes: hashes }],
          });
        },
      },
    ]);
    await new AiCommitGrouper(client, 1000).group(many, context);
    expect(calls).toBe(1);
  });

  test("one bad chunk falls the whole run back, still covering every commit once", async () => {
    let call = 0;
    const client = new AiClient([
      {
        name: "fake",
        generate: async (prompt: string) => {
          call += 1;
          // Second chunk comes back unusable; the first was fine.
          if (call === 2) return "total garbage";
          const hashes = many.map((c) => c.hash).filter((hash) => prompt.includes(hash));
          return JSON.stringify({
            groups: [{ title: "Fine", description: "d", type: "feature", priority: "normal", estimateHours: 2, commitHashes: hashes }],
          });
        },
      },
    ]);

    const result = await new AiCommitGrouper(client, 10).group(many, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toBeTruthy();

    // The half-finished AI items must not leak into the fallback output.
    const covered = result.items.flatMap((item) => item.provenance.commits.map((c) => c.hash));
    expect(covered.length).toBe(25);
    expect(new Set(covered).size).toBe(25);
  });
});
