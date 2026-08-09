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
import { runMigrations } from "./runMigrations.js";
import { migration002 } from "./002-destinations.js";

let dir: string;
let dbPath: string;
let cipher: CredentialCipher;

/**
 * Reads the destinations the migration wrote, straight out of SQLite.
 *
 * This used to go through `DestinationStore`, which was the natural way to
 * assert on the result while both lived on the same database. `DestinationStore`
 * is on Postgres now and this migration is a SQLite-only legacy path — reading
 * through it would either test nothing or fail for a reason unrelated to the
 * migration. The columns are read directly instead, which is also a stricter
 * check: it asserts what is on disk rather than what a mapper reports.
 */
interface MigratedRow {
  id: string;
  name: string;
  api_key_encrypted: string;
  team_id: string;
  list_id: string;
  default_assignee: string | null;
  is_default: number;
}

function migratedDestinations(userId: string): MigratedRow[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(
        `SELECT id, name, api_key_encrypted, team_id, list_id, default_assignee, is_default
           FROM clickup_destinations WHERE user_id = ? ORDER BY created_at ASC`
      )
      .all(userId) as MigratedRow[];
  } finally {
    db.close();
  }
}

/** Inserts a destination the way a user who already had one would have. */
function seedExistingDestination(userId: string, id: string, apiKey: string): void {
  const db = new Database(dbPath);
  try {
    db.exec(DESTINATIONS_SCHEMA_FOR_TEST);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO clickup_destinations
         (id, user_id, name, api_key_encrypted, team_id, list_id, is_default, created_at, updated_at)
       VALUES (?, ?, 'Already mine', ?, 't1', 'l1', 1, ?, ?)`
    ).run(id, userId, cipher.encrypt(apiKey), now, now);
  } finally {
    db.close();
  }
}

/** Mirrors the DDL the migration itself creates, for the pre-seeded case. */
const DESTINATIONS_SCHEMA_FOR_TEST = `
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
`;

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

    const destinations = migratedDestinations("user-1");
    assert.equal(destinations.length, 1);
    assert.equal(destinations[0]!.name, "Default (migrated)");
    assert.equal(destinations[0]!.team_id, "team-9");
    assert.equal(destinations[0]!.list_id, "list-9");
    assert.equal(destinations[0]!.is_default, 1);
    assert.equal(destinations[0]!.default_assignee, "dev@example.com");
    assert.equal(cipher.decrypt(destinations[0]!.api_key_encrypted), "pk_legacy_key");
  });

  test("nulls out the plaintext key after migrating", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);
    assert.equal(storedPlaintextKey(), null);
  });

  test("skips users with no stored key", () => {
    seedUserSettings(null);
    runMigrations(dbPath, cipher);

    assert.equal(migratedDestinations("user-1").length, 0);
  });

  test("skips a user whose team or list id is missing, and keeps their key", () => {
    seedUserSettings("pk_legacy_key", { clickup_list_id: null });
    runMigrations(dbPath, cipher);

    assert.equal(migratedDestinations("user-1").length, 0);
    // The key is the only copy that exists — dropping it would be data loss.
    assert.equal(storedPlaintextKey(), "pk_legacy_key");
  });

  test("is idempotent — a second run creates nothing further", () => {
    seedUserSettings("pk_legacy_key");
    runMigrations(dbPath, cipher);
    runMigrations(dbPath, cipher);

    assert.equal(migratedDestinations("user-1").length, 1);
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

    const destinations = migratedDestinations("user-1");
    assert.equal(destinations.length, 1);
    assert.equal(cipher.decrypt(destinations[0]!.api_key_encrypted), "pk_legacy_key");
    assert.ok(appliedMigrationIds().includes("002-destinations"));
  });

  test("does not steal the default from a destination the user already had", () => {
    seedUserSettings("pk_legacy_key");

    seedExistingDestination("user-1", "existing-1", "pk_existing");

    runMigrations(dbPath, cipher);

    const all = migratedDestinations("user-1");
    assert.equal(all.length, 2);
    assert.equal(all.filter((d) => d.is_default === 1).length, 1);
    assert.equal(all.find((d) => d.is_default === 1)!.id, "existing-1");
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

    const first = migratedDestinations("user-1");
    const second = migratedDestinations("user-2");
    assert.equal(cipher.decrypt(first[0]!.api_key_encrypted), "pk_one");
    assert.equal(cipher.decrypt(second[0]!.api_key_encrypted), "pk_two");
  });
});
