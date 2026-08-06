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
    const current = await this.getSettings(userId);
    const merged: ScanSettings = {
      userId,
      root: patch.root ?? current.root,
      owner: patch.owner ?? current.owner,
      authorIdentities: patch.authorIdentities ?? current.authorIdentities,
      scanTime: patch.scanTime ?? current.scanTime,
      enabled: patch.enabled ?? current.enabled,
      lastCompletedDate: patched(patch.lastCompletedDate, current.lastCompletedDate),
    };

    await this.sql`
      INSERT INTO scan_settings
        (user_id, root, owner, author_identities, scan_time, enabled, last_completed_date)
      VALUES (
        ${userId}, ${merged.root}, ${merged.owner},
        ${JSON.stringify(merged.authorIdentities)}, ${merged.scanTime},
        ${merged.enabled}, ${merged.lastCompletedDate ?? null}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        root = excluded.root,
        owner = excluded.owner,
        author_identities = excluded.author_identities,
        scan_time = excluded.scan_time,
        enabled = excluded.enabled,
        last_completed_date = excluded.last_completed_date
    `;

    return merged;
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
    const current = await this.getBinding(userId, slug);
    const merged: RepoBinding = {
      slug,
      destinationId: patched(patch.destinationId, current?.destinationId),
      templateId: patched(patch.templateId, current?.templateId),
      enabled: patch.enabled ?? current?.enabled ?? true,
      lastScannedDate: patched(patch.lastScannedDate, current?.lastScannedDate),
    };

    await this.sql`
      INSERT INTO scanned_repos
        (user_id, slug, destination_id, template_id, enabled, last_scanned_date)
      VALUES (
        ${userId}, ${slug}, ${merged.destinationId ?? null}, ${merged.templateId ?? null},
        ${merged.enabled}, ${merged.lastScannedDate ?? null}
      )
      ON CONFLICT (user_id, slug) DO UPDATE SET
        destination_id = excluded.destination_id,
        template_id = excluded.template_id,
        enabled = excluded.enabled,
        last_scanned_date = excluded.last_scanned_date
    `;

    return merged;
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
