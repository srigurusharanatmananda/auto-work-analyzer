/**
 * `learn_progress`: what has been seen, what is due — and the property the
 * spec calls out explicitly as needing a cheap assertion: progress is scoped
 * by language, so advancing Sanskrit must not advance Tamil. See
 * `docs/specs/2026-08-08-learning-module-design.md` ("Verification").
 *
 * Runs against a real Postgres schema of its own, under `tsx --test` — the
 * same fixture `HistoryService.dedup.nodetest.ts` uses.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressService } from './Progress.js';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';

const ALICE = 'user-alice';

let db: TestDatabase;
let progress: ProgressService;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  // The fixture's schema is dropped wholesale in `after`, but truncating
  // between tests (the same pattern HistoryService.dedup.nodetest.ts uses)
  // keeps each test's assertions independent of what an earlier test left
  // behind.
  await db.sql`TRUNCATE learn_progress`;
  progress = new ProgressService(db);
});

describe('recordSeen / seenLessonIds', () => {
  test('a recorded lesson shows up in seenLessonIds for that user and language', async () => {
    await progress.recordSeen(ALICE, 'sanskrit', 'letters-1', true);

    const seen = await progress.seenLessonIds(ALICE, 'sanskrit');
    assert.equal(seen.has('letters-1'), true);
  });

  test('seenLessonIds for a user/language with no rows returns an empty set', async () => {
    const seen = await progress.seenLessonIds(ALICE, 'sanskrit');
    assert.deepEqual(seen, new Set());
  });

  describe('progress is scoped by language', () => {
    /**
     * The property the spec's "Verification" section calls out: advancing
     * Sanskrit must not advance Tamil, even for the same lesson id string
     * reused across both manifests.
     */
    test('recording a lesson in sanskrit does not mark it seen in tamil', async () => {
      await progress.recordSeen(ALICE, 'sanskrit', 'letters-1', true);

      const sanskritSeen = await progress.seenLessonIds(ALICE, 'sanskrit');
      const tamilSeen = await progress.seenLessonIds(ALICE, 'tamil');

      assert.equal(sanskritSeen.has('letters-1'), true);
      assert.equal(
        tamilSeen.has('letters-1'),
        false,
        'the same lesson id in a different language must be a different lesson'
      );
    });
  });

  test('recording the same (user, language, lesson) twice updates the row rather than duplicating it', async () => {
    await progress.recordSeen(ALICE, 'sanskrit', 'letters-1', true);
    await progress.recordSeen(ALICE, 'sanskrit', 'letters-1', true);

    const rows = await db.sql<Array<{ lastSeenAt: string; timesCorrect: number; firstSeenAt: string }>>`
      SELECT first_seen_at as "firstSeenAt", last_seen_at as "lastSeenAt", times_correct as "timesCorrect"
        FROM learn_progress
       WHERE user_id = ${ALICE} AND language = 'sanskrit' AND lesson_id = 'letters-1'
    `;

    assert.equal(rows.length, 1, 'a second call must update the existing row, not insert a second one');
    assert.equal(rows[0]!.timesCorrect, 2, 'each correct call increments timesCorrect');
    assert.ok(
      rows[0]!.lastSeenAt >= rows[0]!.firstSeenAt,
      'lastSeenAt should advance on the second call'
    );
  });

  test('an incorrect recording does not increment timesCorrect', async () => {
    await progress.recordSeen(ALICE, 'sanskrit', 'letters-1', false);

    const rows = await db.sql<Array<{ timesCorrect: number }>>`
      SELECT times_correct as "timesCorrect"
        FROM learn_progress
       WHERE user_id = ${ALICE} AND language = 'sanskrit' AND lesson_id = 'letters-1'
    `;

    assert.equal(rows[0]!.timesCorrect, 0);
  });
});
