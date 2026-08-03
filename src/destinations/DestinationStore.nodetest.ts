/**
 * Runs under `tsx --test` (Node), not `bun test`: better-sqlite3 cannot open a
 * database under this repo's Bun version (oven-sh/bun#4290).
 *
 * The invariants worth pinning are the ones a caller cannot see for itself:
 * that a `Destination` never carries the API key (it is serialised straight
 * into API responses), that exactly one destination is the default at all
 * times, and that every read is scoped to the owning user.
 *
 * "pk_test_key" and friends are invented strings, not credentials.
 */
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
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
    assert.equal(created.name, "Ask Nithyananda → Dev");
    assert.equal(created.listId, "list-1");
    const asRecord = created as unknown as Record<string, unknown>;
    assert.equal(asRecord.apiKey, undefined);
    assert.equal(asRecord.apiKeyEncrypted, undefined);
    // Belt and braces: nothing key-shaped anywhere on the serialised object.
    assert.ok(!JSON.stringify(created).includes("pk_test_key"));
  });

  test("getApiKey decrypts the stored key", () => {
    const created = store.create("user-1", input());
    assert.equal(store.getApiKey(created.id, "user-1"), "pk_test_key");
  });

  test("the stored column is ciphertext, not the key", () => {
    const created = store.create("user-1", input());
    // Read the raw column rather than adding a production accessor for it.
    const db = new Database(join(dir, "test.db"));
    const row = db
      .prepare(`SELECT api_key_encrypted FROM clickup_destinations WHERE id = ?`)
      .get(created.id) as { api_key_encrypted: string };
    db.close();
    assert.ok(!row.api_key_encrypted.includes("pk_test_key"));
    assert.match(row.api_key_encrypted, /^[^:]+:[^:]+:[^:]+$/);
  });

  test("getApiKey refuses another user's destination", () => {
    const created = store.create("user-1", input());
    assert.throws(() => store.getApiKey(created.id, "user-2"), /not found/i);
  });

  test("the first destination becomes the default automatically", () => {
    const created = store.create("user-1", input());
    assert.equal(created.isDefault, true);
    assert.equal(store.getDefault("user-1")!.id, created.id);
  });

  test("setDefault moves the flag and leaves exactly one default", () => {
    const first = store.create("user-1", input({ name: "First" }));
    const second = store.create("user-1", input({ name: "Second" }));
    assert.equal(second.isDefault, false);

    store.setDefault(second.id, "user-1");

    const all = store.list("user-1");
    assert.equal(all.filter((d) => d.isDefault).length, 1);
    assert.equal(store.getDefault("user-1")!.id, second.id);
    assert.equal(store.get(first.id, "user-1")!.isDefault, false);
  });

  test("setDefault does not touch another user's default", () => {
    const mine = store.create("user-1", input({ name: "Mine" }));
    const theirs = store.create("user-2", input({ name: "Theirs" }));
    store.setDefault(mine.id, "user-1");
    assert.equal(store.getDefault("user-2")!.id, theirs.id);
  });

  test("list is scoped to the owning user", () => {
    store.create("user-1", input({ name: "Mine" }));
    store.create("user-2", input({ name: "Theirs" }));
    assert.deepEqual(
      store.list("user-1").map((d) => d.name),
      ["Mine"]
    );
  });

  test("update changes fields and can rotate the key", () => {
    const created = store.create("user-1", input());
    const updated = store.update(created.id, "user-1", { name: "Renamed", apiKey: "pk_new" });
    assert.equal(updated.name, "Renamed");
    assert.equal(updated.listId, "list-1");
    assert.equal(store.getApiKey(created.id, "user-1"), "pk_new");
  });

  test("update without an apiKey leaves the stored key intact", () => {
    const created = store.create("user-1", input());
    store.update(created.id, "user-1", { name: "Renamed" });
    assert.equal(store.getApiKey(created.id, "user-1"), "pk_test_key");
  });

  test("update refuses another user's destination", () => {
    const created = store.create("user-1", input());
    assert.throws(() => store.update(created.id, "user-2", { name: "Hijacked" }), /not found/i);
  });

  test("moving a destination to a folderless list clears the folder", () => {
    const created = store.create("user-1", input({ folderId: "f1", folderName: "Sprints" }));
    const updated = store.update(created.id, "user-1", {
      folderId: null,
      folderName: null,
      listId: "list-9",
      listName: "Inbox",
    });
    assert.equal(updated.folderId, undefined);
    assert.equal(updated.folderName, undefined);
    assert.equal(updated.listId, "list-9");
  });

  test("removing the default promotes another destination", () => {
    const first = store.create("user-1", input({ name: "First" }));
    const second = store.create("user-1", input({ name: "Second" }));
    store.remove(first.id, "user-1");
    assert.equal(store.getDefault("user-1")!.id, second.id);
  });

  test("removing the last destination leaves no default", () => {
    const only = store.create("user-1", input());
    store.remove(only.id, "user-1");
    assert.equal(store.getDefault("user-1"), null);
  });

  test("remove refuses another user's destination", () => {
    const created = store.create("user-1", input());
    assert.throws(() => store.remove(created.id, "user-2"), /not found/i);
    assert.ok(store.get(created.id, "user-1"));
  });

  test("create requires an apiKey", () => {
    assert.throws(() => store.create("user-1", input({ apiKey: undefined })), /apiKey/);
  });
});
