/**
 * The Postgres connection and Drizzle instance.
 *
 * Created on demand rather than at module scope. The call system's equivalent
 * throws at import time if DATABASE_URL is unset, which means merely importing
 * anything downstream of it kills a process that was never going to touch the
 * database — including tests and the CLI. A factory keeps that failure at the
 * point of use, where it can be reported properly.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface PostgresHandle {
  db: Database;
  sql: postgres.Sql;
  close(): Promise<void>;
}

export interface OpenOptions {
  /**
   * Resolve unqualified table names in this Postgres schema instead of
   * `public`. Used by the test fixture to give each suite its own set of
   * tables inside one database; unused in production.
   */
  searchPath?: string;
  /**
   * Cap the pool. The test fixture uses 1 so that a suite which leaks an open
   * transaction deadlocks against itself immediately rather than intermittently.
   */
  max?: number;
}

/**
 * Opens a pooled connection.
 *
 * @param connectionString defaults to DATABASE_URL; throws if neither is given,
 *   because a connection to a silently-chosen fallback database is worse than
 *   no connection.
 */
export function openPostgres(connectionString?: string, options: OpenOptions = {}): PostgresHandle {
  const url = connectionString ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Point it at a Postgres database, e.g.\n' +
        '  DATABASE_URL=postgres://localhost:5432/auto_work_analyzer'
    );
  }

  const sql = postgres(url, {
    // Surfaces a mis-typed url as an error rather than a hang on first query.
    connect_timeout: 10,
    ...(options.max ? { max: options.max } : {}),
    ...(options.searchPath
      ? // Set per connection, so a pool member created later cannot quietly
        // fall back to `public` and write the test's rows into the real tables.
        { connection: { search_path: options.searchPath } }
      : {}),
  });

  return {
    db: drizzle(sql, { schema }),
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
