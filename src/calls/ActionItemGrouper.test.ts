/**
 * Grouping a call's action items.
 *
 * The invariant every test here defends is the same one: **no leaf may be lost,
 * duplicated or invented.** Grouping runs after the quote validator, so an item
 * that disappears here disappears silently — the preview shows three tidy
 * parents and nothing looks wrong.
 *
 * No test calls a real provider; `AiClient` is stubbed throughout.
 */

import { describe, expect, mock, test } from "bun:test";
import type { AiClient } from "../ai/AiClient.js";
import type { WorkItem } from "../domain/WorkItem.js";
import {
  groupActionItems,
  isTranscriptGrouping,
  validateThemeResponse,
} from "./ActionItemGrouper.js";

const item = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  title: "Send the NDA",
  description: "Send the standard NDA to the client.",
  type: "chore",
  priority: "normal",
  status: "to do",
  estimateHours: 1,
  tags: ["chore", "call-transcript"],
  provenance: { commits: [], files: [], source: "transcript", quote: "I'll send the NDA today." },
  ...overrides,
});

/** Returns the given text once, then keeps returning it. */
function stubClient(text: string): AiClient {
  return { complete: mock(async () => ({ text, provider: "stub" })) } as unknown as AiClient;
}

function failingClient(message = "provider down"): AiClient {
  return {
    complete: mock(async () => {
      throw new Error(message);
    }),
  } as unknown as AiClient;
}

/** Every leaf reachable from a list of possibly-nested items. */
function leaves(items: WorkItem[]): WorkItem[] {
  return items.flatMap((entry) =>
    entry.subitems && entry.subitems.length > 0 ? leaves(entry.subitems) : [entry]
  );
}

describe("isTranscriptGrouping", () => {
  test("accepts the three modes and nothing else", () => {
    expect(isTranscriptGrouping("per-item")).toBe(true);
    expect(isTranscriptGrouping("single-task")).toBe(true);
    expect(isTranscriptGrouping("by-theme")).toBe(true);
    expect(isTranscriptGrouping("themes")).toBe(false);
    expect(isTranscriptGrouping(undefined)).toBe(false);
  });
});

describe("per-item", () => {
  test("returns the items untouched", async () => {
    const items = [item({ title: "A" }), item({ title: "B" })];
    const result = await groupActionItems(items, "per-item");

    expect(result.mode).toBe("per-item");
    expect(result.items).toEqual(items);
  });

  test("an empty list stays empty in every mode", async () => {
    for (const mode of ["per-item", "single-task", "by-theme"] as const) {
      expect((await groupActionItems([], mode)).items).toEqual([]);
    }
  });
});

describe("single-task", () => {
  const items = [
    item({ title: "Send the NDA", priority: "high", estimateHours: 1, type: "chore" }),
    item({ title: "Fix the export", priority: "urgent", estimateHours: 4, type: "bug-fix" }),
    item({ title: "Fix the totals", priority: "low", estimateHours: 2, type: "bug-fix" }),
  ];

  test("collapses everything into one parent holding all the items", async () => {
    const result = await groupActionItems(items, "single-task", {
      callTitle: "Weekly sync",
      callDate: "2026-08-07",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.title).toBe("Weekly sync — 2026-08-07");
    expect(result.items[0]!.subitems).toEqual(items);
  });

  /** A parent filed as low priority hides an urgent child from every filter. */
  test("the parent takes the most urgent child's priority", async () => {
    expect((await groupActionItems(items, "single-task")).items[0]!.priority).toBe("urgent");
  });

  test("the parent's estimate is the sum of its children", async () => {
    expect((await groupActionItems(items, "single-task")).items[0]!.estimateHours).toBe(7);
  });

  /** Filing two bug fixes and a chore as a "chore" misreports the whole call. */
  test("the parent's type is the most common child type", async () => {
    expect((await groupActionItems(items, "single-task")).items[0]!.type).toBe("bug-fix");
  });

  /**
   * The parent is a synthesis. A quote on it would be a sentence nobody said,
   * shown in the one place the reviewer has been taught to trust.
   */
  test("the parent carries no quote", async () => {
    const parent = (await groupActionItems(items, "single-task")).items[0]!;
    expect(parent.provenance.quote).toBeUndefined();
  });

  test("children keep their own quotes", async () => {
    const parent = (await groupActionItems(items, "single-task")).items[0]!;
    for (const child of parent.subitems!) {
      expect(child.provenance.quote).toBe("I'll send the NDA today.");
    }
  });

  test("falls back to a generic title when there is no call context", async () => {
    expect((await groupActionItems(items, "single-task")).items[0]!.title).toBe(
      "Call action items"
    );
  });
});

describe("by-theme", () => {
  const items = [
    item({ title: "Send the NDA" }),
    item({ title: "Share the payment policy" }),
    item({ title: "List underwriters" }),
  ];

  const response = JSON.stringify({
    groups: [
      { title: "Client document pack", description: "Paperwork", type: "documentation", itemIndexes: [0, 1] },
      { title: "Underwriter research", description: "", type: "chore", itemIndexes: [2] },
    ],
  });

  test("builds one parent per multi-item group", async () => {
    const result = await groupActionItems(items, "by-theme", {}, stubClient(response));

    expect(result.mode).toBe("by-theme");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.title).toBe("Client document pack");
    expect(result.items[0]!.subitems).toHaveLength(2);
  });

  /** Wrapping a lone item buries its quote a level down for no benefit. */
  test("a group of one is the item itself, not a parent with one subtask", async () => {
    const result = await groupActionItems(items, "by-theme", {}, stubClient(response));

    expect(result.items[1]!.title).toBe("List underwriters");
    expect(result.items[1]!.subitems).toBeUndefined();
  });

  test("every original item survives exactly once", async () => {
    const result = await groupActionItems(items, "by-theme", {}, stubClient(response));

    expect(leaves(result.items).map((leaf) => leaf.title).sort()).toEqual(
      items.map((entry) => entry.title).sort()
    );
  });

  test("reads JSON out of a fenced code block", async () => {
    const fenced = "Here you go:\n```json\n" + response + "\n```";
    const result = await groupActionItems(items, "by-theme", {}, stubClient(fenced));

    expect(result.items).toHaveLength(2);
  });

  test("one item is returned as-is without calling the model", async () => {
    const client = stubClient(response);
    const result = await groupActionItems([items[0]!], "by-theme", {}, client);

    expect(result.items).toEqual([items[0]!]);
    expect(client.complete).not.toHaveBeenCalled();
  });

  describe("falls back to per-item rather than losing work", () => {
    /**
     * per-item, NOT single-task: the user still gets every task they would have
     * had. Collapsing the call into one parent because the model misbehaved
     * would be a bigger surprise than doing nothing.
     */
    const expectUngrouped = (result: Awaited<ReturnType<typeof groupActionItems>>) => {
      expect(result.mode).toBe("per-item");
      expect(result.items).toEqual(items);
      expect(result.fallbackReason).toBeTruthy();
    };

    test("when the provider throws", async () => {
      expectUngrouped(await groupActionItems(items, "by-theme", {}, failingClient()));
    });

    test("when there is no AI client at all", async () => {
      expectUngrouped(await groupActionItems(items, "by-theme", {}));
    });

    test("when the response is not JSON", async () => {
      expectUngrouped(await groupActionItems(items, "by-theme", {}, stubClient("no idea, sorry")));
    });

    /** The quiet one: the response is well-formed and two items vanish. */
    test("when a group omits an item", async () => {
      const partial = JSON.stringify({
        groups: [{ title: "Docs", description: "", type: "chore", itemIndexes: [0] }],
      });
      expectUngrouped(await groupActionItems(items, "by-theme", {}, stubClient(partial)));
    });

    /** A set-based coverage check passes this while the item is filed twice. */
    test("when an item is claimed by two groups", async () => {
      const duplicated = JSON.stringify({
        groups: [
          { title: "A", description: "", type: "chore", itemIndexes: [0, 1] },
          { title: "B", description: "", type: "chore", itemIndexes: [1, 2] },
        ],
      });
      expectUngrouped(await groupActionItems(items, "by-theme", {}, stubClient(duplicated)));
    });

    test("when a group references an item that does not exist", async () => {
      const bogus = JSON.stringify({
        groups: [{ title: "A", description: "", type: "chore", itemIndexes: [0, 1, 2, 9] }],
      });
      expectUngrouped(await groupActionItems(items, "by-theme", {}, stubClient(bogus)));
    });
  });
});

describe("validateThemeResponse", () => {
  test("rejects a non-object, an empty group list, and an untitled group", () => {
    expect(validateThemeResponse("nope", 2).ok).toBe(false);
    expect(validateThemeResponse({ groups: [] }, 2).ok).toBe(false);
    expect(validateThemeResponse({ groups: [{ title: "  ", itemIndexes: [0, 1] }] }, 2).ok).toBe(
      false
    );
  });

  /** A bad type is not worth discarding a good grouping; the parent derives one. */
  test("tolerates an unknown type instead of failing the whole grouping", () => {
    const outcome = validateThemeResponse(
      { groups: [{ title: "A", description: "", type: "nonsense", itemIndexes: [0] }] },
      1
    );
    expect(outcome.ok).toBe(true);
  });

  test("names the offending indexes in its reason", () => {
    const outcome = validateThemeResponse(
      { groups: [{ title: "A", description: "", type: "chore", itemIndexes: [0] }] },
      3
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain("1, 2");
  });
});
