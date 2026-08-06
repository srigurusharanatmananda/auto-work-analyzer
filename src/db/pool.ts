/**
 * The one Postgres pool the running server uses.
 *
 * The stores used to each open their own `new Database(path)`, which under
 * SQLite was merely wasteful. Under Postgres it is not: every store instance
 * would hold its own pool of real sockets, and `authenticate` alone constructed
 * one per request. So connections are owned here and handed to stores, which
 * never open their own.
 *
 * Created on first use rather than at import, for the same reason `openPostgres`
 * is a factory: importing a module must not require a database.
 */
import { openPostgres, type PostgresHandle } from './client.js';

let pool: PostgresHandle | null = null;

/** The process-wide handle, opened on first call. */
export function getPool(): PostgresHandle {
  if (!pool) pool = openPostgres();
  return pool;
}

/**
 * Replaces the process-wide handle.
 *
 * Exists for tests, which hand in a schema-isolated fixture so that code
 * reaching for `getPool()` deep in a call stack does not have to be threaded
 * with a parameter it only needs under test.
 */
export function setPool(handle: PostgresHandle | null): void {
  pool = handle;
}

/** Closes and forgets the pool. Safe when none was ever opened. */
export async function closePool(): Promise<void> {
  const current = pool;
  pool = null;
  if (current) await current.close();
}
