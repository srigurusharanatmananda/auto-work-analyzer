/**
 * The extractor, against a stubbed provider.
 *
 * NO TEST HERE CALLS A REAL AI PROVIDER. The AiClient is replaced with a stub
 * that records prompts and returns canned text, so these run offline, free, and
 * deterministically — and so a broken provider chain can never make them pass
 * or fail for an unrelated reason.
 */

import { describe, expect, test } from "bun:test";
import { ActionItemExtractor } from "./ActionItemExtractor.js";
import type { AiClient } from "../ai/AiClient.js";

const SENTENCE_A =
  "the CSV export is dropping the last row for anyone with more than a thousand records";
const SENTENCE_B =
  "we also need the invoice PDFs regenerated before the audit on the twenty-second";

const TRANSCRIPT = [
  `Priya: Right, before we finish, ${SENTENCE_A}.`,
  "Sam: I can take that. I'll have a fix out by Thursday.",
  `Priya: And ${SENTENCE_B}.`,
].join("\n");

function item(quote: string, overrides: Record<string, unknown> = {}) {
  return {
    title: "Do the thing",
    description: "A thing that was asked for.",
    type: "bug-fix",
    priority: "high",
    estimateHours: 2,
    quote,
    ...overrides,
  };
}

/**
 * A stub AiClient. `responses` is consumed one per call, so a chunked run can
 * be given a different answer per chunk.
 */
function stubClient(responses: string[], configured = true) {
  const prompts: string[] = [];
  const client = {
    isConfigured: configured,
    providerNames: ["stub"],
    complete: async (prompt: string) => {
      prompts.push(prompt);
      const text = responses.shift();
      if (text === undefined) throw new Error("stub ran out of responses");
      return { text, provider: "stub", model: "stub" };
    },
  } as unknown as AiClient;

  return { client, prompts };
}

/**
 * A stub that answers based on what it was shown, rather than on call order.
 *
 * Chunk order is an implementation detail of `chunk()`; a test that hard-codes
 * "the second response goes to the second chunk" breaks whenever the splitting
 * changes, and — worse — can accidentally assert the laundering behaviour it
 * meant to forbid.
 */
function stubResponder(respond: (prompt: string) => string) {
  const prompts: string[] = [];
  const client = {
    isConfigured: true,
    providerNames: ["stub"],
    complete: async (prompt: string) => {
      prompts.push(prompt);
      return { text: respond(prompt), provider: "stub", model: "stub" };
    },
  } as unknown as AiClient;

  return { client, prompts };
}

const json = (items: unknown[]) => JSON.stringify({ items });

describe("ActionItemExtractor", () => {
  test("extracts an item whose quote is in the transcript", async () => {
    const { client } = stubClient([json([item(SENTENCE_A)])]);
    const result = await new ActionItemExtractor(client).extract(TRANSCRIPT);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.quote).toBe(SENTENCE_A);
    expect(result.reason).toBeUndefined();
  });

  test("a transcript with no action items yields none, and invents nothing", async () => {
    const { client } = stubClient([json([])]);
    const result = await new ActionItemExtractor(client).extract(
      "Sam: Morning. Priya: Morning. Sam: Nice weather. Priya: It is."
    );

    expect(result.items).toEqual([]);
    // Not a failure — an empty answer is a correct answer, so there is nothing
    // for the caller to warn about.
    expect(result.reason).toBeUndefined();
  });

  test("an invented item is dropped and the reason says so", async () => {
    const { client } = stubClient([
      json([item("we agreed to migrate the entire platform to Kubernetes next sprint")]),
    ]);
    const result = await new ActionItemExtractor(client).extract(TRANSCRIPT);

    expect(result.items).toEqual([]);
    expect(result.reason).toMatch(/not in the transcript/i);
  });

  test("one invented item poisons its whole chunk, rather than being filtered out", async () => {
    // Deliberate: the validator rejects the response, it does not repair it. A
    // model that invented one commitment is not trustworthy about the others in
    // the same breath, and quietly keeping the "good" ones would hide that.
    const { client } = stubClient([
      json([item(SENTENCE_A), item("and we settled on rewriting the billing service in Rust")]),
    ]);
    const result = await new ActionItemExtractor(client).extract(TRANSCRIPT);

    expect(result.items).toEqual([]);
    expect(result.reason).toBeDefined();
  });

  test("malformed JSON produces no items and a stated reason", async () => {
    const { client } = stubClient(["I'm sorry, I can't help with that."]);
    const result = await new ActionItemExtractor(client).extract(TRANSCRIPT);

    expect(result.items).toEqual([]);
    expect(result.reason).toMatch(/no JSON object/i);
  });

  test("a fenced JSON response is parsed", async () => {
    const { client } = stubClient([
      "Here you go:\n```json\n" + json([item(SENTENCE_A)]) + "\n```\nHope that helps!",
    ]);
    const result = await new ActionItemExtractor(client).extract(TRANSCRIPT);
    expect(result.items).toHaveLength(1);
  });

  test("an unconfigured client extracts nothing and says why", async () => {
    const { client, prompts } = stubClient([], false);
    const result = await new ActionItemExtractor(client).extract(TRANSCRIPT);

    expect(result.items).toEqual([]);
    expect(result.reason).toMatch(/no ai provider is configured/i);
    expect(prompts).toHaveLength(0); // never called
  });

  test("an empty transcript makes no request at all", async () => {
    const { client, prompts } = stubClient([]);
    const result = await new ActionItemExtractor(client).extract("   \n  ");

    expect(result.items).toEqual([]);
    expect(result.chunks).toBe(0);
    expect(prompts).toHaveLength(0);
  });
});

describe("ActionItemExtractor — chunking", () => {
  const long = [
    `Priya: ${SENTENCE_A}.`,
    "Sam: Understood, noted.",
    "Priya: Some filler that is here to push the second request onto its own chunk.",
    `Priya: ${SENTENCE_B}.`,
  ].join("\n");

  test("splits a transcript over several requests and merges the items", async () => {
    // Each chunk is answered with whichever of the two requests it actually
    // contains, which is what a working model would do.
    const { client, prompts } = stubResponder((prompt) => {
      if (prompt.includes(SENTENCE_A)) return json([item(SENTENCE_A)]);
      if (prompt.includes(SENTENCE_B)) return json([item(SENTENCE_B)]);
      return json([]);
    });

    // A chunk size small enough to force a split on this fixture.
    const result = await new ActionItemExtractor(client, 90).extract(long);

    expect(prompts.length).toBeGreaterThan(1);
    expect(result.chunks).toBe(prompts.length);
    expect(result.items.map((i) => i.quote).sort()).toEqual([SENTENCE_A, SENTENCE_B].sort());
    expect(result.reason).toBeUndefined();
  });

  test("never splits mid-sentence, so a quote is never truncated out of its chunk", async () => {
    const { client, prompts } = stubClient(Array(20).fill(json([])));
    await new ActionItemExtractor(client, 90).extract(long);

    // Every sentence of the source must appear whole in exactly one prompt. If
    // chunking cut through one, the model would be shown a fragment and the
    // quote check would then reject a genuine request on a technicality.
    for (const sentence of [SENTENCE_A, SENTENCE_B]) {
      const containing = prompts.filter((prompt) => prompt.includes(sentence));
      expect(containing).toHaveLength(1);
    }
  });

  test("an item is validated against its own chunk, not the whole transcript", async () => {
    // The laundering case: a chunk that does NOT contain SENTENCE_B answers
    // with an item quoting it. The sentence is real and elsewhere in the
    // transcript, but this model was never shown it. Validating against the
    // full transcript would accept the item.
    const { client } = stubResponder((prompt) =>
      prompt.includes(SENTENCE_B) ? json([]) : json([item(SENTENCE_B)])
    );

    const result = await new ActionItemExtractor(client, 90).extract(long);

    expect(result.items).toEqual([]);
    expect(result.reason).toMatch(/not in the transcript/i);
  });

  test("one bad chunk does not discard the items from the good ones", async () => {
    const { client } = stubResponder((prompt) => {
      if (prompt.includes(SENTENCE_A)) return json([item(SENTENCE_A)]);
      if (prompt.includes(SENTENCE_B)) return "not json at all";
      return json([]);
    });

    const result = await new ActionItemExtractor(client, 90).extract(long);

    // Unlike the commit grouper, which abandons the run: coverage is its
    // invariant, and there is no equivalent here.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.quote).toBe(SENTENCE_A);
    // But the partial result must be visible as partial.
    expect(result.reason).toMatch(/may be incomplete/i);
  });

  test("a sentence the speaker repeats later is filed once, not twice", async () => {
    // Chunks do not overlap, so the only way one sentence reaches two requests
    // is a transcript that genuinely repeats it — a speaker restating a
    // request. That must not become two tasks.
    const repeated = [
      `Priya: ${SENTENCE_A}.`,
      "Sam: Sorry, you cut out there, say again?",
      "Priya: Some filler to push the repeat into a separate chunk entirely.",
      `Priya: ${SENTENCE_A}.`,
    ].join("\n");

    const { client, prompts } = stubResponder((prompt) =>
      prompt.includes(SENTENCE_A) ? json([item(SENTENCE_A)]) : json([])
    );

    const result = await new ActionItemExtractor(client, 90).extract(repeated);

    expect(prompts.filter((p) => p.includes(SENTENCE_A)).length).toBeGreaterThan(1);
    expect(result.items).toHaveLength(1);
  });
});
