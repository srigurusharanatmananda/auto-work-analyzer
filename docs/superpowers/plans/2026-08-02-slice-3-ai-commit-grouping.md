# Slice 3 — AI Commit Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group commits into semantic units of work — task-shaped rather than commit-shaped — using the existing AI provider chain, degrading safely to today's keyword heuristics whenever the AI path cannot be trusted.

**Architecture:** The provider chain is extracted out of `ManagerSummaryAIService` into a reusable `AiClient`. A `CommitGrouper` interface has two implementations: the extracted keyword heuristics and an AI grouper whose output is validated for schema conformance *and* commit coverage. Any failure — no key, bad JSON, hallucinated hash, uncovered commit — falls back to the heuristic grouper and reports that it did so, so degraded output is never mistaken for the good path.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), the existing Gemini/Groq/HuggingFace/OpenRouter provider chain, `bun test`.

## Global Constraints

- **Prerequisite:** Slice 1 is merged (this consumes `WorkItem`, `workItemsFromAnalysis`, `buildPreview`). Slice 2 is *not* required, but if merged, the preview response gains these fields alongside the destination fields.
- **Spec:** `docs/superpowers/specs/2026-08-02-clickup-formatting-destinations-design.md`.
- **Module system:** ESM. Every relative import ends in `.js`.
- **Test files:** co-locate as `src/**/*.test.ts`. Runner is `bun test`.
- **No new runtime dependencies.**
- **No network in tests.** Inject a fake `AiClient`; never call a real provider from a test.
- **`strictNullChecks` is `false`.** Do not enable it.
- **The AI must never invent a date.** Every `completedDate` is derived from a cited commit's date, and validation enforces it.
- **Name collision:** `src/services/ManagerSummaryAIService.ts` declares a local `interface WorkItem { name; type; description? }` unrelated to the domain `WorkItem`. Rename it to `SummaryWorkItem` in Task 1 before importing anything from `src/domain/`.
- **Commit trailer:** every commit message ends with
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
  shown as `<trailer>` below.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/ai/AiClient.ts` | Provider chain with sequential fallback; one `complete()` method |
| `src/grouping/CommitGrouper.ts` | Interface, `GroupingResult`, and shared types |
| `src/grouping/HeuristicCommitGrouper.ts` | Today's keyword grouping, extracted from `GitWorkAnalyzer` |
| `src/grouping/AiCommitGrouper.ts` | Prompt, response validation, chunking, fallback |
| `src/grouping/groupingSchema.ts` | Response shape validation |

---

### Task 1: Extract the provider chain into `AiClient`

**Files:**
- Create: `src/ai/AiClient.ts`
- Create: `src/ai/AiClient.test.ts`
- Modify: `src/services/ManagerSummaryAIService.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface AiProvider { name: string; generate(prompt: string): Promise<string> }`
  - `class AiClient { constructor(providers?: AiProvider[]); get isConfigured(): boolean; get providerNames(): string[]; complete(prompt: string): Promise<{ text: string; provider: string }> }`
  - `function createAiClientFromEnv(): AiClient`

- [ ] **Step 1: Write the failing test**

Create `src/ai/AiClient.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { AiClient, AiProvider } from "./AiClient.js";

const ok = (name: string, text: string): AiProvider => ({
  name,
  generate: async () => text,
});

const fails = (name: string, message: string): AiProvider => ({
  name,
  generate: async () => {
    throw new Error(message);
  },
});

describe("AiClient", () => {
  test("returns the first provider's result", async () => {
    const result = await new AiClient([ok("A", "hello"), ok("B", "unused")]).complete("p");
    expect(result.text).toBe("hello");
    expect(result.provider).toBe("A");
  });

  test("falls through to the next provider on failure", async () => {
    const result = await new AiClient([fails("A", "boom"), ok("B", "second")]).complete("p");
    expect(result.text).toBe("second");
    expect(result.provider).toBe("B");
  });

  test("falls through on a quota error", async () => {
    const result = await new AiClient([
      fails("A", "429 rate limit exceeded"),
      ok("B", "second"),
    ]).complete("p");
    expect(result.provider).toBe("B");
  });

  test("throws listing every provider error when all fail", async () => {
    const client = new AiClient([fails("A", "boom-a"), fails("B", "boom-b")]);
    await expect(client.complete("p")).rejects.toThrow(/boom-a[\s\S]*boom-b/);
  });

  test("throws a setup message when no providers are configured", async () => {
    await expect(new AiClient([]).complete("p")).rejects.toThrow(/No AI providers configured/);
  });

  test("isConfigured reflects whether any provider exists", () => {
    expect(new AiClient([]).isConfigured).toBe(false);
    expect(new AiClient([ok("A", "x")]).isConfigured).toBe(true);
  });

  test("providerNames lists the chain in order", () => {
    expect(new AiClient([ok("A", "x"), ok("B", "y")]).providerNames).toEqual(["A", "B"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/ai/AiClient.test.ts`
Expected: FAIL — `Cannot find module './AiClient.js'`

- [ ] **Step 3: Write `src/ai/AiClient.ts`**

Move the provider construction verbatim out of `ManagerSummaryAIService.initializeProviders` — the Gemini variants, Groq, HuggingFace, and OpenRouter blocks, each still gated on its env key. Do not change any model id, endpoint, or request body while moving them; this is a move, not a rewrite.

```ts
/**
 * Multi-provider AI client with sequential fallback.
 *
 * Extracted from ManagerSummaryAIService so commit grouping and summary
 * generation share one chain — adding a provider now benefits both.
 */

export interface AiProvider {
  name: string;
  generate(prompt: string): Promise<string>;
}

export interface AiCompletion {
  text: string;
  provider: string;
}

const QUOTA_KEYWORDS = ["quota", "rate limit", "too many requests", "429", "exceeded", "overloaded"];

export function isQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return QUOTA_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export class AiClient {
  constructor(private providers: AiProvider[] = []) {}

  get isConfigured(): boolean {
    return this.providers.length > 0;
  }

  get providerNames(): string[] {
    return this.providers.map((provider) => provider.name);
  }

  async complete(prompt: string): Promise<AiCompletion> {
    if (this.providers.length === 0) {
      throw new Error(
        "No AI providers configured. Add at least one API key to your .env file:\n" +
          "- GOOGLE_API_KEY (https://aistudio.google.com/apikey)\n" +
          "- GROQ_API_KEY (https://console.groq.com/keys)\n" +
          "- HUGGINGFACE_API_KEY (https://huggingface.co/settings/tokens)\n" +
          "- OPENROUTER_API_KEY (https://openrouter.ai/keys)"
      );
    }

    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      try {
        const text = await provider.generate(prompt);
        return { text, provider: provider.name };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ provider: provider.name, error: message });
        console.error(`${provider.name} failed:`, message);
        continue;
      }
    }

    throw new Error(
      `All AI providers failed.\n\nErrors:\n${errors
        .map((entry) => `${entry.provider}: ${entry.error}`)
        .join("\n")}`
    );
  }
}

/** Builds the chain from environment variables. */
export function createAiClientFromEnv(): AiClient {
  const providers: AiProvider[] = [];
  // Move the Gemini / Groq / HuggingFace / OpenRouter blocks here verbatim
  // from ManagerSummaryAIService.initializeProviders, pushing an AiProvider
  // for each configured key. Keep model ids and endpoints exactly as they are.
  return new AiClient(providers);
}
```

- [ ] **Step 4: Refactor `ManagerSummaryAIService` to use it**

In `src/services/ManagerSummaryAIService.ts`:

1. Rename the local `interface WorkItem` to `SummaryWorkItem` and update its uses in that file. This prevents a collision with the domain `WorkItem`.
2. Delete `initializeProviders`, the `AIProvider` interface, and `isQuotaError`.
3. Hold `private client = createAiClientFromEnv()` and make `generateManagerSummary` call `this.client.complete(prompt)`, returning `.text`.
4. Keep `buildPrompt` and the public method signature unchanged — `POST /api/manager-summary` must behave exactly as before.

- [ ] **Step 5: Run tests and verify the summary endpoint is unchanged**

Run: `bun test src/ai/AiClient.test.ts && bun run build`
Expected: 7 tests pass; build exits 0.

With a configured provider key, start the server and confirm `POST /api/manager-summary` still returns a summary. This is a refactor — a behaviour change here is a bug.

- [ ] **Step 6: Commit**

```bash
git add src/ai/AiClient.ts src/ai/AiClient.test.ts src/services/ManagerSummaryAIService.ts
git commit -m "refactor(ai): extract the multi-provider chain into a reusable AiClient

<trailer>"
```

---

### Task 2: Grouper interface and the extracted heuristic

**Files:**
- Create: `src/grouping/CommitGrouper.ts`
- Create: `src/grouping/HeuristicCommitGrouper.ts`
- Create: `src/grouping/HeuristicCommitGrouper.test.ts`

**Interfaces:**
- Consumes: `WorkItem` (Slice 1 Task 1), `GitCommit`, `GitWorkAnalyzer`'s existing detection logic.
- Produces:
  - `interface GroupingContext { analysisDate: string; repository?: string }`
  - `interface GroupingResult { items: WorkItem[]; mode: "ai" | "heuristic"; fallbackReason?: string }`
  - `interface CommitGrouper { group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult> }`
  - `class HeuristicCommitGrouper implements CommitGrouper`

- [ ] **Step 1: Write the failing test**

Create `src/grouping/HeuristicCommitGrouper.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { HeuristicCommitGrouper } from "./HeuristicCommitGrouper.js";
import { GitCommit } from "../types/index.js";

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
});
```

The coverage test is the contract the AI grouper must also satisfy — the same property, checked two ways.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/grouping/HeuristicCommitGrouper.test.ts`
Expected: FAIL — `Cannot find module './HeuristicCommitGrouper.js'`

- [ ] **Step 3: Write `src/grouping/CommitGrouper.ts`**

```ts
import { WorkItem } from "../domain/WorkItem.js";
import { GitCommit } from "../types/index.js";

export interface GroupingContext {
  /** Fallback date for items whose commits carry none. */
  analysisDate: string;
  repository?: string;
}

export interface GroupingResult {
  items: WorkItem[];
  mode: "ai" | "heuristic";
  /** Present only when mode is "heuristic" after an AI attempt failed. */
  fallbackReason?: string;
}

export interface CommitGrouper {
  group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult>;
}
```

- [ ] **Step 4: Write `src/grouping/HeuristicCommitGrouper.ts`**

Extract the existing keyword-based detection from `src/services/GitWorkAnalyzer.ts` — the methods that classify a commit's type, estimate complexity and hours, and generate tags. Move them, do not reimplement them. Where `GitWorkAnalyzer` still needs them for `/api/analyze`, have it delegate to this class rather than keeping a second copy.

```ts
import { WorkItem, WorkItemType } from "../domain/WorkItem.js";
import { GitCommit } from "../types/index.js";
import { CommitGrouper, GroupingContext, GroupingResult } from "./CommitGrouper.js";

/**
 * The pre-existing keyword grouping, extracted verbatim from GitWorkAnalyzer.
 *
 * This is the fallback path: it never fails, never needs a network call, and
 * always covers every input commit.
 */
export class HeuristicCommitGrouper implements CommitGrouper {
  async group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult> {
    if (commits.length === 0) {
      return { items: [], mode: "heuristic" };
    }

    // Group by detected type, matching GitWorkAnalyzer's existing behaviour.
    const buckets = new Map<WorkItemType, GitCommit[]>();
    for (const commit of commits) {
      const type = this.detectType(commit.message);
      const bucket = buckets.get(type) ?? [];
      bucket.push(commit);
      buckets.set(type, bucket);
    }

    const items: WorkItem[] = [];
    for (const [type, bucketCommits] of buckets) {
      const dates = bucketCommits.map((c) => c.date).sort();
      const files = Array.from(new Set(bucketCommits.flatMap((c) => c.files)));

      items.push({
        title: this.titleFor(type, bucketCommits),
        description: bucketCommits.map((c) => c.message).join("\n"),
        type,
        priority: this.priorityFor(bucketCommits),
        estimateHours: this.estimateHours(bucketCommits),
        completedDate: dates[dates.length - 1] ?? context.analysisDate,
        tags: this.tagsFor(files),
        provenance: {
          commits: bucketCommits,
          files,
          repository: context.repository,
          source: "git",
        },
      });
    }

    return { items, mode: "heuristic" };
  }

  // detectType, titleFor, priorityFor, estimateHours, and tagsFor are the
  // corresponding methods moved out of GitWorkAnalyzer. Keep their logic
  // unchanged — this class exists to preserve current behaviour, not improve it.
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/grouping/HeuristicCommitGrouper.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/grouping/CommitGrouper.ts src/grouping/HeuristicCommitGrouper.ts src/grouping/HeuristicCommitGrouper.test.ts src/services/GitWorkAnalyzer.ts
git commit -m "refactor(grouping): extract keyword commit grouping behind a CommitGrouper interface

<trailer>"
```

---

### Task 3: AI grouper with validation and fallback

**Files:**
- Create: `src/grouping/groupingSchema.ts`
- Create: `src/grouping/AiCommitGrouper.ts`
- Create: `src/grouping/AiCommitGrouper.test.ts`

**Interfaces:**
- Consumes: `AiClient` (Task 1); `CommitGrouper`, `GroupingResult`, `HeuristicCommitGrouper` (Task 2).
- Produces:
  - `interface AiGroupResponse { groups: AiGroup[] }` and `interface AiGroup { title; description; type; priority; estimateHours; commitHashes: string[] }`
  - `function validateGroupResponse(raw: unknown, commits: GitCommit[]): { ok: true; groups: AiGroup[] } | { ok: false; reason: string }`
  - `class AiCommitGrouper implements CommitGrouper`

- [ ] **Step 1: Write the failing test**

Create `src/grouping/AiCommitGrouper.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { AiCommitGrouper } from "./AiCommitGrouper.js";
import { validateGroupResponse } from "./groupingSchema.js";
import { AiClient, AiProvider } from "../ai/AiClient.js";
import { GitCommit } from "../types/index.js";

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

describe("validateGroupResponse", () => {
  test("accepts a well-formed, fully covering response", () => {
    const result = validateGroupResponse(JSON.parse(validResponse), commits);
    expect(result.ok).toBe(true);
  });

  test("rejects a hallucinated commit hash", () => {
    const raw = { groups: [{ ...JSON.parse(validResponse).groups[0], commitHashes: ["zzz9999"] }] };
    const result = validateGroupResponse(raw, commits);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/zzz9999/);
  });

  test("rejects a response that leaves a commit uncovered", () => {
    const raw = { groups: [{ ...JSON.parse(validResponse).groups[0], commitHashes: ["aaa1111"] }] };
    const result = validateGroupResponse(raw, commits);
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/bbb2222|uncovered/i);
  });

  test("rejects an unknown type", () => {
    const raw = { groups: [{ ...JSON.parse(validResponse).groups[0], type: "sorcery" }] };
    expect(validateGroupResponse(raw, commits).ok).toBe(false);
  });

  test("rejects a missing title", () => {
    const group = { ...JSON.parse(validResponse).groups[0] };
    delete group.title;
    expect(validateGroupResponse({ groups: [group] }, commits).ok).toBe(false);
  });

  test("rejects a non-object payload", () => {
    expect(validateGroupResponse("nope", commits).ok).toBe(false);
    expect(validateGroupResponse({ notGroups: [] }, commits).ok).toBe(false);
  });
});

describe("AiCommitGrouper", () => {
  test("returns ai mode on a valid response", async () => {
    const grouper = new AiCommitGrouper(clientReturning(validResponse));
    const result = await grouper.group(commits, context);
    expect(result.mode).toBe("ai");
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.title).toBe("Build the two-part feature");
  });

  test("derives completedDate from the latest cited commit, never from the model", async () => {
    const grouper = new AiCommitGrouper(clientReturning(validResponse));
    const result = await grouper.group(commits, context);
    expect(result.items[0]!.completedDate).toBe("2026-07-29");
  });

  test("attaches the cited commits as provenance", async () => {
    const grouper = new AiCommitGrouper(clientReturning(validResponse));
    const item = (await grouper.group(commits, context)).items[0]!;
    expect(item.provenance.commits.map((c) => c.hash).sort()).toEqual(["aaa1111", "bbb2222"]);
    expect(item.provenance.files.sort()).toEqual(["a.ts", "b.ts"]);
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

  test("falls back on a hallucinated hash", async () => {
    const bad = JSON.stringify({
      groups: [{ ...JSON.parse(validResponse).groups[0], commitHashes: ["zzz9999"] }],
    });
    const result = await new AiCommitGrouper(clientReturning(bad)).group(commits, context);
    expect(result.mode).toBe("heuristic");
    expect(result.fallbackReason).toMatch(/zzz9999/);
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/grouping/AiCommitGrouper.test.ts`
Expected: FAIL — `Cannot find module './AiCommitGrouper.js'`

- [ ] **Step 3: Write `src/grouping/groupingSchema.ts`**

```ts
import { GitCommit } from "../types/index.js";
import { WorkItemPriority, WorkItemType } from "../domain/WorkItem.js";

export interface AiGroup {
  title: string;
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  estimateHours: number;
  commitHashes: string[];
}

const TYPES: WorkItemType[] = [
  "feature", "bug-fix", "improvement", "refactor",
  "documentation", "test", "chore", "release",
];
const PRIORITIES: WorkItemPriority[] = ["urgent", "high", "normal", "low"];

export type ValidationOutcome =
  | { ok: true; groups: AiGroup[] }
  | { ok: false; reason: string };

/**
 * Validates shape AND commit coverage.
 *
 * Coverage is the important half: a model that quietly drops commits produces
 * output that looks perfectly well-formed while losing work.
 */
export function validateGroupResponse(raw: unknown, commits: GitCommit[]): ValidationOutcome {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: "Response was not a JSON object" };
  }

  const groups = (raw as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) {
    return { ok: false, reason: "Response had no 'groups' array" };
  }
  if (groups.length === 0) {
    return { ok: false, reason: "Response contained zero groups" };
  }

  const knownHashes = new Set(commits.map((commit) => commit.hash));
  const covered = new Set<string>();
  const validated: AiGroup[] = [];

  for (const [index, entry] of groups.entries()) {
    if (entry === null || typeof entry !== "object") {
      return { ok: false, reason: `Group ${index} was not an object` };
    }
    const group = entry as Record<string, unknown>;

    if (typeof group.title !== "string" || group.title.trim().length === 0) {
      return { ok: false, reason: `Group ${index} has no title` };
    }
    if (typeof group.description !== "string") {
      return { ok: false, reason: `Group ${index} ("${group.title}") has no description` };
    }
    if (!TYPES.includes(group.type as WorkItemType)) {
      return { ok: false, reason: `Group ${index} has unknown type "${String(group.type)}"` };
    }
    if (!PRIORITIES.includes(group.priority as WorkItemPriority)) {
      return { ok: false, reason: `Group ${index} has unknown priority "${String(group.priority)}"` };
    }
    if (typeof group.estimateHours !== "number" || !Number.isFinite(group.estimateHours) || group.estimateHours <= 0) {
      return { ok: false, reason: `Group ${index} has an invalid estimateHours` };
    }
    if (!Array.isArray(group.commitHashes) || group.commitHashes.length === 0) {
      return { ok: false, reason: `Group ${index} cites no commits` };
    }

    for (const hash of group.commitHashes) {
      if (typeof hash !== "string" || !knownHashes.has(hash)) {
        return {
          ok: false,
          reason: `Group ${index} cites unknown commit hash "${String(hash)}"`,
        };
      }
      covered.add(hash);
    }

    validated.push(group as unknown as AiGroup);
  }

  const uncovered = commits.filter((commit) => !covered.has(commit.hash));
  if (uncovered.length > 0) {
    return {
      ok: false,
      reason: `${uncovered.length} commit(s) uncovered: ${uncovered
        .map((commit) => commit.hash)
        .slice(0, 5)
        .join(", ")}`,
    };
  }

  return { ok: true, groups: validated };
}
```

- [ ] **Step 4: Write `src/grouping/AiCommitGrouper.ts`**

```ts
import { AiClient } from "../ai/AiClient.js";
import { WorkItem } from "../domain/WorkItem.js";
import { GitCommit } from "../types/index.js";
import { CommitGrouper, GroupingContext, GroupingResult } from "./CommitGrouper.js";
import { HeuristicCommitGrouper } from "./HeuristicCommitGrouper.js";
import { AiGroup, validateGroupResponse } from "./groupingSchema.js";

/** Commits per request. Keeps prompts inside provider context limits. */
const CHUNK_SIZE = 60;

export class AiCommitGrouper implements CommitGrouper {
  private fallback = new HeuristicCommitGrouper();

  constructor(private client: AiClient, private chunkSize: number = CHUNK_SIZE) {}

  async group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult> {
    if (commits.length === 0) return { items: [], mode: "heuristic" };

    try {
      const chunks = this.chunk(commits);
      const items: WorkItem[] = [];

      for (const chunk of chunks) {
        const { text } = await this.client.complete(this.buildPrompt(chunk));
        const parsed = this.parseJson(text);
        const validation = validateGroupResponse(parsed, chunk);
        if (!validation.ok) throw new Error(validation.reason);
        items.push(...validation.groups.map((group) => this.toWorkItem(group, chunk, context)));
      }

      return { items, mode: "ai" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`AI grouping unavailable, falling back to heuristics: ${reason}`);
      const heuristic = await this.fallback.group(commits, context);
      return { ...heuristic, fallbackReason: reason };
    }
  }

  /** Chunks by position after sorting by date, so related work stays together. */
  private chunk(commits: GitCommit[]): GitCommit[][] {
    const sorted = [...commits].sort((a, b) => a.date.localeCompare(b.date));
    const chunks: GitCommit[][] = [];
    for (let index = 0; index < sorted.length; index += this.chunkSize) {
      chunks.push(sorted.slice(index, index + this.chunkSize));
    }
    return chunks;
  }

  /** Models often wrap JSON in prose or a code fence. */
  private parseJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1]! : text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("Response contained no JSON object");
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }

  private toWorkItem(group: AiGroup, chunk: GitCommit[], context: GroupingContext): WorkItem {
    const cited = chunk.filter((commit) => group.commitHashes.includes(commit.hash));
    const dates = cited.map((commit) => commit.date).sort();
    const files = Array.from(new Set(cited.flatMap((commit) => commit.files)));

    return {
      title: group.title.trim(),
      description: group.description.trim(),
      type: group.type,
      priority: group.priority,
      status: "complete",
      estimateHours: group.estimateHours,
      // Always from a real commit. The model is never trusted with a date.
      completedDate: dates[dates.length - 1] ?? context.analysisDate,
      tags: [],
      provenance: {
        commits: cited,
        files,
        repository: context.repository,
        source: "git",
      },
    };
  }

  private buildPrompt(commits: GitCommit[]): string {
    const lines = commits.map(
      (commit) =>
        `${commit.hash} | ${commit.date} | ${commit.message} | ${commit.files.length} files | +${commit.insertions}/-${commit.deletions}`
    );

    return [
      "You are grouping git commits into units of work for a project management tool.",
      "",
      "Commits (hash | date | message | file count | churn):",
      ...lines,
      "",
      "Group these into units of work. Rules:",
      "1. Every commit hash above must appear in exactly one group's commitHashes.",
      "2. Never invent a commit hash. Use only the hashes listed above.",
      "3. `title` is a task title, not a commit subject: imperative mood, no",
      "   `feat(scope):` prefix, readable by someone who has not seen the diff.",
      "4. `description` states what the problem or goal was, not what the diff did.",
      "   Two sentences at most.",
      "5. `type` is one of: feature, bug-fix, improvement, refactor, documentation,",
      "   test, chore, release.",
      "6. `priority` is one of: urgent, high, normal, low. Use urgent for crashes,",
      "   data loss, and security issues.",
      "7. `estimateHours` is a positive number reflecting the work's scope.",
      "8. Group by unit of work, not by commit. Several commits that finish one",
      "   thing are one group. One commit touching unrelated things may be its own group.",
      "",
      "Respond with JSON only, in exactly this shape, and nothing else:",
      '{"groups":[{"title":"","description":"","type":"feature","priority":"normal","estimateHours":3,"commitHashes":[""]}]}',
    ].join("\n");
  }
}
```

Note there is no `completedDate` in the response shape at all. The model cannot supply a date it might invent — dates come from the cited commits.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/grouping/AiCommitGrouper.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add src/grouping/groupingSchema.ts src/grouping/AiCommitGrouper.ts src/grouping/AiCommitGrouper.test.ts
git commit -m "feat(grouping): AI commit grouping with coverage validation and safe fallback

<trailer>"
```

---

### Task 4: Wire grouping into analysis and surface the mode

**Files:**
- Modify: `src/sources/GitWorkSource.ts`
- Modify: `src/routes/tasks.routes.ts`
- Modify: `src/webhook-server.ts`
- Modify: `ui/components/TaskPreviewModal.tsx`
- Create: `src/sources/GitWorkSource.grouping.test.ts`

**Interfaces:**
- Consumes: `AiCommitGrouper`, `HeuristicCommitGrouper`, `GroupingResult` (Tasks 2–3); `createAiClientFromEnv` (Task 1).
- Produces: `async function workItemsFromCommits(commits, context, grouper): Promise<GroupingResult>`; `PreviewResponse` gains `grouping: { mode, fallbackReason? }`.

`workItemsFromAnalysis` from Slice 1 stays exactly as it is — it adapts an already-grouped `WorkAnalysisResult` and is still used by callers that pass one.

- [ ] **Step 1: Write the failing test**

Create `src/sources/GitWorkSource.grouping.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { workItemsFromCommits } from "./GitWorkSource.js";
import { HeuristicCommitGrouper } from "../grouping/HeuristicCommitGrouper.js";
import { AiCommitGrouper } from "../grouping/AiCommitGrouper.js";
import { AiClient } from "../ai/AiClient.js";
import { GitCommit } from "../types/index.js";

const commits: GitCommit[] = [
  { hash: "aaa1111", author: "d", date: "2026-07-29", message: "fix: crash on launch", files: ["a.ts"], insertions: 3, deletions: 1 },
];

const context = { analysisDate: "2026-07-29", repository: "repo" };

describe("workItemsFromCommits", () => {
  test("uses the supplied grouper and reports its mode", async () => {
    const result = await workItemsFromCommits(commits, context, new HeuristicCommitGrouper());
    expect(result.mode).toBe("heuristic");
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("reports ai mode and no fallbackReason on the AI path", async () => {
    const response = JSON.stringify({
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
    const client = new AiClient([{ name: "fake", generate: async () => response }]);
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/sources/GitWorkSource.grouping.test.ts`
Expected: FAIL — `workItemsFromCommits is not exported`

- [ ] **Step 3: Add `workItemsFromCommits` to `GitWorkSource.ts`**

```ts
import { CommitGrouper, GroupingContext, GroupingResult } from "../grouping/CommitGrouper.js";
import { GitCommit } from "../types/index.js";

/**
 * Groups raw commits into WorkItems using the supplied grouper.
 *
 * The grouper is injected rather than constructed here so tests never touch a
 * provider and callers can force the heuristic path.
 */
export async function workItemsFromCommits(
  commits: GitCommit[],
  context: GroupingContext,
  grouper: CommitGrouper
): Promise<GroupingResult> {
  return grouper.group(commits, context);
}
```

- [ ] **Step 4: Thread grouping through the preview response**

In `src/routes/tasks.routes.ts`:

```ts
export interface PreviewResponse {
  // ...existing fields...
  grouping?: { mode: "ai" | "heuristic"; fallbackReason?: string };
}
```

Add a `grouper: CommitGrouper` to `TasksRouterDeps`. In the `preview-tasks` and `create-tasks` handlers, when the request supplies raw `commits` rather than `workItems` or `workAnalysis`, call `workItemsFromCommits(commits, { analysisDate, repository }, deps.grouper)` and copy `mode` and `fallbackReason` onto `preview.grouping`. Leave the `workItems` and `workAnalysis` branches untouched — they arrive pre-grouped.

In `src/webhook-server.ts`:

```ts
import { createAiClientFromEnv } from "./ai/AiClient.js";
import { AiCommitGrouper } from "./grouping/AiCommitGrouper.js";
import { HeuristicCommitGrouper } from "./grouping/HeuristicCommitGrouper.js";

// AI grouping is on when a provider key exists and AI_GROUPING is not "false".
const aiClient = createAiClientFromEnv();
const grouper =
  aiClient.isConfigured && process.env.AI_GROUPING !== "false"
    ? new AiCommitGrouper(aiClient)
    : new HeuristicCommitGrouper();

console.log(
  `Commit grouping: ${grouper instanceof AiCommitGrouper ? `AI (${aiClient.providerNames.join(", ")})` : "heuristic"}`
);
```

Pass `grouper` into `createTasksRouter`.

- [ ] **Step 5: Document the toggle**

Add to `env.example`:

```bash
# Set to false to force keyword commit grouping even when an AI key is present.
AI_GROUPING=true
```

- [ ] **Step 6: Show the grouping mode in the preview UI**

In `ui/components/TaskPreviewModal.tsx`, when `data.grouping` is present:

- `mode === "ai"` → a subtle badge, "Grouped semantically by AI".
- `mode === "heuristic"` with a `fallbackReason` → a **warning** banner: "Grouped heuristically — AI unavailable: {fallbackReason}". This must be visibly different from the success state; degraded output being mistaken for the good path is the failure this whole slice guards against.
- `mode === "heuristic"` with no reason → a neutral "Grouped by keyword rules" note.

- [ ] **Step 7: Run everything**

Run: `bun test && bun run build`
Expected: all tests pass; build exits 0.

- [ ] **Step 8: Verify against a real repository**

With a provider key configured, run an analysis over a two-week range of a real repo and confirm in the preview that:
- the badge reports AI grouping;
- titles read as task titles, not commit subjects;
- each item's commit count is plausible and the dates match real commits;
- setting `AI_GROUPING=false` and re-running produces the heuristic path with the neutral note.

- [ ] **Step 9: Commit**

```bash
git add src/sources/GitWorkSource.ts src/sources/GitWorkSource.grouping.test.ts src/routes/tasks.routes.ts src/webhook-server.ts env.example ui/components/TaskPreviewModal.tsx
git commit -m "feat(grouping): use AI grouping for commit analysis and surface the mode

<trailer>"
```

---

## Slice 3 Definition of Done

- [ ] `bun test` passes; `bun run build` exits 0.
- [ ] `POST /api/manager-summary` behaves exactly as before the `AiClient` extraction.
- [ ] Commit analysis with a provider key produces task-shaped titles and groupings.
- [ ] Every AI failure mode — no key, provider error, malformed JSON, hallucinated hash, uncovered commit — falls back to heuristics with a reason.
- [ ] No `completedDate` originates from the model; every one traces to a cited commit.
- [ ] `AI_GROUPING=false` forces the heuristic path.
- [ ] The preview visibly distinguishes AI grouping from heuristic fallback.

---

## Open risk carried from the spec

AI grouping over a large commit set sends a large prompt, and chunking bounds per-call size but not total cost. Consider logging token usage or at least commit-count-per-run so cost becomes observable before it is a surprise.
