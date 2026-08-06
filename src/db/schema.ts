/**
 * The Postgres schema, as Drizzle definitions.
 *
 * This is a *faithful* translation of the SQLite schema, not an improved one.
 * Timestamps stay `text` holding ISO-8601 strings, and `task_templates.options`
 * stays `text` holding JSON, because both are what the application currently
 * reads and writes. Changing a column's type and moving 900-odd rows in the
 * same step gives you no way to tell a mapping bug from a copy bug, and the
 * failure mode is silently wrong data rather than a crash.
 *
 * The point of this step is the mechanism: a real migration path, generated and
 * applied by drizzle-kit, replacing `CREATE TABLE IF NOT EXISTS` scattered
 * across each store — a pattern under which adding a column to an existing
 * database is silently a no-op. Once that exists, tightening `text` to
 * `timestamptz` and `jsonb` is a migration with a test, which is exactly what
 * it should be.
 *
 * Two SQLite behaviours have no direct Postgres equivalent and are handled
 * explicitly:
 *
 *  - `users.email TEXT COLLATE NOCASE` with a UNIQUE constraint. Postgres has
 *    no per-column collation of that kind without the `citext` extension, so
 *    uniqueness is enforced by a unique index on `lower(email)` and lookups
 *    must compare `lower(email)`. A plain UNIQUE(email) would let
 *    `A@b.com` and `a@b.com` both exist — two accounts for one address.
 *  - `INTEGER NOT NULL DEFAULT 0/1` booleans become real `boolean` columns.
 *    Safe for the reading code, which already normalises via `Boolean(row.x)`;
 *    that yields the same result for `true` as it did for `1`.
 */
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==================== Identity ====================

export const users = pgTable(
  'users',
  {
    // Text rather than `uuid`: these are uuid strings today, but the column is
    // referenced by other stores as an opaque id and the call system's rows
    // will be re-keyed into it. Keeping it text avoids a cast at every join
    // during that move.
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastLoginAt: text('last_login_at'),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
  },
  (table) => [
    // Replaces SQLite's `UNIQUE ... COLLATE NOCASE`. Without the lower(), two
    // accounts could exist for the same address in different case.
    uniqueIndex('idx_users_email_lower').on(sql`lower(${table.email})`),
    index('idx_users_role').on(table.role),
    index('idx_users_active').on(table.isActive),
    check('users_role_check', sql`${table.role} IN ('admin', 'manager', 'user')`),
  ]
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    revoked: boolean('revoked').notNull().default(false),
    revokedAt: text('revoked_at'),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
  },
  (table) => [
    index('idx_refresh_tokens_user').on(table.userId),
    index('idx_refresh_tokens_expires').on(table.expiresAt),
  ]
);

export const tokenBlacklist = pgTable(
  'token_blacklist',
  {
    jti: text('jti').primaryKey(),
    tokenType: text('token_type').notNull(),
    expiresAt: text('expires_at').notNull(),
    blacklistedAt: text('blacklisted_at').notNull(),
    reason: text('reason'),
  },
  (table) => [
    index('idx_blacklist_expires').on(table.expiresAt),
    check('token_blacklist_type_check', sql`${table.tokenType} IN ('access', 'refresh')`),
  ]
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent'),
    success: boolean('success').notNull(),
    attemptedAt: text('attempted_at').notNull(),
    failureReason: text('failure_reason'),
  },
  (table) => [
    index('idx_login_attempts_email').on(table.email, table.attemptedAt),
    index('idx_login_attempts_ip').on(table.ipAddress, table.attemptedAt),
  ]
);

export const userSettings = pgTable(
  'user_settings',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    defaultAssignee: text('default_assignee'),
    backendUrl: text('backend_url'),
    // Legacy plaintext key column. Migration 002 moved these into
    // clickup_destinations.api_key_encrypted; it is carried across so the
    // move is not undone by the port, and is not read on any live path.
    clickupApiKey: text('clickup_api_key'),
    clickupTeamId: text('clickup_team_id'),
    clickupListId: text('clickup_list_id'),
    updatedAt: text('updated_at').notNull(),
  }
);

// ==================== Analyses ====================

export const analysisHistory = pgTable(
  'analysis_history',
  {
    id: text('id').primaryKey(),
    /**
     * Null means unowned: rows written before this column existed, and rows
     * written by the secret-authenticated webhook, which has no session. Shown
     * to admins only. No foreign key, deliberately — deleting a user must not
     * cascade away the record that work was done.
     */
    userId: text('user_id'),
    timestamp: text('timestamp').notNull(),
    projectPath: text('project_path').notNull(),
    date: text('date').notNull(),
    endDate: text('end_date'),
    author: text('author'),
    branch: text('branch'),
    totalCommits: integer('total_commits').notNull(),
    totalWorkItems: integer('total_work_items').notNull(),
    tasksCreated: integer('tasks_created').notNull(),
    summary: text('summary').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(now() at time zone 'utc')::text`),
  },
  (table) => [
    index('idx_analysis_user').on(table.userId),
    index('idx_analysis_timestamp').on(table.timestamp),
    index('idx_analysis_project').on(table.projectPath),
  ]
);

export const workItems = pgTable(
  'work_items',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisHistory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    description: text('description'),
    estimatedHours: real('estimated_hours').notNull().default(0),
    complexity: integer('complexity').notNull().default(0),
    filesCount: integer('files_count').notNull().default(0),
    commitsCount: integer('commits_count').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(now() at time zone 'utc')::text`),
  },
  (table) => [index('idx_work_items_analysis').on(table.analysisId)]
);

export const processedCommits = pgTable(
  'processed_commits',
  {
    /**
     * The hash alone is the identity, deliberately and across all users and
     * clones: one commit becomes one task, whichever clone observed it.
     * `project_path` is provenance, not part of the key. Scoping this per user
     * would change dedup semantics, so it stays global.
     */
    hash: text('hash').primaryKey(),
    date: text('date').notNull(),
    author: text('author').notNull(),
    message: text('message').notNull(),
    projectPath: text('project_path').notNull(),
    processedAt: text('processed_at').notNull(),
    taskId: text('task_id'),
    taskName: text('task_name'),
  },
  (table) => [
    index('idx_processed_commits_project').on(table.projectPath),
    index('idx_processed_commits_date').on(table.date),
  ]
);

// ==================== Configuration ====================

export const taskTemplates = pgTable(
  'task_templates',
  {
    id: text('id').primaryKey(),
    /** Null for the built-ins, which are visible to everyone. */
    userId: text('user_id'),
    name: text('name').notNull(),
    description: text('description'),
    nameTemplate: text('name_template').notNull(),
    descriptionTemplate: text('description_template').notNull(),
    /** JSON, as text. See the note at the top of this file. */
    options: text('options').notNull(),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_templates_user').on(table.userId)]
);

export const clickupDestinations = pgTable(
  'clickup_destinations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    /** AES-256-GCM ciphertext. Never logged, never returned over HTTP. */
    apiKeyEncrypted: text('api_key_encrypted').notNull(),
    teamId: text('team_id').notNull(),
    teamName: text('team_name'),
    spaceId: text('space_id'),
    spaceName: text('space_name'),
    folderId: text('folder_id'),
    folderName: text('folder_name'),
    listId: text('list_id').notNull(),
    listName: text('list_name'),
    defaultTemplateId: text('default_template_id'),
    defaultAssignee: text('default_assignee'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_destinations_user').on(table.userId)]
);

// ==================== Org-wide scanning ====================

export const scanSettings = pgTable('scan_settings', {
  userId: text('user_id').primaryKey(),
  root: text('root').notNull(),
  owner: text('owner').notNull(),
  /** JSON array of author identities, as text. */
  authorIdentities: text('author_identities').notNull(),
  /** "HH:MM" local time, not a timestamp. */
  scanTime: text('scan_time').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  lastCompletedDate: text('last_completed_date'),
});

export const scanRuns = pgTable('scan_runs', {
  userId: text('user_id').primaryKey(),
  ranAt: text('ran_at').notNull(),
  /** JSON summary of the last run, as text. */
  summary: text('summary').notNull(),
});

export const scannedRepos = pgTable(
  'scanned_repos',
  {
    userId: text('user_id').notNull(),
    slug: text('slug').notNull(),
    destinationId: text('destination_id'),
    templateId: text('template_id'),
    enabled: boolean('enabled').notNull().default(true),
    lastScannedDate: text('last_scanned_date'),
  },
  (table) => [primaryKey({ columns: [table.userId, table.slug] })]
);

/**
 * The old bookkeeping table for the hand-rolled data-migration runner.
 *
 * Carried across so a migrated database does not re-run migration 002 (which
 * moved plaintext ClickUp keys into encrypted storage) and so the runner
 * continues to work during the transition. Drizzle keeps its own journal in
 * `__drizzle_migrations`; the two are independent and both are needed until the
 * hand-rolled runner is retired.
 */
export const schemaMigrations = pgTable('schema_migrations', {
  id: text('id').primaryKey(),
  appliedAt: text('applied_at').notNull(),
});
