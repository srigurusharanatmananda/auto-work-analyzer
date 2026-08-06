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

function stubResolver(): DestinationResolver {
  return {
    resolve: async () => ({
      destination: null as null,
      clickUp: {} as never,
      listId: undefined as string | undefined,
      template: BUILTIN_TEMPLATES[0]!,
      config: { teamId: "t", apiKey: "k", projectName: "test" },
    }),
  } as unknown as DestinationResolver;
}

const stubAiClient = {
  isConfigured: true,
  providerNames: ["stub"],
  complete: async () => ({ text: modelResponse, provider: "stub", model: "stub" }),
} as unknown as AiClient;

before(async () => {
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
