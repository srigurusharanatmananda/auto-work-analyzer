/**
 * Authentication Database Service
 * Extends DatabaseService with user authentication tables
 * Following OWASP 2025 security best practices
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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

export class AuthDatabaseService {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Create .database directory if it doesn't exist
    const dbDir = path.join(process.cwd(), '.database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = dbPath || path.join(dbDir, 'auto-work-analyzer.db');
    this.db = new Database(this.dbPath);

    // Enable foreign keys and WAL mode for better concurrency
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');

    this.initializeAuthTables();
  }

  /**
   * Initialize authentication tables
   */
  private initializeAuthTables(): void {
    // Users table
    this.db.exec(`
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

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
    `);

    // Refresh tokens table
    this.db.exec(`
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

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    `);

    // Token blacklist table (for logout and token revocation)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        jti TEXT PRIMARY KEY,
        token_type TEXT NOT NULL CHECK(token_type IN ('access', 'refresh')),
        expires_at TEXT NOT NULL,
        blacklisted_at TEXT NOT NULL,
        reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist(expires_at);
    `);

    // Login attempts table (for rate limiting and security monitoring)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        success INTEGER NOT NULL,
        attempted_at TEXT NOT NULL,
        failure_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, attempted_at);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
    `);

    // User settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        default_assignee TEXT,
        backend_url TEXT,
        clickup_api_key TEXT,
        clickup_team_id TEXT,
        clickup_list_id TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
    `);

    // Create default admin user if no users exist
    this.createDefaultAdminIfNeeded();
  }

  /**
   * Create default admin user if database is empty
   */
  private createDefaultAdminIfNeeded(): void {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    if (count.count === 0) {
      console.log('⚠️  No users found. Default admin user will be created on first server start.');
      console.log('    You should change the default password immediately after first login!');
    }
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Create a new user
   */
  createUser(user: Omit<UserRecord, 'created_at' | 'updated_at' | 'failed_login_attempts'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, role, is_active,
        email_verified, created_at, updated_at, failed_login_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const now = new Date().toISOString();
    stmt.run(
      user.id,
      user.email.toLowerCase(),
      user.password_hash,
      user.full_name,
      user.role,
      user.is_active ? 1 : 0,
      user.email_verified ? 1 : 0,
      now,
      now
    );
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): UserRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE email = ? COLLATE NOCASE
    `);

    const row = stmt.get(email.toLowerCase()) as any;
    if (!row) return undefined;

    return {
      ...row,
      is_active: Boolean(row.is_active),
      email_verified: Boolean(row.email_verified),
    };
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): UserRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;

    return {
      ...row,
      is_active: Boolean(row.is_active),
      email_verified: Boolean(row.email_verified),
    };
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers(limit: number = 50, offset: number = 0): UserRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(row => ({
      ...row,
      is_active: Boolean(row.is_active),
      email_verified: Boolean(row.email_verified),
    }));
  }

  /**
   * Update user login info
   */
  updateUserLogin(userId: string, success: boolean): void {
    if (success) {
      this.db.prepare(`
        UPDATE users
        SET last_login_at = ?,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), new Date().toISOString(), userId);
    } else {
      this.db.prepare(`
        UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), userId);
    }
  }

  /**
   * Lock user account
   */
  lockUserAccount(userId: string, lockDurationMinutes: number): void {
    const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000).toISOString();
    this.db.prepare(`
      UPDATE users
      SET locked_until = ?,
          updated_at = ?
      WHERE id = ?
    `).run(lockUntil, new Date().toISOString(), userId);
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<Pick<UserRecord, 'full_name' | 'email' | 'role' | 'is_active' | 'email_verified'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.full_name !== undefined) {
      fields.push('full_name = ?');
      values.push(updates.full_name);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email.toLowerCase());
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }
    if (updates.email_verified !== undefined) {
      fields.push('email_verified = ?');
      values.push(updates.email_verified ? 1 : 0);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);

    const stmt = this.db.prepare(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
  }

  /**
   * Update user password
   */
  updateUserPassword(userId: string, passwordHash: string): void {
    this.db.prepare(`
      UPDATE users
      SET password_hash = ?,
          updated_at = ?
      WHERE id = ?
    `).run(passwordHash, new Date().toISOString(), userId);
  }

  /**
   * Delete user
   */
  deleteUser(userId: string): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  // ==================== REFRESH TOKEN OPERATIONS ====================

  /**
   * Store refresh token
   */
  storeRefreshToken(token: Omit<RefreshTokenRecord, 'created_at' | 'revoked' | 'revoked_at'>): void {
    this.db.prepare(`
      INSERT INTO refresh_tokens (
        id, user_id, token_hash, expires_at, created_at, revoked, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      token.id,
      token.user_id,
      token.token_hash,
      token.expires_at,
      new Date().toISOString(),
      token.user_agent,
      token.ip_address
    );
  }

  /**
   * Get refresh token by hash
   */
  getRefreshToken(tokenHash: string): RefreshTokenRecord | undefined {
    const row = this.db.prepare(`
      SELECT * FROM refresh_tokens WHERE token_hash = ?
    `).get(tokenHash) as any;

    if (!row) return undefined;

    return {
      ...row,
      revoked: Boolean(row.revoked),
    };
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(tokenHash: string): void {
    this.db.prepare(`
      UPDATE refresh_tokens
      SET revoked = 1, revoked_at = ?
      WHERE token_hash = ?
    `).run(new Date().toISOString(), tokenHash);
  }

  /**
   * Revoke all user's refresh tokens
   */
  revokeAllUserTokens(userId: string): void {
    this.db.prepare(`
      UPDATE refresh_tokens
      SET revoked = 1, revoked_at = ?
      WHERE user_id = ?
    `).run(new Date().toISOString(), userId);
  }

  /**
   * Clean up expired refresh tokens
   */
  cleanupExpiredTokens(): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      DELETE FROM refresh_tokens WHERE expires_at < ?
    `).run(now);

    this.db.prepare(`
      DELETE FROM token_blacklist WHERE expires_at < ?
    `).run(now);
  }

  // ==================== TOKEN BLACKLIST OPERATIONS ====================

  /**
   * Add token to blacklist
   */
  blacklistToken(jti: string, tokenType: 'access' | 'refresh', expiresAt: string, reason?: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO token_blacklist (jti, token_type, expires_at, blacklisted_at, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(jti, tokenType, expiresAt, new Date().toISOString(), reason);
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(jti: string): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM token_blacklist WHERE jti = ?
    `).get(jti);
    return row !== undefined;
  }

  // ==================== LOGIN ATTEMPTS OPERATIONS ====================

  /**
   * Log login attempt
   */
  logLoginAttempt(attempt: Omit<LoginAttemptRecord, 'id' | 'attempted_at'>): void {
    this.db.prepare(`
      INSERT INTO login_attempts (id, email, ip_address, user_agent, success, attempted_at, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `attempt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      attempt.email.toLowerCase(),
      attempt.ip_address,
      attempt.user_agent,
      attempt.success ? 1 : 0,
      new Date().toISOString(),
      attempt.failure_reason
    );
  }

  /**
   * Get recent failed login attempts
   */
  getRecentFailedAttempts(email: string, minutesAgo: number): number {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM login_attempts
      WHERE email = ? COLLATE NOCASE
        AND success = 0
        AND attempted_at > ?
    `).get(email.toLowerCase(), since) as { count: number };

    return row.count;
  }

  /**
   * Get recent failed attempts by IP
   */
  getRecentFailedAttemptsByIP(ipAddress: string, minutesAgo: number): number {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM login_attempts
      WHERE ip_address = ?
        AND success = 0
        AND attempted_at > ?
    `).get(ipAddress, since) as { count: number };

    return row.count;
  }

  /**
   * Get user settings
   */
  getUserSettings(userId: string): UserSettingsRecord | null {
    const settings = this.db.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `).get(userId) as UserSettingsRecord | undefined;

    return settings || null;
  }

  /**
   * Update or create user settings
   */
  upsertUserSettings(userId: string, settings: Partial<Omit<UserSettingsRecord, 'user_id' | 'updated_at'>>): void {
    const existing = this.getUserSettings(userId);

    if (existing) {
      // Update existing settings
      const updates: string[] = [];
      const values: any[] = [];

      if (settings.default_assignee !== undefined) {
        updates.push('default_assignee = ?');
        values.push(settings.default_assignee);
      }
      if (settings.backend_url !== undefined) {
        updates.push('backend_url = ?');
        values.push(settings.backend_url);
      }
      if (settings.clickup_api_key !== undefined) {
        updates.push('clickup_api_key = ?');
        values.push(settings.clickup_api_key);
      }
      if (settings.clickup_team_id !== undefined) {
        updates.push('clickup_team_id = ?');
        values.push(settings.clickup_team_id);
      }
      if (settings.clickup_list_id !== undefined) {
        updates.push('clickup_list_id = ?');
        values.push(settings.clickup_list_id);
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(userId);

      this.db.prepare(`
        UPDATE user_settings
        SET ${updates.join(', ')}
        WHERE user_id = ?
      `).run(...values);
    } else {
      // Create new settings
      this.db.prepare(`
        INSERT INTO user_settings (
          user_id, default_assignee, backend_url, clickup_api_key, clickup_team_id, clickup_list_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        settings.default_assignee || null,
        settings.backend_url || null,
        settings.clickup_api_key || null,
        settings.clickup_team_id || null,
        settings.clickup_list_id || null,
        new Date().toISOString()
      );
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
