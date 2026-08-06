/**
 * An isolated Postgres database for one test suite.
 *
 * Every suite gets its own **schema** inside the developer's existing database,
 * not its own database. Schema creation is near-instant where CREATE DATABASE
 * takes hundreds of milliseconds, and the tables are identical either way.
 *
 * The migrations are applied by executing the .sql files directly rather than
 * through Drizzle's migrator. The migrator keeps its bookkeeping in a shared
 * `drizzle` schema, so the second suite to run would find every migration
 * already recorded as applied and quietly create no tables at all — a fixture
 * that fails by producing an empty database is the worst kind.
 *
 * Isolation is by construction: `search_path` is set on the connection, so a
 * statement that forgets to qualify a table name still cannot reach `public`.
 */
// Loaded here rather than left to the runner: a suite that silently found no
// DATABASE_URL would report "Postgres unavailable" and look like an
// environment problem instead of a missing import.
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openPostgres, type PostgresHandle } from '../db/client.js';
import { setPool } from '../db/pool.js';

export interface TestDatabase extends PostgresHandle {
  /** The schema these tables live in. */
  schemaName: string;
  /** Drops the schema and closes the connection. Safe to call twice. */
  drop(): Promise<void>;
}

/**
 * Resolved relative to this file, not to `process.cwd()`. Several suites chdir
 * into a temp directory to exercise the relative `.database` path, and a
 * cwd-based lookup would then find no migrations there.
 */
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

function migrationStatements(): string[] {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort(); // 0000_, 0001_, ... — lexical order is application order.

  if (files.length === 0) {
    throw new Error(
      `No migrations found in ${migrationsDir}. The fixture would create an ` +
        `empty schema and every test would fail for the wrong reason.`
    );
  }

  return files.flatMap((name) =>
    readFileSync(join(migrationsDir, name), 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0)
  );
}

/**
 * Re-points the one thing `search_path` cannot redirect.
 *
 * Drizzle writes foreign-key targets fully qualified — `REFERENCES
 * "public"."users"` — so a schema-isolated copy of the tables would every time
 * declare its constraints against the real `public` tables, and fail outright
 * when those do not exist. Nothing else in the generated SQL names a schema
 * (verified: three occurrences, all FK targets), so this substitution is
 * narrow. It is also the only place the fixture's tables differ from
 * production's, which is why it is a named function rather than an inline
 * `.replace()`.
 */
function qualifyForSchema(statement: string, schemaName: string): string {
  return statement.replaceAll('"public".', `"${schemaName}".`);
}

/**
 * Reports the reason Postgres could not be reached, formatted for a test
 * failure rather than a stack trace.
 */
export function postgresUnavailableMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return (
    `Postgres is not reachable, so this suite cannot run.\n  ${detail}\n` +
    `  Start Postgres and set DATABASE_URL (or TEST_DATABASE_URL).`
  );
}

/**
 * Creates a fresh schema with the full current table set.
 *
 * Also points the process-wide pool at it, and clears that on `drop()`. Code
 * several frames down a call stack reaches for `getPool()` without any way to
 * be handed a fixture — `GitWorkAnalyzer` builds a `HistoryService` builds a
 * `DatabaseService`, for instance. Without this, such a suite would open a
 * *second* pool that nothing ever closes, and node would sit with a live socket
 * after the last test passed: the run hangs rather than fails, which is the
 * worst way for this to go wrong.
 *
 * Throws if Postgres is unreachable. Deliberately not a skip: a database suite
 * that passes without a database is indistinguishable from one that works.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Neither TEST_DATABASE_URL nor DATABASE_URL is set, so there is no ' +
        'database to test against. See env.example.'
    );
  }

  // A name that cannot collide with a concurrent run or a leftover from a
  // crashed one, and is obviously disposable when found by hand later.
  const schemaName = `test_${randomUUID().replace(/-/g, '')}`;

  // The schema has to be created through a connection that does not yet point
  // at it, hence two handles.
  const admin = openPostgres(url, { max: 1 });
  try {
    await admin.sql.unsafe(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await admin.close();
  }

  const handle = openPostgres(url, { searchPath: schemaName, max: 1 });

  try {
    for (const statement of migrationStatements()) {
      await handle.sql.unsafe(qualifyForSchema(statement, schemaName));
    }
  } catch (error) {
    // Do not leave the half-built schema behind on the developer's database.
    await handle.close();
    const cleanup = openPostgres(url, { max: 1 });
    try {
      await cleanup.sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await cleanup.close();
    }
    throw error;
  }

  setPool(handle);

  let dropped = false;

  return {
    ...handle,
    schemaName,
    close: handle.close,
    async drop(): Promise<void> {
      if (dropped) return;
      dropped = true;
      setPool(null);
      await handle.close();

      const cleanup = openPostgres(url, { max: 1 });
      try {
        await cleanup.sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanup.close();
      }
    },
  };
}

/**
 * Removes schemas left behind by suites that crashed before `drop()`.
 *
 * Not called automatically by the fixture — a suite that tidies up after other
 * suites can delete a schema a concurrent run is still using. Exposed for a
 * maintenance script.
 */
export async function dropLeftoverTestSchemas(url: string): Promise<string[]> {
  const handle = openPostgres(url, { max: 1 });
  try {
    const rows = await handle.sql<Array<{ nspname: string }>>`
      SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test\\_%'
    `;
    for (const row of rows) {
      await handle.sql.unsafe(`DROP SCHEMA IF EXISTS "${row.nspname}" CASCADE`);
    }
    return rows.map((row) => row.nspname);
  } finally {
    await handle.close();
  }
}
