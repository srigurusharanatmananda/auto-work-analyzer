/**
 * What has been seen, what is due — the store behind `learn_progress`.
 *
 * Mirrors `DatabaseService`'s shape deliberately (constructor taking an
 * optional injected handle, `sql` resolved lazily via `getPool()`, `close()`
 * a no-op) rather than introducing a second convention for a surface this
 * small — two tables, a handful of queries. See
 * `docs/specs/2026-08-08-learning-module-design.md` ("Storage").
 *
 * `language` is not an optional filter here, it is load-bearing: every method
 * takes it and every query is scoped by it, because the spec's verification
 * requirement is exactly "advancing Sanskrit must not advance Tamil" — see
 * `Progress.nodetest.ts`.
 */
import postgres from 'postgres';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';

export class ProgressService {
  private readonly injected?: PostgresHandle;

  constructor(pg?: PostgresHandle) {
    this.injected = pg;
  }

  /** Resolved on first query, not in the constructor. See DatabaseService.sql. */
  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  /**
   * Every lesson id this user has a progress row for, in `language` only.
   *
   * This is what `Curriculum.nextLesson(manifest, seenLessonIds)` consumes —
   * its `seenLessonIds` parameter is a `ReadonlySet<string>`, which a `Set`
   * satisfies directly.
   */
  async seenLessonIds(userId: string, language: string): Promise<Set<string>> {
    const rows = await this.sql<Array<{ lessonId: string }>>`
      SELECT lesson_id as "lessonId"
        FROM learn_progress
       WHERE user_id = ${userId} AND language = ${language}
    `;
    return new Set(rows.map((row) => row.lessonId));
  }

  /**
   * Records that the learner saw `lessonId` in `language`, right now.
   *
   * Upsert via `INSERT ... ON CONFLICT ... DO UPDATE`, not a SELECT followed
   * by a separate INSERT/UPDATE — the same pattern `DatabaseService
   * .markCommitAsProcessed` uses, and for the same reason: two concurrent
   * requests recording the same lesson would otherwise both read "no row
   * yet" and both try to insert, one of them failing or, worse under a
   * race-free-looking SELECT-then-branch, silently double-counting
   * `timesCorrect`.
   *
   * `firstSeenAt` is set only on insert; `excluded.first_seen_at` is not
   * referenced, so a second call never overwrites it. `lastSeenAt` always
   * advances. `timesCorrect` increments only when `correct` is true — and
   * because the whole write happens in one statement, the increment is atomic
   * with the row identification, not a separate read-then-write.
   */
  async recordSeen(userId: string, language: string, lessonId: string, correct: boolean): Promise<void> {
    const now = new Date().toISOString();
    const id = `${userId}:${language}:${lessonId}`;

    await this.sql`
      INSERT INTO learn_progress (
        id, user_id, language, lesson_id, first_seen_at, last_seen_at, times_correct
      ) VALUES (
        ${id}, ${userId}, ${language}, ${lessonId}, ${now}, ${now}, ${correct ? 1 : 0}
      )
      ON CONFLICT (user_id, language, lesson_id) DO UPDATE SET
        last_seen_at = ${now},
        times_correct = learn_progress.times_correct + ${correct ? 1 : 0}
    `;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared, so a store closing it
   * would disconnect the rest of the process. Matches DatabaseService/
   * HistoryService.
   */
  close(): void {}
}
