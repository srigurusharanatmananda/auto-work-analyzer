/**
 * "Am I the one scanning this day for this user?"
 *
 * Every scan that reaches ClickUp goes through here first. The reason is in the
 * `scan_leases` schema comment and worth repeating in one line: two schedulers
 * both deciding a day is due will *both* create the tasks, because dedup reads
 * `processed_commits` before either has written to it. The claim therefore has
 * to precede the work.
 *
 * ## Why not an advisory lock
 *
 * `pg_advisory_lock` is the obvious reach, and it is wrong here twice over. It
 * is session-scoped, and the connection comes from a pool, so the lock belongs
 * to whichever pooled connection happened to serve the call and is released the
 * moment that connection is recycled — not when the scan ends. The transaction
 * variant fixes the ownership but requires holding a transaction open for the
 * whole scan, which for a run measured in minutes means a connection pinned and
 * a vacuum horizon held back for the duration.
 *
 * A row with an expiry is none of those things, survives a process death, and
 * can be read by a human wondering why a day did not scan.
 */

import { getPool } from "../db/pool.js";
import type { PostgresHandle } from "../db/client.js";

/**
 * How long a claim survives without a refresh.
 *
 * Shorter than `STALE_CLAIM_MS` in `TranscriptionJobStore` because a scan is
 * minutes where a Whisper run can be tens of them, and a shorter timeout means
 * a crashed process blocks its day for less time. It only has to outlast the
 * gap between heartbeats, not the scan itself.
 */
export const LEASE_TTL_MS = 5 * 60 * 1000;

/** How often a holder refreshes while working. Comfortably inside the TTL. */
export const HEARTBEAT_MS = 60 * 1000;

/** UTC ISO, matching the text timestamps the rest of the schema stores. */
function stamp(at: number): string {
  return new Date(at).toISOString();
}

export interface ScanLeaseStoreDeps {
  sql?: PostgresHandle;
  /** Injected so tests can drive expiry without waiting. */
  now?: () => number;
  ttlMs?: number;
}

export class ScanLeaseStore {
  constructor(private readonly deps: ScanLeaseStoreDeps = {}) {}

  private get sql() {
    return (this.deps.sql ?? getPool()).sql;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private get ttlMs(): number {
    return this.deps.ttlMs ?? LEASE_TTL_MS;
  }

  /**
   * Takes the day if it is free, and says so. Never waits.
   *
   * One statement, because two — a SELECT then an INSERT — is the very race
   * this exists to close. The `ON CONFLICT ... WHERE` is what makes it atomic:
   * an existing row is overwritten only when it is both unfinished and expired,
   * and when that test fails the statement returns no rows rather than
   * blocking. Returning false is the normal, expected outcome on the loser.
   */
  async claim(userId: string, scanDate: string, owner: string): Promise<boolean> {
    const now = this.now();
    const expiresAt = stamp(now + this.ttlMs);
    const nowText = stamp(now);

    const rows = await this.sql<Array<{ owner: string }>>`
      INSERT INTO scan_leases (user_id, scan_date, owner, expires_at, completed_at)
      VALUES (${userId}, ${scanDate}, ${owner}, ${expiresAt}, NULL)
      ON CONFLICT (user_id, scan_date) DO UPDATE
         SET owner = EXCLUDED.owner,
             expires_at = EXCLUDED.expires_at
       WHERE scan_leases.completed_at IS NULL
         AND scan_leases.expires_at < ${nowText}
      RETURNING owner
    `;

    return rows.length > 0;
  }

  /**
   * Pushes the expiry out. Called on a timer while the scan runs.
   *
   * Scoped to the owner, so a process whose lease was already stolen — it
   * overran the TTL — cannot reach in and extend someone else's claim. It
   * simply fails to refresh, which is the correct outcome for a holder that is
   * no longer the holder.
   */
  async heartbeat(userId: string, scanDate: string, owner: string): Promise<boolean> {
    const rows = await this.sql<Array<{ owner: string }>>`
      UPDATE scan_leases
         SET expires_at = ${stamp(this.now() + this.ttlMs)}
       WHERE user_id = ${userId}
         AND scan_date = ${scanDate}
         AND owner = ${owner}
         AND completed_at IS NULL
      RETURNING owner
    `;
    return rows.length > 0;
  }

  /** Marks the day done. A completed lease is never reclaimed by anyone. */
  async complete(userId: string, scanDate: string, owner: string): Promise<void> {
    await this.sql`
      UPDATE scan_leases
         SET completed_at = ${stamp(this.now())}
       WHERE user_id = ${userId}
         AND scan_date = ${scanDate}
         AND owner = ${owner}
    `;
  }

  /**
   * Gives the day back after a failure, so the next tick retries it.
   *
   * Deleted rather than marked failed: a failed day is not a record anyone
   * consults, and leaving it behind would mean the retry path has to reason
   * about reclaiming a row it also has to distinguish from a completed one.
   * The scan's own error is already logged and surfaced by `saveRun`.
   */
  async release(userId: string, scanDate: string, owner: string): Promise<void> {
    await this.sql`
      DELETE FROM scan_leases
       WHERE user_id = ${userId}
         AND scan_date = ${scanDate}
         AND owner = ${owner}
         AND completed_at IS NULL
    `;
  }

  /**
   * Runs `work` only if this process wins the day.
   *
   * The heartbeat and the release are the parts that are easy to forget, and
   * forgetting either is silent — a missed release blocks the day until the TTL
   * lapses, a missed heartbeat lets a long scan be stolen and duplicated. So
   * neither is left to the caller.
   *
   * Returns false when another process holds the day, which is not an error.
   */
  async withLease(
    userId: string,
    scanDate: string,
    owner: string,
    work: () => Promise<void>
  ): Promise<boolean> {
    if (!(await this.claim(userId, scanDate, owner))) return false;

    const beat = setInterval(() => {
      void this.heartbeat(userId, scanDate, owner).catch((error) => {
        console.warn(
          `Could not refresh the scan lease for ${userId} ${scanDate}:`,
          error instanceof Error ? error.message : error
        );
      });
    }, HEARTBEAT_MS);
    beat.unref?.();

    try {
      await work();
      await this.complete(userId, scanDate, owner);
    } catch (error) {
      await this.release(userId, scanDate, owner).catch((): void => {});
      throw error;
    } finally {
      clearInterval(beat);
    }

    return true;
  }
}
