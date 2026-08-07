/**
 * The unattended path from a finished transcription to ClickUp tasks.
 *
 * Real Postgres, because every guarantee worth testing here is about what
 * survives in the job row between runs — the dedup bookkeeping is the feature,
 * and an in-memory stub would test the stub.
 *
 * NOTHING here calls a real AI provider or reaches ClickUp: the client is a
 * stub and the resolver hands back a fake that records what it was asked to
 * create.
 */

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TranscriptSweeper } from "./TranscriptSweeper.js";
import { TranscriptionJobStore } from "../transcription/TranscriptionJobStore.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import type { AiClient } from "../ai/AiClient.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";

const USER = "user-1";
const QUOTE_ONE = "I will have a fix out by Thursday for the CSV export";
const QUOTE_TWO = "I can share the standard NDA straight after this meeting";
const TRANSCRIPT = [`Sam: ${QUOTE_ONE}.`, `Priya: ${QUOTE_TWO}.`].join("\n");

const ITEM_ONE = {
  title: "Fix the CSV export",
  description: "Exports drop the final row.",
  type: "bug-fix",
  priority: "high",
  estimateHours: 3,
  quote: QUOTE_ONE,
};
const ITEM_TWO = {
  title: "Send the standard NDA",
  description: "Share the NDA after the meeting.",
  type: "chore",
  priority: "normal",
  estimateHours: 1,
  quote: QUOTE_TWO,
};

let pg: TestDatabase;
let store: TranscriptionJobStore;

/** Responses the stubbed model will hand back, in order. */
let modelResponses: string[];
/** How many times the model was actually asked anything. */
let modelCalls: number;
/** Names the fake ClickUp was asked to create, across the whole test. */
let created: string[];
/** Task names that should be rejected rather than created. */
let rejectNames: Set<string>;

const stubAiClient = {
  isConfigured: true,
  providerNames: ["stub"],
  complete: async () => {
    modelCalls += 1;
    return { text: modelResponses.shift() ?? "{}", provider: "stub", model: "stub" };
  },
} as unknown as AiClient;

function stubResolver(): DestinationResolver {
  return {
    resolve: async () => ({
      destination: { id: "dest-1", name: "Scratch list" },
      clickUp: {
        createTask: async (task: any) => {
          if (rejectNames.has(task.name)) throw new Error(`ClickUp rejected ${task.name}`);
          created.push(task.name);
          return { id: `id-${created.length}`, name: task.name, url: "http://example.invalid" };
        },
        getListStatuses: async () => ["to do", "complete"],
      } as never,
      listId: "list-1",
      template: BUILTIN_TEMPLATES[0]!,
      config: { teamId: "t", apiKey: "k", projectName: "test" },
    }),
  } as unknown as DestinationResolver;
}

function sweeper(overrides: Partial<ConstructorParameters<typeof TranscriptSweeper>[0]> = {}) {
  return new TranscriptSweeper({
    store,
    resolver: stubResolver(),
    aiClient: stubAiClient,
    ...overrides,
  });
}

/** A finished job with a transcript, ready to be swept. */
async function succeededJob(transcript = TRANSCRIPT, filename = "call.m4a") {
  const job = await store.enqueue({
    userId: USER,
    audioPath: `/storage/audio/${filename}`,
    originalFilename: filename,
    callTitle: "Weekly sync",
    callDate: "2026-08-07",
  });
  await store.claimNext();
  await store.markSucceeded(job.id, {
    transcript,
    language: "en",
    segments: [{ text: transcript, start: 0, end: 10 }],
  });
  return job.id;
}

const bothItems = () => JSON.stringify({ items: [ITEM_ONE, ITEM_TWO] });

before(async () => {
  pg = await createTestDatabase();
  store = new TranscriptionJobStore();
});

after(async () => {
  await pg?.drop();
});

beforeEach(async () => {
  await pg.sql`TRUNCATE transcription_jobs`;
  modelResponses = [];
  modelCalls = 0;
  created = [];
  rejectNames = new Set();
});

describe("what gets swept", () => {
  test("a finished, unswept job produces tasks", async () => {
    await succeededJob();
    modelResponses = [bothItems()];

    const summary = await sweeper().run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 1);
    assert.equal(summary.totalTasksCreated, 2);
    assert.deepEqual(created.sort(), [ITEM_ONE.title, ITEM_TWO.title].sort());
  });

  test("a job still running is left alone", async () => {
    const job = await store.enqueue({
      userId: USER,
      audioPath: "/storage/audio/a.m4a",
      originalFilename: "a.m4a",
    });
    await store.claimNext();

    const summary = await sweeper().run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 0);
    assert.equal(modelCalls, 0, "an unfinished job must not cost a model call");
    assert.ok(job.id);
  });

  /** Someone else's call is not this user's to file. */
  test("another user's job is never swept", async () => {
    const job = await store.enqueue({
      userId: "someone-else",
      audioPath: "/storage/audio/theirs.m4a",
      originalFilename: "theirs.m4a",
    });
    await store.claimNext();
    await store.markSucceeded(job.id, { transcript: TRANSCRIPT, language: "en", segments: [] });

    const summary = await sweeper().run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 0);
  });

  /**
   * A silent recording transcribes to ''. Extracting from it would cost a model
   * call to reach the obvious answer, every single run, forever.
   */
  test("a recording with no speech is skipped without a model call", async () => {
    await succeededJob("");

    const summary = await sweeper().run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 0);
    assert.equal(modelCalls, 0);
  });

  /** A call that genuinely agreed nothing must not be re-extracted forever. */
  test("a call with no action items is marked done rather than retried", async () => {
    const id = await succeededJob();
    modelResponses = [JSON.stringify({ items: [] })];

    await sweeper().run(USER, { dryRun: false });
    const after = await store.get(id, USER);
    assert.ok(after!.sweptAt, "an empty extraction still completes the job");

    modelCalls = 0;
    const second = await sweeper().run(USER, { dryRun: false });
    assert.equal(second.jobs.length, 0);
    assert.equal(modelCalls, 0);
  });
});

describe("dedup", () => {
  test("a second sweep creates nothing and costs no model call", async () => {
    await succeededJob();
    modelResponses = [bothItems()];
    await sweeper().run(USER, { dryRun: false });
    assert.equal(created.length, 2);

    created = [];
    modelCalls = 0;
    const second = await sweeper().run(USER, { dryRun: false });

    assert.equal(second.jobs.length, 0, "a fully swept job is not listed again");
    assert.deepEqual(created, []);
    assert.equal(modelCalls, 0);
  });

  /**
   * The case a single done-flag cannot express. One task lands, one is
   * rejected: marking the job done loses the rejected one, marking nothing
   * duplicates the one that landed.
   */
  test("a partial failure refiles only the item that failed", async () => {
    const id = await succeededJob();
    modelResponses = [bothItems()];
    rejectNames = new Set([ITEM_TWO.title]);

    const first = await sweeper().run(USER, { dryRun: false });
    assert.equal(first.jobs[0]!.tasksCreated, 1);
    assert.deepEqual(created, [ITEM_ONE.title]);
    assert.match(first.jobs[0]!.error!, /rejected/i);

    const midway = await store.get(id, USER);
    assert.equal(midway!.sweptAt, null, "a partially filed job is not done");
    assert.deepEqual(midway!.createdItemIndexes, [0]);

    // The list starts accepting it.
    created = [];
    modelCalls = 0;
    rejectNames = new Set();
    const second = await sweeper().run(USER, { dryRun: false });

    assert.deepEqual(created, [ITEM_TWO.title], "only the outstanding item is refiled");
    assert.equal(second.jobs[0]!.alreadyFiled, 1);
    assert.equal(modelCalls, 0, "the frozen extraction is reused");

    const finished = await store.get(id, USER);
    assert.ok(finished!.sweptAt);
    assert.deepEqual(finished!.createdItemIndexes, [0, 1]);
  });

  /**
   * The reason the extraction is frozen at all. If the second run re-extracted,
   * "index 0 is already filed" would refer to whatever the model happened to
   * return that time — so a changed answer would refile item 1 as if it were
   * new.
   */
  test("a re-run reuses the frozen extraction even if the model would now answer differently", async () => {
    const id = await succeededJob();
    modelResponses = [bothItems()];
    rejectNames = new Set([ITEM_TWO.title]);
    await sweeper().run(USER, { dryRun: false });

    // A completely different answer, which must never be consulted.
    modelResponses = [JSON.stringify({ items: [{ ...ITEM_ONE, title: "Something else entirely" }] })];
    created = [];
    rejectNames = new Set();
    await sweeper().run(USER, { dryRun: false });

    assert.deepEqual(created, [ITEM_TWO.title]);
    const finished = await store.get(id, USER);
    assert.equal(finished!.actionItems!.length, 2);
    assert.equal(finished!.actionItems![0]!.title, ITEM_ONE.title);
  });
});

describe("dry run", () => {
  test("creates nothing and reports what it would have created", async () => {
    await succeededJob();
    modelResponses = [bothItems()];

    const summary = await sweeper().run(USER, { dryRun: true });

    assert.equal(summary.dryRun, true);
    assert.equal(summary.totalTasksCreated, 0);
    assert.deepEqual(created, []);
    assert.equal(summary.jobs[0]!.wouldCreate!.length, 2);
  });

  /**
   * A dry run that froze the extraction would silently decide what a later real
   * run files — which is not what "dry" means.
   */
  test("does not freeze the extraction or mark anything swept", async () => {
    const id = await succeededJob();
    modelResponses = [bothItems()];

    await sweeper().run(USER, { dryRun: true });

    const after = await store.get(id, USER);
    assert.equal(after!.actionItems, null);
    assert.equal(after!.sweptAt, null);
    assert.deepEqual(after!.createdItemIndexes, []);
  });

  test("the job is still sweepable afterwards", async () => {
    await succeededJob();
    modelResponses = [bothItems(), bothItems()];

    await sweeper().run(USER, { dryRun: true });
    const real = await sweeper().run(USER, { dryRun: false });

    assert.equal(real.totalTasksCreated, 2);
  });
});

describe("failure isolation", () => {
  /** An unattended job whose failures stop the batch is worse than no job. */
  test("one job failing does not stop the others", async () => {
    await succeededJob(TRANSCRIPT, "first.m4a");
    await succeededJob(TRANSCRIPT, "second.m4a");
    // The first extraction is unparseable; the second is fine.
    modelResponses = ["not json at all", bothItems()];

    const summary = await sweeper().run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 2);
    assert.ok(summary.jobs[0]!.error, "the broken job reports its error");
    assert.equal(summary.jobs[1]!.tasksCreated, 2, "the healthy job still ran");
  });

  /**
   * A partial extraction is a partial view of what the call agreed. Freezing it
   * would make that partial view permanent and authoritative.
   */
  test("an incomplete extraction is not frozen", async () => {
    const id = await succeededJob();
    modelResponses = ["I'm sorry, I can't help with that."];

    const summary = await sweeper().run(USER, { dryRun: false });

    assert.ok(summary.jobs[0]!.error);
    const after = await store.get(id, USER);
    assert.equal(after!.actionItems, null, "a failed extraction must be retryable");
    assert.equal(after!.sweptAt, null);
  });

  test("no AI provider is an error on the job, not a crash", async () => {
    await succeededJob();

    const summary = await sweeper({ aiClient: undefined }).run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 1);
    assert.match(summary.jobs[0]!.error!, /AI provider/i);
  });
});

describe("batching", () => {
  test("takes at most batchSize jobs per run", async () => {
    for (let index = 0; index < 3; index += 1) {
      await succeededJob(TRANSCRIPT, `call-${index}.m4a`);
    }
    modelResponses = [bothItems(), bothItems(), bothItems()];

    const summary = await sweeper({ batchSize: 2 }).run(USER, { dryRun: false });

    assert.equal(summary.jobs.length, 2, "the third is left for the next run");
  });
});
