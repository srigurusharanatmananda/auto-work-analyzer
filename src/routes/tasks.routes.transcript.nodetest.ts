/**
 * A call transcript through the real preview pipeline.
 *
 * The point of these is that there is no transcript-specific pipeline: the
 * body shape is new, everything after it — templates, rendering, the response
 * envelope — is the code every other source already uses. If a change ever
 * makes transcripts need their own rendering path, these break.
 *
 * NO TEST HERE CALLS A REAL AI PROVIDER; the client is a stub. Nothing reaches
 * ClickUp either — the resolver is stubbed and only /preview-tasks is called,
 * which writes nothing anywhere.
 *
 * Runs under `tsx --test` because it needs a real user row (authenticate
 * re-reads it on every request), and that means Postgres.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { createTasksRouter } from "./tasks.routes.js";
import { HeuristicCommitGrouper } from "../grouping/HeuristicCommitGrouper.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { createTestUser } from "../testing/authFixture.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import type { AiClient } from "../ai/AiClient.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";

const QUOTE =
  "the CSV export is dropping the last row for anyone with more than a thousand records";

const TRANSCRIPT = [
  `Priya: Before we wrap up, ${QUOTE}.`,
  "Sam: I can take that. I'll have a fix out by Thursday.",
].join("\n");

const ACTION_ITEM = {
  title: "Fix the CSV export dropping the last row",
  description: "Exports truncate the final row for datasets over a thousand records.",
  type: "bug-fix",
  priority: "high",
  estimateHours: 3,
  quote: QUOTE,
  speaker: "Sam",
};

let pg: TestDatabase;
let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let authHeader: string;
/** Swapped per test so each can decide what the "model" returns. */
let modelResponse: string;
/**
 * Every task the stubbed ClickUp was asked to create. Nothing leaves the
 * process — this is how the round-trip test below observes what WOULD be
 * created without creating it.
 */
let createdTasks: Array<{ name: string; description: string }>;

function stubResolver(): DestinationResolver {
  return {
    resolve: async () => ({
      destination: null as null,
      clickUp: {
        createTask: async (task: any) => {
          createdTasks.push({ name: task.name, description: task.description });
          return { id: "stub-id", name: task.name, url: "http://example.invalid/stub" };
        },
      } as never,
      listId: undefined as string | undefined,
      template: BUILTIN_TEMPLATES[0]!,
      config: { teamId: "t", apiKey: "k", projectName: "test" },
    }),
  } as unknown as DestinationResolver;
}

/**
 * Consumed in order when set, for the tests that make TWO model calls —
 * extraction then grouping. Empty means "always answer `modelResponse`", which
 * is what every single-call test wants.
 */
let modelResponses: string[] = [];

const stubAiClient = {
  isConfigured: true,
  providerNames: ["stub"],
  complete: async () => ({
    text: modelResponses.length > 0 ? modelResponses.shift()! : modelResponse,
    provider: "stub",
    model: "stub",
  }),
} as unknown as AiClient;

before(async () => {
  createdTasks = [];
  pg = await createTestDatabase();

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createTasksRouter({
      resolver: stubResolver(),
      defaultProjectPath: process.cwd(),
      grouper: new HeuristicCommitGrouper(),
      aiClient: stubAiClient,
    })
  );

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  authHeader = (await createTestUser()).authHeader;
});

after(async () => {
  server.close();
  await pg?.drop();
});

async function preview(body: unknown) {
  const res = await fetch(`${baseUrl}/preview-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe("POST /api/preview-tasks with a transcript", () => {
  test("renders a task through the same pipeline every other source uses", async () => {
    modelResponse = JSON.stringify({ items: [ACTION_ITEM] });

    const { status, body } = await preview({
      transcript: TRANSCRIPT,
      callDate: "2026-08-06",
      callTitle: "Weekly sync",
    });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);

    // Rendered by the built-in template, not by anything transcript-specific.
    const [entry] = body.data.items;
    assert.ok(entry.task.name.length > 0, "the template produced a task name");
    assert.ok(entry.task.tags.includes("call-transcript"), "provenance tag survives rendering");
    assert.ok(entry.task.tags.includes("Weekly sync"));
  });

  test("an invented action item produces no task and says why", async () => {
    modelResponse = JSON.stringify({
      items: [{ ...ACTION_ITEM, quote: "we agreed to rewrite the billing service in Rust" }],
    });

    const { status, body } = await preview({ transcript: TRANSCRIPT });

    assert.equal(status, 200);
    assert.equal(body.data.items.length, 0, "an unsupported item must not become a task");

    const warnings = body.data.warnings.join(" ");
    assert.match(warnings, /not in the transcript/i);
  });

  /**
   * The distinction the whole `reason` channel exists for. Both cases render
   * zero tasks; only the warnings tell them apart, and a user who cannot tell
   * will conclude the call produced nothing when extraction actually broke.
   */
  test("a quiet call and a broken extraction are distinguishable", async () => {
    modelResponse = JSON.stringify({ items: [] });
    const quiet = await preview({ transcript: "Sam: Morning. Priya: Morning." });

    modelResponse = "I'm sorry, I can't help with that.";
    const broken = await preview({ transcript: TRANSCRIPT });

    assert.equal(quiet.body.data.items.length, 0);
    assert.equal(broken.body.data.items.length, 0);

    const quietWarnings = quiet.body.data.warnings.join(" ");
    const brokenWarnings = broken.body.data.warnings.join(" ");

    assert.doesNotMatch(quietWarnings, /incomplete/i, "a quiet call is not an error");
    assert.match(brokenWarnings, /incomplete|JSON/i);
  });

  test("a transcript still requires authentication", async () => {
    const res = await fetch(`${baseUrl}/preview-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: TRANSCRIPT }),
    });
    assert.equal(res.status, 401);
  });

  test("carries the cited quote through to the client, where a reviewer can see it", async () => {
    modelResponse = JSON.stringify({ items: [ACTION_ITEM] });

    const { body } = await preview({ transcript: TRANSCRIPT });
    const [entry] = body.data.items;

    // The UI shows this verbatim. If the preview ever stopped returning the
    // source work item, the review screen would be asking someone to approve a
    // task with no visible evidence behind it — which is the same as no review.
    assert.equal(entry.workItem.provenance.source, "transcript");
    assert.equal(entry.workItem.provenance.quote, QUOTE);
    assert.equal(entry.workItem.provenance.speaker, "Sam");
  });

  test("a router with no AI client explains itself rather than silently finding nothing", async () => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createTasksRouter({
        resolver: stubResolver(),
        defaultProjectPath: process.cwd(),
        grouper: new HeuristicCommitGrouper(),
        // aiClient deliberately omitted.
      })
    );

    const local = app.listen(0);
    try {
      const res = await fetch(
        `http://localhost:${(local.address() as AddressInfo).port}/api/preview-tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ transcript: TRANSCRIPT }),
        }
      );
      const body = (await res.json()) as any;

      assert.equal(res.status, 400);
      assert.match(body.error, /AI provider/i);
    } finally {
      local.close();
    }
  });
});

/**
 * The reviewed path: preview a transcript, then create from what the reviewer
 * approved.
 *
 * These are the tests that make the review meaningful. The client sends back the
 * work items the preview gave it — NOT the transcript again — and the last test
 * here is the reason why: extraction is a model call, so re-sending the
 * transcript at create time would re-run it and create a different set of tasks
 * from the ones a human just read and agreed to. Nothing about the response
 * would look wrong.
 *
 * No ClickUp call leaves the process: the resolver's `createTask` is a stub that
 * records into `createdTasks`.
 */
/**
 * A finished transcription job, by id, instead of pasted text.
 *
 * This is the hop that makes uploading a recording useful: the same extraction
 * and the same review, with the transcript fetched rather than copied. The
 * lookup is satisfied with an object literal, which is the point of the router
 * depending on an interface rather than the store class.
 */
describe("POST /api/preview-tasks with a transcriptionJobId", () => {
  const finishedJob = {
    status: "succeeded",
    transcript: TRANSCRIPT,
    callTitle: "Weekly sync",
    callDate: "2026-08-06",
    originalFilename: "standup.mp3",
  };

  function routerWith(job: unknown, options: { withLookup?: boolean } = {}) {
    const { withLookup = true } = options;
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createTasksRouter({
        resolver: stubResolver(),
        defaultProjectPath: process.cwd(),
        grouper: new HeuristicCommitGrouper(),
        aiClient: stubAiClient,
        ...(withLookup
          ? { transcriptionJobs: { get: async () => job as any } }
          : {}),
      })
    );
    return app.listen(0);
  }

  async function previewJob(
    server: ReturnType<express.Express["listen"]>,
    body: unknown = { transcriptionJobId: "job-1" }
  ) {
    const res = await fetch(
      `http://localhost:${(server.address() as AddressInfo).port}/api/preview-tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      }
    );
    return { status: res.status, body: (await res.json()) as any };
  }

  test("a finished job produces the same reviewable tasks as pasted text", async () => {
    modelResponse = JSON.stringify({ items: [ACTION_ITEM] });
    const server = routerWith(finishedJob);

    try {
      const { status, body } = await previewJob(server);

      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.data.items.length, 1);
      assert.equal(body.data.items[0].workItem.provenance.quote, QUOTE);
      // Tags come from the JOB, not the request, so they cannot drift from what
      // was uploaded.
      assert.ok(body.data.items[0].task.tags.includes("Weekly sync"));
      assert.ok(body.data.items[0].task.tags.includes("2026-08-06"));
    } finally {
      server.close();
    }
  });

  test("a job that is still running is a 409 that says so, not a 400", async () => {
    const server = routerWith({ ...finishedJob, status: "running", transcript: null });

    try {
      const { status, body } = await previewJob(server);

      // Nothing is malformed — the work just is not done yet.
      assert.equal(status, 409);
      assert.match(body.error, /still running/i);
      assert.equal(body.data.status, "running");
    } finally {
      server.close();
    }
  });

  test("a failed job says the transcription failed, not that there are no tasks", async () => {
    const server = routerWith({ ...finishedJob, status: "failed", transcript: null });

    try {
      const { status, body } = await previewJob(server);
      assert.equal(status, 409);
      assert.match(body.error, /failed/i);
    } finally {
      server.close();
    }
  });

  /** 404 not 403 — a job id must not be confirmable by a stranger. */
  test("an unknown or unowned job is a 404", async () => {
    const server = routerWith(null);

    try {
      const { status, body } = await previewJob(server);
      assert.equal(status, 404);
      assert.match(body.error, /No such transcription job/i);
    } finally {
      server.close();
    }
  });

  /**
   * A silent recording is a real, successful transcription. An unexplained empty
   * list reads like a bug; this says which it is.
   */
  test("a job that transcribed to silence explains the empty result", async () => {
    modelResponse = JSON.stringify({ items: [] });
    const server = routerWith({ ...finishedJob, transcript: "   " });

    try {
      const { body } = await previewJob(server);

      assert.equal(body.data.items.length, 0);
      assert.match(body.data.warnings.join(" "), /no speech/i);
    } finally {
      server.close();
    }
  });

  test("a router with no job lookup explains itself rather than 500ing", async () => {
    const server = routerWith(finishedJob, { withLookup: false });

    try {
      const { status, body } = await previewJob(server);
      assert.equal(status, 400);
      assert.match(body.error, /not configured to read transcription jobs/i);
    } finally {
      server.close();
    }
  });

  test("it still requires authentication", async () => {
    const server = routerWith(finishedJob);

    try {
      const res = await fetch(
        `http://localhost:${(server.address() as AddressInfo).port}/api/preview-tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcriptionJobId: "job-1" }),
        }
      );
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

describe("transcript → preview → create", () => {
  const SECOND_QUOTE = "I'll have a fix out by Thursday";

  const SECOND_ITEM = {
    title: "Ship the CSV fix by Thursday",
    description: "Sam committed to a fix landing Thursday.",
    type: "chore",
    priority: "normal",
    estimateHours: 1,
    quote: `Sam: I can take that. ${SECOND_QUOTE}`,
    speaker: "Sam",
  };

  async function create(body: unknown) {
    const res = await fetch(`${baseUrl}/create-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  test("the previewed work items are accepted verbatim by /create-tasks", async () => {
    createdTasks = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM] });

    const previewed = await preview({ transcript: TRANSCRIPT, callTitle: "Weekly sync" });
    const workItems = previewed.body.data.items.map((entry: any) => entry.workItem);

    const created = await create({ workItems });

    // A 400 here would mean a transcript-derived work item does not satisfy the
    // validator the canonical create path applies — i.e. the two halves of the
    // feature disagree, which no preview-only test could catch.
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.data.tasksCreated, 1);
    assert.equal(createdTasks.length, 1);
  });

  test("only the items the reviewer kept are created", async () => {
    createdTasks = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] });

    const previewed = await preview({ transcript: TRANSCRIPT });
    assert.equal(previewed.body.data.items.length, 2, "both items should be previewed");

    // The reviewer rejects the second one.
    const kept = [previewed.body.data.items[0].workItem];
    const created = await create({ workItems: kept });

    assert.equal(created.body.data.tasksCreated, 1);
    assert.equal(createdTasks.length, 1);
    assert.match(createdTasks[0]!.name, /CSV/);
  });

  /**
   * The whole reason the client re-sends work items instead of the transcript.
   * The "model" returns something completely different by the time create runs;
   * what gets created must still be what was reviewed.
   */
  test("creating does not re-run extraction", async () => {
    createdTasks = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM] });

    const previewed = await preview({ transcript: TRANSCRIPT });
    const workItems = previewed.body.data.items.map((entry: any) => entry.workItem);

    modelResponse = JSON.stringify({ items: [SECOND_ITEM] });
    const created = await create({ workItems });

    assert.equal(created.body.data.tasksCreated, 1);
    assert.match(
      createdTasks[0]!.name,
      /CSV/,
      "the created task must be the reviewed one, not a fresh extraction"
    );
  });

  /**
   * Approving nothing must create nothing, and must not fall through to another
   * input shape. An empty `workItems` deliberately does NOT count as the chosen
   * shape (see suppliedWorkItems), so this pins that a reviewer who unchecks
   * every item gets zero tasks rather than a 400 or a surprise.
   */
  test("approving nothing creates nothing", async () => {
    createdTasks = [];
    const created = await create({ workItems: [] });

    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.data.tasksCreated, 0);
    assert.equal(createdTasks.length, 0);
  });
});

/**
 * Grouping is applied server-side so the preview shows exactly what will be
 * created. The invariant across all of these: whatever the shape, every action
 * item that survived the quote validator must still reach ClickUp.
 */
describe("grouping a transcript's action items", () => {
  const SECOND_QUOTE = "I think that one can be shared immediately after this meeting";
  const LONGER_TRANSCRIPT = [TRANSCRIPT, `Priya: ${SECOND_QUOTE}.`].join("\n");
  const SECOND_ITEM = {
    title: "Send the standard NDA",
    description: "Share the NDA so documents can start moving.",
    type: "chore",
    priority: "normal",
    estimateHours: 1,
    quote: SECOND_QUOTE,
    speaker: "Priya",
  };

  /** Names of every leaf task, however deeply the preview nested them. */
  function leafNames(items: any[]): string[] {
    return items.flatMap((entry: any) =>
      entry.task.subtasks && entry.task.subtasks.length > 0
        ? entry.task.subtasks.map((sub: any) => sub.name)
        : [entry.task.name]
    );
  }

  test("per-item is the default, and leaves each item its own task", async () => {
    modelResponses = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] });

    const { body } = await preview({ transcript: LONGER_TRANSCRIPT });

    assert.equal(body.data.items.length, 2);
    assert.equal(body.data.transcriptGrouping, "per-item");
  });

  test("single-task nests every item under one parent", async () => {
    modelResponses = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] });

    const { body } = await preview({
      transcript: LONGER_TRANSCRIPT,
      grouping: "single-task",
      callTitle: "Weekly sync",
      callDate: "2026-08-07",
    });

    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].task.name, "Weekly sync — 2026-08-07");
    assert.equal(body.data.transcriptGrouping, "single-task");
    // The whole point: the built-in template has emitSubtasks off, so without
    // the override this parent would be created empty.
    assert.equal(body.data.items[0].task.subtasks.length, 2);
  });

  test("no action item is lost to grouping", async () => {
    modelResponses = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] });

    const { body } = await preview({ transcript: LONGER_TRANSCRIPT, grouping: "single-task" });

    assert.deepEqual(leafNames(body.data.items).sort(), [ACTION_ITEM.title, SECOND_ITEM.title].sort());
  });

  test("by-theme uses the model's clusters", async () => {
    modelResponses = [
      JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] }),
      JSON.stringify({
        groups: [
          { title: "Client paperwork", description: "", type: "chore", itemIndexes: [0, 1] },
        ],
      }),
    ];

    const { body } = await preview({ transcript: LONGER_TRANSCRIPT, grouping: "by-theme" });

    assert.equal(body.data.transcriptGrouping, "by-theme");
    assert.equal(body.data.items[0].task.name, "Client paperwork");
    assert.deepEqual(leafNames(body.data.items).sort(), [ACTION_ITEM.title, SECOND_ITEM.title].sort());
  });

  /**
   * A grouping failure must not cost the user their extraction. They get the
   * flat list they would have got anyway, plus a warning saying why.
   */
  test("a grouping the model botches degrades to per-item and says so", async () => {
    modelResponses = [
      JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] }),
      // Well-formed, and quietly omits item 1.
      JSON.stringify({ groups: [{ title: "Partial", description: "", type: "chore", itemIndexes: [0] }] }),
    ];

    const { body } = await preview({ transcript: LONGER_TRANSCRIPT, grouping: "by-theme" });

    assert.equal(body.data.transcriptGrouping, "per-item");
    assert.equal(body.data.items.length, 2);
    assert.ok(
      body.data.warnings.some((w: string) => /could not group/i.test(w)),
      `expected a grouping warning, got ${JSON.stringify(body.data.warnings)}`
    );
  });

  /** An unrecognised value is not worth a 400; it means "the normal shape". */
  test("an unknown grouping falls back to per-item rather than erroring", async () => {
    modelResponses = [];
    modelResponse = JSON.stringify({ items: [ACTION_ITEM, SECOND_ITEM] });

    const { status, body } = await preview({ transcript: LONGER_TRANSCRIPT, grouping: "sideways" });

    assert.equal(status, 200);
    assert.equal(body.data.transcriptGrouping, "per-item");
  });
});
