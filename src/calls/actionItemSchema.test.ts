/**
 * The validator that decides whether a task is real.
 *
 * These tests are about one property above all others: an item the transcript
 * does not support must not survive. Everything else here is shape checking.
 */

import { describe, expect, test } from "bun:test";
import { MIN_QUOTE_LENGTH, validateActionItems } from "./actionItemSchema.js";

const TRANSCRIPT = [
  "Priya: Right, before we finish — the CSV export is dropping the last row for anyone with more than a thousand records.",
  "Sam: I can take that. I'll have a fix out by Thursday.",
  "Priya: We should probably think about rewriting the whole reporting module at some point.",
  "Sam: Maybe next quarter.",
].join("\n");

const VALID = {
  title: "Fix the CSV export dropping the last row",
  description: "Exports truncate the final row for datasets over a thousand records.",
  type: "bug-fix",
  priority: "high",
  estimateHours: 3,
  quote: "the CSV export is dropping the last row for anyone with more than a thousand records",
  speaker: "Sam",
};

const ok = (items: unknown[]) => validateActionItems({ items }, TRANSCRIPT);

describe("validateActionItems — quote checking", () => {
  test("accepts an item whose quote is in the transcript", () => {
    const outcome = ok([VALID]);
    expect(outcome.ok).toBe(true);
    expect(outcome.items).toHaveLength(1);
  });

  /**
   * The reason this module exists. A model producing a confident, well-formed,
   * entirely invented commitment is the failure that costs trust in every other
   * task the system files.
   */
  test("rejects an item whose quote is absent — the invented-task case", () => {
    const outcome = ok([
      {
        ...VALID,
        title: "Migrate the database to Postgres",
        quote: "we agreed to migrate the whole database over to Postgres next week",
      },
    ]);

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/not in the transcript/i);
  });

  test("rejects a paraphrase, even a faithful one", () => {
    // Every word of this is supported by the transcript in substance. It is
    // still rejected, because once the citation is a paraphrase it evidences
    // the model's reading rather than what was said.
    const outcome = ok([
      { ...VALID, quote: "the CSV export drops the final row for large datasets" },
    ]);

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/not in the transcript/i);
  });

  test("tolerates re-wrapped whitespace, which every transcript has", () => {
    const outcome = ok([
      {
        ...VALID,
        quote:
          "the CSV export is dropping the last row\n   for anyone with more\nthan a thousand records",
      },
    ]);
    expect(outcome.ok).toBe(true);
  });

  test("tolerates a case difference", () => {
    const outcome = ok([
      {
        ...VALID,
        quote: "The CSV Export Is Dropping The Last Row For Anyone With More Than A Thousand Records",
      },
    ]);
    expect(outcome.ok).toBe(true);
  });

  test("rejects a quote too short to evidence anything", () => {
    // "I can take that." appears verbatim, so the substring check alone would
    // pass it — and it would pass for almost any invented task attached to it.
    const outcome = ok([{ ...VALID, quote: "I can take that." }]);

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(new RegExp(String(MIN_QUOTE_LENGTH)));
  });

  test("rejects an item with no quote at all", () => {
    const { quote: _dropped, ...withoutQuote } = VALID;
    const outcome = ok([withoutQuote]);

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/cites no quote/i);
  });

});

/**
 * One sentence can carry more than one commitment, and this used to lose them
 * all.
 *
 * The old rule rejected the whole response whenever two items shared a quote,
 * on the theory that a shared quote meant a mis-split. For "I'll fix the export
 * and Priya will send the NDA" that is simply wrong — and rejecting the chunk
 * discarded both real items plus everything else extracted alongside them,
 * with no error the user ever saw. Observed live.
 */
describe("validateActionItems — one sentence, several commitments", () => {
  /** Both commitments live in this one line, and both cite it correctly. */
  const SHARED =
    "Sam: I'll fix the export bug and Priya will send the NDA straight after this meeting.";
  const TWO_JOBS = [TRANSCRIPT, SHARED].join("\n");
  const QUOTE = "I'll fix the export bug and Priya will send the NDA straight after this meeting";

  const item = (title: string, description: string) => ({
    ...VALID,
    title,
    description,
    quote: QUOTE,
  });

  test("keeps two distinct requests that cite the same sentence", () => {
    const outcome = validateActionItems(
      {
        items: [
          item("Fix the export bug", "Sam is fixing the export."),
          item("Send the NDA", "Priya is sending the NDA after the meeting."),
        ],
      },
      TWO_JOBS
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.items?.map((entry) => entry.title)).toEqual([
      "Fix the export bug",
      "Send the NDA",
    ]);
  });

  /**
   * The case the original rule was actually built for — but dropped rather
   * than fatal, because losing the whole chunk to avoid one duplicate costs
   * more than the duplicate does.
   */
  test("drops a word-for-word repeat instead of rejecting everything", () => {
    const outcome = validateActionItems(
      {
        items: [
          item("Fix the export bug", "Sam is fixing the export."),
          item("Fix the export bug", "Sam is fixing the export."),
          item("Send the NDA", "Priya is sending the NDA after the meeting."),
        ],
      },
      TWO_JOBS
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.items?.map((entry) => entry.title)).toEqual([
      "Fix the export bug",
      "Send the NDA",
    ]);
  });

  /** A silent drop is how a list quietly becomes incomplete. */
  test("says so when it drops one", () => {
    const outcome = validateActionItems(
      {
        items: [
          item("Fix the export bug", "Sam is fixing the export."),
          item("Fix the export bug", "Sam is fixing the export."),
        ],
      },
      TWO_JOBS
    );

    expect(outcome.warnings).toHaveLength(1);
    expect(outcome.warnings?.[0]).toMatch(/repeats an earlier item/i);
  });

  test("a duplicate differing only in case or spacing is still a duplicate", () => {
    const outcome = validateActionItems(
      {
        items: [
          item("Fix the export bug", "Sam is fixing the export."),
          item("FIX  THE   EXPORT BUG", "Sam is  fixing the export."),
        ],
      },
      TWO_JOBS
    );

    expect(outcome.items).toHaveLength(1);
  });

  /**
   * Still fatal past the cap. A sentence yielding four separate requests is
   * the mis-split the original rule existed for, and nothing in that response
   * has been read carefully enough to file.
   */
  test("rejects the response when one sentence is shredded into too many items", () => {
    const outcome = validateActionItems(
      {
        items: [
          item("One", "a"),
          item("Two", "b"),
          item("Three", "c"),
          item("Four", "d"),
        ],
      },
      TWO_JOBS
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/mis-split/i);
  });

  test("a clean response carries no warnings", () => {
    expect(ok([VALID]).warnings).toBeUndefined();
  });
});

describe("validateActionItems — an empty answer is a correct answer", () => {
  /**
   * Unlike groupingSchema, where zero groups means commits were dropped. Most
   * conversation contains no action items, and a validator that treated
   * "nothing to do" as a failure would push the extractor towards inventing
   * something.
   */
  test("accepts an empty items array", () => {
    const outcome = validateActionItems({ items: [] }, TRANSCRIPT);
    expect(outcome.ok).toBe(true);
    expect(outcome.items).toEqual([]);
  });
});

describe("validateActionItems — shape", () => {
  test.each([
    ["not an object", null],
    ["a string", "items"],
  ])("rejects a response that is %s", (_label, raw) => {
    expect(validateActionItems(raw, TRANSCRIPT).ok).toBe(false);
  });

  test("rejects a response with no items array", () => {
    const outcome = validateActionItems({ actions: [] }, TRANSCRIPT);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/no 'items' array/);
  });

  test.each([
    ["no title", { title: "" }],
    ["an unknown type", { type: "epic" }],
    ["an unknown priority", { priority: "blocker" }],
    ["a zero estimate", { estimateHours: 0 }],
    ["a negative estimate", { estimateHours: -2 }],
    ["a non-numeric estimate", { estimateHours: "3" }],
    ["a non-string speaker", { speaker: 42 }],
  ])("rejects an item with %s", (_label, override) => {
    expect(ok([{ ...VALID, ...override }]).ok).toBe(false);
  });

  test("speaker is optional", () => {
    const { speaker: _dropped, ...withoutSpeaker } = VALID;
    expect(ok([withoutSpeaker]).ok).toBe(true);
  });
});

/**
 * Adversarial cases: responses a model plausibly produces that must not become
 * tasks. These are the ones worth having, because each is well-formed and
 * confident — nothing about the shape gives them away.
 */
describe("validateActionItems — adversarial", () => {
  const HEDGY = [
    "Sam: We should probably think about rewriting the reporting module at some point.",
    "Priya: Maybe next quarter. I'm not committing to anything today.",
  ].join("\n");

  test("a quote assembled from two separate sentences is rejected", () => {
    // Both halves appear in the transcript; the sentence never did. This is how
    // a model manufactures a commitment out of adjacent hedges.
    const outcome = validateActionItems(
      {
        items: [
          {
            title: "Rewrite the reporting module",
            description: "Agreed to rewrite reporting next quarter.",
            type: "refactor",
            priority: "normal",
            estimateHours: 40,
            quote: "rewriting the reporting module at some point. Maybe next quarter.",
          },
        ],
      },
      HEDGY
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/not in the transcript/i);
  });

  test("a quote padded with an invented clause is rejected", () => {
    const outcome = validateActionItems(
      {
        items: [
          {
            title: "Rewrite the reporting module",
            description: "Committed to a rewrite.",
            type: "refactor",
            priority: "high",
            estimateHours: 40,
            quote:
              "We should probably think about rewriting the reporting module at some point, " +
              "and Sam agreed to own it.",
          },
        ],
      },
      HEDGY
    );

    expect(outcome.ok).toBe(false);
  });

  /**
   * The uncomfortable one: the validator checks that a sentence was SAID, not
   * that it was a commitment. A hedge quoted accurately passes here, and only
   * the prompt discourages filing it. Pinned so the limit is documented in a
   * test rather than discovered in a ClickUp list — if a "was this actually a
   * commitment" check is ever added, this is the test that should flip.
   */
  test("an accurately-quoted hedge passes validation — the prompt is what discourages it", () => {
    const outcome = validateActionItems(
      {
        items: [
          {
            title: "Rewrite the reporting module",
            description: "Raised as a possibility.",
            type: "refactor",
            priority: "low",
            estimateHours: 40,
            quote: "We should probably think about rewriting the reporting module at some point",
          },
        ],
      },
      HEDGY
    );

    expect(outcome.ok).toBe(true);
  });
});
