# Slice 2 — Selectable ClickUp Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create tasks into any ClickUp account / workspace / space / folder / list combination, chosen per run, with encrypted credentials and correct per-list status mapping.

**Architecture:** Named destinations persist an encrypted API key plus the full ClickUp hierarchy path. A resolver turns a destination id into a configured `ClickUpService` and its default template. A status mapper reconciles our normalized statuses against the target list's real statuses at preview time, so a status that does not exist is visibly dropped rather than silently rejected by the API.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Express 4, better-sqlite3, Node `crypto` (AES-256-GCM), `fastest-levenshtein`, `bun test`, Next.js 14 App Router.

## Global Constraints

- **Prerequisite:** Slice 1 is merged. This plan consumes `Template`, `TemplateStore`, `RenderedTask`, `renderTasks`, `buildPreview`, and `createTasksRouter` from it.
- **Spec:** `docs/superpowers/specs/2026-08-02-clickup-formatting-destinations-design.md`.
- **Module system:** ESM. Every relative import ends in `.js`.
- **Test files:** co-locate as `src/**/*.test.ts`. Runner is `bun test`.
- **No new runtime dependencies.** `crypto` is built in; `fastest-levenshtein` and `better-sqlite3` are already present.
- **No network in tests.** Stub `globalThis.fetch` and restore it in `afterEach`.
- **`strictNullChecks` is `false`.** Do not enable it.
- **Never log an API key**, plaintext or ciphertext, at any log level.
- **Backward compatibility:** every endpoint must keep working when `destinationId` is omitted, falling back to the user's default destination and then to the `.env` configuration.
- **Commit trailer:** every commit message ends with
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
  shown as `<trailer>` below.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/destinations/CredentialCipher.ts` | AES-256-GCM encrypt/decrypt of API keys |
| `src/destinations/DestinationStore.ts` | `clickup_destinations` table access, single-default invariant |
| `src/destinations/DestinationResolver.ts` | destination id → `{ ClickUpService, listId, template }` |
| `src/formatting/StatusMapper.ts` | normalized status → the target list's real status |
| `src/migrations/runMigrations.ts` | `schema_migrations` bookkeeping |
| `src/migrations/002-destinations.ts` | move `.env` / `user_settings` credentials into destinations |
| `src/routes/destinations.routes.ts` | destination CRUD + `/test` |
| `src/routes/clickup.routes.ts` | hierarchy browsing endpoints |
| `ui/app/settings/destinations/page.tsx` | destination list, hierarchy picker, editor |
| `ui/components/TaskPreviewModal.tsx` | gains a destination picker + status mapping display (modify) |

---

### Task 1: Credential encryption

**Files:**
- Create: `src/destinations/CredentialCipher.ts`
- Create: `src/destinations/CredentialCipher.test.ts`
- Modify: `env.example`, `README.md`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `class CredentialCipher { constructor(base64Key: string); encrypt(plaintext: string): string; decrypt(payload: string): string }`
  - `function loadCipherFromEnv(): CredentialCipher` — throws a setup-instruction error when `CREDENTIAL_ENCRYPTION_KEY` is absent or malformed.
  - `function generateKeyBase64(): string` — helper for the setup instructions.

- [ ] **Step 1: Write the failing test**

Create `src/destinations/CredentialCipher.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import {
  CredentialCipher,
  generateKeyBase64,
  loadCipherFromEnv,
} from "./CredentialCipher.js";

const KEY = generateKeyBase64();
const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  else process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
});

describe("CredentialCipher", () => {
  test("round-trips a value", () => {
    const cipher = new CredentialCipher(KEY);
    const secret = "pk_12345678_ABCDEFGHIJKLMNOP";
    expect(cipher.decrypt(cipher.encrypt(secret))).toBe(secret);
  });

  test("ciphertext differs between encryptions of the same value", () => {
    const cipher = new CredentialCipher(KEY);
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  test("ciphertext does not contain the plaintext", () => {
    const cipher = new CredentialCipher(KEY);
    expect(cipher.encrypt("pk_secret_value")).not.toContain("pk_secret_value");
  });

  test("a different key cannot decrypt", () => {
    const payload = new CredentialCipher(KEY).encrypt("secret");
    expect(() => new CredentialCipher(generateKeyBase64()).decrypt(payload)).toThrow();
  });

  test("tampered ciphertext fails the auth tag check", () => {
    const cipher = new CredentialCipher(KEY);
    const payload = cipher.encrypt("secret");
    const parts = payload.split(":");
    const tampered = [parts[0], parts[1], "00" + parts[2]!.slice(2)].join(":");
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  test("a malformed payload throws a clear error", () => {
    expect(() => new CredentialCipher(KEY).decrypt("not-a-payload")).toThrow(/malformed/i);
  });

  test("rejects a key of the wrong length", () => {
    expect(() => new CredentialCipher(Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("loadCipherFromEnv", () => {
  test("throws with setup instructions when the key is missing", () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    expect(() => loadCipherFromEnv()).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  });

  test("returns a working cipher when the key is present", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = KEY;
    const cipher = loadCipherFromEnv();
    expect(cipher.decrypt(cipher.encrypt("x"))).toBe("x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/destinations/CredentialCipher.test.ts`
Expected: FAIL — `Cannot find module './CredentialCipher.js'`

- [ ] **Step 3: Write the implementation**

Create `src/destinations/CredentialCipher.ts`:

```ts
/**
 * AES-256-GCM encryption for stored ClickUp API keys.
 *
 * Payload format: base64(iv):base64(authTag):base64(ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class CredentialCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}).`
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString("base64"),
      authTag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const parts = payload.split(":");
    if (parts.length !== 3) {
      throw new Error("Stored credential is malformed and cannot be decrypted.");
    }
    const [ivPart, tagPart, dataPart] = parts as [string, string, string];
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}

export function generateKeyBase64(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/**
 * Fails loudly when unconfigured. The silent alternative — storing keys in the
 * clear — is worse than refusing to start.
 */
export function loadCipherFromEnv(): CredentialCipher {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not set. ClickUp API keys are stored encrypted, " +
        "so this is required.\n\nGenerate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n\n" +
        "Then add it to your .env as CREDENTIAL_ENCRYPTION_KEY=<value>."
    );
  }
  return new CredentialCipher(key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/destinations/CredentialCipher.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Document the new variable**

Add to `env.example`:

```bash
# Required — encrypts stored ClickUp API keys. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CREDENTIAL_ENCRYPTION_KEY=
```

Add the same generation command and an explanation to the configuration section of `README.md`.

- [ ] **Step 6: Commit**

```bash
git add src/destinations/CredentialCipher.ts src/destinations/CredentialCipher.test.ts env.example README.md
git commit -m "feat(destinations): AES-256-GCM cipher for stored ClickUp credentials

<trailer>"
```

---

### Task 2: ClickUp hierarchy methods

**Files:**
- Modify: `src/services/ClickUpService.ts`
- Create: `src/services/ClickUpService.hierarchy.test.ts`

**Interfaces:**
- Consumes: existing `ClickUpService` and `ClickUpConfig`.
- Produces, on `ClickUpService`:
  - `getFolders(spaceId: string): Promise<Array<{ id: string; name: string }>>`
  - `getListsInFolder(folderId: string): Promise<Array<{ id: string; name: string }>>`
  - `getFolderlessLists(spaceId: string): Promise<Array<{ id: string; name: string }>>`
  - `getListStatuses(listId: string): Promise<string[]>`

`getFolderlessLists` is not optional. ClickUp permits lists directly under a space with no folder, and a picker that walks only folders silently hides them.

- [ ] **Step 1: Write the failing test**

Create `src/services/ClickUpService.hierarchy.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { ClickUpService } from "./ClickUpService.js";
import { ClickUpConfig } from "../types/index.js";

const config: ClickUpConfig = {
  teamId: "team-1",
  apiKey: "pk_test",
  projectName: "test",
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (url: string) => { status?: number; body: unknown }): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    calls.push(url);
    const { status = 200, body } = handler(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as any;
  }) as any;
  return calls;
}

describe("ClickUpService hierarchy", () => {
  test("getFolders returns id and name pairs", async () => {
    stubFetch(() => ({ body: { folders: [{ id: "f1", name: "Sprints" }] } }));
    const folders = await new ClickUpService(config).getFolders("space-1");
    expect(folders).toEqual([{ id: "f1", name: "Sprints" }]);
  });

  test("getFolders hits the space folder endpoint", async () => {
    const calls = stubFetch(() => ({ body: { folders: [] } }));
    await new ClickUpService(config).getFolders("space-1");
    expect(calls[0]).toContain("/space/space-1/folder");
  });

  test("getListsInFolder hits the folder list endpoint", async () => {
    const calls = stubFetch(() => ({ body: { lists: [{ id: "l1", name: "Dev" }] } }));
    const lists = await new ClickUpService(config).getListsInFolder("f1");
    expect(calls[0]).toContain("/folder/f1/list");
    expect(lists).toEqual([{ id: "l1", name: "Dev" }]);
  });

  test("getFolderlessLists hits the space list endpoint", async () => {
    const calls = stubFetch(() => ({ body: { lists: [{ id: "l9", name: "Inbox" }] } }));
    const lists = await new ClickUpService(config).getFolderlessLists("space-1");
    expect(calls[0]).toContain("/space/space-1/list");
    expect(lists).toEqual([{ id: "l9", name: "Inbox" }]);
  });

  test("getListStatuses returns status names in order", async () => {
    stubFetch(() => ({
      body: {
        id: "l1",
        statuses: [
          { status: "to do", orderindex: 0 },
          { status: "in progress", orderindex: 1 },
          { status: "done", orderindex: 2 },
        ],
      },
    }));
    expect(await new ClickUpService(config).getListStatuses("l1")).toEqual([
      "to do",
      "in progress",
      "done",
    ]);
  });

  test("getListStatuses returns an empty array when the list has none", async () => {
    stubFetch(() => ({ body: { id: "l1" } }));
    expect(await new ClickUpService(config).getListStatuses("l1")).toEqual([]);
  });

  test("a non-OK response throws with the status code", async () => {
    stubFetch(() => ({ status: 401, body: { err: "Token invalid" } }));
    await expect(new ClickUpService(config).getFolders("space-1")).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/services/ClickUpService.hierarchy.test.ts`
Expected: FAIL — `getFolders is not a function`

- [ ] **Step 3: Add the methods**

In `src/services/ClickUpService.ts`, add these next to the existing `getLists`, reusing the same header and error-handling shape as `getSpaces`:

```ts
  /**
   * Folders within a space.
   */
  async getFolders(spaceId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/space/${spaceId}/folder`, "folders");
    return (result as any[]).map((folder) => ({ id: folder.id, name: folder.name }));
  }

  /**
   * Lists inside a folder.
   */
  async getListsInFolder(folderId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/folder/${folderId}/list`, "lists");
    return (result as any[]).map((list) => ({ id: list.id, name: list.name }));
  }

  /**
   * Lists that sit directly under a space with no folder. ClickUp allows these
   * and a folder-only picker would hide them.
   */
  async getFolderlessLists(spaceId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/space/${spaceId}/list`, "lists");
    return (result as any[]).map((list) => ({ id: list.id, name: list.name }));
  }

  /**
   * The status names configured on a list, in board order.
   */
  async getListStatuses(listId: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/list/${listId}`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch list: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const list = await response.json();
    const statuses = (list.statuses || []) as Array<{ status: string; orderindex?: number }>;
    return statuses
      .slice()
      .sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0))
      .map((entry) => entry.status);
  }

  /** Shared GET helper for collection endpoints. */
  private async getJson(path: string, collectionKey: string): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch ${collectionKey}: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return result[collectionKey] || [];
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/ClickUpService.hierarchy.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/ClickUpService.ts src/services/ClickUpService.hierarchy.test.ts
git commit -m "feat(clickup): add folder, folderless-list, and list-status lookups

<trailer>"
```

---

### Task 3: Status mapper

**Files:**
- Create: `src/formatting/StatusMapper.ts`
- Create: `src/formatting/StatusMapper.test.ts`

**Interfaces:**
- Consumes: `distance` from `fastest-levenshtein`.
- Produces:
  - `interface StatusMapping { from: string; to: string | null; method: "exact" | "synonym" | "fuzzy" | "unmatched" }`
  - `function mapStatus(desired: string | undefined, available: string[]): StatusMapping | null` — returns `null` when `desired` is empty.
  - `function mapStatuses(desired: Array<string | undefined>, available: string[]): StatusMapping[]`

`"complete"` is not a valid status in every list — commit `af716cd` removed a hardcoded status for exactly this reason. Unmatched statuses are dropped so ClickUp applies the list default, and the drop is reported rather than hidden.

- [ ] **Step 1: Write the failing test**

Create `src/formatting/StatusMapper.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mapStatus, mapStatuses } from "./StatusMapper.js";

const LIST = ["to do", "in progress", "in review", "Complete"];

describe("mapStatus", () => {
  test("returns null when no status is desired", () => {
    expect(mapStatus(undefined, LIST)).toBeNull();
    expect(mapStatus("", LIST)).toBeNull();
  });

  test("matches exactly, case-insensitively", () => {
    expect(mapStatus("complete", LIST)).toEqual({
      from: "complete", to: "Complete", method: "exact",
    });
  });

  test("matches through the synonym map", () => {
    expect(mapStatus("done", LIST)).toEqual({ from: "done", to: "Complete", method: "synonym" });
    expect(mapStatus("wip", LIST)).toEqual({ from: "wip", to: "in progress", method: "synonym" });
  });

  test("fuzzy-matches a near miss", () => {
    expect(mapStatus("in-progress", LIST)).toEqual({
      from: "in-progress", to: "in progress", method: "fuzzy",
    });
  });

  test("drops a status with no plausible match", () => {
    expect(mapStatus("archived-forever", LIST)).toEqual({
      from: "archived-forever", to: null, method: "unmatched",
    });
  });

  test("drops everything when the list reports no statuses", () => {
    expect(mapStatus("complete", [])).toEqual({
      from: "complete", to: null, method: "unmatched",
    });
  });

  test("does not fuzzy-match across genuinely different statuses", () => {
    expect(mapStatus("to do", ["Complete"])!.to).toBeNull();
  });
});

describe("mapStatuses", () => {
  test("maps a batch and skips undefined entries", () => {
    const mappings = mapStatuses(["complete", undefined, "nonsense"], LIST);
    expect(mappings.length).toBe(2);
    expect(mappings[0]!.to).toBe("Complete");
    expect(mappings[1]!.to).toBeNull();
  });

  test("deduplicates repeated statuses", () => {
    expect(mapStatuses(["complete", "complete"], LIST).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/formatting/StatusMapper.test.ts`
Expected: FAIL — `Cannot find module './StatusMapper.js'`

- [ ] **Step 3: Write the implementation**

Create `src/formatting/StatusMapper.ts`:

```ts
/**
 * Reconciles our normalized statuses against a ClickUp list's real statuses.
 *
 * When nothing matches we omit the status so ClickUp applies the list default,
 * and report the omission so it is visible in the preview instead of being
 * discovered after the fact.
 */

import { distance } from "fastest-levenshtein";

export interface StatusMapping {
  from: string;
  to: string | null;
  method: "exact" | "synonym" | "fuzzy" | "unmatched";
}

/** Mirrors NotesProcessor.normalizeStatus, extended with target-side variants. */
const SYNONYMS: Record<string, string[]> = {
  complete: ["complete", "completed", "done", "finished", "closed", "x"],
  "in progress": ["in progress", "in-progress", "wip", "working", "doing", "started", "active"],
  "to do": ["to do", "todo", "to-do", "pending", "backlog", "open", "new"],
  blocked: ["blocked", "on hold", "paused", "waiting"],
  "in review": ["in review", "review", "reviewing", "qa"],
};

/** Above this normalized edit distance we refuse to guess. */
const FUZZY_MAX_RATIO = 0.34;

function canonicalGroup(value: string): string | null {
  const lower = value.toLowerCase().trim();
  for (const [group, variants] of Object.entries(SYNONYMS)) {
    if (variants.includes(lower)) return group;
  }
  return null;
}

export function mapStatus(
  desired: string | undefined,
  available: string[]
): StatusMapping | null {
  if (!desired || desired.trim().length === 0) return null;

  const from = desired.trim();
  const lower = from.toLowerCase();

  const exact = available.find((status) => status.toLowerCase() === lower);
  if (exact) return { from, to: exact, method: "exact" };

  const desiredGroup = canonicalGroup(from);
  if (desiredGroup) {
    const synonym = available.find((status) => canonicalGroup(status) === desiredGroup);
    if (synonym) return { from, to: synonym, method: "synonym" };
  }

  let best: { status: string; ratio: number } | null = null;
  for (const status of available) {
    const target = status.toLowerCase();
    const ratio = distance(lower, target) / Math.max(lower.length, target.length);
    if (best === null || ratio < best.ratio) best = { status, ratio };
  }

  if (best && best.ratio <= FUZZY_MAX_RATIO) {
    return { from, to: best.status, method: "fuzzy" };
  }

  return { from, to: null, method: "unmatched" };
}

export function mapStatuses(
  desired: Array<string | undefined>,
  available: string[]
): StatusMapping[] {
  const seen = new Set<string>();
  const mappings: StatusMapping[] = [];

  for (const value of desired) {
    const mapping = mapStatus(value, available);
    if (!mapping) continue;
    const key = mapping.from.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mappings.push(mapping);
  }

  return mappings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/formatting/StatusMapper.test.ts`
Expected: PASS, 9 tests.

If the `"in-progress"` fuzzy case fails, check `FUZZY_MAX_RATIO`: the distance is 1 over a length of 11, a ratio of ~0.09, which must fall under the threshold. If `"to do"` vs `"Complete"` wrongly matches, the threshold is too loose.

- [ ] **Step 5: Commit**

```bash
git add src/formatting/StatusMapper.ts src/formatting/StatusMapper.test.ts
git commit -m "feat(formatting): map normalized statuses onto a list's real statuses

<trailer>"
```

---

### Task 4: Destination persistence

**Files:**
- Create: `src/destinations/DestinationStore.ts`
- Create: `src/destinations/DestinationStore.test.ts`

**Interfaces:**
- Consumes: `CredentialCipher` (Task 1).
- Produces:
  - `interface Destination { id, userId, name, teamId, teamName?, spaceId?, spaceName?, folderId?, folderName?, listId, listName?, defaultTemplateId?, defaultAssignee?, isDefault }` — note there is **no** `apiKey` field on this type.
  - `interface DestinationInput` — as above plus `apiKey: string`, minus `id`/`isDefault`.
  - `class DestinationStore` with `constructor(dbPath: string, cipher: CredentialCipher)`, `list(userId)`, `get(id, userId)`, `getApiKey(id, userId): string`, `getDefault(userId)`, `create(userId, input)`, `update(id, userId, input)`, `setDefault(id, userId)`, `remove(id, userId)`, `close()`.

Keeping the decrypted key off the `Destination` type is deliberate: destinations are serialised straight into API responses, and a key that is not on the object cannot leak through one.

- [ ] **Step 1: Write the failing test**

Create `src/destinations/DestinationStore.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CredentialCipher, generateKeyBase64 } from "./CredentialCipher.js";
import { DestinationStore } from "./DestinationStore.js";

let dir: string;
let store: DestinationStore;

const input = (overrides: Record<string, unknown> = {}) => ({
  name: "Ask Nithyananda → Dev",
  apiKey: "pk_test_key",
  teamId: "team-1",
  teamName: "USK",
  spaceId: "space-1",
  spaceName: "Engineering",
  listId: "list-1",
  listName: "Dev Sprint",
  ...overrides,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-dest-"));
  store = new DestinationStore(join(dir, "test.db"), new CredentialCipher(generateKeyBase64()));
});

afterEach(() => {
  store.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("DestinationStore", () => {
  test("creates and reads back a destination without exposing the key", () => {
    const created = store.create("user-1", input());
    expect(created.name).toBe("Ask Nithyananda → Dev");
    expect(created.listId).toBe("list-1");
    expect((created as Record<string, unknown>).apiKey).toBeUndefined();
    expect((created as Record<string, unknown>).apiKeyEncrypted).toBeUndefined();
  });

  test("getApiKey decrypts the stored key", () => {
    const created = store.create("user-1", input());
    expect(store.getApiKey(created.id, "user-1")).toBe("pk_test_key");
  });

  test("getApiKey refuses another user's destination", () => {
    const created = store.create("user-1", input());
    expect(() => store.getApiKey(created.id, "user-2")).toThrow(/not found/i);
  });

  test("the first destination becomes the default automatically", () => {
    const created = store.create("user-1", input());
    expect(created.isDefault).toBe(true);
    expect(store.getDefault("user-1")!.id).toBe(created.id);
  });

  test("setDefault moves the flag and leaves exactly one default", () => {
    const first = store.create("user-1", input({ name: "First" }));
    const second = store.create("user-1", input({ name: "Second" }));
    expect(second.isDefault).toBe(false);

    store.setDefault(second.id, "user-1");

    const all = store.list("user-1");
    expect(all.filter((d) => d.isDefault).length).toBe(1);
    expect(store.getDefault("user-1")!.id).toBe(second.id);
    expect(store.get(first.id, "user-1")!.isDefault).toBe(false);
  });

  test("list is scoped to the owning user", () => {
    store.create("user-1", input({ name: "Mine" }));
    store.create("user-2", input({ name: "Theirs" }));
    expect(store.list("user-1").map((d) => d.name)).toEqual(["Mine"]);
  });

  test("update changes fields and can rotate the key", () => {
    const created = store.create("user-1", input());
    const updated = store.update(created.id, "user-1", { name: "Renamed", apiKey: "pk_new" });
    expect(updated.name).toBe("Renamed");
    expect(updated.listId).toBe("list-1");
    expect(store.getApiKey(created.id, "user-1")).toBe("pk_new");
  });

  test("update without an apiKey leaves the stored key intact", () => {
    const created = store.create("user-1", input());
    store.update(created.id, "user-1", { name: "Renamed" });
    expect(store.getApiKey(created.id, "user-1")).toBe("pk_test_key");
  });

  test("removing the default promotes another destination", () => {
    const first = store.create("user-1", input({ name: "First" }));
    const second = store.create("user-1", input({ name: "Second" }));
    store.remove(first.id, "user-1");
    expect(store.getDefault("user-1")!.id).toBe(second.id);
  });

  test("removing the last destination leaves no default", () => {
    const only = store.create("user-1", input());
    store.remove(only.id, "user-1");
    expect(store.getDefault("user-1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/destinations/DestinationStore.test.ts`
Expected: FAIL — `Cannot find module './DestinationStore.js'`

- [ ] **Step 3: Write the implementation**

Create `src/destinations/DestinationStore.ts`:

```ts
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { CredentialCipher } from "./CredentialCipher.js";

export interface Destination {
  id: string;
  userId: string;
  name: string;
  teamId: string;
  teamName?: string;
  spaceId?: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  listId: string;
  listName?: string;
  defaultTemplateId?: string;
  defaultAssignee?: string;
  isDefault: boolean;
}

export interface DestinationInput {
  name: string;
  /** Plaintext; encrypted before storage. Omit on update to keep the existing key. */
  apiKey?: string;
  teamId: string;
  teamName?: string;
  spaceId?: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  listId: string;
  listName?: string;
  defaultTemplateId?: string;
  defaultAssignee?: string;
}

interface Row {
  id: string;
  user_id: string;
  name: string;
  api_key_encrypted: string;
  team_id: string;
  team_name: string | null;
  space_id: string | null;
  space_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  list_id: string;
  list_name: string | null;
  default_template_id: string | null;
  default_assignee: string | null;
  is_default: number;
}

/** Note: never includes the API key, encrypted or otherwise. */
function toDestination(row: Row): Destination {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    teamId: row.team_id,
    teamName: row.team_name ?? undefined,
    spaceId: row.space_id ?? undefined,
    spaceName: row.space_name ?? undefined,
    folderId: row.folder_id ?? undefined,
    folderName: row.folder_name ?? undefined,
    listId: row.list_id,
    listName: row.list_name ?? undefined,
    defaultTemplateId: row.default_template_id ?? undefined,
    defaultAssignee: row.default_assignee ?? undefined,
    isDefault: row.is_default === 1,
  };
}

export class DestinationStore {
  private db: Database.Database;

  constructor(dbPath: string, private cipher: CredentialCipher) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clickup_destinations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        team_id TEXT NOT NULL,
        team_name TEXT,
        space_id TEXT,
        space_name TEXT,
        folder_id TEXT,
        folder_name TEXT,
        list_id TEXT NOT NULL,
        list_name TEXT,
        default_template_id TEXT,
        default_assignee TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_destinations_user ON clickup_destinations(user_id);
    `);
  }

  private rowOf(id: string, userId: string): Row | undefined {
    return this.db
      .prepare(`SELECT * FROM clickup_destinations WHERE id = ? AND user_id = ?`)
      .get(id, userId) as Row | undefined;
  }

  list(userId: string): Destination[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM clickup_destinations WHERE user_id = ? ORDER BY is_default DESC, name ASC`
      )
      .all(userId) as Row[];
    return rows.map(toDestination);
  }

  get(id: string, userId: string): Destination | null {
    const row = this.rowOf(id, userId);
    return row ? toDestination(row) : null;
  }

  getDefault(userId: string): Destination | null {
    const row = this.db
      .prepare(`SELECT * FROM clickup_destinations WHERE user_id = ? AND is_default = 1`)
      .get(userId) as Row | undefined;
    return row ? toDestination(row) : null;
  }

  getApiKey(id: string, userId: string): string {
    const row = this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");
    return this.cipher.decrypt(row.api_key_encrypted);
  }

  create(userId: string, input: DestinationInput): Destination {
    if (!input.apiKey) throw new Error("apiKey is required when creating a destination");

    const id = randomUUID();
    const now = new Date().toISOString();
    const isFirst = this.list(userId).length === 0;

    this.db
      .prepare(
        `INSERT INTO clickup_destinations
           (id, user_id, name, api_key_encrypted, team_id, team_name, space_id, space_name,
            folder_id, folder_name, list_id, list_name, default_template_id, default_assignee,
            is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id, userId, input.name, this.cipher.encrypt(input.apiKey),
        input.teamId, input.teamName ?? null,
        input.spaceId ?? null, input.spaceName ?? null,
        input.folderId ?? null, input.folderName ?? null,
        input.listId, input.listName ?? null,
        input.defaultTemplateId ?? null, input.defaultAssignee ?? null,
        isFirst ? 1 : 0, now, now
      );

    return this.get(id, userId)!;
  }

  update(id: string, userId: string, input: Partial<DestinationInput>): Destination {
    const row = this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");

    this.db
      .prepare(
        `UPDATE clickup_destinations SET
           name = ?, api_key_encrypted = ?, team_id = ?, team_name = ?,
           space_id = ?, space_name = ?, folder_id = ?, folder_name = ?,
           list_id = ?, list_name = ?, default_template_id = ?, default_assignee = ?,
           updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        input.name ?? row.name,
        input.apiKey ? this.cipher.encrypt(input.apiKey) : row.api_key_encrypted,
        input.teamId ?? row.team_id,
        input.teamName ?? row.team_name,
        input.spaceId ?? row.space_id,
        input.spaceName ?? row.space_name,
        input.folderId ?? row.folder_id,
        input.folderName ?? row.folder_name,
        input.listId ?? row.list_id,
        input.listName ?? row.list_name,
        input.defaultTemplateId ?? row.default_template_id,
        input.defaultAssignee ?? row.default_assignee,
        new Date().toISOString(),
        id,
        userId
      );

    return this.get(id, userId)!;
  }

  /** Exactly one default per user, enforced inside a transaction. */
  setDefault(id: string, userId: string): void {
    if (!this.rowOf(id, userId)) throw new Error("Destination not found");

    const apply = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE clickup_destinations SET is_default = 0 WHERE user_id = ?`)
        .run(userId);
      this.db
        .prepare(`UPDATE clickup_destinations SET is_default = 1 WHERE id = ? AND user_id = ?`)
        .run(id, userId);
    });

    apply();
  }

  remove(id: string, userId: string): void {
    const row = this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");

    const apply = this.db.transaction(() => {
      this.db
        .prepare(`DELETE FROM clickup_destinations WHERE id = ? AND user_id = ?`)
        .run(id, userId);

      if (row.is_default === 1) {
        const next = this.db
          .prepare(
            `SELECT id FROM clickup_destinations WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`
          )
          .get(userId) as { id: string } | undefined;
        if (next) {
          this.db
            .prepare(`UPDATE clickup_destinations SET is_default = 1 WHERE id = ?`)
            .run(next.id);
        }
      }
    });

    apply();
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/destinations/DestinationStore.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/destinations/DestinationStore.ts src/destinations/DestinationStore.test.ts
git commit -m "feat(destinations): persist destinations with encrypted keys and a single default

<trailer>"
```

---

### Task 5: Credential migration

**Files:**
- Create: `src/migrations/runMigrations.ts`
- Create: `src/migrations/002-destinations.ts`
- Create: `src/migrations/002-destinations.test.ts`
- Modify: `src/webhook-server.ts` (run migrations at boot)

**Interfaces:**
- Consumes: `CredentialCipher` (Task 1), `DestinationStore` (Task 4).
- Produces: `function runMigrations(dbPath: string, cipher: CredentialCipher): void` and `const migration002: Migration`.

There is no numbered migration framework today — `AuthDatabaseService.initializeSchema` uses `CREATE TABLE IF NOT EXISTS` on boot, which is fine for schema but cannot express a one-time data move. This adds the minimum bookkeeping needed for that.

- [ ] **Step 1: Write the failing test**

Create `src/migrations/002-destinations.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CredentialCipher, generateKeyBase64 } from "../destinations/CredentialCipher.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { runMigrations } from "./runMigrations.js";

let dir: string;
let dbPath: string;
let cipher: CredentialCipher;

function seedUserSettings(apiKey: string | null): void {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      default_assignee TEXT,
      backend_url TEXT,
      clickup_api_key TEXT,
      clickup_team_id TEXT,
      clickup_list_id TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  db.prepare(
    `INSERT INTO user_settings (user_id, default_assignee, clickup_api_key, clickup_team_id, clickup_list_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("user-1", "dev@example.com", apiKey, "team-9", "list-9", new Date().toISOString());
  db.close();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-migrate-"));
  dbPath = join(dir, "test.db");
  cipher = new CredentialCipher(generateKeyBase64());
});

afterEach(() => {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("002-destinations", () => {
  test("moves an existing user_settings key into a default destination", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    const destinations = store.list("user-1");
    expect(destinations.length).toBe(1);
    expect(destinations[0]!.name).toBe("Default (migrated)");
    expect(destinations[0]!.teamId).toBe("team-9");
    expect(destinations[0]!.listId).toBe("list-9");
    expect(destinations[0]!.isDefault).toBe(true);
    expect(destinations[0]!.defaultAssignee).toBe("dev@example.com");
    expect(store.getApiKey(destinations[0]!.id, "user-1")).toBe("pk_legacy_key");
    store.close();
  });

  test("nulls out the plaintext key after migrating", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);

    const db = new Database(dbPath);
    const row = db
      .prepare(`SELECT clickup_api_key FROM user_settings WHERE user_id = ?`)
      .get("user-1") as { clickup_api_key: string | null };
    db.close();
    expect(row.clickup_api_key).toBeNull();
  });

  test("skips users with no stored key", () => {
    seedUserSettings(null);
    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    expect(store.list("user-1").length).toBe(0);
    store.close();
  });

  test("is idempotent — a second run creates nothing further", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);
    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    expect(store.list("user-1").length).toBe(1);
    store.close();
  });

  test("records the migration in schema_migrations", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);

    const db = new Database(dbPath);
    const rows = db.prepare(`SELECT id FROM schema_migrations`).all() as Array<{ id: string }>;
    db.close();
    expect(rows.map((r) => r.id)).toContain("002-destinations");
  });

  test("runs cleanly when user_settings does not exist at all", () => {
    expect(() => runMigrations(dbPath, cipher)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/migrations/002-destinations.test.ts`
Expected: FAIL — `Cannot find module './runMigrations.js'`

- [ ] **Step 3: Write `src/migrations/runMigrations.ts`**

```ts
import Database from "better-sqlite3";
import { CredentialCipher } from "../destinations/CredentialCipher.js";
import { migration002 } from "./002-destinations.js";

export interface Migration {
  id: string;
  run(db: Database.Database, cipher: CredentialCipher): void;
}

const MIGRATIONS: Migration[] = [migration002];

/**
 * Applies pending data migrations exactly once each. Schema creation still
 * happens via CREATE TABLE IF NOT EXISTS in the individual stores; this exists
 * for one-time data moves, which that pattern cannot express.
 */
export function runMigrations(dbPath: string, cipher: CredentialCipher): void {
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = new Set(
      (db.prepare(`SELECT id FROM schema_migrations`).all() as Array<{ id: string }>).map(
        (row) => row.id
      )
    );

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      migration.run(db, cipher);
      db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`).run(
        migration.id,
        new Date().toISOString()
      );
      console.log(`Applied migration ${migration.id}`);
    }
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Write `src/migrations/002-destinations.ts`**

```ts
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { CredentialCipher } from "../destinations/CredentialCipher.js";
import { Migration } from "./runMigrations.js";

interface SettingsRow {
  user_id: string;
  default_assignee: string | null;
  clickup_api_key: string | null;
  clickup_team_id: string | null;
  clickup_list_id: string | null;
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return row !== undefined;
}

/**
 * Moves plaintext ClickUp credentials out of user_settings and into an
 * encrypted default destination.
 *
 * user_settings.clickup_api_key is nulled but the column is retained for one
 * release so a rollback is possible; drop it afterwards.
 */
export const migration002: Migration = {
  id: "002-destinations",

  run(db: Database.Database, cipher: CredentialCipher): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS clickup_destinations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        team_id TEXT NOT NULL,
        team_name TEXT,
        space_id TEXT,
        space_name TEXT,
        folder_id TEXT,
        folder_name TEXT,
        list_id TEXT NOT NULL,
        list_name TEXT,
        default_template_id TEXT,
        default_assignee TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_destinations_user ON clickup_destinations(user_id);
    `);

    if (!tableExists(db, "user_settings")) return;

    const rows = db
      .prepare(
        `SELECT user_id, default_assignee, clickup_api_key, clickup_team_id, clickup_list_id
         FROM user_settings
         WHERE clickup_api_key IS NOT NULL AND clickup_api_key != ''`
      )
      .all() as SettingsRow[];

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO clickup_destinations
         (id, user_id, name, api_key_encrypted, team_id, team_name, space_id, space_name,
          folder_id, folder_name, list_id, list_name, default_template_id, default_assignee,
          is_default, created_at, updated_at)
       VALUES (?, ?, 'Default (migrated)', ?, ?, NULL, NULL, NULL, NULL, NULL, ?, NULL,
               'builtin-standard', ?, 1, ?, ?)`
    );
    const clear = db.prepare(
      `UPDATE user_settings SET clickup_api_key = NULL WHERE user_id = ?`
    );

    const apply = db.transaction(() => {
      for (const row of rows) {
        if (!row.clickup_team_id || !row.clickup_list_id) {
          console.warn(
            `Skipping credential migration for user ${row.user_id}: missing team or list id.`
          );
          continue;
        }
        insert.run(
          randomUUID(),
          row.user_id,
          cipher.encrypt(row.clickup_api_key!),
          row.clickup_team_id,
          row.clickup_list_id,
          row.default_assignee,
          now,
          now
        );
        clear.run(row.user_id);
      }
    });

    apply();
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/migrations/002-destinations.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run migrations at boot**

In `src/webhook-server.ts`, before constructing any store:

```ts
import { loadCipherFromEnv } from "./destinations/CredentialCipher.js";
import { runMigrations } from "./migrations/runMigrations.js";

const dbPath = process.env.DATABASE_PATH || ".database/auto-work-analyzer.db";
const cipher = loadCipherFromEnv(); // throws with setup instructions when unset
runMigrations(dbPath, cipher);
```

`loadCipherFromEnv` throwing here is the intended startup guard.

- [ ] **Step 7: Verify the guard**

Run: `CREDENTIAL_ENCRYPTION_KEY= bun run webhook`
Expected: the process exits with the message naming `CREDENTIAL_ENCRYPTION_KEY` and the generation command. Then set a real key in `.env` and confirm it boots.

- [ ] **Step 8: Commit**

```bash
git add src/migrations/ src/webhook-server.ts
git commit -m "feat(migrations): move plaintext ClickUp keys into encrypted destinations

<trailer>"
```

---

### Task 6: Destination resolution and API

**Files:**
- Create: `src/destinations/DestinationResolver.ts`
- Create: `src/destinations/DestinationResolver.test.ts`
- Create: `src/routes/destinations.routes.ts`
- Create: `src/routes/clickup.routes.ts`
- Modify: `src/webhook-server.ts` (mount both routers)

**Interfaces:**
- Consumes: `DestinationStore` (Task 4), `TemplateStore` (Slice 1 Task 7), `ClickUpService`.
- Produces:
  - `interface ResolvedDestination { destination: Destination | null; clickUp: ClickUpService; listId: string | undefined; template: Template }`
  - `class DestinationResolver { constructor(deps); resolve(userId: string, destinationId?: string, templateId?: string): ResolvedDestination }`

Resolution order: explicit `destinationId` → the user's default destination → the `.env` config. The last step is what keeps every pre-Slice-2 caller working.

- [ ] **Step 1: Write the failing test**

Create `src/destinations/DestinationResolver.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CredentialCipher, generateKeyBase64 } from "./CredentialCipher.js";
import { DestinationStore } from "./DestinationStore.js";
import { DestinationResolver } from "./DestinationResolver.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { ClickUpConfig } from "../types/index.js";

let dir: string;
let destinations: DestinationStore;
let templates: TemplateStore;
let resolver: DestinationResolver;

const envConfig: ClickUpConfig = {
  teamId: "env-team",
  apiKey: "pk_env",
  defaultListId: "env-list",
  projectName: "test",
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-resolve-"));
  const dbPath = join(dir, "test.db");
  destinations = new DestinationStore(dbPath, new CredentialCipher(generateKeyBase64()));
  templates = new TemplateStore(dbPath);
  resolver = new DestinationResolver({ destinations, templates, envConfig });
});

afterEach(() => {
  destinations.close();
  templates.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("DestinationResolver", () => {
  test("falls back to the env config when the user has no destinations", () => {
    const resolved = resolver.resolve("user-1");
    expect(resolved.destination).toBeNull();
    expect(resolved.listId).toBe("env-list");
    expect(resolved.template.id).toBe("builtin-standard");
  });

  test("uses the user's default destination when one exists", () => {
    const created = destinations.create("user-1", {
      name: "Mine", apiKey: "pk_1", teamId: "t1", listId: "l1",
    });
    const resolved = resolver.resolve("user-1");
    expect(resolved.destination!.id).toBe(created.id);
    expect(resolved.listId).toBe("l1");
  });

  test("an explicit destinationId wins over the default", () => {
    destinations.create("user-1", { name: "First", apiKey: "pk_1", teamId: "t1", listId: "l1" });
    const second = destinations.create("user-1", {
      name: "Second", apiKey: "pk_2", teamId: "t2", listId: "l2",
    });
    expect(resolver.resolve("user-1", second.id).listId).toBe("l2");
  });

  test("uses the destination's default template", () => {
    const created = destinations.create("user-1", {
      name: "Mine", apiKey: "pk_1", teamId: "t1", listId: "l1",
      defaultTemplateId: "builtin-terse",
    });
    expect(resolver.resolve("user-1", created.id).template.id).toBe("builtin-terse");
  });

  test("an explicit templateId wins over the destination default", () => {
    const created = destinations.create("user-1", {
      name: "Mine", apiKey: "pk_1", teamId: "t1", listId: "l1",
      defaultTemplateId: "builtin-terse",
    });
    expect(resolver.resolve("user-1", created.id, "builtin-commit-log").template.id).toBe(
      "builtin-commit-log"
    );
  });

  test("an unknown destination id throws", () => {
    expect(() => resolver.resolve("user-1", "nope")).toThrow(/not found/i);
  });

  test("another user's destination id throws", () => {
    const created = destinations.create("user-2", {
      name: "Theirs", apiKey: "pk_2", teamId: "t2", listId: "l2",
    });
    expect(() => resolver.resolve("user-1", created.id)).toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/destinations/DestinationResolver.test.ts`
Expected: FAIL — `Cannot find module './DestinationResolver.js'`

- [ ] **Step 3: Write `src/destinations/DestinationResolver.ts`**

```ts
import { ClickUpService } from "../services/ClickUpService.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { Template } from "../formatting/Template.js";
import { ClickUpConfig } from "../types/index.js";
import { Destination, DestinationStore } from "./DestinationStore.js";

const DEFAULT_TEMPLATE_ID = "builtin-standard";

export interface ResolvedDestination {
  /** Null when falling back to the .env configuration. */
  destination: Destination | null;
  clickUp: ClickUpService;
  listId: string | undefined;
  template: Template;
}

export interface DestinationResolverDeps {
  destinations: DestinationStore;
  templates: TemplateStore;
  envConfig: ClickUpConfig;
}

export class DestinationResolver {
  constructor(private deps: DestinationResolverDeps) {}

  /**
   * Resolution order: explicit id → the user's default → the .env config.
   * The last step keeps callers that predate destinations working unchanged.
   */
  resolve(userId: string, destinationId?: string, templateId?: string): ResolvedDestination {
    let destination: Destination | null = null;

    if (destinationId) {
      destination = this.deps.destinations.get(destinationId, userId);
      if (!destination) throw new Error(`Destination not found: ${destinationId}`);
    } else {
      destination = this.deps.destinations.getDefault(userId);
    }

    const template = this.resolveTemplate(templateId, destination);

    if (!destination) {
      return {
        destination: null,
        clickUp: new ClickUpService(this.deps.envConfig),
        listId: this.deps.envConfig.defaultListId,
        template,
      };
    }

    const apiKey = this.deps.destinations.getApiKey(destination.id, userId);
    const clickUp = new ClickUpService({
      teamId: destination.teamId,
      apiKey,
      defaultListId: destination.listId,
      defaultAssignee: destination.defaultAssignee,
      projectName: destination.name,
    });

    return { destination, clickUp, listId: destination.listId, template };
  }

  private resolveTemplate(templateId: string | undefined, destination: Destination | null): Template {
    const wanted = templateId || destination?.defaultTemplateId || DEFAULT_TEMPLATE_ID;
    const template = this.deps.templates.get(wanted) ?? this.deps.templates.get(DEFAULT_TEMPLATE_ID);
    if (!template) throw new Error("No template available — built-in templates are missing");
    return template;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/destinations/DestinationResolver.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write `src/routes/clickup.routes.ts`**

Browsing accepts either a saved `destinationId` or a raw `apiKey`, so a new destination can be explored before it is saved. These are `POST` because a raw API key must not travel in a query string, where it would land in access logs.

```ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { ClickUpService } from "../services/ClickUpService.js";

export function createClickUpRouter(destinations: DestinationStore): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user?.id ?? req.user?.userId;

  const serviceFor = (req: any): ClickUpService => {
    const { apiKey, destinationId, teamId } = req.body;
    if (destinationId) {
      const destination = destinations.get(destinationId, userIdOf(req));
      if (!destination) throw new Error("Destination not found");
      return new ClickUpService({
        teamId: teamId || destination.teamId,
        apiKey: destinations.getApiKey(destinationId, userIdOf(req)),
        projectName: destination.name,
      });
    }
    if (!apiKey) throw new Error("Provide either apiKey or destinationId");
    return new ClickUpService({ teamId: teamId || "", apiKey, projectName: "browse" });
  };

  const handle = (
    fn: (service: ClickUpService, body: any) => Promise<unknown>
  ) => async (req: any, res: any) => {
    try {
      res.json({ success: true, data: await fn(serviceFor(req), req.body) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      const status = message.includes("401") ? 401 : 400;
      res.status(status).json({
        success: false,
        error: message.includes("401")
          ? "That ClickUp API key is invalid or was revoked."
          : message,
      });
    }
  };

  router.post("/teams", authenticate, handle(async (service) => {
    const info = await service.getTeamInfo();
    return [{ id: info.team.id, name: info.team.name }];
  }));

  router.post("/spaces", authenticate, handle(async (service) => {
    const spaces = await service.getSpaces();
    return spaces.map((space: any) => ({ id: space.id, name: space.name }));
  }));

  router.post("/folders", authenticate, handle((service, body) =>
    service.getFolders(body.spaceId)
  ));

  // Returns folder lists when folderId is given, otherwise the space's
  // folderless lists. Both are real places tasks can live.
  router.post("/lists", authenticate, handle((service, body) =>
    body.folderId
      ? service.getListsInFolder(body.folderId)
      : service.getFolderlessLists(body.spaceId)
  ));

  router.post("/statuses", authenticate, handle((service, body) =>
    service.getListStatuses(body.listId)
  ));

  return router;
}
```

`POST /teams` returns a single-element array because `getTeamInfo` fetches one team by the configured id. When no `teamId` is supplied and the user is browsing with a raw key, call ClickUp's `GET /team` instead — add that as `getTeams()` on `ClickUpService` mirroring `getSpaces`, and use it when `body.teamId` is absent.

- [ ] **Step 6: Write `src/routes/destinations.routes.ts`**

```ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { ClickUpService } from "../services/ClickUpService.js";

export function createDestinationsRouter(destinations: DestinationStore): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user?.id ?? req.user?.userId;

  const fail = (res: any, error: unknown, status = 400): void => {
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : "Request failed",
    });
  };

  router.get("/", authenticate, (req, res) => {
    res.json({ success: true, data: destinations.list(userIdOf(req)) });
  });

  router.post("/", authenticate, (req, res) => {
    const { name, apiKey, teamId, listId } = req.body;
    const missing = ["name", "apiKey", "teamId", "listId"].filter((key) => !req.body[key]);
    if (missing.length > 0) {
      res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(", ")}` });
      return;
    }
    try {
      res.status(201).json({ success: true, data: destinations.create(userIdOf(req), req.body) });
    } catch (error) {
      fail(res, error);
    }
  });

  router.put("/:id", authenticate, (req, res) => {
    try {
      res.json({ success: true, data: destinations.update(req.params.id!, userIdOf(req), req.body) });
    } catch (error) {
      fail(res, error, 404);
    }
  });

  router.post("/:id/default", authenticate, (req, res) => {
    try {
      destinations.setDefault(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 404);
    }
  });

  router.delete("/:id", authenticate, (req, res) => {
    try {
      destinations.remove(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 404);
    }
  });

  // Confirms the credentials work and the target list is reachable.
  router.post("/:id/test", authenticate, async (req, res) => {
    try {
      const userId = userIdOf(req);
      const destination = destinations.get(req.params.id!, userId);
      if (!destination) {
        fail(res, new Error("Destination not found"), 404);
        return;
      }
      const service = new ClickUpService({
        teamId: destination.teamId,
        apiKey: destinations.getApiKey(destination.id, userId),
        projectName: destination.name,
      });
      const statuses = await service.getListStatuses(destination.listId);
      res.json({ success: true, data: { reachable: true, statuses } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed";
      res.status(400).json({
        success: false,
        error: message.includes("401")
          ? "This destination's API key is invalid or was revoked."
          : message.includes("404")
          ? "The target list no longer exists. Re-select it for this destination."
          : message,
      });
    }
  });

  return router;
}
```

- [ ] **Step 7: Mount both routers**

In `src/webhook-server.ts`, after the migration call from Task 5:

```ts
import { DestinationStore } from "./destinations/DestinationStore.js";
import { createDestinationsRouter } from "./routes/destinations.routes.js";
import { createClickUpRouter } from "./routes/clickup.routes.js";

const destinationStore = new DestinationStore(dbPath, cipher);

app.use("/api/destinations", createDestinationsRouter(destinationStore));
app.use("/api/clickup", createClickUpRouter(destinationStore));
```

- [ ] **Step 8: Verify the routes are mounted**

Start the server and check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3009/api/destinations
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3009/api/clickup/teams
```

Expected: `401` for both (authenticated routes; `404` would mean unmounted).

- [ ] **Step 9: Commit**

```bash
git add src/destinations/DestinationResolver.ts src/destinations/DestinationResolver.test.ts src/routes/destinations.routes.ts src/routes/clickup.routes.ts src/services/ClickUpService.ts src/webhook-server.ts
git commit -m "feat(destinations): resolver, CRUD API, and ClickUp hierarchy browsing

<trailer>"
```

---

### Task 7: Route task creation through destinations

**Files:**
- Modify: `src/routes/tasks.routes.ts`
- Modify: `src/routes/tasks.routes.test.ts`

**Interfaces:**
- Consumes: `DestinationResolver` (Task 6), `mapStatuses` (Task 3).
- Produces: `PreviewResponse` gains `destination`, `statusMapping`, and richer `warnings`. `TasksRouterDeps` replaces `clickUpConfig` with `resolver: DestinationResolver`.

- [ ] **Step 1: Extend the failing test**

Add to `src/routes/tasks.routes.test.ts`:

```ts
import { annotateStatusMapping } from "./tasks.routes.js";
import { makeWorkItem } from "../domain/WorkItem.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { buildPreview } from "./tasks.routes.js";

const standardTemplate = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;

describe("annotateStatusMapping", () => {
  test("rewrites statuses to the list's real names", () => {
    const preview = buildPreview([makeWorkItem({ status: "done" })], standardTemplate);
    const annotated = annotateStatusMapping(preview, ["to do", "Complete"]);
    expect(annotated.items[0]!.task.status).toBe("Complete");
    expect(annotated.statusMapping[0]!.method).toBe("synonym");
  });

  test("removes an unmatched status and warns", () => {
    const preview = buildPreview([makeWorkItem({ status: "nonsense" })], standardTemplate);
    const annotated = annotateStatusMapping(preview, ["to do", "Complete"]);
    expect(annotated.items[0]!.task.status).toBeUndefined();
    expect(annotated.warnings.some((w) => w.includes("nonsense"))).toBe(true);
  });

  test("leaves items without a status untouched", () => {
    const preview = buildPreview([makeWorkItem()], standardTemplate);
    const annotated = annotateStatusMapping(preview, ["to do"]);
    expect(annotated.items[0]!.task.status).toBeUndefined();
    expect(annotated.statusMapping).toEqual([]);
  });

  test("is a no-op when the list reports no statuses", () => {
    const preview = buildPreview([makeWorkItem({ status: "complete" })], standardTemplate);
    const annotated = annotateStatusMapping(preview, []);
    expect(annotated.items[0]!.task.status).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/routes/tasks.routes.test.ts`
Expected: FAIL — `annotateStatusMapping is not exported`

- [ ] **Step 3: Add status annotation and destination resolution**

In `src/routes/tasks.routes.ts`:

```ts
import { mapStatus, StatusMapping } from "../formatting/StatusMapper.js";
import { DestinationResolver } from "../destinations/DestinationResolver.js";

export interface PreviewResponse {
  items: RenderedTask[];
  markdown: string;
  template: { id: string; name: string };
  destination?: { id: string; name: string; listName?: string; teamName?: string } | null;
  statusMapping: StatusMapping[];
  warnings: string[];
}
```

Add `statusMapping: []` to the object `buildPreview` returns, then add:

```ts
/**
 * Rewrites each rendered task's status to the target list's real status,
 * dropping any that cannot be matched so ClickUp applies the list default.
 */
export function annotateStatusMapping(
  preview: PreviewResponse,
  availableStatuses: string[]
): PreviewResponse {
  const mappings: StatusMapping[] = [];
  const warnings = [...preview.warnings];

  const items = preview.items.map((entry) => {
    const desired = entry.task.status;
    const mapping = mapStatus(desired, availableStatuses);
    if (!mapping) return entry;

    if (!mappings.some((existing) => existing.from.toLowerCase() === mapping.from.toLowerCase())) {
      mappings.push(mapping);
    }

    const task = { ...entry.task };
    if (mapping.to) {
      task.status = mapping.to;
    } else {
      delete task.status;
      warnings.push(
        `Status "${mapping.from}" does not exist in the target list — it will be left at the list default.`
      );
    }

    return { ...entry, task };
  });

  return { ...preview, items, statusMapping: mappings, warnings };
}
```

- [ ] **Step 4: Swap `clickUpConfig` for the resolver**

Change `TasksRouterDeps`:

```ts
export interface TasksRouterDeps {
  resolver: DestinationResolver;
}
```

In each handler, replace `resolveTemplate(...)` and `new ClickUpService(deps.clickUpConfig)` with a single resolution, reading `destinationId` from the request body:

```ts
const userId = (req as any).user?.id ?? (req as any).user?.userId;
const resolved = deps.resolver.resolve(userId, req.body.destinationId, req.body.templateId);
```

Then for preview and for creation:

```ts
let preview = buildPreview(items, resolved.template);

// Only fetch statuses when at least one item actually carries one.
if (preview.items.some((entry) => entry.task.status)) {
  try {
    const statuses = await resolved.clickUp.getListStatuses(resolved.listId!);
    preview = annotateStatusMapping(preview, statuses);
  } catch (error) {
    preview.warnings.push(
      "Could not read the target list's statuses; statuses will be sent unmapped."
    );
  }
}

preview.destination = resolved.destination
  ? {
      id: resolved.destination.id,
      name: resolved.destination.name,
      listName: resolved.destination.listName,
      teamName: resolved.destination.teamName,
    }
  : null;
```

Creation calls `createRenderedTasks(preview.items, resolved.clickUp, resolved.listId)`.

The status fetch is guarded and non-fatal: an unreadable status list degrades to unmapped statuses with a warning rather than blocking creation entirely.

- [ ] **Step 5: Update the router construction in `webhook-server.ts`**

```ts
const resolver = new DestinationResolver({
  destinations: destinationStore,
  templates: templateStore,
  envConfig: config.clickup,
});

app.use("/api", createTasksRouter({ resolver }));
```

- [ ] **Step 6: Run the full suite and build**

Run: `bun test && bun run build`
Expected: all pass, build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/routes/tasks.routes.ts src/routes/tasks.routes.test.ts src/webhook-server.ts
git commit -m "feat(tasks): create into the selected destination with mapped statuses

<trailer>"
```

---

### Task 8: Destination management UI

**Files:**
- Create: `ui/app/settings/destinations/page.tsx`
- Modify: `ui/components/TaskPreviewModal.tsx`
- Modify: `ui/app/settings/page.tsx`

**Interfaces:**
- Consumes: `/api/destinations`, `/api/clickup/*`, `/api/preview-tasks`.
- Produces: nothing consumed by later tasks.

Match the conventions in `ui/app/settings/page.tsx`: `'use client'`, `useAuth()`, the `@/lib/components/ui` primitives, `react-hot-toast`, and `ProtectedRoute`.

- [ ] **Step 1: Build the destinations page**

Create `ui/app/settings/destinations/page.tsx` with:

- A list from `GET /api/destinations`, each row showing name and the full path (`Team → Space → Folder → List`), with **Set default**, **Test**, **Edit**, and **Delete**.
- **Test** calls `POST /api/destinations/:id/test` and toasts either the returned statuses or the specific error message.
- An **Add destination** flow that walks the hierarchy as a cascade, calling the browse endpoints with the typed-in raw `apiKey`:
  1. Paste API key → `POST /api/clickup/teams` → select team.
  2. `POST /api/clickup/spaces` → select space.
  3. `POST /api/clickup/folders` → select folder, **or** choose "No folder".
  4. `POST /api/clickup/lists` with `folderId` when a folder was chosen, otherwise with `spaceId` alone → select list.
  5. Name the destination, optionally pick a default template from `GET /api/templates`, save via `POST /api/destinations`.
- Store the display names alongside the ids as each step is selected — the API expects `teamName`, `spaceName`, `folderName`, and `listName`, and they are what make the saved row readable.
- Mask the API key input (`type="password"`) and never render a stored key — the API does not return one.

- [ ] **Step 2: Add the destination picker to the preview modal**

In `ui/components/TaskPreviewModal.tsx`:

- Load destinations on mount from `GET /api/destinations`; default to the one with `isDefault`.
- Add a destination `<select>` beside the template `<select>` added in Slice 1.
- On either selection change, re-request `POST /api/preview-tasks` with both `destinationId` and `templateId`.
- Render `data.destination` as a "Creating in: Team → List" line, so the target is unmissable before confirming.
- Render `data.statusMapping` as a small table (`from → to`, or "will use list default" when `to` is null).
- Render `data.warnings` prominently.
- Send `destinationId` with the confirm call.

- [ ] **Step 3: Link the page from settings**

Add a Destinations link next to the Templates link in `ui/app/settings/page.tsx` and `ui/lib/components/Sidebar.tsx`.

- [ ] **Step 4: Verify end to end in the browser**

With a real ClickUp API key:
- Add a destination that lives inside a folder, and a second that uses a **folderless** list. Both must be selectable.
- Test both; confirm the statuses come back.
- Run a preview against a destination whose list has no `complete` status; confirm the preview shows the status being dropped and warns.
- Create tasks and confirm they land in the correct list in ClickUp.
- Delete the default destination and confirm another is promoted.

- [ ] **Step 5: Commit**

```bash
git add ui/app/settings/destinations/page.tsx ui/components/TaskPreviewModal.tsx ui/app/settings/page.tsx ui/lib/components/Sidebar.tsx
git commit -m "feat(ui): destination management and preview destination picker

<trailer>"
```

---

## Slice 2 Definition of Done

- [ ] `bun test` passes; `bun run build` exits 0.
- [ ] The server refuses to start without `CREDENTIAL_ENCRYPTION_KEY`.
- [ ] An existing `user_settings.clickup_api_key` is migrated into an encrypted destination and nulled, once.
- [ ] Tasks can be created into two different ClickUp accounts from the same running instance.
- [ ] A folderless list is selectable in the picker.
- [ ] A status absent from the target list is dropped, reported in the preview, and does not fail creation.
- [ ] Omitting `destinationId` still creates tasks using the `.env` config.
- [ ] No API key appears in any log line or API response.
