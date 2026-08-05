/**
 * Covers POST /api/destinations/resolve-url only — the URL shortcut past the
 * four-level picker.
 *
 * Runs under `tsx --test`: `authenticate` builds a real AuthService, which opens
 * better-sqlite3. Own temp cwd, because DatabaseService writes to
 * process.cwd()/.database.
 *
 * `globalThis.fetch` is stubbed, so ClickUpService is exercised for real without
 * reaching the network — which is what lets these assert on the messages a user
 * would actually see.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createDestinationsRouter } from "./destinations.routes.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { CredentialCipher, generateKeyBase64 } from "../destinations/CredentialCipher.js";
import { createTestUser } from "../testing/authFixture.js";

const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-resolveurl-"));
process.chdir(tmpDbDir);

const SECRET_KEY = "pk_secret_value_do_not_leak";

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;
let authHeader: string;
let destinations: DestinationStore;
let templates: TemplateStore;
let originalFetch: typeof globalThis.fetch;

/**
 * Stands in for ClickUp. Every response is shaped like the real API's.
 *
 * Requests to localhost are passed through to the real fetch: these tests drive
 * their own express server over HTTP, so swallowing those would break the test
 * harness rather than the code under test.
 */
function stubClickUp(): void {
  globalThis.fetch = (async (input: unknown, init?: unknown) => {
    const url = String(input);
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      return originalFetch(input as string, init as RequestInit);
    }
    const json = (body: unknown, status = 200) => ({
      ok: status < 400,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => body,
      text: async () => JSON.stringify(body),
    });

    if (url.endsWith("/team")) {
      return json({ teams: [{ id: "9012168250", name: "KAILASA Male" }] });
    }
    if (url.includes("/view/6-901214252467-1")) {
      return json({ view: { id: "6-901214252467-1", parent: { id: "901214252467", type: 6 } } });
    }
    if (url.includes("/view/4-90121000001-1")) {
      return json({ view: { parent: { id: "90121000001", type: 4 } } });
    }
    if (url.includes("/list/901214252467")) {
      return json({
        id: "901214252467",
        name: "KAILASA Store 2.0",
        space: { id: "90121000001", name: "Ministry of Digital Services" },
        folder: { id: "90121000002", name: "Projects" },
        statuses: [{ status: "setup" }, { status: "completed" }],
      });
    }
    return json({ err: "Not found", ECODE: "SHARD_006" }, 404);
  }) as unknown as typeof globalThis.fetch;
}

before(() => {
  const dbPath = join(tmpDbDir, "test.db");
  destinations = new DestinationStore(dbPath, new CredentialCipher(generateKeyBase64()));
  templates = new TemplateStore(dbPath);

  const app = express();
  app.use(express.json());
  app.use("/api/destinations", createDestinationsRouter(destinations, templates));

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/destinations`;

  // A real user row, not just a signature: `authenticate` re-reads the user on
  // every request, so a token for an id that exists in no users table is
  // correctly rejected.
  authHeader = createTestUser().authHeader;

  originalFetch = globalThis.fetch;
  stubClickUp();
});

after(() => {
  globalThis.fetch = originalFetch;
  server.close();
  destinations.close();
  templates.close();
  process.chdir(originalCwd);
  rmSync(tmpDbDir, { recursive: true, force: true });
});

const post = (body: unknown, auth = true) =>
  fetch(`${baseUrl}/resolve-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });

describe("POST /api/destinations/resolve-url", () => {
  test("requires authentication", async () => {
    const res = await post({ url: "x", apiKey: "y" }, false);
    assert.equal(res.status, 401);
  });

  test("resolves a list-view URL into the whole hierarchy", async () => {
    const res = await post({
      url: "https://app.clickup.com/9012168250/v/l/6-901214252467-1",
      apiKey: SECRET_KEY,
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();

    assert.equal(data.listId, "901214252467");
    assert.equal(data.listName, "KAILASA Store 2.0");
    assert.equal(data.spaceName, "Ministry of Digital Services");
    assert.equal(data.folderName, "Projects");
    assert.equal(data.teamName, "KAILASA Male");
    assert.equal(data.via, "view");
  });

  test("never echoes the API key back, on success or failure", async () => {
    // The key travels in the body of this request; it must not come back out.
    const ok = await post({
      url: "https://app.clickup.com/9012168250/v/l/6-901214252467-1",
      apiKey: SECRET_KEY,
    });
    assert.ok(!JSON.stringify(await ok.json()).includes(SECRET_KEY));

    const bad = await post({ url: "https://app.clickup.com/9012168250", apiKey: SECRET_KEY });
    assert.ok(!JSON.stringify(await bad.json()).includes(SECRET_KEY));
  });

  test("400 with a named reason when the URL is a workspace, not a list", async () => {
    const res = await post({ url: "https://app.clickup.com/9012168250", apiKey: SECRET_KEY });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /workspace, not a list/i);
  });

  test("400 when the view's parent is a space rather than a list", async () => {
    // Slicing the middle segment out of the URL would have produced a plausible
    // wrong list id here instead of an explanation.
    const res = await post({
      url: "https://app.clickup.com/9012168250/v/l/4-90121000001-1",
      apiKey: SECRET_KEY,
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /space or folder rather than a list/i);
  });

  test("names the inaccessible workspace instead of relaying a bare 404", async () => {
    const res = await post({
      url: "https://app.clickup.com/9099999999/v/li/901416083685",
      apiKey: SECRET_KEY,
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /cannot see/i);
    assert.match(body.error, /9099999999/);
    // And it says what the key CAN see, so the user knows which account to use.
    assert.match(body.error, /KAILASA Male/);
  });

  test("400 when the key is missing, saying why a URL is not enough", async () => {
    const res = await post({ url: "https://app.clickup.com/9012168250/v/li/901214252467" });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /API key is required/i);
  });

  test("400 when the URL is missing", async () => {
    const res = await post({ apiKey: SECRET_KEY });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /URL is required/i);
  });

  test("persists nothing — resolving is not saving", async () => {
    await post({
      url: "https://app.clickup.com/9012168250/v/l/6-901214252467-1",
      apiKey: SECRET_KEY,
    });
    assert.deepEqual(destinations.list("user-1"), []);
  });
});
