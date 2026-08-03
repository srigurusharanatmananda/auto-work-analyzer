/**
 * Runs under `tsx --test` (Node): better-sqlite3 cannot open a database under
 * this repo's Bun version (oven-sh/bun#4290).
 *
 * This migration moves REAL credentials, so the cases that matter are the ones
 * where it goes wrong: run twice, interrupted between the data move and the
 * bookkeeping row, run against a database that has already grown destinations,
 * and run with a cipher that cannot round-trip what it encrypted. In every one
 * of those the key must still be recoverable afterwards.
 *
 * Every "pk_" string below is invented.
 */
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CredentialCipher, generateKeyBase64 } from "../destinations/CredentialCipher.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { runMigrations } from "./runMigrations.js";
import { migration002 } from "./002-destinations.js";

let dir: string;
let dbPath: string;
let cipher: CredentialCipher;

function seedUserSettings(apiKey: string | null, overrides: Record<string, unknown> = {}): void {
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
  const row = {
    user_id: "user-1",
    default_assignee: "dev@example.com",
    clickup_team_id: "team-9",
    clickup_list_id: "list-9",
    ...overrides,
  } as Record<string, any>;
  db.prepare(
    `INSERT INTO user_settings (user_id, default_assignee, clickup_api_key, clickup_team_id, clickup_list_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    row.user_id,
    row.default_assignee,
    apiKey,
    row.clickup_team_id,
    row.clickup_list_id,
    new Date().toISOString()
  );
  db.close();
}

function storedPlaintextKey(userId = "user-1"): string | null {
  const db = new Database(dbPath);
  const row = db
    .prepare(`SELECT clickup_api_key FROM user_settings WHERE user_id = ?`)
    .get(userId) as { clickup_api_key: string | null } | undefined;
  db.close();
  return row ? row.clickup_api_key : null;
}

function appliedMigrationIds(): string[] {
  const db = new Database(dbPath);
  const rows = db.prepare(`SELECT id FROM schema_migrations`).all() as Array<{ id: string }>;
  db.close();
  return rows.map((r) => r.id);
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
    assert.equal(destinations.length, 1);
    assert.equal(destinations[0]!.name, "Default (migrated)");
    assert.equal(destinations[0]!.teamId, "team-9");
    assert.equal(destinations[0]!.listId, "list-9");
    assert.equal(destinations[0]!.isDefault, true);
    assert.equal(destinations[0]!.defaultAssignee, "dev@example.com");
    assert.equal(store.getApiKey(destinations[0]!.id, "user-1"), "pk_legacy_key");
    store.close();
  });

  test("nulls out the plaintext key after migrating", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);
    assert.equal(storedPlaintextKey(), null);
  });

  test("skips users with no stored key", () => {
    seedUserSettings(null);
    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    assert.equal(store.list("user-1").length, 0);
    store.close();
  });

  test("skips a user whose team or list id is missing, and keeps their key", () => {
    seedUserSettings("pk_legacy_key", { clickup_list_id: null });
    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    assert.equal(store.list("user-1").length, 0);
    store.close();
    // The key is the only copy that exists — dropping it would be data loss.
    assert.equal(storedPlaintextKey(), "pk_legacy_key");
  });

  test("is idempotent — a second run creates nothing further", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);
    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    assert.equal(store.list("user-1").length, 1);
    store.close();
  });

  /**
   * The interrupted case: the data move committed but the process died before
   * the schema_migrations row was written. The next boot re-runs the migration,
   * which must neither duplicate the destination nor lose the credential.
   */
  test("a re-run after an interrupted run neither duplicates nor loses the key", () => {
    seedUserSettings("pk_legacy_key");

    const db = new Database(dbPath);
    migration002.run(db, cipher); // no bookkeeping row — as if killed here
    db.close();

    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    const destinations = store.list("user-1");
    assert.equal(destinations.length, 1);
    assert.equal(store.getApiKey(destinations[0]!.id, "user-1"), "pk_legacy_key");
    store.close();
    assert.ok(appliedMigrationIds().includes("002-destinations"));
  });

  test("does not steal the default from a destination the user already had", () => {
    seedUserSettings("pk_legacy_key");

    const store = new DestinationStore(dbPath, cipher);
    const existing = store.create("user-1", {
      name: "Already mine",
      apiKey: "pk_existing",
      teamId: "t1",
      listId: "l1",
    });
    store.close();

    runMigrations(dbPath, cipher);

    const reopened = new DestinationStore(dbPath, cipher);
    const all = reopened.list("user-1");
    assert.equal(all.length, 2);
    assert.equal(all.filter((d) => d.isDefault).length, 1);
    assert.equal(reopened.getDefault("user-1")!.id, existing.id);
    reopened.close();
  });

  /**
   * If the ciphertext cannot be read back, nulling the plaintext would destroy
   * the only usable copy of the key. The migration must abort instead.
   */
  test("aborts without clearing the plaintext when the ciphertext cannot be read back", () => {
    seedUserSettings("pk_legacy_key");

    const brokenCipher = {
      encrypt: (_plaintext: string) => "garbage:garbage:garbage",
      decrypt: (_payload: string) => "not-what-went-in",
    } as unknown as CredentialCipher;

    assert.throws(() => runMigrations(dbPath, brokenCipher), /round-trip|verify/i);

    assert.equal(storedPlaintextKey(), "pk_legacy_key");
    const db = new Database(dbPath);
    const count = db
      .prepare(`SELECT COUNT(*) AS n FROM clickup_destinations`)
      .get() as { n: number };
    db.close();
    assert.equal(count.n, 0);
    assert.ok(!appliedMigrationIds().includes("002-destinations"));
  });

  test("records the migration in schema_migrations", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);
    assert.ok(appliedMigrationIds().includes("002-destinations"));
  });

  test("runs cleanly when user_settings does not exist at all", () => {
    assert.doesNotThrow(() => runMigrations(dbPath, cipher));
    assert.ok(appliedMigrationIds().includes("002-destinations"));
  });

  test("migrates each user independently", () => {
    seedUserSettings("pk_one");
    const db = new Database(dbPath);
    db.prepare(
      `INSERT INTO user_settings (user_id, default_assignee, clickup_api_key, clickup_team_id, clickup_list_id, updated_at)
       VALUES ('user-2', NULL, 'pk_two', 'team-2', 'list-2', ?)`
    ).run(new Date().toISOString());
    db.close();

    runMigrations(dbPath, cipher);

    const store = new DestinationStore(dbPath, cipher);
    const first = store.list("user-1");
    const second = store.list("user-2");
    assert.equal(store.getApiKey(first[0]!.id, "user-1"), "pk_one");
    assert.equal(store.getApiKey(second[0]!.id, "user-2"), "pk_two");
    store.close();
  });
});
