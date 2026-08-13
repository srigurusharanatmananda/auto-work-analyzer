/**
 * A single verse of an uploaded chant book — the store behind
 * `chant_book_verses`. `rawText` is written once at upload time (from
 * `BookVerseParser.ts`'s split); `processedData`/`processedAt` are written
 * lazily, the first time a learner asks to chant that specific verse — see
 * `db/schema.ts`'s own comment on `chantBookVerses` for why upfront
 * processing of every verse would defeat this feature's whole point.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';
import type { ChantPada } from './content/chanting.js';

/** The AI-computed breakdown for one book verse — same shape as a built-in `ChantVerse`, minus the fields a book verse doesn't have (id/source/verseNumber/speakerTag live on the parent row or aren't applicable). */
export interface ChantBookVerseBreakdown {
  padas: ChantPada[];
  meaning: string;
  citation: string;
}

export interface ChantBookVerse {
  id: string;
  bookId: string;
  verseNumber: number;
  rawText: string;
  /** `null` until a learner first asks to chant this verse. */
  breakdown: ChantBookVerseBreakdown | null;
  processedAt: string | null;
}

interface Row {
  id: string;
  book_id: string;
  verse_number: number;
  raw_text: string;
  processed_data: string | null;
  processed_at: string | null;
}

function toVerse(row: Row): ChantBookVerse {
  return {
    id: row.id,
    bookId: row.book_id,
    verseNumber: row.verse_number,
    rawText: row.raw_text,
    breakdown: row.processed_data ? (JSON.parse(row.processed_data) as ChantBookVerseBreakdown) : null,
    processedAt: row.processed_at,
  };
}

export class ChantBookVersesStore {
  private readonly injected?: PostgresHandle;
  private readonly nowFn: () => number;

  constructor(pg?: PostgresHandle, now?: () => number) {
    this.injected = pg;
    this.nowFn = now ?? Date.now;
  }

  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  /** Every verse of a book, without its (possibly large, possibly absent) breakdown — enough for a picker UI. */
  async listSummaries(bookId: string): Promise<Array<{ verseNumber: number; rawText: string; hasBreakdown: boolean }>> {
    const rows = await this.sql<Array<{ verse_number: number; raw_text: string; processed_data: string | null }>>`
      SELECT verse_number, raw_text, processed_data
        FROM chant_book_verses
       WHERE book_id = ${bookId}
       ORDER BY verse_number ASC
    `;
    return rows.map((row) => ({
      verseNumber: row.verse_number,
      rawText: row.raw_text,
      hasBreakdown: row.processed_data !== null,
    }));
  }

  async get(bookId: string, verseNumber: number): Promise<ChantBookVerse | null> {
    const rows = await this.sql<Row[]>`
      SELECT id, book_id, verse_number, raw_text, processed_data, processed_at
        FROM chant_book_verses
       WHERE book_id = ${bookId} AND verse_number = ${verseNumber}
    `;
    return rows[0] ? toVerse(rows[0]) : null;
  }

  /** Bulk insert at upload time, from `BookVerseParser.ts`'s own output — one row per parsed verse, no breakdown yet. */
  async createMany(bookId: string, verses: Array<{ verseNumber: number; rawText: string }>): Promise<void> {
    if (verses.length === 0) return;
    const rows = verses.map((v) => ({ id: randomUUID(), book_id: bookId, verse_number: v.verseNumber, raw_text: v.rawText }));
    await this.sql`
      INSERT INTO chant_book_verses ${this.sql(rows, 'id', 'book_id', 'verse_number', 'raw_text')}
    `;
  }

  /** Persists the lazily-computed breakdown. Idempotent to call twice for the same verse (a second learner asking for it concurrently just overwrites with an equivalent result, not a race worth locking over — the computation is deterministic-enough given the same source text). */
  async setBreakdown(bookId: string, verseNumber: number, breakdown: ChantBookVerseBreakdown): Promise<void> {
    const now = new Date(this.nowFn()).toISOString();
    await this.sql`
      UPDATE chant_book_verses
         SET processed_data = ${JSON.stringify(breakdown)}, processed_at = ${now}
       WHERE book_id = ${bookId} AND verse_number = ${verseNumber}
    `;
  }

  close(): void {}
}
