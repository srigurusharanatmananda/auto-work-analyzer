/**
 * Pins the PUT/DELETE status-code mapping added in Task 7 fix round 2:
 *   400 invalid body, 404 no-such-id, 404 not-yours (byte-identical to the
 *   line above), 409 built-in-immutable, 500 anything unexpected.
 *
 * Runs under `tsx --test` (Node), not `bun test`, because reaching these
 * codes requires `authenticate` to actually succeed — and `authenticate`
 * unconditionally constructs a real `AuthService` (-> AuthDatabaseService ->
 * better-sqlite3), which cannot open a database under this repo's Bun
 * version (see task-7-report.md). A real, unblacklisted JWT is minted via
 * JWTService directly (no login flow / user row needed — verifyAccessToken
 * only checks the signature and the token_blacklist table) so `authenticate`
 * passes for real, exactly as it does in production.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { createTemplatesRouter } from "./templates.routes.js";
import { TemplateStoreError, type TemplateInput, type TemplateStore } from "../services/TemplateStore.js";
import { JWTService } from "../services/JWTService.js";
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
let authHeader: string;

before(() => {
  const app = express();
  app.use(express.json());
  app.use("/api/templates", createTemplatesRouter(stubStore));

  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}/api/templates`;

  // Minted directly, not via a login flow — verifyAccessToken only checks
  // the JWT signature and an (empty) blacklist table, so this is a real,
  // valid token `authenticate` will accept exactly as in production.
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

  test("is not shadowed by a param route — /schema is a literal, not an :id", async () => {
    // The stub store's `get` returns null for everything, so if a future
    // `GET /:id` were ever mounted ahead of /schema this would come back 404
    // rather than the schema payload.
    const res = await fetch(`${baseUrl}/schema`, { headers: { Authorization: authHeader } });
    const body = await res.json();
    assert.ok(body.data?.scalars, "GET /schema must resolve to the schema route");
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
