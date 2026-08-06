import { randomUUID } from "crypto";
import { CredentialCipher } from "./CredentialCipher.js";
import { getPool } from "../db/pool.js";
import type { PostgresHandle } from "../db/client.js";

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
  is_default: boolean;
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
    isDefault: row.is_default,
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

export class DestinationStore {
  private readonly pg: PostgresHandle;

  constructor(
    private cipher: CredentialCipher,
    pg: PostgresHandle = getPool()
  ) {
    this.pg = pg;
  }

  private get sql() {
    return this.pg.sql;
  }

  private async rowOf(id: string, userId: string): Promise<Row | undefined> {
    const [row] = await this.sql<Row[]>`
      SELECT * FROM clickup_destinations WHERE id = ${id} AND user_id = ${userId}
    `;
    return row;
  }

  async list(userId: string): Promise<Destination[]> {
    const rows = await this.sql<Row[]>`
      SELECT * FROM clickup_destinations
       WHERE user_id = ${userId}
       ORDER BY is_default DESC, name ASC
    `;
    return rows.map(toDestination);
  }

  async get(id: string, userId: string): Promise<Destination | null> {
    const row = await this.rowOf(id, userId);
    return row ? toDestination(row) : null;
  }

  async getDefault(userId: string): Promise<Destination | null> {
    const [row] = await this.sql<Row[]>`
      SELECT * FROM clickup_destinations WHERE user_id = ${userId} AND is_default = true
    `;
    return row ? toDestination(row) : null;
  }

  /** The only path to a plaintext key. Never log the return value. */
  async getApiKey(id: string, userId: string): Promise<string> {
    const row = await this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");
    return this.cipher.decrypt(row.api_key_encrypted);
  }

  async create(userId: string, input: DestinationInput): Promise<Destination> {
    if (!input.apiKey) throw new Error("apiKey is required when creating a destination");

    const id = randomUUID();
    const now = new Date().toISOString();

    // The first destination a user saves becomes their default. Decided inside
    // the same transaction as the insert: two concurrent creates that each read
    // "no rows yet" would otherwise both claim the default, and the invariant
    // `setDefault` maintains — exactly one — would be broken from birth.
    const inserted = (await this.sql.begin(async (tx) => {
      const [{ count }] = await tx<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM clickup_destinations WHERE user_id = ${userId}
      `;

      return tx<Row[]>`
        INSERT INTO clickup_destinations
          (id, user_id, name, api_key_encrypted, team_id, team_name, space_id, space_name,
           folder_id, folder_name, list_id, list_name, default_template_id, default_assignee,
           is_default, created_at, updated_at)
        VALUES (
          ${id}, ${userId}, ${input.name}, ${this.cipher.encrypt(input.apiKey!)},
          ${input.teamId}, ${input.teamName ?? null}, ${input.spaceId ?? null},
          ${input.spaceName ?? null}, ${input.folderId ?? null}, ${input.folderName ?? null},
          ${input.listId}, ${input.listName ?? null}, ${input.defaultTemplateId ?? null},
          ${input.defaultAssignee ?? null}, ${count === 0}, ${now}, ${now}
        )
        RETURNING *
      `;
    })) as unknown as Row[];

    return toDestination(inserted[0]!);
  }

  async update(
    id: string,
    userId: string,
    input: Partial<DestinationInput>
  ): Promise<Destination> {
    const row = await this.rowOf(id, userId);
    if (!row) throw new Error("Destination not found");

    const [updated] = await this.sql<Row[]>`
      UPDATE clickup_destinations SET
        name = ${input.name ?? row.name},
        api_key_encrypted = ${
          input.apiKey ? this.cipher.encrypt(input.apiKey) : row.api_key_encrypted
        },
        team_id = ${input.teamId ?? row.team_id},
        team_name = ${patched(input.teamName, row.team_name)},
        space_id = ${patched(input.spaceId, row.space_id)},
        space_name = ${patched(input.spaceName, row.space_name)},
        folder_id = ${patched(input.folderId, row.folder_id)},
        folder_name = ${patched(input.folderName, row.folder_name)},
        list_id = ${input.listId ?? row.list_id},
        list_name = ${patched(input.listName, row.list_name)},
        default_template_id = ${patched(input.defaultTemplateId, row.default_template_id)},
        default_assignee = ${patched(input.defaultAssignee, row.default_assignee)},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    return toDestination(updated!);
  }

  /** Exactly one default per user, enforced inside a transaction. */
  async setDefault(id: string, userId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [row] = await tx<Array<{ id: string }>>`
        SELECT id FROM clickup_destinations WHERE id = ${id} AND user_id = ${userId}
      `;
      if (!row) throw new Error("Destination not found");

      await tx`UPDATE clickup_destinations SET is_default = false WHERE user_id = ${userId}`;
      await tx`
        UPDATE clickup_destinations SET is_default = true
         WHERE id = ${id} AND user_id = ${userId}
      `;
    });
  }

  /**
   * Deleting the default promotes the oldest survivor, so a user who had a
   * working default never silently ends up with none — every unqualified
   * request would otherwise fall back to the .env configuration without saying
   * so.
   */
  async remove(id: string, userId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [row] = await tx<Row[]>`
        SELECT * FROM clickup_destinations WHERE id = ${id} AND user_id = ${userId}
      `;
      if (!row) throw new Error("Destination not found");

      await tx`DELETE FROM clickup_destinations WHERE id = ${id} AND user_id = ${userId}`;

      if (row.is_default) {
        const [next] = await tx<Array<{ id: string }>>`
          SELECT id FROM clickup_destinations
           WHERE user_id = ${userId}
           ORDER BY created_at ASC
           LIMIT 1
        `;
        if (next) {
          await tx`UPDATE clickup_destinations SET is_default = true WHERE id = ${next.id}`;
        }
      }
    });
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared, so a store closing it
   * would disconnect the rest of the process.
   */
  close(): void {}
}
