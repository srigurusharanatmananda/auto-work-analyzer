/**
 * A learner's own uploaded books — the store behind `learn_resource_uploads`.
 * Mirrors `ResourceNotesStore`'s shape (same DI/pool pattern), but each row is
 * its own resource-like entity rather than an annotation on a curated one —
 * see the table's comment in `db/schema.ts`.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';
import type { ResourceLanguage } from './content/resources.js';

export interface ResourceUpload {
  id: string;
  userId: string;
  language: ResourceLanguage;
  title: string;
  originalFilename: string;
  storedFilename: string;
  sizeBytes: number;
  createdAt: string;
}

interface Row {
  id: string;
  user_id: string;
  language: string;
  title: string;
  original_filename: string;
  stored_filename: string;
  size_bytes: number;
  created_at: string;
}

function toUpload(row: Row): ResourceUpload {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language as ResourceLanguage,
    title: row.title,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export class ResourceUploadsStore {
  private readonly injected?: PostgresHandle;
  private readonly nowFn: () => number;

  constructor(pg?: PostgresHandle, now?: () => number) {
    this.injected = pg;
    this.nowFn = now ?? Date.now;
  }

  /** Resolved on first query, not in the constructor. See Progress.ts's sql getter for why. */
  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  async list(userId: string, language: ResourceLanguage): Promise<ResourceUpload[]> {
    const rows = await this.sql<Row[]>`
      SELECT id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
        FROM learn_resource_uploads
       WHERE user_id = ${userId} AND language = ${language}
       ORDER BY created_at DESC
    `;
    return rows.map(toUpload);
  }

  /** Scoped to the caller — a 404 for someone else's upload id, same reasoning as `TranscriptionJobStore.get`. */
  async get(userId: string, id: string): Promise<ResourceUpload | null> {
    const rows = await this.sql<Row[]>`
      SELECT id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
        FROM learn_resource_uploads
       WHERE id = ${id} AND user_id = ${userId}
    `;
    return rows[0] ? toUpload(rows[0]) : null;
  }

  /**
   * Unscoped by design — used only by the token-gated file route, which has
   * no session to scope by and relies on the signed token as its authority
   * instead. Same reasoning as `TranscriptionJobStore.getUnscoped`.
   */
  async getUnscoped(id: string): Promise<ResourceUpload | null> {
    const rows = await this.sql<Row[]>`
      SELECT id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
        FROM learn_resource_uploads
       WHERE id = ${id}
    `;
    return rows[0] ? toUpload(rows[0]) : null;
  }

  async create(
    userId: string,
    language: ResourceLanguage,
    title: string,
    originalFilename: string,
    storedFilename: string,
    sizeBytes: number
  ): Promise<ResourceUpload> {
    const id = randomUUID();
    const now = new Date(this.nowFn()).toISOString();

    const [row] = await this.sql<Row[]>`
      INSERT INTO learn_resource_uploads
        (id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at)
      VALUES (${id}, ${userId}, ${language}, ${title}, ${originalFilename}, ${storedFilename}, ${sizeBytes}, ${now})
      RETURNING id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
    `;
    return toUpload(row!);
  }

  /** Scoped to the caller. Returns the deleted row (for the route to remove its file) or null if none matched. */
  async remove(userId: string, id: string): Promise<ResourceUpload | null> {
    const rows = await this.sql<Row[]>`
      DELETE FROM learn_resource_uploads
       WHERE id = ${id} AND user_id = ${userId}
       RETURNING id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
    `;
    return rows[0] ? toUpload(rows[0]) : null;
  }

  /** No-op: the pool is owned by `db/pool.ts` and shared. Matches ResourceNotesStore.close. */
  close(): void {}
}
