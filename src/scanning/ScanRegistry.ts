/**
 * Scan configuration, per-repository bindings, and the last run's summary.
 *
 * Three tables, one class, because they are always read together and a repo
 * binding is meaningless without the settings that decide when scanning runs.
 *
 * Shaped after DestinationStore: the connection is injected, the schema comes
 * from the migrations, every method is scoped by userId, and `patch` semantics
 * where `undefined` means "leave alone" and `null` means "clear" — a distinction
 * DestinationStore originally got wrong and which silently kept a stale value.
 */

import { homedir } from "os";
import { join } from "path";
import { getPool } from "../db/pool.js";
import type { PostgresHandle } from "../db/client.js";

export interface ScanSettings {
  userId: string;
  root: string;
  owner: string;
  authorIdentities: string[];
  /** "HH:MM", local time. */
  scanTime: string;
  enabled: boolean;
  /** "YYYY-MM-DD" of the last fully completed run. */
  lastCompletedDate?: string;
}

export interface RepoBinding {
  slug: string;
  destinationId?: string;
  templateId?: string;
  enabled: boolean;
  lastScannedDate?: string;
}

interface SettingsRow {
  user_id: string;
  root: string;
  owner: string;
  author_identities: string;
  scan_time: string;
  enabled: boolean;
  last_completed_date: string | null;
}

interface BindingRow {
  user_id: string;
  slug: string;
  destination_id: string | null;
  template_id: string | null;
  enabled: boolean;
  last_scanned_date: string | null;
}


/** Disabled, so nothing is created unattended before the user opts in. */
function defaultSettings(userId: string): ScanSettings {
  return {
    userId,
    root: join(homedir(), "Documents", "GitHub"),
    owner: "kailasa-ngpt",
    authorIdentities: [],
    scanTime: "18:00",
    enabled: false,
  };
}

function toSettings(row: SettingsRow): ScanSettings {
  return {
    userId: row.user_id,
    root: row.root,
    owner: row.owner,
    authorIdentities: JSON.parse(row.author_identities),
    scanTime: row.scan_time,
    enabled: row.enabled,
    lastCompletedDate: row.last_completed_date ?? undefined,
  };
}

function toBinding(row: BindingRow): RepoBinding {
  return {
    slug: row.slug,
    destinationId: row.destination_id ?? undefined,
    templateId: row.template_id ?? undefined,
    enabled: row.enabled,
    lastScannedDate: row.last_scanned_date ?? undefined,
  };
}

/** `undefined` keeps the stored value; `null` clears it. */
function patched<T>(incoming: T | null | undefined, stored: T | undefined): T | undefined {
  if (incoming === undefined) return stored;
  if (incoming === null) return undefined;
  return incoming;
}

export class ScanRegistry {
  private readonly injected?: PostgresHandle;

  constructor(pg?: PostgresHandle) {
    this.injected = pg;
  }

  /**
   * Resolved on first query, not in the constructor.
   *
   * Two reasons, both load-bearing: constructing a store must not require a
   * reachable database (several call sites build one and never query it), and
   * a handle captured at construction would ignore a later `setPool` — which is
   * how the tests point the shared pool at an isolated schema.
   */
  private get sql() {
    return (this.injected ?? getPool()).sql;
  }

  async getSettings(userId: string): Promise<ScanSettings> {
    const [row] = await this.sql<SettingsRow[]>`
      SELECT * FROM scan_settings WHERE user_id = ${userId}
    `;
    return row ? toSettings(row) : defaultSettings(userId);
  }

  async saveSettings(
    userId: string,
    patch: Partial<Omit<ScanSettings, "userId">>
  ): Promise<ScanSettings> {
    // Merged in SQL, not in TypeScript. The read-then-write version lost
    // writes: the scheduler recording `lastCompletedDate` while a user was
    // saving `enabled: false` meant whichever finished second overwrote the
    // other's field with the value it had read before that write existed — a
    // silently re-enabled scan, or a completion date that vanished so the day
    // was scanned again.
    //
    // Each column keeps its stored value unless this patch names it. NULL means
    // "not named", which is why `lastCompletedDate` cannot use COALESCE: null
    // is a meaningful value there (it clears the date), so it needs a separate
    // flag to tell "clear it" apart from "leave it".
    const defaults = defaultSettings(userId);
    const touchLastCompleted = patch.lastCompletedDate !== undefined;
    const lastCompletedValue = patch.lastCompletedDate ?? null;
    const identities = patch.authorIdentities
      ? JSON.stringify(patch.authorIdentities)
      : null;

    const [row] = await this.sql<SettingsRow[]>`
      INSERT INTO scan_settings
        (user_id, root, owner, author_identities, scan_time, enabled, last_completed_date)
      VALUES (
        ${userId},
        ${patch.root ?? defaults.root},
        ${patch.owner ?? defaults.owner},
        ${identities ?? JSON.stringify(defaults.authorIdentities)},
        ${patch.scanTime ?? defaults.scanTime},
        ${patch.enabled ?? defaults.enabled},
        ${lastCompletedValue}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        root = COALESCE(${patch.root ?? null}::text, scan_settings.root),
        owner = COALESCE(${patch.owner ?? null}::text, scan_settings.owner),
        author_identities = COALESCE(${identities}::text, scan_settings.author_identities),
        scan_time = COALESCE(${patch.scanTime ?? null}::text, scan_settings.scan_time),
        enabled = COALESCE(${patch.enabled ?? null}::boolean, scan_settings.enabled),
        last_completed_date = CASE
          WHEN ${touchLastCompleted} THEN ${lastCompletedValue}::text
          ELSE scan_settings.last_completed_date
        END
      RETURNING *
    `;

    // Returned from the row the database actually holds, so a concurrent write
    // is reflected rather than papered over by what this caller assumed.
    return row ? toSettings(row) : defaults;
  }

  async listBindings(userId: string): Promise<RepoBinding[]> {
    const rows = await this.sql<BindingRow[]>`
      SELECT * FROM scanned_repos WHERE user_id = ${userId} ORDER BY slug ASC
    `;
    return rows.map(toBinding);
  }

  async getBinding(userId: string, slug: string): Promise<RepoBinding | null> {
    const [row] = await this.sql<BindingRow[]>`
      SELECT * FROM scanned_repos WHERE user_id = ${userId} AND slug = ${slug}
    `;
    return row ? toBinding(row) : null;
  }

  async saveBinding(
    userId: string,
    slug: string,
    patch: Partial<Omit<RepoBinding, "slug">>
  ): Promise<RepoBinding> {
    // Same one-statement merge as `saveSettings`, and for the same reason:
    // `markScanned` writes `lastScannedDate` from the scanner while a user may
    // be changing this repo's destination from the settings page. Read-then-
    // write meant one of those two silently lost.
    //
    // All three nullable fields need the CASE treatment rather than COALESCE,
    // because null clears them — that is how a repo's destination is unset.
    const touch = {
      destination: patch.destinationId !== undefined,
      template: patch.templateId !== undefined,
      lastScanned: patch.lastScannedDate !== undefined,
    };

    const [row] = await this.sql<BindingRow[]>`
      INSERT INTO scanned_repos
        (user_id, slug, destination_id, template_id, enabled, last_scanned_date)
      VALUES (
        ${userId}, ${slug},
        ${patch.destinationId ?? null},
        ${patch.templateId ?? null},
        ${patch.enabled ?? true},
        ${patch.lastScannedDate ?? null}
      )
      ON CONFLICT (user_id, slug) DO UPDATE SET
        destination_id = CASE
          WHEN ${touch.destination} THEN ${patch.destinationId ?? null}::text
          ELSE scanned_repos.destination_id
        END,
        template_id = CASE
          WHEN ${touch.template} THEN ${patch.templateId ?? null}::text
          ELSE scanned_repos.template_id
        END,
        enabled = COALESCE(${patch.enabled ?? null}::boolean, scanned_repos.enabled),
        last_scanned_date = CASE
          WHEN ${touch.lastScanned} THEN ${patch.lastScannedDate ?? null}::text
          ELSE scanned_repos.last_scanned_date
        END
      RETURNING *
    `;

    return row ? toBinding(row) : { slug, enabled: patch.enabled ?? true };
  }

  async markScanned(userId: string, slug: string, date: string): Promise<void> {
    await this.saveBinding(userId, slug, { lastScannedDate: date });
  }

  /**
   * The most recent run's summary, kept so a SCHEDULED run's failures are
   * visible in the UI. A summary that only reaches console.log makes an
   * unattended job's errors invisible, which is worse than no job. Only the
   * latest is retained — this is a status panel, not an audit log.
   */
  async saveRun(userId: string, summary: unknown): Promise<void> {
    await this.sql`
      INSERT INTO scan_runs (user_id, ran_at, summary)
      VALUES (${userId}, ${new Date().toISOString()}, ${JSON.stringify(summary)})
      ON CONFLICT (user_id) DO UPDATE SET
        ran_at = excluded.ran_at,
        summary = excluded.summary
    `;
  }

  async getLastRun(userId: string): Promise<{ ranAt: string; summary: unknown } | null> {
    const [row] = await this.sql<Array<{ ran_at: string; summary: string }>>`
      SELECT ran_at, summary FROM scan_runs WHERE user_id = ${userId}
    `;
    return row ? { ranAt: row.ran_at, summary: JSON.parse(row.summary) } : null;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared, so a store closing it
   * would disconnect the rest of the process.
   */
  close(): void {}
}
