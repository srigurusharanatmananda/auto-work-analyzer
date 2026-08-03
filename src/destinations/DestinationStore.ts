import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { CredentialCipher } from "./CredentialCipher.js";

/**
 * Note the absence of an `apiKey` field. Destinations are serialised straight
 * into API responses, and a key that is not on the object cannot leak through
 * one. The only way to the plaintext is `getApiKey`, which every caller has to
 * ask for explicitly.
 */
export interface Destination {
  id: string;
  userId: string;
  name: string;
  teamId: string;
  teamName?: string;
  spaceId?: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  listId: string;
  listName?: string;
  defaultTemplateId?: string;
  defaultAssignee?: string;
  isDefault: boolean;
}

/**
 * `null` on an optional field means "clear it" — distinct from `undefined`,
 * which means "leave it alone". Moving a destination from a folder to a
 * folderless list needs the former.
 */
export interface DestinationInput {
  name: string;
  /** Plaintext; encrypted before storage. Omit on update to keep the existing key. */
  apiKey?: string;
  teamId: string;
  teamName?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  folderId?: string | null;
  folderName?: string | null;
  listId: string;
  listName?: string | null;
  defaultTemplateId?: string | null;
  defaultAssignee?: string | null;
}

interface Row {
  id: string;
  user_id: string;
  name: string;
  api_key_encrypted: string;
  team_id: string;
  team_name: string | null;
  space_id: string | null;
  space_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  list_id: string;
  list_name: string | null;
  default_template_id: string | null;
  default_assignee: string | null;
  is_default: number;
}

/** Note: never includes the API key, encrypted or otherwise. */
function toDestination(row: Row): Destination {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    teamId: row.team_id,
    teamName: row.team_name ?? undefined,
    spaceId: row.space_id ?? undefined,
    spaceName: row.space_name ?? undefined,
    folderId: row.folder_id ?? undefined,
    folderName: row.folder_name ?? undefined,
    listId: row.list_id,
    listName: row.list_name ?? undefined,
    defaultTemplateId: row.default_template_id ?? undefined,
    defaultAssignee: row.default_assignee ?? undefined,
    isDefault: row.is_default === 1,
  };
}

/**
 * `undefined` keeps the stored value, `null` clears it, anything else replaces
 * it. A plain `??` cannot express the middle case, which is why this exists.
 */
function patched<T>(incoming: T | null | undefined, stored: T | null): T | null {
  if (incoming === undefined) return stored;
  return incoming;
}

/** Schema shared with migration 002, which has to create it before this class exists. */
export const DESTINATIONS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS clickup_destinations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    team_id TEXT NOT NULL,
    team_name TEXT,
    space_id TEXT,
    space_name TEXT,
    folder_id TEXT,
    folder_name TEXT,
    list_id TEXT NOT NULL,
    list_name TEXT,
    default_template_id TEXT,
    default_assignee TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_destinations_user ON clickup_destinations(user_id);
`;

export class DestinationStore {
  private db: Database.Database;

  constructor(dbPath: string, private cipher: CredentialCipher) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(DESTINATIONS_SCHEMA);
  }

  private rowOf(id: string, userId: string): Row | undefined {
    return this.db
      .prepare(`SELECT * FROM clickup_destinations WHERE id = ? AND user_id = ?`)
      .get(id, userId) as Row | undefined;
  }

  list(userId: string): Destination[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM clickup_destinations WHERE user_id = ? ORDER BY is_default DESC, name ASC`
      )
      .all(userId) as Row[];
    return rows.map(toDestination);
  }

  get(id: string, userId: string): Destination | null {
    const row = this.rowOf(id, userId);
    return row ? toDestination(row) : null;
  }

  getDefault(userId: string): Destination | null {
    const row = this.db
      .prepare(`SELECT * FROM clickup_destinations WHERE user_id = ? AND is_default = 1`)
      .get(userId) as Row | undefined;
    return row ? toDestination(row) : null;
  }

  /** The only path to a plaintext key. Never log the return value. */
  getApiKey(id: string, userId: string): string {
    const row = this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");
    return this.cipher.decrypt(row.api_key_encrypted);
  }

  create(userId: string, input: DestinationInput): Destination {
    if (!input.apiKey) throw new Error("apiKey is required when creating a destination");

    const id = randomUUID();
    const now = new Date().toISOString();
    const isFirst = this.list(userId).length === 0;

    this.db
      .prepare(
        `INSERT INTO clickup_destinations
           (id, user_id, name, api_key_encrypted, team_id, team_name, space_id, space_name,
            folder_id, folder_name, list_id, list_name, default_template_id, default_assignee,
            is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        userId,
        input.name,
        this.cipher.encrypt(input.apiKey),
        input.teamId,
        input.teamName ?? null,
        input.spaceId ?? null,
        input.spaceName ?? null,
        input.folderId ?? null,
        input.folderName ?? null,
        input.listId,
        input.listName ?? null,
        input.defaultTemplateId ?? null,
        input.defaultAssignee ?? null,
        isFirst ? 1 : 0,
        now,
        now
      );

    return this.get(id, userId)!;
  }

  update(id: string, userId: string, input: Partial<DestinationInput>): Destination {
    const row = this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");

    this.db
      .prepare(
        `UPDATE clickup_destinations SET
           name = ?, api_key_encrypted = ?, team_id = ?, team_name = ?,
           space_id = ?, space_name = ?, folder_id = ?, folder_name = ?,
           list_id = ?, list_name = ?, default_template_id = ?, default_assignee = ?,
           updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        input.name ?? row.name,
        input.apiKey ? this.cipher.encrypt(input.apiKey) : row.api_key_encrypted,
        input.teamId ?? row.team_id,
        patched(input.teamName, row.team_name),
        patched(input.spaceId, row.space_id),
        patched(input.spaceName, row.space_name),
        patched(input.folderId, row.folder_id),
        patched(input.folderName, row.folder_name),
        input.listId ?? row.list_id,
        patched(input.listName, row.list_name),
        patched(input.defaultTemplateId, row.default_template_id),
        patched(input.defaultAssignee, row.default_assignee),
        new Date().toISOString(),
        id,
        userId
      );

    return this.get(id, userId)!;
  }

  /** Exactly one default per user, enforced inside a transaction. */
  setDefault(id: string, userId: string): void {
    if (!this.rowOf(id, userId)) throw new Error("Destination not found");

    const apply = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE clickup_destinations SET is_default = 0 WHERE user_id = ?`)
        .run(userId);
      this.db
        .prepare(`UPDATE clickup_destinations SET is_default = 1 WHERE id = ? AND user_id = ?`)
        .run(id, userId);
    });

    apply();
  }

  /**
   * Deleting the default promotes the oldest survivor, so a user who had a
   * working default never silently ends up with none — every unqualified
   * request would otherwise fall back to the .env configuration without saying
   * so.
   */
  remove(id: string, userId: string): void {
    const row = this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");

    const apply = this.db.transaction(() => {
      this.db
        .prepare(`DELETE FROM clickup_destinations WHERE id = ? AND user_id = ?`)
        .run(id, userId);

      if (row.is_default === 1) {
        const next = this.db
          .prepare(
            `SELECT id FROM clickup_destinations WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`
          )
          .get(userId) as { id: string } | undefined;
        if (next) {
          this.db
            .prepare(`UPDATE clickup_destinations SET is_default = 1 WHERE id = ?`)
            .run(next.id);
        }
      }
    });

    apply();
  }

  close(): void {
    this.db.close();
  }
}
