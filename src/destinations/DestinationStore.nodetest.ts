/**
 * Runs against a real Postgres schema of its own, under `tsx --test`.
 *
 * The invariants worth pinning are the ones a caller cannot see for itself:
 * that a `Destination` never carries the API key (it is serialised straight
 * into API responses), that exactly one destination is the default at all
 * times, and that every read is scoped to the owning user.
 *
 * "pk_test_key" and friends are invented strings, not credentials.
 */
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CredentialCipher, generateKeyBase64 } from "./CredentialCipher.js";
import { DestinationStore } from "./DestinationStore.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";

let db: TestDatabase;
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

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.sql`TRUNCATE clickup_destinations`;
  // A fresh key per test: nothing here depends on ciphertext surviving between
  // tests, and a shared key would let one test decrypt another's fixture.
  store = new DestinationStore(new CredentialCipher(generateKeyBase64()), db);
});

afterEach(() => {
  store.close();
});

describe("DestinationStore", () => {
  test("creates and reads back a destination without exposing the key", async () => {
    const created = await store.create("user-1", input());
    assert.equal(created.name, "Ask Nithyananda → Dev");
    assert.equal(created.listId, "list-1");
    const asRecord = created as unknown as Record<string, unknown>;
    assert.equal(asRecord.apiKey, undefined);
    assert.equal(asRecord.apiKeyEncrypted, undefined);
    // Belt and braces: nothing key-shaped anywhere on the serialised object.
    assert.ok(!JSON.stringify(created).includes("pk_test_key"));
  });

  test("getApiKey decrypts the stored key", async () => {
    const created = await store.create("user-1", input());
    assert.equal(await store.getApiKey(created.id, "user-1"), "pk_test_key");
  });

  test("the stored column is ciphertext, not the key", async () => {
    const created = await store.create("user-1", input());
    // Read the raw column rather than adding a production accessor for it.
    const [row] = await db.sql<Array<{ api_key_encrypted: string }>>`
      SELECT api_key_encrypted FROM clickup_destinations WHERE id = ${created.id}
    `;
    assert.ok(!row!.api_key_encrypted.includes("pk_test_key"));
    assert.match(row!.api_key_encrypted, /^[^:]+:[^:]+:[^:]+$/);
  });

  test("getApiKey refuses another user's destination", async () => {
    const created = await store.create("user-1", input());
    await assert.rejects(() => store.getApiKey(created.id, "user-2"), /not found/i);
  });

  test("the first destination becomes the default automatically", async () => {
    const created = await store.create("user-1", input());
    assert.equal(created.isDefault, true);
    assert.equal((await store.getDefault("user-1"))!.id, created.id);
  });

  test("setDefault moves the flag and leaves exactly one default", async () => {
    const first = await store.create("user-1", input({ name: "First" }));
    const second = await store.create("user-1", input({ name: "Second" }));
    assert.equal(second.isDefault, false);

    await store.setDefault(second.id, "user-1");

    const all = await store.list("user-1");
    assert.equal(all.filter((d) => d.isDefault).length, 1);
    assert.equal((await store.getDefault("user-1"))!.id, second.id);
    assert.equal((await store.get(first.id, "user-1"))!.isDefault, false);
  });

  test("setDefault does not touch another user's default", async () => {
    const mine = await store.create("user-1", input({ name: "Mine" }));
    const theirs = await store.create("user-2", input({ name: "Theirs" }));
    await store.setDefault(mine.id, "user-1");
    assert.equal((await store.getDefault("user-2"))!.id, theirs.id);
  });

  test("list is scoped to the owning user", async () => {
    await store.create("user-1", input({ name: "Mine" }));
    await store.create("user-2", input({ name: "Theirs" }));
    assert.deepEqual(
      (await store.list("user-1")).map((d) => d.name),
      ["Mine"]
    );
  });

  test("update changes fields and can rotate the key", async () => {
    const created = await store.create("user-1", input());
    const updated = await store.update(created.id, "user-1", { name: "Renamed", apiKey: "pk_new" });
    assert.equal(updated.name, "Renamed");
    assert.equal(updated.listId, "list-1");
    assert.equal(await store.getApiKey(created.id, "user-1"), "pk_new");
  });

  test("update without an apiKey leaves the stored key intact", async () => {
    const created = await store.create("user-1", input());
    await store.update(created.id, "user-1", { name: "Renamed" });
    assert.equal(await store.getApiKey(created.id, "user-1"), "pk_test_key");
  });

  test("update refuses another user's destination", async () => {
    const created = await store.create("user-1", input());
    await assert.rejects(() => store.update(created.id, "user-2", { name: "Hijacked" }), /not found/i);
  });

  test("moving a destination to a folderless list clears the folder", async () => {
    const created = await store.create("user-1", input({ folderId: "f1", folderName: "Sprints" }));
    const updated = await store.update(created.id, "user-1", {
      folderId: null,
      folderName: null,
      listId: "list-9",
      listName: "Inbox",
    });
    assert.equal(updated.folderId, undefined);
    assert.equal(updated.folderName, undefined);
    assert.equal(updated.listId, "list-9");
  });

  test("removing the default promotes another destination", async () => {
    const first = await store.create("user-1", input({ name: "First" }));
    const second = await store.create("user-1", input({ name: "Second" }));
    await store.remove(first.id, "user-1");
    assert.equal((await store.getDefault("user-1"))!.id, second.id);
  });

  test("removing the last destination leaves no default", async () => {
    const only = await store.create("user-1", input());
    await store.remove(only.id, "user-1");
    assert.equal(await store.getDefault("user-1"), null);
  });

  test("remove refuses another user's destination", async () => {
    const created = await store.create("user-1", input());
    await assert.rejects(() => store.remove(created.id, "user-2"), /not found/i);
    assert.ok(await store.get(created.id, "user-1"));
  });

  test("create requires an apiKey", async () => {
    await assert.rejects(() => store.create("user-1", input({ apiKey: undefined })), /apiKey/);
  });
});
