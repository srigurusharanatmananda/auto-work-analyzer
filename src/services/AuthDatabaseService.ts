/**
 * Users, refresh tokens, the JTI blacklist, login attempts and user settings.
 *
 * Two things this file used to rely on that Postgres spells differently, and
 * both are security-relevant rather than cosmetic:
 *
 *  - **Case-insensitive email.** SQLite had `COLLATE NOCASE` on the column and
 *    on the lookups. Postgres has a unique index on `lower(email)` (see the
 *    migration) and every read here lowercases before comparing. If that were
 *    dropped, `Alice@example.com` and `alice@example.com` would become two
 *    accounts — a login bypass by registration rather than an inconvenience.
 *  - **`INSERT OR IGNORE` for the blacklist.** Re-blacklisting an already
 *    revoked jti must be a no-op, not a primary-key error; a logout that throws
 *    would leave a token live.
 *
 * Booleans are real booleans now: is_active, email_verified, revoked and
 * success were 0/1 integers, and `Boolean(row.is_active)` on a Postgres boolean
 * still works, so the mapping is kept but no longer load-bearing.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user';
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  failed_login_attempts: number;
  locked_until?: string;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked: boolean;
  revoked_at?: string;
  user_agent?: string;
  ip_address?: string;
}

export interface TokenBlacklistRecord {
  jti: string;
  token_type: 'access' | 'refresh';
  expires_at: string;
  blacklisted_at: string;
  reason?: string;
}

export interface LoginAttemptRecord {
  id: string;
  email: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  attempted_at: string;
  failure_reason?: string;
}

export interface UserSettingsRecord {
  user_id: string;
  default_assignee?: string;
  backend_url?: string;
  clickup_api_key?: string;
  clickup_team_id?: string;
  clickup_list_id?: string;
  updated_at: string;
}

function toUser(row: Record<string, unknown>): UserRecord {
  return {
    ...(row as unknown as UserRecord),
    is_active: Boolean(row.is_active),
    email_verified: Boolean(row.email_verified),
  };
}

export class AuthDatabaseService {
  private readonly injected?: PostgresHandle;

  constructor(pg?: PostgresHandle) {
    this.injected = pg;
  }

  /**
   * Resolved on first query, not in the constructor. See DatabaseService: a
   * store must be constructible without a reachable database, and a captured
   * handle would ignore a later `setPool`.
   */
  private get sql() {
    return (this.injected ?? getPool()).sql;
  }

  // ==================== USER OPERATIONS ====================

  async createUser(
    user: Omit<UserRecord, 'created_at' | 'updated_at' | 'failed_login_attempts'>
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.sql`
      INSERT INTO users (
        id, email, password_hash, full_name, role, is_active,
        email_verified, created_at, updated_at, failed_login_attempts
      ) VALUES (
        ${user.id}, ${user.email.toLowerCase()}, ${user.password_hash}, ${user.full_name},
        ${user.role}, ${user.is_active}, ${user.email_verified}, ${now}, ${now}, 0
      )
    `;
  }

  /**
   * Lookup is on `lower(email)` on both sides, matching the unique index. A
   * plain `email = $1` would miss a row stored with different capitalisation
   * and report "no such user" for an account that exists.
   */
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const [row] = await this.sql<Array<Record<string, unknown>>>`
      SELECT * FROM users WHERE lower(email) = ${email.toLowerCase()}
    `;
    return row ? toUser(row) : undefined;
  }

  async getUserById(id: string): Promise<UserRecord | undefined> {
    const [row] = await this.sql<Array<Record<string, unknown>>>`
      SELECT * FROM users WHERE id = ${id}
    `;
    return row ? toUser(row) : undefined;
  }

  /** Every user. Admin-only at the route layer. */
  async getAllUsers(limit: number = 50, offset: number = 0): Promise<UserRecord[]> {
    const rows = await this.sql<Array<Record<string, unknown>>>`
      SELECT * FROM users
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    return rows.map(toUser);
  }

  /**
   * How many active admins exist, and whether this user is one of them.
   *
   * A query rather than a filter over `getAllUsers`, because the caller is
   * deciding whether an action would lock everyone out of the installation.
   * Counting a page answers a different question: past the page size an admin
   * simply becomes invisible, and the guard fails OPEN — it would let you
   * delete the last one.
   */
  async countActiveAdmins(userId: string): Promise<{ total: number; includesUser: boolean }> {
    const [row] = await this.sql<Array<{ total: string; includes_user: boolean }>>`
      SELECT COUNT(*)::text AS total,
             COALESCE(BOOL_OR(id = ${userId}), false) AS includes_user
        FROM users
       WHERE role = 'admin' AND is_active = true
    `;
    return {
      total: Number(row?.total ?? 0),
      includesUser: row?.includes_user === true,
    };
  }

  async updateUserLogin(userId: string, success: boolean): Promise<void> {
    const now = new Date().toISOString();

    if (success) {
      await this.sql`
        UPDATE users
           SET last_login_at = ${now},
               failed_login_attempts = 0,
               locked_until = NULL,
               updated_at = ${now}
         WHERE id = ${userId}
      `;
      return;
    }

    await this.sql`
      UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             updated_at = ${now}
       WHERE id = ${userId}
    `;
  }

  async lockUserAccount(userId: string, lockDurationMinutes: number): Promise<void> {
    const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000).toISOString();
    await this.sql`
      UPDATE users
         SET locked_until = ${lockUntil}, updated_at = ${new Date().toISOString()}
       WHERE id = ${userId}
    `;
  }

  /**
   * A partial update, built from only the fields actually present.
   *
   * `undefined` means "leave alone", so the object is assembled first and
   * handed to postgres.js's helper, which emits `SET col = $n` for exactly the
   * keys given. The previous version concatenated SQL fragments by hand; this
   * cannot produce a mismatched fragment/parameter pair.
   */
  async updateUser(
    userId: string,
    updates: Partial<
      Pick<UserRecord, 'full_name' | 'email' | 'role' | 'is_active' | 'email_verified'>
    >
  ): Promise<void> {
    const patch: Record<string, unknown> = {};

    if (updates.full_name !== undefined) patch.full_name = updates.full_name;
    if (updates.email !== undefined) patch.email = updates.email.toLowerCase();
    if (updates.role !== undefined) patch.role = updates.role;
    if (updates.is_active !== undefined) patch.is_active = updates.is_active;
    if (updates.email_verified !== undefined) patch.email_verified = updates.email_verified;

    if (Object.keys(patch).length === 0) return;

    patch.updated_at = new Date().toISOString();

    await this.sql`
      UPDATE users SET ${this.sql(patch, ...Object.keys(patch))} WHERE id = ${userId}
    `;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.sql`
      UPDATE users
         SET password_hash = ${passwordHash}, updated_at = ${new Date().toISOString()}
       WHERE id = ${userId}
    `;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.sql`DELETE FROM users WHERE id = ${userId}`;
  }

  // ==================== REFRESH TOKEN OPERATIONS ====================

  async storeRefreshToken(
    token: Omit<RefreshTokenRecord, 'created_at' | 'revoked' | 'revoked_at'>
  ): Promise<void> {
    await this.sql`
      INSERT INTO refresh_tokens (
        id, user_id, token_hash, expires_at, created_at, revoked, user_agent, ip_address
      ) VALUES (
        ${token.id}, ${token.user_id}, ${token.token_hash}, ${token.expires_at},
        ${new Date().toISOString()}, false,
        ${token.user_agent ?? null}, ${token.ip_address ?? null}
      )
    `;
  }

  async getRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const [row] = await this.sql<Array<Record<string, unknown>>>`
      SELECT * FROM refresh_tokens WHERE token_hash = ${tokenHash}
    `;
    if (!row) return undefined;

    return {
      ...(row as unknown as RefreshTokenRecord),
      revoked: Boolean(row.revoked),
    };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens
         SET revoked = true, revoked_at = ${new Date().toISOString()}
       WHERE token_hash = ${tokenHash}
    `;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens
         SET revoked = true, revoked_at = ${new Date().toISOString()}
       WHERE user_id = ${userId}
    `;
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date().toISOString();
    await this.sql`DELETE FROM refresh_tokens WHERE expires_at < ${now}`;
    await this.sql`DELETE FROM token_blacklist WHERE expires_at < ${now}`;
  }

  // ==================== TOKEN BLACKLIST OPERATIONS ====================

  /**
   * SQLite's `INSERT OR IGNORE`. Re-blacklisting an already-revoked jti has to
   * be a no-op: a logout that threw on the second call would leave the token
   * live and report an error the caller cannot act on.
   */
  async blacklistToken(
    jti: string,
    tokenType: 'access' | 'refresh',
    expiresAt: string,
    reason?: string
  ): Promise<void> {
    await this.sql`
      INSERT INTO token_blacklist (jti, token_type, expires_at, blacklisted_at, reason)
      VALUES (${jti}, ${tokenType}, ${expiresAt}, ${new Date().toISOString()}, ${reason ?? null})
      ON CONFLICT (jti) DO NOTHING
    `;
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const rows = await this.sql`SELECT 1 FROM token_blacklist WHERE jti = ${jti}`;
    return rows.length > 0;
  }

  // ==================== LOGIN ATTEMPTS OPERATIONS ====================

  async logLoginAttempt(attempt: Omit<LoginAttemptRecord, 'id' | 'attempted_at'>): Promise<void> {
    await this.sql`
      INSERT INTO login_attempts (
        id, email, ip_address, user_agent, success, attempted_at, failure_reason
      ) VALUES (
        ${randomUUID()}, ${attempt.email.toLowerCase()}, ${attempt.ip_address},
        ${attempt.user_agent ?? null}, ${attempt.success}, ${new Date().toISOString()},
        ${attempt.failure_reason ?? null}
      )
    `;
  }

  async getRecentFailedAttempts(email: string, minutesAgo: number): Promise<number> {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const [row] = await this.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
        FROM login_attempts
       WHERE lower(email) = ${email.toLowerCase()}
         AND success = false
         AND attempted_at > ${since}
    `;
    return row!.count;
  }

  async getRecentFailedAttemptsByIP(ipAddress: string, minutesAgo: number): Promise<number> {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const [row] = await this.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
        FROM login_attempts
       WHERE ip_address = ${ipAddress}
         AND success = false
         AND attempted_at > ${since}
    `;
    return row!.count;
  }

  // ==================== USER SETTINGS ====================

  async getUserSettings(userId: string): Promise<UserSettingsRecord | null> {
    const [row] = await this.sql<UserSettingsRecord[]>`
      SELECT * FROM user_settings WHERE user_id = ${userId}
    `;
    return row ?? null;
  }

  /**
   * One upsert instead of a read followed by a branch.
   *
   * The read-then-insert-or-update version had a race: two concurrent saves for
   * a new user both saw "no row" and both inserted, and the second failed on
   * the primary key.
   *
   * Only the keys actually supplied are written, on both legs. That preserves
   * the previous semantics exactly, including the part that is easy to lose: a
   * caller passing `null` for a field is *clearing* it, and a caller omitting
   * the field entirely is leaving it alone. Writing this as
   * `COALESCE(new, existing)` would collapse those two into one and make
   * clearing a setting silently do nothing.
   */
  async upsertUserSettings(
    userId: string,
    settings: Partial<Omit<UserSettingsRecord, 'user_id' | 'updated_at'>>
  ): Promise<void> {
    const COLUMNS = [
      'default_assignee',
      'backend_url',
      'clickup_api_key',
      'clickup_team_id',
      'clickup_list_id',
    ] as const;

    const now = new Date().toISOString();
    const supplied = COLUMNS.filter((column) => settings[column] !== undefined);

    const row: Record<string, unknown> = { user_id: userId, updated_at: now };
    for (const column of supplied) row[column] = settings[column] ?? null;

    // Nothing to change but the timestamp: still an upsert, so a first save
    // with no fields creates the row rather than doing nothing.
    const updateColumns = [...supplied, 'updated_at'];

    await this.sql`
      INSERT INTO user_settings ${this.sql(row, 'user_id', ...supplied, 'updated_at')}
      ON CONFLICT (user_id) DO UPDATE SET ${this.sql(row, ...updateColumns)}
    `;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared, so a store closing it
   * would disconnect the rest of the process.
   */
  close(): void {}
}
