/**
 * A Postgres-backed `Store` for `express-rate-limit`, implementing the
 * interface at `node_modules/express-rate-limit/dist/index.d.ts` (`Store`) —
 * `increment` / `decrement` / `resetKey`, returning `{ totalHits, resetTime }`.
 *
 * `MemoryStore` (express-rate-limit's default) resets on restart and cannot
 * see hits from any other process. `ScanLeaseStore` solved the same shape of
 * problem — several processes needing to agree on one piece of state — with a
 * single shared Postgres table and an atomic `INSERT ... ON CONFLICT` rather
 * than a SELECT followed by a write; this mirrors that, for a hit counter
 * instead of a claim. BullMQ/Redis was deliberately rejected for exactly this
 * kind of low-volume coordination problem — see STATUS.md's "Not doing"
 * entry on `transcription_jobs` — so this does not reach for Redis either.
 *
 * Constructor mirrors `ScanLeaseStore`'s: an optional injected `sql` handle
 * (lazy `getPool()` otherwise) and an optional injected `now` so tests can
 * drive window expiry without waiting on a real clock.
 */
import { getPool } from '../db/pool.js';
import { stamp } from '../db/timestamp.js';
import type { PostgresHandle } from '../db/client.js';
import type { ClientRateLimitInfo, Store } from 'express-rate-limit';

export interface PostgresRateLimitStoreDeps {
  /**
   * Scopes this store's rows to one rate limiter. Required: `authRateLimiter`,
   * `apiRateLimiter` and `mediaFetchRateLimiter` all fall back to the same key
   * (the caller's IP) for an unauthenticated request, and each limiter is a
   * separate budget — without this, tripping the strict auth limit would also
   * burn through the much larger general-API budget on the same row. See the
   * comment on `rateLimitHits` in `schema.ts`.
   */
  limiter: string;
  /**
   * How long a window lasts. Passed explicitly rather than read from the
   * `init(options)` callback express-rate-limit offers: a store that only
   * learns its own window when the library gets around to calling it is
   * harder to construct in a test than one that is simply told.
   */
  windowMs: number;
  sql?: PostgresHandle;
  /** Injected so tests can drive expiry without waiting. */
  now?: () => number;
}

/**
 * express-rate-limit's own double-count guard buckets stores by
 * `store.constructor.name` when `localKeys` is falsy (the correct setting
 * for a database-backed store — see `PostgresRateLimitStore.localKeys`
 * below), which collapses every instance of THIS class into one shared
 * bucket regardless of `limiter`. Without a distinct `prefix` per instance,
 * a single request that passes through more than one of this app's three
 * limiters (e.g. any `/api/auth/*` request also hits the globally-mounted
 * `apiRateLimiter`) would throw `ERR_ERL_DOUBLE_COUNT` — ask
 * express-rate-limit's own source (`singleCount` in its dist bundle) why:
 * the check is meant to catch a genuine misconfiguration (one store, one
 * key, incremented twice for one request), and three logically-independent
 * limiters sharing one store CLASS is a false positive of exactly that
 * heuristic, not the bug it exists to catch.
 */
export function prefixFor(limiter: string): string {
  return `${limiter}:`;
}


export class PostgresRateLimitStore implements Store {
  /**
   * false: rows in `rate_limit_hits` genuinely are shared across every
   * process that points at the same Postgres — the entire reason this store
   * exists instead of `MemoryStore`. See `prefixFor` above for the OTHER
   * half of this, since `localKeys: false` is what makes the constructor-name
   * bucketing collision possible in the first place.
   */
  readonly localKeys = false;
  /** See `prefixFor`. Distinguishes this instance from a sibling limiter's, in the double-count check only — never touches an actual stored key. */
  readonly prefix: string;

  constructor(private readonly deps: PostgresRateLimitStoreDeps) {
    this.prefix = prefixFor(deps.limiter);
  }

  private get sql() {
    return (this.deps.sql ?? getPool()).sql;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private get limiter(): string {
    return this.deps.limiter;
  }

  /**
   * Fetches the current count without changing it. Not required by `Store`,
   * but cheap to offer and useful for tests that want to assert state without
   * incrementing it.
   */
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const rows = await this.sql<Array<{ hits: number; resetAt: string }>>`
      SELECT hits, reset_at as "resetAt"
        FROM rate_limit_hits
       WHERE limiter = ${this.limiter} AND client_key = ${key}
    `;
    if (rows.length === 0) return undefined;
    return { totalHits: rows[0]!.hits, resetTime: new Date(rows[0]!.resetAt) };
  }

  /**
   * Counts one hit for `key`, starting a fresh window if the previous one has
   * expired.
   *
   * One statement, not a SELECT to decide "is this window still live" followed
   * by an INSERT or UPDATE — the same reasoning `ScanLeaseStore.claim` gives
   * for its single `INSERT ... ON CONFLICT`: two concurrent requests from the
   * same client would otherwise both read the same stale-or-fresh state and
   * race on what to write. Here the `CASE` inside `DO UPDATE` does the
   * "expired? reset : accumulate" branch atomically, at the database, so two
   * concurrent hits are still exactly two hits.
   */
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    const now = this.now();
    const nowText = stamp(now);
    const freshResetAt = stamp(now + this.deps.windowMs);

    const rows = await this.sql<Array<{ hits: number; resetAt: string }>>`
      INSERT INTO rate_limit_hits (limiter, client_key, hits, reset_at)
      VALUES (${this.limiter}, ${key}, 1, ${freshResetAt})
      ON CONFLICT (limiter, client_key) DO UPDATE SET
        hits = CASE
          WHEN rate_limit_hits.reset_at <= ${nowText} THEN 1
          ELSE rate_limit_hits.hits + 1
        END,
        reset_at = CASE
          WHEN rate_limit_hits.reset_at <= ${nowText} THEN ${freshResetAt}
          ELSE rate_limit_hits.reset_at
        END
      RETURNING hits, reset_at as "resetAt"
    `;

    const row = rows[0]!;
    return { totalHits: row.hits, resetTime: new Date(row.resetAt) };
  }

  /**
   * Un-counts one hit — used by `skipSuccessfulRequests` / `skipFailedRequests`
   * to give back a hit that `increment` charged before the outcome of the
   * request was known. Floored at 0: a request that arrives after the window
   * has already rolled over (and been zeroed by the next `increment`) must not
   * push the new window negative.
   *
   * Known imprecision, not unique to this store: `decrement(key)` receives no
   * way to identify WHICH window's hit to undo, only `key`. If a request
   * takes longer than the window (`mediaFetchRateLimiter`'s own fetch timeout
   * is 30 minutes against this file's 15-minute window — see
   * `security.middleware.ts`), the window can roll over before that request's
   * outcome is known, and this un-counts whatever the CURRENT window's hits
   * happen to be, which may by then belong to a different, unrelated request.
   * Checked express-rate-limit's own `MemoryStore.decrement` (its dist
   * bundle) to confirm this is not a defect this store introduces: it has
   * the identical limitation, for the identical reason — the `Store`
   * interface's `decrement(key)` signature carries no window identity for
   * any implementation to check against.
   */
  async decrement(key: string): Promise<void> {
    await this.sql`
      UPDATE rate_limit_hits
         SET hits = GREATEST(hits - 1, 0)
       WHERE limiter = ${this.limiter} AND client_key = ${key}
    `;
  }

  /** Clears a client's counter entirely, e.g. via the middleware's `resetKey`. */
  async resetKey(key: string): Promise<void> {
    await this.sql`
      DELETE FROM rate_limit_hits
       WHERE limiter = ${this.limiter} AND client_key = ${key}
    `;
  }
}
