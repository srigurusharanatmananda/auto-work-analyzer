/**
 * The SQLite→Postgres copy, against a real Postgres database.
 *
 * Skipped entirely, loudly, when no Postgres is reachable — a migration test
 * that quietly passes because it never connected is worse than no test.
 *
 * The source is built by the real `DatabaseService` / `AuthDatabaseService` /
 * `TemplateStore` code rather than by hand-written INSERTs, so the fixture
 * cannot drift from the schema the application actually creates. That matters
 * here more than usual: the thing under test is precisely whether the shapes on
 * the two sides agree.
 *
 * Runs under `tsx --test` (Node): better-sqlite3 cannot run under Bun
 * (oven-sh/bun#4290).
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { openPostgres, type PostgresHandle } from './client.js';
import { migrateSqliteToPostgres, verifyParity } from './sqliteToPostgres.js';
import { createTestDatabase } from '../testing/postgresFixture.js';

/**
 * A database name of its own, dropped and recreated per run. Sharing a database
 * with the developer's own would make the "target must be empty" check depend
 * on what they happened to be doing.
 */
const TEST_DB = 'awa_migration_test';
const ADMIN_URL = process.env.TEST_POSTGRES_ADMIN_URL ?? 'postgres://localhost:5432/postgres';
const TEST_URL = new URL(ADMIN_URL);
TEST_URL.pathname = `/${TEST_DB}`;

const originalCwd = process.cwd();
const tmpDir = mkdtempSync(join(tmpdir(), 'awa-pgmig-'));
const sqlitePath = join(tmpDir, '.database', 'auto-work-analyzer.db');

let pg: PostgresHandle;
let available = false;
let skipReason = '';

/**
 * Builds the source database with raw SQLite.
 *
 * It used to go through the real stores, which kept the fixture from drifting
 * out of sync with the schema the application creates. Every one of those
 * stores is on Postgres now, so calling them here would write to the live
 * database instead of the fixture — silently, because they fall back to the
 * shared pool. The old SQLite shapes are spelled out instead, which is the
 * right source of truth anyway: what this migration reads is a database written
 * by the OLD code, including the INTEGER booleans that are the conversion under
 * test.
 */
function seedSqlite(): void {
  process.chdir(tmpDir);
  mkdirSync(dirname(sqlitePath), { recursive: true });

  const auth = new Database(sqlitePath);
  try {
    auth.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'manager', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1,
        email_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT
      );
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        revoked_at TEXT,
        user_agent TEXT,
        ip_address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    const now = new Date().toISOString();
    const insertUser = auth.prepare(
      `INSERT INTO users
         (id, email, password_hash, full_name, role, is_active, email_verified,
          created_at, updated_at, failed_login_attempts)
       VALUES (?, ?, '$argon2id$v=19$m=65536,t=3,p=4$notreal$notreal', ?, ?, ?, ?, ?, ?, 0)`
    );
    // Mixed case on purpose: see the lower() index on the Postgres side.
    insertUser.run('user-alice', 'Alice@Example.com', 'Alice', 'admin', 1, 1, now, now);
    // is_active 0, so the 0 -> false leg is actually exercised.
    insertUser.run('user-bob', 'bob@example.com', 'Bob', 'user', 0, 0, now, now);

    auth
      .prepare(
        `INSERT INTO refresh_tokens
           (id, user_id, token_hash, expires_at, created_at, revoked, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?, 0, 'test', '127.0.0.1')`
      )
      .run(
        'rt-1',
        'user-alice',
        'hash-alice-1',
        new Date(Date.now() + 86_400_000).toISOString(),
        now
      );
  } finally {
    auth.close();
  }

  // Raw SQL, for the same reason as the templates below: `DatabaseService` is
  // on Postgres now, so calling it here would write to the live database rather
  // than build a SQLite fixture — silently, since the constructor falls back to
  // the shared pool. The old column types are what this migration reads, so
  // they are what the fixture must have.
  const db = new Database(sqlitePath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        timestamp TEXT NOT NULL,
        project_path TEXT NOT NULL,
        date TEXT NOT NULL,
        end_date TEXT,
        author TEXT,
        branch TEXT,
        total_commits INTEGER NOT NULL,
        total_work_items INTEGER NOT NULL,
        tasks_created INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        estimated_hours REAL NOT NULL DEFAULT 0,
        complexity INTEGER NOT NULL DEFAULT 0,
        files_count INTEGER NOT NULL DEFAULT 0,
        commits_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (analysis_id) REFERENCES analysis_history(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS processed_commits (
        hash TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        author TEXT NOT NULL,
        message TEXT NOT NULL,
        project_path TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        task_id TEXT,
        task_name TEXT
      );
    `);

    const now = new Date().toISOString();
    const insertAnalysis = db.prepare(
      `INSERT INTO analysis_history
         (id, user_id, timestamp, project_path, date, total_commits,
          total_work_items, tasks_created, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertAnalysis.run(
      'analysis-owned', 'user-alice', now, '/repos/one', '2026-08-05', 7, 2, 1,
      "alice's analysis", now
    );
    // A null owner, so "null survives as null" is actually exercised.
    insertAnalysis.run(
      'analysis-unowned', null, now, '/repos/legacy', '2026-01-01', 1, 1, 0, 'no owner', now
    );

    const insertWorkItem = db.prepare(
      `INSERT INTO work_items
         (id, analysis_id, name, type, description, estimated_hours, complexity,
          files_count, commits_count, created_at)
       VALUES (?, ?, ?, ?, 'x', ?, ?, ?, ?, ?)`
    );
    for (const [i, analysisId] of ['analysis-owned', 'analysis-owned', 'analysis-unowned'].entries()) {
      insertWorkItem.run(
        `work-${i}`,
        analysisId,
        `item ${i}`,
        'feature',
        1.5, // A real, so REAL -> real is exercised.
        1,   // Genuinely 1, and must NOT become boolean true.
        3,
        2,
        now
      );
    }

    db.prepare(
      `INSERT INTO processed_commits
         (hash, date, author, message, project_path, processed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('abc123', '2026-08-05', 'alice', 'a commit', '/repos/one', now);
  } finally {
    db.close();
  }

  // Written with raw SQL rather than through `TemplateStore`, which now runs on
  // Postgres and can no longer produce a SQLite fixture. That is the right shape
  // regardless: the source of this migration is a database written by the OLD
  // code, so the fixture should be the old schema — including `is_builtin` as an
  // INTEGER, which is precisely the conversion under test.
  const templateDb = new Database(sqlitePath);
  try {
    templateDb.exec(`
      CREATE TABLE IF NOT EXISTS task_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        name_template TEXT NOT NULL,
        description_template TEXT NOT NULL,
        options TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const now = new Date().toISOString();
    const options = JSON.stringify({
      emitSubtasks: true,
      applyPriority: true,
      applyTimeEstimate: false,
      dueDateSource: 'completedDate',
      statusMode: 'fromWorkItem',
      tagStrategy: { mode: 'fromWorkItem' },
    });

    const insert = templateDb.prepare(
      `INSERT INTO task_templates
         (id, user_id, name, description, name_template, description_template,
          options, is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, '{{name}}', '{{description}}', ?, ?, ?, ?)`
    );

    // One user template and one built-in, so the 0 -> false and 1 -> true legs
    // of the boolean conversion are both exercised.
    insert.run('tpl-mine', 'user-alice', 'Mine', 'a user template', options, 0, now, now);
    insert.run('tpl-builtin', null, 'Standard', 'a built-in', options, 1, now, now);
  } finally {
    templateDb.close();
  }

  process.chdir(originalCwd);
}

before(async () => {
  seedSqlite();

  // Create the test database from the admin connection, dropping any leftover.
  try {
    const admin = openPostgres(ADMIN_URL);
    try {
      await admin.sql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`);
      await admin.sql.unsafe(`CREATE DATABASE ${TEST_DB}`);
    } finally {
      await admin.close();
    }

    pg = openPostgres(TEST_URL.toString());
    await migrate(pg.db, { migrationsFolder: 'src/db/migrations' });
    available = true;
  } catch (error) {
    skipReason = error instanceof Error ? error.message : String(error);
    console.error(
      `\n!! Postgres is not reachable, so the migration tests did NOT run.\n` +
        `!! ${skipReason}\n` +
        `!! Start Postgres, or set TEST_POSTGRES_ADMIN_URL.\n`
    );
  }
});

after(async () => {
  if (pg) await pg.close();
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('sqlite -> postgres', () => {
  test('Postgres was reachable, so the rest of this file means something', () => {
    assert.equal(available, true, `Postgres unavailable: ${skipReason}`);
  });

  test('every table matches on row count', async (t) => {
    if (!available) return t.skip('no postgres');

    await migrateSqliteToPostgres({ sqlitePath, postgres: pg });

    // Counted by a separate pass over both databases, not from the copy's own
    // bookkeeping.
    const parity = await verifyParity(sqlitePath, pg);
    const mismatched = parity.filter((row) => !row.match);

    assert.deepEqual(
      mismatched,
      [],
      `row counts differ: ${JSON.stringify(mismatched, null, 2)}`
    );

    // And the fixture actually contained something, so a pair of zeroes cannot
    // pass as agreement.
    const analyses = parity.find((r) => r.table === 'analysis_history')!;
    assert.equal(analyses.postgres, 2);
    assert.equal(parity.find((r) => r.table === 'work_items')!.postgres, 3);
    assert.equal(parity.find((r) => r.table === 'users')!.postgres, 2);
  });

  test('0/1 became real booleans, and integers did not', async (t) => {
    if (!available) return t.skip('no postgres');

    const [alice] = await pg.sql`SELECT is_active, email_verified FROM users WHERE id = 'user-alice'`;
    const [bob] = await pg.sql`SELECT is_active, email_verified FROM users WHERE id = 'user-bob'`;

    assert.equal(alice!.is_active, true);
    assert.equal(alice!.email_verified, true);
    assert.equal(bob!.is_active, false, 'a 0 must become false, not true');
    assert.equal(bob!.email_verified, false);

    // The guard against over-eager conversion: complexity is 1 and is an int.
    const [item] = await pg.sql`SELECT complexity, estimated_hours FROM work_items WHERE id = 'work-0'`;
    assert.equal(item!.complexity, 1);
    assert.notEqual(item!.complexity, true);
    assert.equal(Number(item!.estimated_hours), 1.5);
  });

  test('a null owner survives as null rather than becoming a string', async (t) => {
    if (!available) return t.skip('no postgres');

    const [row] = await pg.sql`SELECT user_id FROM analysis_history WHERE id = 'analysis-unowned'`;
    assert.equal(row!.user_id, null);
  });

  test('the case-insensitive email uniqueness is enforced', async (t) => {
    if (!available) return t.skip('no postgres');

    // SQLite had UNIQUE ... COLLATE NOCASE; Postgres has a unique index on
    // lower(email). Alice was stored as "Alice@Example.com", so this must fail.
    await assert.rejects(
      () => pg.sql`
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES ('dupe', 'alice@example.com', 'x', 'Dupe', 'user', 'now', 'now')
      `,
      /duplicate key|unique/i,
      'two accounts must not be able to share one address in different case'
    );
  });

  test('the role check constraint came across', async (t) => {
    if (!available) return t.skip('no postgres');

    await assert.rejects(
      () => pg.sql`
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES ('bad-role', 'x@example.com', 'x', 'X', 'superuser', 'now', 'now')
      `,
      /check constraint|violates/i
    );
  });

  /**
   * The server seeds three built-in templates on every start, so a target whose
   * server has ever run is not empty. If those counted as data, `db:import`
   * would be impossible for anyone who started the server before reading the
   * docs — which is most people.
   */
  test('the seeded built-in templates do not count as a populated target', async (t) => {
    if (!available) return t.skip('no postgres');

    const fresh = await createTestDatabase();
    try {
      const now = new Date().toISOString();
      // Exactly what TemplateStore.seedBuiltins writes.
      await fresh.sql`
        INSERT INTO task_templates
          (id, user_id, name, description, name_template, description_template,
           options, is_builtin, created_at, updated_at)
        VALUES ('tpl-builtin', NULL, 'Standard', 'a built-in', '{{name}}',
                '{{description}}', '{}', true, ${now}, ${now})
      `;

      await migrateSqliteToPostgres({ sqlitePath, postgres: fresh });

      // The source's own copy of that id won, rather than colliding.
      const [row] = await fresh.sql`
        SELECT COUNT(*)::int AS count FROM task_templates WHERE id = 'tpl-builtin'
      `;
      assert.equal(row!.count, 1, 'the seeded row must be replaced, not duplicated');

      const parity = await verifyParity(sqlitePath, fresh);
      assert.deepEqual(parity.filter((r) => !r.match), []);
    } finally {
      await fresh.drop();
    }
  });

  test('refuses to copy into a database that already holds rows', async (t) => {
    if (!available) return t.skip('no postgres');

    // The target is populated by now, which is exactly the situation the guard
    // exists for: a second run must not silently double the data or fail
    // half-way through with a primary-key collision.
    await assert.rejects(
      () => migrateSqliteToPostgres({ sqlitePath, postgres: pg }),
      /already holds/
    );
  });

  test('an orphaned child row is reported before anything is written', async (t) => {
    if (!available) return t.skip('no postgres');

    // A work item whose analysis does not exist. This cannot be produced
    // through DatabaseService, which sets `pragma foreign_keys = ON` — good
    // news about the real data, and the reason the orphan has to be written
    // with the pragma off here. It is still a state a migration must handle: a
    // database hand-edited, restored from a partial dump, or written before the
    // pragma was set can hold one, and Postgres will enforce what SQLite let
    // through.
    const orphanDir = mkdtempSync(join(tmpdir(), 'awa-orphan-'));
    const orphanPath = join(orphanDir, 'orphan.db');

    // The schema used to be created by `new DatabaseService(orphanPath)`. That
    // class is on Postgres now, so the SQLite shape is spelled out here — which
    // is the honest thing anyway: the source of this migration is a database
    // written by the OLD code, and this is what it looked like.
    const raw = new Database(orphanPath);
    raw.exec(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        timestamp TEXT NOT NULL,
        project_path TEXT NOT NULL,
        date TEXT NOT NULL,
        end_date TEXT,
        author TEXT,
        branch TEXT,
        total_commits INTEGER NOT NULL,
        total_work_items INTEGER NOT NULL,
        tasks_created INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        estimated_hours REAL NOT NULL DEFAULT 0,
        complexity INTEGER NOT NULL DEFAULT 0,
        files_count INTEGER NOT NULL DEFAULT 0,
        commits_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (analysis_id) REFERENCES analysis_history(id) ON DELETE CASCADE
      );
    `);

    try {
      raw.pragma('foreign_keys = OFF');
      raw
        .prepare(
          `INSERT INTO work_items
             (id, analysis_id, name, type, description,
              estimated_hours, complexity, files_count, commits_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('lonely', 'analysis-that-never-existed', 'orphan', 'feature', '', 0, 0, 0, 0);
    } finally {
      raw.close();
    }

    const fresh = openPostgres(TEST_URL.toString());
    try {
      await assert.rejects(
        () => migrateSqliteToPostgres({ sqlitePath: orphanPath, postgres: fresh }),
        /no matching parent/
      );
    } finally {
      await fresh.close();
      rmSync(orphanDir, { recursive: true, force: true });
    }
  });
});
