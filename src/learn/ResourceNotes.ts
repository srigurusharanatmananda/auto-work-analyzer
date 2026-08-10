/**
 * A learner's own notes on a reading resource — the store behind
 * `learn_resource_notes`. Mirrors `TemplateStore`'s shape, not `Progress`'s:
 * a note is a freely-created, freely-deleted row a user can have many of on
 * the same resource, not a single upsert-scoped slot. See the table's own
 * comment in `db/schema.ts` for why that distinction picked the id scheme.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';

export interface ResourceNote {
  id: string;
  resourceId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  resource_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

function toNote(row: Row): ResourceNote {
  return {
    id: row.id,
    resourceId: row.resource_id,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ResourceNotesStore {
  private readonly injected?: PostgresHandle;

  constructor(pg?: PostgresHandle) {
    this.injected = pg;
  }

  /** Resolved on first query, not in the constructor. See Progress.ts's sql getter for why. */
  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  /** Every note this user left on `resourceId`, newest first. */
  async list(userId: string, resourceId: string): Promise<ResourceNote[]> {
    const rows = await this.sql<Row[]>`
      SELECT id, resource_id, note, created_at, updated_at
        FROM learn_resource_notes
       WHERE user_id = ${userId} AND resource_id = ${resourceId}
       ORDER BY created_at DESC
    `;
    return rows.map(toNote);
  }

  async create(userId: string, resourceId: string, note: string): Promise<ResourceNote> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const [row] = await this.sql<Row[]>`
      INSERT INTO learn_resource_notes (id, user_id, resource_id, note, created_at, updated_at)
      VALUES (${id}, ${userId}, ${resourceId}, ${note}, ${now}, ${now})
      RETURNING id, resource_id, note, created_at, updated_at
    `;
    return toNote(row!);
  }

  /**
   * Scoped to the caller: deletes nothing and does not throw if `noteId`
   * belongs to someone else or does not exist — indistinguishable from a
   * genuine miss, same reasoning as `TemplateStore.remove`, so this can't be
   * used to probe whether another user's note id exists.
   */
  async remove(userId: string, noteId: string): Promise<void> {
    await this.sql`
      DELETE FROM learn_resource_notes WHERE id = ${noteId} AND user_id = ${userId}
    `;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared. Matches
   * Progress.ts/TemplateStore.ts.
   */
  close(): void {}
}
