/**
 * Scan configuration, per-repository bindings, and the last run's summary.
 *
 * Three tables, one class, because they are always read together and a repo
 * binding is meaningless without the settings that decide when scanning runs.
 *
 * Shaped after DestinationStore: schema created in the constructor, every method
 * scoped by userId, and `patch` semantics where `undefined` means "leave alone"
 * and `null` means "clear" — a distinction DestinationStore originally got wrong
 * and which silently kept a stale value.
 */

import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

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
  enabled: number;
  last_completed_date: string | null;
}

interface BindingRow {
  user_id: string;
  slug: string;
  destination_id: string | null;
  template_id: string | null;
  enabled: number;
  last_scanned_date: string | null;
}

export const SCANNING_SCHEMA = `
  CREATE TABLE IF NOT EXISTS scan_settings (
    user_id TEXT PRIMARY KEY,
    root TEXT NOT NULL,
    owner TEXT NOT NULL,
    author_identities TEXT NOT NULL,
    scan_time TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    last_completed_date TEXT
  );
  CREATE TABLE IF NOT EXISTS scan_runs (
    user_id TEXT PRIMARY KEY,
    ran_at TEXT NOT NULL,
    summary TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scanned_repos (
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    destination_id TEXT,
    template_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_scanned_date TEXT,
    PRIMARY KEY (user_id, slug)
  );
`;

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
    enabled: row.enabled === 1,
    lastCompletedDate: row.last_completed_date ?? undefined,
  };
}

function toBinding(row: BindingRow): RepoBinding {
  return {
    slug: row.slug,
    destinationId: row.destination_id ?? undefined,
    templateId: row.template_id ?? undefined,
    enabled: row.enabled === 1,
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
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCANNING_SCHEMA);
  }

  getSettings(userId: string): ScanSettings {
    const row = this.db.prepare(`SELECT * FROM scan_settings WHERE user_id = ?`).get(userId) as
      | SettingsRow
      | undefined;
    return row ? toSettings(row) : defaultSettings(userId);
  }

  saveSettings(userId: string, patch: Partial<Omit<ScanSettings, "userId">>): ScanSettings {
    const current = this.getSettings(userId);
    const merged: ScanSettings = {
      userId,
      root: patch.root ?? current.root,
      owner: patch.owner ?? current.owner,
      authorIdentities: patch.authorIdentities ?? current.authorIdentities,
      scanTime: patch.scanTime ?? current.scanTime,
      enabled: patch.enabled ?? current.enabled,
      lastCompletedDate: patched(patch.lastCompletedDate, current.lastCompletedDate),
    };

    this.db
      .prepare(
        `INSERT INTO scan_settings
           (user_id, root, owner, author_identities, scan_time, enabled, last_completed_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           root = excluded.root,
           owner = excluded.owner,
           author_identities = excluded.author_identities,
           scan_time = excluded.scan_time,
           enabled = excluded.enabled,
           last_completed_date = excluded.last_completed_date`
      )
      .run(
        userId,
        merged.root,
        merged.owner,
        JSON.stringify(merged.authorIdentities),
        merged.scanTime,
        merged.enabled ? 1 : 0,
        merged.lastCompletedDate ?? null
      );

    return merged;
  }

  listBindings(userId: string): RepoBinding[] {
    const rows = this.db
      .prepare(`SELECT * FROM scanned_repos WHERE user_id = ? ORDER BY slug ASC`)
      .all(userId) as BindingRow[];
    return rows.map(toBinding);
  }

  getBinding(userId: string, slug: string): RepoBinding | null {
    const row = this.db
      .prepare(`SELECT * FROM scanned_repos WHERE user_id = ? AND slug = ?`)
      .get(userId, slug) as BindingRow | undefined;
    return row ? toBinding(row) : null;
  }

  saveBinding(
    userId: string,
    slug: string,
    patch: Partial<Omit<RepoBinding, "slug">>
  ): RepoBinding {
    const current = this.getBinding(userId, slug);
    const merged: RepoBinding = {
      slug,
      destinationId: patched(patch.destinationId, current?.destinationId),
      templateId: patched(patch.templateId, current?.templateId),
      enabled: patch.enabled ?? current?.enabled ?? true,
      lastScannedDate: patched(patch.lastScannedDate, current?.lastScannedDate),
    };

    this.db
      .prepare(
        `INSERT INTO scanned_repos
           (user_id, slug, destination_id, template_id, enabled, last_scanned_date)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, slug) DO UPDATE SET
           destination_id = excluded.destination_id,
           template_id = excluded.template_id,
           enabled = excluded.enabled,
           last_scanned_date = excluded.last_scanned_date`
      )
      .run(
        userId,
        slug,
        merged.destinationId ?? null,
        merged.templateId ?? null,
        merged.enabled ? 1 : 0,
        merged.lastScannedDate ?? null
      );

    return merged;
  }

  markScanned(userId: string, slug: string, date: string): void {
    this.saveBinding(userId, slug, { lastScannedDate: date });
  }

  /**
   * The most recent run's summary, kept so a SCHEDULED run's failures are
   * visible in the UI. A summary that only reaches console.log makes an
   * unattended job's errors invisible, which is worse than no job. Only the
   * latest is retained — this is a status panel, not an audit log.
   */
  saveRun(userId: string, summary: unknown): void {
    this.db
      .prepare(
        `INSERT INTO scan_runs (user_id, ran_at, summary) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET ran_at = excluded.ran_at, summary = excluded.summary`
      )
      .run(userId, new Date().toISOString(), JSON.stringify(summary));
  }

  getLastRun(userId: string): { ranAt: string; summary: unknown } | null {
    const row = this.db
      .prepare(`SELECT ran_at, summary FROM scan_runs WHERE user_id = ?`)
      .get(userId) as { ran_at: string; summary: string } | undefined;
    return row ? { ranAt: row.ran_at, summary: JSON.parse(row.summary) } : null;
  }

  close(): void {
    this.db.close();
  }
}
