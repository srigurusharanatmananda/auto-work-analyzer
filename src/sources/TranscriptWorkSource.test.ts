/**
 * The adapter from action items onto the canonical WorkItem.
 *
 * Two of these are about a mistake that would be easy to make and expensive to
 * notice: filing requests as already-complete, and inventing a completion date.
 */

import { describe, expect, test } from "bun:test";
import { workItemFromActionItem, workItemsFromTranscript } from "./TranscriptWorkSource.js";
import type { ActionItem } from "../calls/actionItemSchema.js";
import type { AiClient } from "../ai/AiClient.js";

const QUOTE =
  "the CSV export is dropping the last row for anyone with more than a thousand records";

const TRANSCRIPT = `Priya: Right, before we finish, ${QUOTE}.`;

const ACTION_ITEM: ActionItem = {
  title: "Fix the CSV export dropping the last row",
  description: "Exports truncate the final row for datasets over a thousand records.",
  type: "bug-fix",
  priority: "high",
  estimateHours: 3,
  quote: QUOTE,
  speaker: "Sam",
};

function stubClient(text: string) {
  return {
    isConfigured: true,
    providerNames: ["stub"],
    complete: async () => ({ text, provider: "stub", model: "stub" }),
  } as unknown as AiClient;
}

describe("workItemFromActionItem", () => {
  test("carries the title, type, priority and estimate across", () => {
    const item = workItemFromActionItem(ACTION_ITEM);

    expect(item.title).toBe("Fix the CSV export dropping the last row");
    expect(item.type).toBe("bug-fix");
    expect(item.priority).toBe("high");
    expect(item.estimateHours).toBe(3);
  });

  /**
   * The git path sets status "complete" because a commit is finished work by
   * definition. An action item is the opposite — a request that has not been
   * done. Copying the git path here would produce a list of closed tasks nobody
   * ever does, which looks like a working integration and is worse than none.
   */
  test("is filed as outstanding work, not as complete", () => {
    expect(workItemFromActionItem(ACTION_ITEM).status).toBe("to do");
  });

  test("has no completedDate, because nothing was completed", () => {
    const item = workItemFromActionItem(ACTION_ITEM, { callDate: "2026-08-06" });
    expect(item.completedDate).toBeUndefined();
  });

  test("keeps the quote in provenance, where a reviewer can check it", () => {
    const item = workItemFromActionItem(ACTION_ITEM);

    expect(item.provenance.source).toBe("transcript");
    expect(item.provenance.quote).toBe(QUOTE);
    expect(item.provenance.speaker).toBe("Sam");
    expect(item.provenance.commits).toEqual([]);
  });

  test("tags carry the type, the provenance marker, the date and the call", () => {
    const item = workItemFromActionItem(ACTION_ITEM, {
      callDate: "2026-08-06",
      callTitle: "Weekly sync",
    });

    expect(item.tags).toContain("bug-fix");
    expect(item.tags).toContain("call-transcript");
    expect(item.tags).toContain("2026-08-06");
    expect(item.tags).toContain("Weekly sync");
  });

  test("omits absent context rather than tagging an empty string", () => {
    const item = workItemFromActionItem(ACTION_ITEM, { callTitle: "   " });

    expect(item.tags).not.toContain("");
    expect(item.tags.every((tag) => tag.trim().length > 0)).toBe(true);
  });

  test("a speaker-less item simply has no speaker", () => {
    const { speaker: _dropped, ...anonymous } = ACTION_ITEM;
    const item = workItemFromActionItem(anonymous as ActionItem);

    expect(item.provenance.speaker).toBeUndefined();
  });
});

describe("workItemsFromTranscript", () => {
  test("produces WorkItems the existing pipeline can consume unchanged", async () => {
    const client = stubClient(JSON.stringify({ items: [ACTION_ITEM] }));
    const result = await workItemsFromTranscript(TRANSCRIPT, client, {
      callDate: "2026-08-06",
    });

    expect(result.items).toHaveLength(1);
    expect(result.reason).toBeUndefined();

    // The shape tasks.routes requires of every source.
    const item = result.items[0]!;
    expect(typeof item.title).toBe("string");
    expect(typeof item.description).toBe("string");
    expect(Array.isArray(item.tags)).toBe(true);
    expect(Array.isArray(item.provenance.commits)).toBe(true);
    expect(Array.isArray(item.provenance.files)).toBe(true);
  });

  /**
   * "No action items" and "extraction broke" produce an identical empty list
   * and mean completely different things. Only `reason` distinguishes them.
   */
  test("an empty call is distinguishable from a failed extraction", async () => {
    const quiet = await workItemsFromTranscript(
      "Sam: Morning. Priya: Morning.",
      stubClient(JSON.stringify({ items: [] }))
    );
    expect(quiet.items).toEqual([]);
    expect(quiet.reason).toBeUndefined();

    const broken = await workItemsFromTranscript(TRANSCRIPT, stubClient("not json"));
    expect(broken.items).toEqual([]);
    expect(broken.reason).toBeDefined();
  });

  test("an invented item never reaches a WorkItem", async () => {
    const client = stubClient(
      JSON.stringify({
        items: [{ ...ACTION_ITEM, quote: "we agreed to rewrite the billing service in Rust" }],
      })
    );

    const result = await workItemsFromTranscript(TRANSCRIPT, client);
    expect(result.items).toEqual([]);
    expect(result.reason).toMatch(/not in the transcript/i);
  });
});
