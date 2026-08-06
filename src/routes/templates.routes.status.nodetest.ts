/**
 * Pins the PUT/DELETE status-code mapping added in Task 7 fix round 2:
 *   400 invalid body, 404 no-such-id, 404 not-yours (byte-identical to the
 *   line above), 409 built-in-immutable, 500 anything unexpected.
 *
 * Runs under `tsx --test` (Node), not `bun test`, because reaching these
 * codes requires `authenticate` to actually succeed — and `authenticate`
 * uses a real `AuthService` (-> AuthDatabaseService -> better-sqlite3), which
 * cannot open a database under this repo's Bun version (see task-7-report.md).
 * `createTestUser` supplies both a real user row and an unblacklisted JWT, so
 * `authenticate` passes for real, exactly as it does in production.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createTemplatesRouter } from "./templates.routes.js";
import { TemplateStoreError, type TemplateInput, type TemplateStore } from "../services/TemplateStore.js";
import { createTestUser } from "../testing/authFixture.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import { DEFAULT_TEMPLATE_OPTIONS, type Template } from "../formatting/Template.js";

const VALID_BODY = {
  name: "Mine",
  nameTemplate: "{{title}}",
  descriptionTemplate: "{{description}}",
  options: { ...DEFAULT_TEMPLATE_OPTIONS },
};

function fakeTemplate(id: string): Template {
  return {
    id,
    userId: "user-1",
    name: "Mine",
    nameTemplate: "{{title}}",
    descriptionTemplate: "{{description}}",
    options: { ...DEFAULT_TEMPLATE_OPTIONS },
    isBuiltin: false,
  };
}

// A stub store whose update/remove behavior is selected by the id under
// test, so every branch of the route's error-mapping is reachable
// deterministically without a real database.
const stubStore = {
  list: (): Template[] => [],
  get: (): Template | null => null,
  create: (_userId: string, _input: TemplateInput): Template => fakeTemplate("created"),
  update: (id: string): Template => {
    if (id === "missing") throw new TemplateStoreError("Template not found", "not_found");
    if (id === "others-template") {
      throw new TemplateStoreError("Template not found", "not_found");
    }
    if (id === "builtin-standard") {
      throw new TemplateStoreError(
        "Cannot modify a built-in template. Duplicate it first.",
        "builtin_immutable"
      );
    }
    if (id === "boom") throw new Error("disk on fire");
    return fakeTemplate(id);
  },
  remove: (id: string): void => {
    if (id === "missing") throw new TemplateStoreError("Template not found", "not_found");
    if (id === "others-template") {
      throw new TemplateStoreError("Template not found", "not_found");
    }
    if (id === "builtin-standard") {
      throw new TemplateStoreError("Cannot delete a built-in template", "builtin_immutable");
    }
    if (id === "boom") throw new Error("disk on fire");
  },
  close: (): void => {},
} as unknown as TemplateStore;

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let pg: TestDatabase;
let authHeader: string;

/**
 * Each of these files opens `process.cwd()/.database` via `authenticate` ->
 * AuthService -> better-sqlite3, and `node --test` runs test FILES in parallel.
 * Sharing one SQLite file made whole files die intermittently with node:test's
 * "Unable to deserialize cloned data due to invalid or unsupported version"
 * (a crashed child, never a failed assertion) — ~1 run in 3 on a fresh checkout,
 * where the schema still has to be created concurrently. Own temp cwd per file,
 * the same fix GitWorkAnalyzer.createTasks.nodetest.ts already used.
 */
const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-nodetest-"));
process.chdir(tmpDbDir);

before(async () => {
  pg = await createTestDatabase();
  const app = express();
  app.use(express.json());
  app.use("/api/templates", createTemplatesRouter(stubStore));

  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}/api/templates`;

  // A real user row, not just a signature: `authenticate` re-reads the user on
  // every request, so a token for an id that exists in no users table is
  // correctly rejected.
  authHeader = (await createTestUser()).authHeader;
});

after(async () => {
  await pg?.drop();
  process.chdir(originalCwd);
  rmSync(tmpDbDir, { recursive: true, force: true });
  server.close();
});

async function put(id: string, body: unknown) {
  return fetch(`${baseUrl}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
}

async function del(id: string) {
  return fetch(`${baseUrl}/${id}`, {
    method: "DELETE",
    headers: { Authorization: authHeader },
  });
}

describe("PUT /api/templates/:id status codes", () => {
  test("400 on an invalid body (nameTemplate fails validateTemplate)", async () => {
    const res = await put("anything", { ...VALID_BODY, nameTemplate: "{{nope}}" });
    assert.equal(res.status, 400);
  });

  test("404 when the id doesn't exist", async () => {
    const res = await put("missing", VALID_BODY);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Template not found");
  });

  test("404 — byte-identical body — when the id belongs to another user", async () => {
    const res = await put("others-template", VALID_BODY);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.deepEqual(body, { success: false, error: "Template not found" });
  });

  test("409 when the id is a built-in", async () => {
    const res = await put("builtin-standard", VALID_BODY);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.match(body.error, /built-in/i);
  });

  test("500 on an unexpected (non-TemplateStoreError) failure", async () => {
    const res = await put("boom", VALID_BODY);
    assert.equal(res.status, 500);
  });
});

describe("DELETE /api/templates/:id status codes", () => {
  test("404 when the id doesn't exist", async () => {
    const res = await del("missing");
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Template not found");
  });

  test("404 — byte-identical body — when the id belongs to another user", async () => {
    const res = await del("others-template");
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.deepEqual(body, { success: false, error: "Template not found" });
  });

  test("409 when the id is a built-in", async () => {
    const res = await del("builtin-standard");
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.match(body.error, /built-in/i);
  });

  test("500 on an unexpected (non-TemplateStoreError) failure", async () => {
    const res = await del("boom");
    assert.equal(res.status, 500);
  });
});

describe("GET /api/templates/schema", () => {
  test("serves the placeholder vocabulary the editor's reference panel renders", async () => {
    const res = await fetch(`${baseUrl}/schema`, { headers: { Authorization: authHeader } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    // The two shapes the reference panel reads: a flat scalar list and the
    // section names. Asserting representative members rather than the whole
    // list, so adding a placeholder does not fail this test.
    assert.ok(Array.isArray(body.data.scalars));
    assert.ok(body.data.scalars.includes("title"));
    assert.ok(body.data.scalars.includes("repository"));
    assert.deepEqual(Object.keys(body.data.sections).sort(), [
      "commits",
      "files",
      "subitems",
      "tags",
    ]);
    // A nested section carries its own scalars — the panel lists these too.
    assert.ok(body.data.sections.commits.scalars.includes("shortHash"));
  });

});

describe("POST /api/templates/preview", () => {
  test("renders without requiring `name`", async () => {
    const res = await fetch(`${baseUrl}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        nameTemplate: "{{title}}",
        descriptionTemplate: "{{description}}",
        options: { ...DEFAULT_TEMPLATE_OPTIONS },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);
    assert.ok(body.data.markdown.length > 0);
  });
});
