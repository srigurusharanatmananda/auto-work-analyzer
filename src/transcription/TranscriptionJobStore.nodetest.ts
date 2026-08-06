/**
 * The transcription queue against a real Postgres schema.
 *
 * Runs under `tsx --test` because it needs a database. The tests that matter are
 * the concurrency ones: a queue that hands the same job to two workers
 * transcribes the same audio twice, and on 8 GB that means two OOM kills instead
 * of one result. Those properties cannot be checked without a real database —
 * `FOR UPDATE SKIP LOCKED` has no in-memory equivalent.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';
import {
  MAX_ATTEMPTS,
  TranscriptionJobStore,
  STALE_CLAIM_MS,
} from './TranscriptionJobStore.js';

let pg: TestDatabase;
let store: TranscriptionJobStore;

const USER = 'user-1';
const OTHER = 'user-2';

before(async () => {
  pg = await createTestDatabase();
  store = new TranscriptionJobStore();
});

after(async () => {
  await pg?.drop();
});

beforeEach(async () => {
  await pg.sql`TRUNCATE transcription_jobs`;
});

function enqueue(overrides: Partial<Parameters<TranscriptionJobStore['enqueue']>[0]> = {}) {
  return store.enqueue({
    userId: USER,
    audioPath: '/srv/storage/audio/a.mp3',
    originalFilename: 'a.mp3',
    ...overrides,
  });
}

describe('enqueue', () => {
  test('a new job starts queued with nothing transcribed', async () => {
    const job = await enqueue({ callTitle: 'Weekly sync', callDate: '2026-08-06' });

    assert.equal(job.status, 'queued');
    assert.equal(job.attempts, 0);
    assert.equal(job.segmentsSeen, 0);
    assert.equal(job.transcript, null);
    assert.deepEqual(job.segments, []);
    assert.equal(job.callTitle, 'Weekly sync');
    assert.equal(job.callDate, '2026-08-06');
  });
});

describe('claimNext', () => {
  test('claims the oldest job first', async () => {
    const first = await enqueue({ originalFilename: 'first.mp3' });
    // created_at comes from now() at second-or-finer resolution; nudge the second
    // row's timestamp so the ordering under test is unambiguous.
    const second = await enqueue({ originalFilename: 'second.mp3' });
    await pg.sql`UPDATE transcription_jobs SET created_at = '2030-01-01' WHERE id = ${second.id}`;

    const claimed = await store.claimNext();
    assert.equal(claimed?.id, first.id);
  });

  test('claiming marks it running and counts the attempt', async () => {
    await enqueue();
    const claimed = await store.claimNext();

    assert.equal(claimed?.status, 'running');
    assert.equal(claimed?.attempts, 1);
  });

  test('returns null when the queue is empty', async () => {
    assert.equal(await store.claimNext(), null);
  });

  /**
   * The property the whole design rests on. Two workers claiming concurrently
   * must get different jobs — if they got the same one, the same audio would be
   * transcribed twice.
   */
  test('two concurrent claims never take the same job', async () => {
    const a = await enqueue({ originalFilename: 'a.mp3' });
    const b = await enqueue({ originalFilename: 'b.mp3' });

    const [first, second] = await Promise.all([store.claimNext(), store.claimNext()]);

    assert.ok(first && second, 'both workers should get work');
    assert.notEqual(first.id, second.id, 'the same job was claimed twice');
    assert.deepEqual([first.id, second.id].sort(), [a.id, b.id].sort());
  });

  test('more workers than jobs: the extra ones get null, not a duplicate', async () => {
    await enqueue();

    const claims = await Promise.all([store.claimNext(), store.claimNext(), store.claimNext()]);
    const got = claims.filter((job) => job !== null);

    assert.equal(got.length, 1);
  });

  test('a running job is not claimed again', async () => {
    await enqueue();
    await store.claimNext();

    assert.equal(await store.claimNext(), null);
  });

  test('a cancelled job is never claimed', async () => {
    const job = await enqueue();
    assert.equal(await store.cancelQueued(job.id, USER), true);

    assert.equal(await store.claimNext(), null);
  });
});

describe('completion', () => {
  test('a successful job keeps its transcript, segments and language', async () => {
    const job = await enqueue();
    await store.claimNext();

    await store.markSucceeded(job.id, {
      transcript: 'the export is dropping the last row',
      segments: [{ text: 'the export is dropping the last row', start: 0, end: 3 }],
      language: 'en',
    });

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
    assert.equal(stored?.transcript, 'the export is dropping the last row');
    assert.equal(stored?.segments.length, 1);
    assert.equal(stored?.language, 'en');
    assert.equal(stored?.error, null);
  });

  /**
   * A silent recording is a real, successful result. Storing `''` where `null`
   * means "not finished" is what lets the UI say "no speech detected" instead of
   * showing a job that looks stuck.
   */
  test('an empty transcript is a success, distinguishable from unfinished', async () => {
    const job = await enqueue();
    await store.claimNext();
    await store.markSucceeded(job.id, { transcript: '', segments: [], language: null });

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
    assert.equal(stored?.transcript, '', 'empty string, not null');
  });

  test('progress is visible while running', async () => {
    const job = await enqueue();
    await store.claimNext();

    await store.recordProgress(job.id, 7);

    assert.equal((await store.get(job.id, USER))?.segmentsSeen, 7);
  });

  test('progress on a finished job is ignored rather than reviving it', async () => {
    const job = await enqueue();
    await store.claimNext();
    await store.markSucceeded(job.id, { transcript: 'done', segments: [], language: 'en' });

    // A last progress callback arriving after completion must not undo it.
    await store.recordProgress(job.id, 99);

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
    assert.equal(stored?.segmentsSeen, 0);
  });
});

describe('failure and retry', () => {
  test('a retryable failure goes back to the queue', async () => {
    const job = await enqueue();
    await store.claimNext();

    const status = await store.markFailed(job.id, 'Whisper crashed', true);

    assert.equal(status, 'queued');
    assert.equal((await store.claimNext())?.id, job.id, 'it should be claimable again');
  });

  test('a non-retryable failure is final even on the first attempt', async () => {
    const job = await enqueue();
    await store.claimNext();

    const status = await store.markFailed(job.id, 'Not an audio file', false);

    assert.equal(status, 'failed');
    assert.equal(await store.claimNext(), null);
  });

  /** Bounded retries: an OOM on a long file will recur, so it must not loop. */
  test('retries stop at MAX_ATTEMPTS', async () => {
    const job = await enqueue();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const claimed = await store.claimNext();
      assert.equal(claimed?.id, job.id, `attempt ${attempt} should claim the job`);
      await store.markFailed(job.id, 'Whisper crashed', true);
    }

    assert.equal(await store.claimNext(), null, 'a fourth attempt must not happen');
    assert.equal((await store.get(job.id, USER))?.status, 'failed');
  });
});

describe('reclaimStale', () => {
  /**
   * The recovery path for a worker killed mid-job — the common case, since
   * Whisper is what the OOM killer reaches for first. Without this the row stays
   * `running` forever: the user sees a job that never finishes and never errors.
   */
  test('an abandoned running job is returned to the queue', async () => {
    const job = await enqueue();
    await store.claimNext();

    // Simulate a worker that died a long time ago.
    await pg.sql`
      UPDATE transcription_jobs
      SET claimed_at = ${new Date(Date.now() - STALE_CLAIM_MS * 2).toISOString()}
      WHERE id = ${job.id}
    `;

    const outcome = await store.reclaimStale();

    assert.equal(outcome.requeued, 1);
    assert.equal(outcome.failed, 0);
    assert.equal((await store.claimNext())?.id, job.id);
  });

  /** A job that is merely slow must not be handed to a second worker. */
  test('a job with a fresh heartbeat is left alone', async () => {
    const job = await enqueue();
    await store.claimNext();
    await store.recordProgress(job.id, 3);

    const outcome = await store.reclaimStale();

    assert.equal(outcome.requeued, 0);
    assert.equal((await store.get(job.id, USER))?.status, 'running');
  });

  test('an abandoned job out of attempts is failed with a reason, not requeued', async () => {
    const job = await enqueue();
    await pg.sql`
      UPDATE transcription_jobs
      SET status = 'running',
          attempts = ${MAX_ATTEMPTS},
          claimed_at = ${new Date(Date.now() - STALE_CLAIM_MS * 2).toISOString()}
      WHERE id = ${job.id}
    `;

    const outcome = await store.reclaimStale();

    assert.equal(outcome.failed, 1);
    assert.equal(outcome.requeued, 0);

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'failed');
    assert.match(stored?.error ?? '', /out of memory|attempts/i);
  });
});

describe('scoping', () => {
  /** 404-not-403: another user's job id must not be confirmable. */
  test("another user's job is invisible", async () => {
    const job = await enqueue();

    assert.equal(await store.get(job.id, OTHER), null);
    assert.notEqual(await store.get(job.id, USER), null);
  });

  test('listForUser returns only that user, newest first', async () => {
    const mine = await enqueue({ originalFilename: 'mine.mp3' });
    await enqueue({ userId: OTHER, originalFilename: 'theirs.mp3' });

    const listed = await store.listForUser(USER);

    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.id, mine.id);
  });

  test("cancelling another user's job does nothing", async () => {
    const job = await enqueue();

    assert.equal(await store.cancelQueued(job.id, OTHER), false);
    assert.equal((await store.get(job.id, USER))?.status, 'queued');
  });

  /**
   * Cancellation is for queued work only. A running job is mid-Whisper-call and
   * flipping the row would not stop it — it would just leave a `cancelled` row
   * that a later `markSucceeded` overwrites.
   */
  test('a running job cannot be cancelled through cancelQueued', async () => {
    const job = await enqueue();
    await store.claimNext();

    assert.equal(await store.cancelQueued(job.id, USER), false);
    assert.equal((await store.get(job.id, USER))?.status, 'running');
  });
});
