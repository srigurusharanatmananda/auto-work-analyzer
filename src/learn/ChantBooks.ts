/**
 * A learner's own uploaded chant book — the store behind `chant_books`.
 * Mirrors `ResourceUploadsStore`'s shape (same DI/pool pattern, same
 * scoped-by-owner reasoning); see that file's own header.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';
import type { Language } from './Transliterator.js';

export interface ChantBook {
  id: string;
  userId: string;
  language: Language;
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

function toBook(row: Row): ChantBook {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language as Language,
    title: row.title,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export class ChantBooksStore {
  private readonly injected?: PostgresHandle;
  private readonly nowFn: () => number;

  constructor(pg?: PostgresHandle, now?: () => number) {
    this.injected = pg;
    this.nowFn = now ?? Date.now;
  }

  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  async list(userId: string, language: Language): Promise<ChantBook[]> {
    const rows = await this.sql<Row[]>`
      SELECT id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
        FROM chant_books
       WHERE user_id = ${userId} AND language = ${language}
       ORDER BY created_at DESC
    `;
    return rows.map(toBook);
  }

  /** Scoped to the caller — a 404 for someone else's book id. */
  async get(userId: string, id: string): Promise<ChantBook | null> {
    const rows = await this.sql<Row[]>`
      SELECT id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
        FROM chant_books
       WHERE id = ${id} AND user_id = ${userId}
    `;
    return rows[0] ? toBook(rows[0]) : null;
  }

  async create(
    userId: string,
    language: Language,
    title: string,
    originalFilename: string,
    storedFilename: string,
    sizeBytes: number
  ): Promise<ChantBook> {
    const id = randomUUID();
    const now = new Date(this.nowFn()).toISOString();

    const [row] = await this.sql<Row[]>`
      INSERT INTO chant_books
        (id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at)
      VALUES (${id}, ${userId}, ${language}, ${title}, ${originalFilename}, ${storedFilename}, ${sizeBytes}, ${now})
      RETURNING id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
    `;
    return toBook(row!);
  }

  /** Scoped to the caller. Returns the deleted row (for the route to remove its file) or null if none matched. Verse rows cascade via the FK. */
  async remove(userId: string, id: string): Promise<ChantBook | null> {
    const rows = await this.sql<Row[]>`
      DELETE FROM chant_books
       WHERE id = ${id} AND user_id = ${userId}
       RETURNING id, user_id, language, title, original_filename, stored_filename, size_bytes, created_at
    `;
    return rows[0] ? toBook(rows[0]) : null;
  }

  /** No-op: the pool is owned by `db/pool.ts` and shared. Matches ResourceUploadsStore.close. */
  close(): void {}
}
