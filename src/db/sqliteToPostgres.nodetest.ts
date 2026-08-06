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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { openPostgres, type PostgresHandle } from './client.js';
import { migrateSqliteToPostgres, verifyParity } from './sqliteToPostgres.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { AuthDatabaseService } from '../services/AuthDatabaseService.js';
import { TemplateStore } from '../services/TemplateStore.js';

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

/** Builds a source database through the real stores. */
function seedSqlite(): void {
  process.chdir(tmpDir);

  const auth = new AuthDatabaseService();
  try {
    auth.createUser({
      id: 'user-alice',
      email: 'Alice@Example.com', // Mixed case on purpose: see the lower() index.
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$notreal$notreal',
      full_name: 'Alice',
      role: 'admin',
      is_active: true,
      email_verified: true,
    });
    auth.createUser({
      id: 'user-bob',
      email: 'bob@example.com',
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$notreal$notreal',
      full_name: 'Bob',
      role: 'user',
      is_active: false, // A false boolean, so 0→false is actually exercised.
      email_verified: false,
    });

    auth.storeRefreshToken({
      id: 'rt-1',
      user_id: 'user-alice',
      token_hash: 'hash-alice-1',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      user_agent: 'test',
      ip_address: '127.0.0.1',
    });
  } finally {
    auth.close();
  }

  const db = new DatabaseService();
  try {
    db.saveAnalysis({
      id: 'analysis-owned',
      userId: 'user-alice',
      timestamp: new Date().toISOString(),
      projectPath: '/repos/one',
      date: '2026-08-05',
      totalCommits: 7,
      totalWorkItems: 2,
      tasksCreated: 1,
      summary: "alice's analysis",
    });
    db.saveAnalysis({
      id: 'analysis-unowned',
      timestamp: new Date().toISOString(),
      projectPath: '/repos/legacy',
      date: '2026-01-01',
      totalCommits: 1,
      totalWorkItems: 1,
      tasksCreated: 0,
      summary: 'no owner',
    });

    for (const [i, analysisId] of ['analysis-owned', 'analysis-owned', 'analysis-unowned'].entries()) {
      db.saveWorkItem({
        id: `work-${i}`,
        analysisId,
        name: `item ${i}`,
        type: 'feature',
        description: 'x',
        estimatedHours: 1.5, // A real, so REAL→real is exercised.
        complexity: 1, // Genuinely 1, and must NOT become boolean true.
        filesCount: 3,
        commitsCount: 2,
        createdAt: new Date().toISOString(),
      });
    }

    db.markCommitAsProcessed({
      hash: 'abc123',
      date: '2026-08-05',
      author: 'alice',
      message: 'a commit',
      projectPath: '/repos/one',
      processedAt: new Date().toISOString(),
    });
  } finally {
    db.close();
  }

  const templates = new TemplateStore(sqlitePath);
  try {
    templates.create('user-alice', {
      name: 'Mine',
      description: 'a user template',
      nameTemplate: '{{name}}',
      descriptionTemplate: '{{description}}',
      options: {
        emitSubtasks: true,
        applyPriority: true,
        applyTimeEstimate: false,
        dueDateSource: 'completedDate',
        statusMode: 'fromWorkItem',
        tagStrategy: { mode: 'fromWorkItem' },
      },
    });
  } finally {
    templates.close();
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

    // Create the schema through the real code, then insert behind its back.
    new DatabaseService(orphanPath).close();

    const raw = new Database(orphanPath);
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
