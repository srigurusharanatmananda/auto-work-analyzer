/**
 * Pins the backward-compatibility contract of /api/notes and /api/create-tasks.
 *
 * Task 8 replaced both handlers' bodies wholesale, so these are the only tests
 * standing between that refactor and a silently changed public response shape.
 * They assert field names, nesting and status codes — not just `success: true`.
 *
 * Runs under `tsx --test` (Node), not `bun test`, because every assertion here
 * needs `authenticate` to genuinely succeed, and `authenticate` constructs a
 * real AuthService -> AuthDatabaseService -> better-sqlite3, which cannot open a
 * database under this repo's Bun version (oven-sh/bun#4290). A real token is
 * minted via JWTService directly — verifyAccessToken only checks the signature
 * and the (empty) blacklist table, so no user row or login flow is needed.
 *
 * `createTasks` is false throughout, so no ClickUp call is ever made.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { createTasksRouter } from "./tasks.routes.js";
import { JWTService } from "../services/JWTService.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { UnknownTemplateError } from "../formatting/Template.js";
import {
  DestinationResolver,
  UnknownDestinationError,
} from "../destinations/DestinationResolver.js";
import type { Destination } from "../destinations/DestinationStore.js";
import type { ClickUpService } from "../services/ClickUpService.js";
import type { ClickUpConfig } from "../types/index.js";

// Never used to reach ClickUp: every test below either leaves createTasks false
// or stubs the analyzer, so no request leaves the process.
const clickUpConfig = {
  teamId: "team",
  apiKey: "unused",
  projectName: "test",
} as ClickUpConfig;

/**
 * Stands in for the real DestinationResolver without opening a database, and
 * preserves the two rejections the router turns into 400s: an unknown template
 * id and an unknown destination id.
 *
 * `listId` is left undefined so the status-mapping round trip is skipped
 * entirely — these tests are about response envelopes, and a status lookup here
 * would be a real network call.
 */
function stubResolver(destination: Destination | null = null): DestinationResolver {
  return {
    resolve: (_userId: string, destinationId?: string, templateId?: string) => {
      if (destinationId && destinationId !== destination?.id) {
        throw new UnknownDestinationError(destinationId);
      }
      const id = templateId || "builtin-standard";
      const template = BUILTIN_TEMPLATES.find((t) => t.id === id);
      if (!template) throw new UnknownTemplateError(id);
      return {
        destination,
        clickUp: {
          createTask: async (task: any) => ({ id: "x", name: task.name, url: "http://x" }),
          getListStatuses: async () => {
            throw new Error("no network in tests");
          },
        } as unknown as ClickUpService,
        listId: undefined as string | undefined,
        template,
        config: clickUpConfig,
      };
    },
  } as unknown as DestinationResolver;
}

const LEGACY_NOTES =
  "Task 1: Try it\nPriority: HIGH\nEstimate: 2 hours\nDescription: Smoke test.\n\n---\n\nTask 2: Second\nDescription: Also.";

/**
 * A minimally complete WorkItem as a client would post it. Every field the
 * render path actually dereferences is present, so this must survive validation
 * untouched — the guard has to reject malformed input without narrowing what a
 * legitimate caller may send.
 */
const VALID_WORK_ITEM = {
  title: "Ship the thing",
  description: "Prose.",
  type: "feature",
  priority: "high",
  estimateHours: 2,
  tags: ["api"],
  provenance: { commits: [] as unknown[], files: [] as string[], source: "notes" },
};

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let authHeader: string;

before(() => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createTasksRouter({
      resolver: stubResolver(),
      // Read only by the legacy {workAnalysis} branch, which no test below
      // exercises — driving it would need a real GitWorkAnalyzer against a real
      // repo and a real ClickUp.
      defaultProjectPath: process.cwd(),
    })
  );

  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}/api`;

  const { accessToken } = JWTService.generateTokenPair({
    userId: "user-1",
    email: "test@example.com",
    role: "user",
    fullName: "Test User",
  });
  authHeader = `Bearer ${accessToken}`;
});

after(() => {
  server.close();
});

function postJson(path: string, body: unknown, auth = true) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/notes — legacy response envelope", () => {
  test("the documented envelope survives the refactor", async () => {
    const res = await postJson("/notes", { notes: LEGACY_NOTES, createTasks: false });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(typeof body.message, "string");

    // processedNotes.tasks[] keeps all five legacy fields, complexity included
    // (WorkItem carries `priority`, so the route derives complexity back).
    assert.equal(body.data.processedNotes.totalTasks, 2);
    assert.equal(body.data.processedNotes.tasks.length, 2);
    for (const task of body.data.processedNotes.tasks) {
      assert.deepEqual(Object.keys(task).sort(), [
        "complexity",
        "estimatedHours",
        "name",
        "tags",
        "type",
      ]);
    }

    // "Priority: HIGH" on task 1 must come back as complexity "high".
    assert.equal(body.data.processedNotes.tasks[0].complexity, "high");

    assert.deepEqual(body.data.createdTasks, []);
    assert.deepEqual(body.data.summary, {
      tasksExtracted: 2,
      tasksCreated: 0,
      tasksFailed: 0,
    });
  });

  test("returns the rendered markdown alongside the tasks", async () => {
    const res = await postJson("/notes", { notes: LEGACY_NOTES, createTasks: false });
    const body = await res.json();
    assert.match(body.data.markdown, /Task 1: Try it/);
  });

  test("400 with the exact legacy message when no notes are supplied", async () => {
    const res = await postJson("/notes", { createTasks: false });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, {
      success: false,
      error: "No notes provided. Send 'notes' in body or upload a text file.",
    });
  });

  // The counterpart to the empty-file case below: no file and no `notes` key is
  // still a 400, and so is an explicitly empty JSON `notes` string (the old
  // handler's `else if (req.body.notes)` fell through to the 400 for both).
  test("400 when the JSON notes field is an empty string", async () => {
    const res = await postJson("/notes", { notes: "", createTasks: false });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "No notes provided. Send 'notes' in body or upload a text file.");
  });

  test("400 when the named template does not exist", async () => {
    const res = await postJson("/notes", { notes: LEGACY_NOTES, templateId: "nope" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.details, /nope/);
  });

  test("401 without a bearer token", async () => {
    const res = await postJson("/notes", { notes: LEGACY_NOTES }, false);
    assert.equal(res.status, 401);
  });
});

describe("POST /api/notes — multipart upload", () => {
  // Guards the middleware order: `upload.single("notes")` must run BEFORE
  // `authenticate`, or multer never parses the body and req.file is undefined.
  test("reads notes from an uploaded .txt file", async () => {
    const form = new FormData();
    form.append("notes", new Blob([LEGACY_NOTES], { type: "text/plain" }), "notes.txt");
    form.append("createTasks", "false");

    const res = await fetch(`${baseUrl}/notes`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: form,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.summary.tasksExtracted, 2);
  });

  test("rejects a non-text upload (fileFilter is still enforced)", async () => {
    const form = new FormData();
    form.append("notes", new Blob(["\x89PNG"], { type: "image/png" }), "evil.png");

    const res = await fetch(`${baseUrl}/notes`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: form,
    });

    assert.notEqual(res.status, 200);
  });

  // The old inline handler used a bare truthiness check, so the string "false"
  // that multipart always sends counted as true and created tasks nobody asked
  // for. Proof that it no longer does: with a bogus API key, any real ClickUp
  // call would surface as a failure or a 500, so a clean zero-created 200 means
  // no call happened.
  // The old inline handler branched on `req.file` being present, not on the text
  // being non-empty, so an empty .txt processed to zero tasks and returned 200.
  // Restored deliberately: "you uploaded a file with nothing in it" is a
  // different answer from "you sent no notes at all", and only the second is a
  // 400. Changing it would break any caller that treats 200/0-tasks as success.
  test("an empty uploaded file is 200 with zero tasks, not a 400", async () => {
    const form = new FormData();
    form.append("notes", new Blob([""], { type: "text/plain" }), "empty.txt");
    form.append("createTasks", "false");

    const res = await fetch(`${baseUrl}/notes`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: form,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.summary.tasksExtracted, 0);
    assert.deepEqual(body.data.processedNotes.tasks, []);
    assert.deepEqual(body.data.createdTasks, []);
  });

  test('createTasks="false" from a form does not trigger creation', async () => {
    const form = new FormData();
    form.append("notes", new Blob([LEGACY_NOTES], { type: "text/plain" }), "notes.txt");
    form.append("createTasks", "false");

    const res = await fetch(`${baseUrl}/notes`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: form,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data.createdTasks, []);
    assert.equal(body.data.summary.tasksCreated, 0);
    assert.equal(body.data.summary.tasksFailed, 0);
  });
});

/**
 * `workItems` arrives as untrusted JSON and used to be cast straight to
 * WorkItem[], so a malformed item exploded inside buildRenderContext and came
 * back as a 500 "Failed to create tasks" — the server taking the blame for the
 * client's bad body. Validation covers exactly the fields the render path
 * dereferences (renderContext.buildRenderContext reads provenance.commits /
 * provenance.files, ClickUpRenderer.resolveTags spreads tags), not a whole
 * schema clone.
 */
describe("workItems validation", () => {
  test("an empty object is a 400 naming the missing field, not a 500", async () => {
    const res = await postJson("/create-tasks", { workItems: [{}] });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /workItems/);
    assert.match(body.details, /workItems\[0\]/);
    assert.match(body.details, /provenance/);
  });

  test("a missing provenance is a 400 naming provenance", async () => {
    const { provenance, ...withoutProvenance } = VALID_WORK_ITEM;
    const res = await postJson("/create-tasks", { workItems: [withoutProvenance] });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.details, /workItems\[0\]\.provenance/);
  });

  test("a provenance without commits/files arrays is a 400 naming them", async () => {
    const noCommits = await postJson("/create-tasks", {
      workItems: [{ ...VALID_WORK_ITEM, provenance: { files: [], source: "notes" } }],
    });
    assert.equal(noCommits.status, 400);
    assert.match((await noCommits.json()).details, /provenance\.commits/);

    const noFiles = await postJson("/create-tasks", {
      workItems: [{ ...VALID_WORK_ITEM, provenance: { commits: [], source: "notes" } }],
    });
    assert.equal(noFiles.status, 400);
    assert.match((await noFiles.json()).details, /provenance\.files/);
  });

  test("a missing tags array is a 400 (ClickUpRenderer spreads it)", async () => {
    const { tags, ...withoutTags } = VALID_WORK_ITEM;
    const res = await postJson("/create-tasks", { workItems: [withoutTags] });
    assert.equal(res.status, 400);
    assert.match((await res.json()).details, /workItems\[0\]\.tags/);
  });

  test("the index of the offending item is reported, not just the first", async () => {
    const res = await postJson("/create-tasks", {
      workItems: [VALID_WORK_ITEM, { ...VALID_WORK_ITEM, provenance: {} }],
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).details, /workItems\[1\]/);
  });

  // Guards against an over-tight rule: a well-formed item must still render.
  // Asserted on /preview-tasks so nothing is created and no ClickUp call is made.
  test("a valid workItem passes validation unchanged", async () => {
    const res = await postJson("/preview-tasks", { workItems: [VALID_WORK_ITEM] });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].task.name, "Ship the thing");
  });

  test("the same guard protects /export-markdown", async () => {
    const res = await postJson("/export-markdown", { workItems: [{}] });
    assert.equal(res.status, 400);
    assert.match((await res.json()).details, /workItems\[0\]/);
  });
});

describe("POST /api/create-tasks — legacy response envelope", () => {
  test("400 when neither workAnalysis nor workItems is supplied", async () => {
    const res = await postJson("/create-tasks", {});
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /workAnalysis is required/);
  });

  test("401 without a bearer token", async () => {
    const res = await postJson("/create-tasks", { workItems: [] }, false);
    assert.equal(res.status, 401);
  });

  // An empty workItems array short-circuits before any ClickUp call, which lets
  // the success envelope be asserted without touching the network.
  test("success envelope keeps tasksCreated + tasks", async () => {
    const res = await postJson("/create-tasks", { workItems: [] });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.tasksCreated, 0);
    assert.deepEqual(body.data.tasks, []);
    assert.equal(body.message, "Created 0 tasks in ClickUp");
  });
});

/**
 * The point of ruling (c): a legacy `{ workAnalysis }` body must still reach
 * GitWorkAnalyzer.createTasksFromWork, because that is what writes
 * addAnalysisHistory / saveWorkItem / markCommitsAsProcessed. If it were
 * rerouted through the canonical renderer those side effects would vanish and
 * the analyzer would silently re-detect the same commits forever, creating
 * duplicate tasks with no error to notice. These tests fail if that happens.
 */
describe("POST /api/create-tasks — legacy {workAnalysis} branch", () => {
  let legacyApp: ReturnType<express.Express["listen"]>;
  let legacyUrl: string;
  const calls: Array<{ projectPath: string; date: string }> = [];

  before(() => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createTasksRouter({
        resolver: stubResolver(),
        defaultProjectPath: "/default/project",
        analyzerFactory: (projectPath) => ({
          createTasksFromWork: async (analysis: any) => {
            calls.push({ projectPath, date: analysis.date });
            // Shaped like the real return: created tasks plus a null for a
            // failure, which the route must filter out.
            return [
              { id: "t1", name: "📊 Daily Work Summary - 2026-08-01", url: "http://x/1" },
              { id: "t2", name: "✅ Something", url: "http://x/2" },
              null,
            ];
          },
        }),
      })
    );
    legacyApp = app.listen(0);
    legacyUrl = `http://localhost:${(legacyApp.address() as AddressInfo).port}/api`;
  });

  after(() => {
    legacyApp.close();
  });

  function postLegacy(body: unknown) {
    return fetch(`${legacyUrl}/create-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    });
  }

  test("delegates to createTasksFromWork rather than the renderer", async () => {
    calls.length = 0;
    const res = await postLegacy({ workAnalysis: { date: "2026-08-01", detectedWork: [] } });

    assert.equal(res.status, 200);
    assert.equal(calls.length, 1, "createTasksFromWork must be called exactly once");
    assert.equal(calls[0]!.date, "2026-08-01");
  });

  test("honours an explicit projectPath, falling back to the default", async () => {
    calls.length = 0;
    await postLegacy({ workAnalysis: { date: "d", detectedWork: [] }, projectPath: "/explicit" });
    assert.equal(calls[0]!.projectPath, "/explicit");

    calls.length = 0;
    await postLegacy({ workAnalysis: { date: "d", detectedWork: [] } });
    assert.equal(calls[0]!.projectPath, "/default/project");
  });

  test("keeps the pre-refactor envelope: nulls filtered, no failedTasks key", async () => {
    const res = await postLegacy({ workAnalysis: { date: "d", detectedWork: [] } });
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.tasksCreated, 2, "the null entry must be filtered out");
    assert.equal(body.data.tasks.length, 2);
    assert.equal(body.message, "Created 2 tasks in ClickUp");
    // The old handler had no failedTasks key; createTasksFromWork nulls failures
    // internally and cannot say which ones failed, so inventing an empty array
    // here would be a claim we cannot support.
    assert.ok(!("failedTasks" in body.data));
    // Full ClickUpTask objects, not the {id,name,url} projection the new branch
    // returns — the legacy branch passes through whatever the analyzer returned.
    assert.equal(body.data.tasks[0].name, "📊 Daily Work Summary - 2026-08-01");
  });

  // Task 9A: a picked template must reach createTasksFromWork on this branch
  // too, or a user who selects a template in the UI (which posts
  // `{ workAnalysis }`) sees the preview change but gets old-format tasks.
  test("a {workAnalysis} body forwards the resolved template to the analyzer", async () => {
    const app = express();
    app.use(express.json());
    let received: any = "NOT_CALLED";
    app.use(
      "/api",
      createTasksRouter({
        resolver: stubResolver(),
        defaultProjectPath: "/p",
        analyzerFactory: () => ({
          createTasksFromWork: async (_wa: any, _cfg: any, _batch?: number, opts?: any) => {
            received = opts?.template ?? null;
            return [];
          },
        }),
      })
    );
    const server = app.listen(0);
    try {
      const url = `http://localhost:${(server.address() as AddressInfo).port}/api/create-tasks`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          workAnalysis: { date: "d", detectedWork: [] },
          templateId: "builtin-terse",
        }),
      });

      assert.equal(res.status, 200);
      assert.equal(received?.id, "builtin-terse");
    } finally {
      server.close();
    }
  });

  // The dangerous shape: a client that always sends `workItems` (an editor that
  // initialises it to []) alongside the legacy `workAnalysis`. Under a bare
  // Array.isArray check the empty array won the precedence race, the request
  // returned a cheerful "Created 0 tasks in ClickUp", and createTasksFromWork —
  // the ONLY caller of markCommitsAsProcessed — was never reached. Those commits
  // then stay unprocessed and get re-reported forever, with nothing thrown.
  test("an empty workItems array cannot bypass the legacy {workAnalysis} path", async () => {
    calls.length = 0;
    const res = await postLegacy({
      workAnalysis: { date: "2026-08-02", detectedWork: [] },
      workItems: [],
    });

    assert.equal(res.status, 200);
    assert.equal(
      calls.length,
      1,
      "createTasksFromWork must still be called — otherwise commit dedup silently stops"
    );
    assert.equal(calls[0]!.date, "2026-08-02");
  });

  // Ambiguity is refused rather than resolved by precedence: with a real
  // workItems payload AND a workAnalysis, either choice silently discards half
  // the request, so neither is made.
  test("workAnalysis plus a non-empty workItems is a 400, not a silent choice", async () => {
    calls.length = 0;
    const res = await postLegacy({
      workAnalysis: { date: "d", detectedWork: [] },
      workItems: [VALID_WORK_ITEM],
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /both/i);
    assert.equal(calls.length, 0, "nothing may be created while the request is ambiguous");
  });

  test("a legacy failure is a 500 with the original error string", async () => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createTasksRouter({
        resolver: stubResolver(),
        defaultProjectPath: "/p",
        analyzerFactory: () => ({
          createTasksFromWork: async () => {
            throw new Error("ClickUp unreachable");
          },
        }),
      })
    );
    const server = app.listen(0);
    try {
      const url = `http://localhost:${(server.address() as AddressInfo).port}/api/create-tasks`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ workAnalysis: { date: "d", detectedWork: [] } }),
      });

      // Not the brief's blanket 400 "Template render failed" — an outage is ours.
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.error, "Failed to create tasks");
      assert.equal(body.details, "ClickUp unreachable");
    } finally {
      server.close();
    }
  });
});

describe("POST /api/preview-tasks", () => {
  test("renders without creating anything", async () => {
    const res = await postJson("/preview-tasks", { notes: LEGACY_NOTES });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.items.length, 2);
    assert.equal(body.data.template.id, "builtin-standard");
    assert.deepEqual(body.data.warnings, []);
  });

  test("400 when no input shape is supplied", async () => {
    const res = await postJson("/preview-tasks", {});
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /workItems, notes, or workAnalysis/);
  });
});

describe("POST /api/export-markdown", () => {
  test("returns markdown with the supplied header", async () => {
    const res = await postJson("/export-markdown", {
      notes: LEGACY_NOTES,
      title: "Weekly Report",
      period: "2026-07-27 to 2026-08-02",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.data.markdown, /# Weekly Report/);
    assert.match(body.data.markdown, /# Period: 2026-07-27 to 2026-08-02/);
  });
});

/**
 * Slice 2 additions to the preview envelope. The point of surfacing the
 * destination is that a user can see WHERE tasks are about to be created before
 * confirming; null means the .env fallback, which is what every request that
 * names no destination still gets.
 */
describe("destination selection", () => {
  test("preview reports a null destination when falling back to .env", async () => {
    const res = await postJson("/preview-tasks", { notes: LEGACY_NOTES });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.destination, null);
    assert.deepEqual(body.data.statusMapping, []);
  });

  test("preview reports the resolved destination when one is selected", async () => {
    const destination = {
      id: "dest-1",
      userId: "user-1",
      name: "Ask Nithyananda → Dev",
      teamId: "t1",
      teamName: "USK",
      listId: "l1",
      listName: "Dev Sprint",
      isDefault: true,
    } as Destination;

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createTasksRouter({ resolver: stubResolver(destination), defaultProjectPath: "/p" })
    );
    const server = app.listen(0);
    try {
      const url = `http://localhost:${(server.address() as AddressInfo).port}/api/preview-tasks`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ notes: LEGACY_NOTES, destinationId: "dest-1" }),
      });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.deepEqual(body.data.destination, {
        id: "dest-1",
        name: "Ask Nithyananda → Dev",
        listName: "Dev Sprint",
        teamName: "USK",
      });
    } finally {
      server.close();
    }
  });

  // A bad destination id is the caller's mistake, like a bad template id — not
  // a 500.
  test("400 when the named destination does not exist", async () => {
    const res = await postJson("/preview-tasks", {
      notes: LEGACY_NOTES,
      destinationId: "no-such-destination",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Unknown destination");
    assert.match(body.details, /no-such-destination/);
  });

  test("the destination reaches createTasksFromWork on the legacy branch", async () => {
    const destination = {
      id: "dest-1",
      userId: "user-1",
      name: "Mine",
      teamId: "t1",
      listId: "l1",
      isDefault: true,
    } as Destination;

    let receivedConfig: any = "NOT_CALLED";
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createTasksRouter({
        resolver: stubResolver(destination),
        defaultProjectPath: "/p",
        analyzerFactory: () => ({
          createTasksFromWork: async (_wa: any, cfg: any) => {
            receivedConfig = cfg;
            return [];
          },
        }),
      })
    );
    const server = app.listen(0);
    try {
      const url = `http://localhost:${(server.address() as AddressInfo).port}/api/create-tasks`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          workAnalysis: { date: "d", detectedWork: [] },
          destinationId: "dest-1",
        }),
      });
      // The resolved config, not the raw .env one — this is what makes the
      // legacy branch write to the chosen list instead of CLICKUP_DEFAULT_LIST_ID.
      assert.notEqual(receivedConfig, "NOT_CALLED");
      assert.equal(receivedConfig.teamId, "team");
    } finally {
      server.close();
    }
  });
});
