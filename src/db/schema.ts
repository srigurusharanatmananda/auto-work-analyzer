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
 * ## The trap in `text` timestamps
 *
 * Because timestamps are `text`, `WHERE ts < $cutoff` is a STRING comparison. It
 * gives the right answer only while every writer uses the SAME format, and two
 * are in play that do not sort together:
 *
 *   JS  `new Date().toISOString()`     -> "2026-08-06T14:45:00.000Z"
 *   SQL `(now() at time zone 'utc')`   -> "2026-08-06 14:45:00.123456"
 *
 * `' '` (0x20) sorts before `'T'` (0x54), so a space-separated value compares as
 * older than ANY T-separated one, whatever the real instants are. This already
 * bit `transcription_jobs.claimed_at`: it made every running job look abandoned
 * and eligible for re-claim, i.e. two workers on the same audio.
 *
 * The auth columns (`refresh_tokens.expires_at`, `login_attempts.attempted_at`,
 * `token_blacklist.expires_at`) are correct today **only** because they are
 * written from JS and compared against JS values. Do not give them a SQL default
 * without also fixing their comparisons — token expiry and brute-force lockout
 * both depend on them.
 *
 * When comparing, cast: `ts::timestamp < (now() at time zone 'utc') - interval`.
 * Tightening these columns to `timestamptz` removes the hazard altogether and is
 * the right next migration.
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

/**
 * The owner of a `processed_commits` row that predates per-user scoping.
 *
 * Rows written before that change record only "somebody filed this commit", and
 * there is no way to recover who. Treating them as unowned would make every
 * user's next scan re-file the entire history — hundreds of duplicate ClickUp
 * tasks — so they are owned by everybody instead: this sentinel counts as
 * processed for whoever asks.
 *
 * A sentinel rather than NULL because it has to work in a composite primary
 * key, and Postgres treats NULLs as distinct there, which would allow the same
 * hash to be inserted as unowned any number of times.
 */
export const LEGACY_COMMIT_OWNER = '*';

export const processedCommits = pgTable(
  'processed_commits',
  {
    /**
     * Identity is (user_id, hash), NOT the hash alone.
     *
     * Two clones of one repository still dedup against each other for the same
     * user — `project_path` is provenance, not part of the key. But two
     * different people analysing the same repository each get their own ledger,
     * because "already filed" is a statement about someone's ClickUp list, and
     * one user's list having a task says nothing about another's.
     */
    hash: text('hash').notNull(),
    /** Owner, or `LEGACY_COMMIT_OWNER` for rows written before scoping. */
    userId: text('user_id').notNull().default(LEGACY_COMMIT_OWNER),
    date: text('date').notNull(),
    author: text('author').notNull(),
    message: text('message').notNull(),
    projectPath: text('project_path').notNull(),
    processedAt: text('processed_at').notNull(),
    taskId: text('task_id'),
    taskName: text('task_name'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.hash] }),
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

/**
 * One row per (user, day) of scanning work, claimed before the scan starts.
 *
 * `ScanScheduler` is an in-process `setInterval`, and its only guard against
 * running twice is `if (this.timer) return` — which is per process. Two server
 * instances, or a restart that overlaps the old process, means two schedulers
 * both deciding the same day is due. They then both call `DailyScanner.run`,
 * and because dedup is a `SELECT 1 FROM processed_commits` followed by an
 * `INSERT ... ON CONFLICT`, both read nothing, **both create the ClickUp
 * tasks**, and only then does one of the writes lose. `ON CONFLICT` protects
 * the row; it does not un-create a task in someone's real workspace.
 *
 * So the claim has to happen before the work, not after. This table is that
 * claim, at the granularity the work actually has: a single day for a single
 * user.
 */
export const scanLeases = pgTable(
  'scan_leases',
  {
    userId: text('user_id').notNull(),
    /** "YYYY-MM-DD" — the day being scanned, not when it was claimed. */
    scanDate: text('scan_date').notNull(),
    /** Which process holds it. Only the holder may finish or release it. */
    owner: text('owner').notNull(),
    /**
     * When the claim goes stale.
     *
     * Refreshed while the scan runs, exactly as `TranscriptionJobStore` does
     * with `claimed_at`. Without the refresh a scan slower than the timeout
     * gets its lease stolen mid-flight, which recreates the duplicate this
     * table exists to prevent — and does it only under load, which is the worst
     * time to find out.
     */
    expiresAt: text('expires_at').notNull(),
    /**
     * Set when the day finished. A completed lease is never reclaimed.
     *
     * The row deliberately outlives the work. Deleting it on success would
     * reopen a narrow race: a second scheduler that computed its due-dates
     * before the first finished still has that date in hand, and would find
     * nothing standing in its way. `lastCompletedDate` does not close this —
     * the second process read it too early.
     */
    completedAt: text('completed_at'),
  },
  (table) => [primaryKey({ columns: [table.userId, table.scanDate] })]
);

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

/**
 * Transcription jobs: audio in, transcript out, asynchronously.
 *
 * A queue in Postgres rather than Redis/BullMQ, which is what
 * call-intelligence-system used. The reasoning is measured against what the work
 * actually costs: Whisper takes minutes, so job pickup latency is under 0.2% of
 * end-to-end time, and `LISTEN/NOTIFY` makes pickup ~1ms anyway — the same order
 * as a Redis blocking pop. Redis would be a second datastore to run and another
 * resident process competing for memory, which on an 8 GB machine costs more
 * than the latency it saves.
 *
 * `SELECT ... FOR UPDATE SKIP LOCKED` is what makes this a real queue rather
 * than a table two workers fight over.
 */
export const transcriptionJobs = pgTable(
  'transcription_jobs',
  {
    id: text('id').primaryKey(),
    /**
     * Owner. Not null, unlike `analysis_history.user_id` — every job is created
     * through an authenticated upload, so there is no unowned case to allow for,
     * and a transcript is personal in a way an analysis record is not.
     */
    userId: text('user_id').notNull(),
    /** Absolute path on the host. Must sit under the Whisper storage root. */
    audioPath: text('audio_path').notNull(),
    /** The name the user uploaded, for display. */
    originalFilename: text('original_filename').notNull(),
    /** queued | running | succeeded | failed | cancelled */
    status: text('status').notNull().default('queued'),
    /**
     * Transcript text once finished. Null while running — distinguishable from
     * `''`, which is a real result: a silent recording.
     */
    transcript: text('transcript'),
    /** Segments with timings, as JSON. Kept for future speaker/seek features. */
    segments: text('segments'),
    language: text('language'),
    /** Why it failed, shown to the user. Null unless status = 'failed'. */
    error: text('error'),
    /**
     * Attempts so far. A job that has exhausted its retries is failed for good;
     * without this a crash-looping job would be retried forever, which on a
     * 30-minute task means the queue never drains.
     */
    attempts: integer('attempts').notNull().default(0),
    /**
     * Set when a worker claims the job, cleared when it finishes. A row that is
     * `running` with a stale `claimedAt` was orphaned by a crashed worker and is
     * reclaimable — the only way to recover work that a process death
     * interrupted.
     */
    claimedAt: text('claimed_at'),
    /** Progress, for the UI: how many segments have arrived so far. */
    segmentsSeen: integer('segments_seen').notNull().default(0),
    callTitle: text('call_title'),
    callDate: text('call_date'),
    /**
     * The extracted action items, as JSON, cached the first time the sweep runs.
     *
     * Cached because extraction is a model call and is NOT deterministic: a
     * re-run produces a different set of items, so "have I already filed this
     * one?" would be unanswerable. Freezing the extraction is what makes
     * `createdItemIndexes` mean anything — and it also means a retry after a
     * partial failure costs nothing.
     */
    actionItems: text('action_items'),
    /**
     * Indexes into `actionItems` that reached ClickUp, as a JSON array.
     *
     * Per-item rather than a single "done" flag because a sweep can partially
     * fail — three tasks created, two rejected by the list. Marking the whole
     * job done would lose the two; marking nothing would duplicate the three.
     */
    createdItemIndexes: text('created_item_indexes'),
    /** Set once every action item has been filed. The dedup guard for re-runs. */
    sweptAt: text('swept_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(now() at time zone 'utc')::text`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(now() at time zone 'utc')::text`),
  },
  (table) => [
    index('idx_transcription_user').on(table.userId),
    // The claim query's index: find the oldest queued row.
    index('idx_transcription_status_created').on(table.status, table.createdAt),
    // The sweep's query: this user's finished, not-yet-swept jobs.
    index('idx_transcription_sweep').on(table.userId, table.status, table.sweptAt),
  ]
);

// ==================== Learning module ====================
// See docs/specs/2026-08-08-learning-module-design.md ("Storage").

/**
 * What has been seen, what is due — per user, per language.
 *
 * `language` is not optional and not a foreign key: this schema has no narrow
 * union column type, so it is plain `text` by house style, holding
 * `'sanskrit' | 'tamil'` (see `src/learn/Transliterator.ts`'s `Language`
 * type) enforced by the application, not the database. It exists on this
 * table specifically because the spec calls out that Sanskrit and Tamil
 * progress must never mix — a learner working through Sanskrit must not
 * silently advance Tamil lessons of the same id, which is why the unique
 * index below includes it rather than keying on (userId, lessonId) alone.
 *
 * `id` is a hash of (userId, language, lessonId) — see `Progress.ts`'s
 * `progressId` — rather than a generated uuid, so a lookup by identity is a
 * primary-key lookup with no extra round trip. A plain separator-joined
 * string was considered and rejected: none of the three fields is guaranteed
 * not to contain the separator, which is exactly the collision `AudioCache`
 * hashes its key to avoid. Never try to reconstruct it; the three columns it
 * is derived from are on the row already.
 */
export const learnProgress = pgTable(
  'learn_progress',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** 'sanskrit' | 'tamil'. See the column comment above for why this is text. */
    language: text('language').notNull(),
    lessonId: text('lesson_id').notNull(),
    firstSeenAt: text('first_seen_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    timesCorrect: integer('times_correct').notNull().default(0),
  },
  (table) => [
    // One progress row per lesson, per learner, per language — this is what
    // recordSeen's upsert conflicts on.
    uniqueIndex('idx_learn_progress_identity').on(table.userId, table.language, table.lessonId),
    // "What is due for this language" (Curriculum.nextLesson's seen-set) is
    // the query shape this table exists to answer.
    index('idx_learn_progress_user_language').on(table.userId, table.language),
  ]
);

/**
 * Cache bookkeeping for synthesised audio — NOT the audio itself, which lives
 * on disk under `storage/` and is owned entirely by `src/learn/AudioCache.ts`.
 * This table only records what exists, so the app can list or expire cache
 * entries without touching the filesystem. Deliberately decoupled from
 * `AudioCache.ts`: nothing here imports it and nothing there imports this.
 *
 * `id` is the cache key — the same one `AudioCache` derives from
 * (text, voice, prosody) — kept minimal per the spec: enough to know what
 * exists without duplicating audio bytes.
 */
export const learnAudioCache = pgTable('learn_audio_cache', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  voice: text('voice').notNull(),
  prosody: text('prosody').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(now() at time zone 'utc')::text`),
});
