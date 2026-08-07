/**
 * The commit dedup ledger is per user, all the way from the HTTP layer.
 *
 * `HistoryService.dedup.nodetest.ts` proves the store scopes correctly. This
 * proves the *route* actually hands it the caller — the half that can silently
 * regress, because an analyzer built without a user id still works perfectly and
 * just quietly shares one global ledger again. The symptom is invisible until a
 * second person scans the same repository and gets an empty report.
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
import type { DestinationResolver } from "../destinations/DestinationResolver.js";

let pg: TestDatabase;
let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let alice: Awaited<ReturnType<typeof createTestUser>>;
let bob: Awaited<ReturnType<typeof createTestUser>>;

/** Every (projectPath, userId) the router built an analyzer for. */
let built: Array<{ projectPath: string; userId: string }>;

function stubResolver(): DestinationResolver {
  return {
    resolve: async () => ({
      destination: null as null,
      clickUp: {
        createTask: async (task: any) => ({ id: "t1", name: task.name, url: "http://x" }),
        getListStatuses: async () => ["to do"],
      } as never,
      listId: undefined as string | undefined,
      template: BUILTIN_TEMPLATES[0]!,
      config: { teamId: "t", apiKey: "k", projectName: "test" },
    }),
  } as unknown as DestinationResolver;
}

before(async () => {
  pg = await createTestDatabase();
  built = [];

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createTasksRouter({
      resolver: stubResolver(),
      defaultProjectPath: "/default/project",
      grouper: new HeuristicCommitGrouper(),
      analyzerFactory: (projectPath, userId) => {
        built.push({ projectPath, userId });
        return {
          createTasksFromWork: async () => [{ id: "t1", name: "A task", url: "http://x" }],
        };
      },
    })
  );

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  alice = await createTestUser({ userId: "user-alice", email: "alice@example.com" });
  bob = await createTestUser({ userId: "user-bob", email: "bob@example.com" });
});

after(async () => {
  server.close();
  await pg?.drop();
});

async function createTasks(authHeader: string) {
  const response = await fetch(`${baseUrl}/create-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workAnalysis: {
        date: "2026-08-07",
        totalCommits: 1,
        totalFilesChanged: 1,
        totalLinesAdded: 1,
        totalLinesDeleted: 0,
        detectedWork: [
          {
            name: "A thing",
            description: "d",
            type: "feature",
            complexity: "low",
            estimatedHours: 1,
            files: ["a.ts"],
            commits: [],
            tags: [],
          },
        ],
        summary: "s",
      },
    }),
  });
  return { status: response.status, body: (await response.json()) as any };
}

describe("POST /api/create-tasks builds the analyzer for the caller", () => {
  test("passes the authenticated user's id, not a default", async () => {
    built = [];

    const response = await createTasks(alice.authHeader);

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(built.length, 1);
    assert.equal(built[0]!.userId, "user-alice");
  });

  /**
   * The regression that matters. If both requests produced the same owner, the
   * two users would share one ledger and the second would find every commit
   * already processed.
   */
  test("two callers get two different ledgers", async () => {
    built = [];

    await createTasks(alice.authHeader);
    await createTasks(bob.authHeader);

    assert.deepEqual(
      built.map((entry) => entry.userId),
      ["user-alice", "user-bob"]
    );
  });

  /** The owner must never be the sentinel on an authenticated path. */
  test("never falls back to the shared legacy ledger", async () => {
    built = [];

    await createTasks(alice.authHeader);

    assert.notEqual(built[0]!.userId, "*");
  });
});
