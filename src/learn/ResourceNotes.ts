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
  /** Insertion-order tiebreaker — see `schema.ts`'s comment on why this exists at all. */
  seq: number;
}

interface Row {
  id: string;
  resource_id: string;
  note: string;
  created_at: string;
  updated_at: string;
  seq: number;
}

function toNote(row: Row): ResourceNote {
  return {
    id: row.id,
    resourceId: row.resource_id,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    seq: row.seq,
  };
}

export class ResourceNotesStore {
  private readonly injected?: PostgresHandle;
  private readonly nowFn: () => number;

  constructor(pg?: PostgresHandle, now?: () => number) {
    this.injected = pg;
    // Injectable so a test can create two notes with distinct timestamps
    // without depending on real-clock luck — see the `ORDER BY` comment on
    // `list()` for why two notes created in the same millisecond used to be
    // an unreliable, order-flipping test (caught 2026-08-10 by an unrelated
    // branch's independent test run, not something the original PR's own
    // test run happened to hit).
    this.nowFn = now ?? Date.now;
  }

  /** Resolved on first query, not in the constructor. See Progress.ts's sql getter for why. */
  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  /**
   * Every note this user left on `resourceId`, newest first.
   *
   * `seq DESC` is the secondary sort, not `id DESC` — `id` is a random uuid
   * with no relationship to insertion order, which would make ties
   * deterministic but not actually correct: it would resolve the same way
   * on every query, but that one way could just as easily put the OLDER of
   * two same-millisecond notes on top, permanently. `seq` is a Postgres
   * `bigserial`, assigned at insert time, so it is the one column here
   * guaranteed to reflect real insertion order regardless of how close
   * together two creates land — see `schema.ts`'s comment on `seq` for why
   * this needed a real column rather than a formula over existing ones.
   */
  async list(userId: string, resourceId: string): Promise<ResourceNote[]> {
    const rows = await this.sql<Row[]>`
      SELECT id, resource_id, note, created_at, updated_at, seq
        FROM learn_resource_notes
       WHERE user_id = ${userId} AND resource_id = ${resourceId}
       ORDER BY created_at DESC, seq DESC
    `;
    return rows.map(toNote);
  }

  async create(userId: string, resourceId: string, note: string): Promise<ResourceNote> {
    const id = randomUUID();
    const now = new Date(this.nowFn()).toISOString();

    const [row] = await this.sql<Row[]>`
      INSERT INTO learn_resource_notes (id, user_id, resource_id, note, created_at, updated_at)
      VALUES (${id}, ${userId}, ${resourceId}, ${note}, ${now}, ${now})
      RETURNING id, resource_id, note, created_at, updated_at, seq
    `;
    return toNote(row!);
  }

  /**
   * Scoped to the caller AND to `resourceId`: deletes nothing and does not
   * throw if `noteId` belongs to someone else, belongs to a different
   * resource than the one named, or does not exist — indistinguishable from
   * a genuine miss, same reasoning as `TemplateStore.remove`, so this can't
   * be used to probe whether another user's (or another resource's) note id
   * exists. The `resourceId` scope matters even though `noteId` alone is
   * already globally unique: without it, `DELETE /resources/:id/notes/:noteId`
   * would silently delete a note that belongs to a DIFFERENT resource than
   * the one in the URL, as long as the caller owns it — the route's shape
   * implies that scoping, so the store should actually enforce it.
   */
  async remove(userId: string, resourceId: string, noteId: string): Promise<void> {
    await this.sql`
      DELETE FROM learn_resource_notes
       WHERE id = ${noteId} AND user_id = ${userId} AND resource_id = ${resourceId}
    `;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared. Matches
   * Progress.ts/TemplateStore.ts.
   */
  close(): void {}
}
