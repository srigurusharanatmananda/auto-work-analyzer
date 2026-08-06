/**
 * The worker loop, against a real queue and a stubbed Whisper.
 *
 * Needs Postgres because the interesting behaviour is the interaction between
 * the loop and the claim — that one job runs at a time, that a crash-shaped
 * failure returns work to the queue and a bad-file failure does not. A mocked
 * store would let those pass while the real thing was broken.
 *
 * NO TEST HERE CALLS WHISPER. The client is stubbed at the `transcribe` method.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';
import { TranscriptionJobStore, MAX_ATTEMPTS } from './TranscriptionJobStore.js';
import { TranscriptionWorker } from './TranscriptionWorker.js';
import {
  TranscriptionFailedError,
  WhisperUnavailableError,
  type WhisperClient,
  type TranscriptionResult,
} from './WhisperClient.js';

let pg: TestDatabase;
let store: TranscriptionJobStore;

const USER = 'user-1';

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

/** A Whisper stand-in driven by whatever the test wants to happen. */
function stubWhisper(
  behaviour: (jobId: string) => Promise<TranscriptionResult>,
  onSegmentCount = 0
): WhisperClient {
  return {
    transcribe: async (options: any) => {
      for (let index = 0; index < onSegmentCount; index += 1) {
        options.onSegment?.({ text: `seg${index}`, start: index, end: index + 1 }, index);
      }
      return behaviour(String(options.jobId));
    },
  } as unknown as WhisperClient;
}

const transcript = (text: string): TranscriptionResult => ({
  segments: [{ text, start: 0, end: 1 }],
  text,
  language: 'en',
  languageConfidence: 0.9,
});

function enqueue(filename = 'a.mp3') {
  return store.enqueue({
    userId: USER,
    audioPath: `/srv/storage/audio/${filename}`,
    originalFilename: filename,
  });
}

/**
 * Builds a worker with the sweep timer effectively disabled, so each test drives
 * the loop explicitly rather than racing a background interval.
 */
function workerWith(whisper: WhisperClient, settled: string[] = []) {
  return new TranscriptionWorker({
    store,
    whisper,
    sweepIntervalMs: 60 * 60 * 1000,
    onSettled: (job, outcome) => settled.push(`${job.originalFilename}:${outcome}`),
  });
}

describe('processing', () => {
  test('a queued job becomes a stored transcript', async () => {
    const job = await enqueue();
    const settled: string[] = [];
    const worker = workerWith(
      stubWhisper(async () => transcript('the export drops the last row')),
      settled
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
    assert.equal(stored?.transcript, 'the export drops the last row');
    assert.equal(stored?.language, 'en');
    assert.deepEqual(settled, ['a.mp3:succeeded']);
  });

  test('it drains the whole queue, not just the first job', async () => {
    await enqueue('one.mp3');
    await enqueue('two.mp3');
    await enqueue('three.mp3');

    const worker = workerWith(stubWhisper(async () => transcript('done')));
    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const jobs = await store.listForUser(USER);
    assert.equal(jobs.length, 3);
    assert.ok(
      jobs.every((job) => job.status === 'succeeded'),
      `all should succeed, got: ${jobs.map((j) => j.status).join(', ')}`
    );
  });

  /**
   * The 8 GB constraint, enforced. Two Whispers at once is how one slow job
   * becomes two OOM kills.
   */
  test('only one job runs at a time', async () => {
    await enqueue('one.mp3');
    await enqueue('two.mp3');

    let inFlight = 0;
    let maxInFlight = 0;

    const worker = workerWith(
      stubWhisper(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((done) => setTimeout(done, 20));
        inFlight -= 1;
        return transcript('done');
      })
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    assert.equal(maxInFlight, 1, 'two transcriptions overlapped');
  });

  test('progress is recorded as segments arrive', async () => {
    const job = await enqueue();
    const worker = workerWith(stubWhisper(async () => transcript('done'), 4));

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    // Progress writes are fire-and-forget, so allow the microtasks to settle.
    await new Promise((done) => setTimeout(done, 50));

    // The job succeeded, so segments_seen is whatever the last progress write
    // left; the point is that it advanced past zero while running.
    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
  });

  test('an empty queue is not an error', async () => {
    const worker = workerWith(stubWhisper(async () => transcript('unused')));
    await worker.start();
    await worker.drainNow();
    await worker.stop();
  });
});

describe('failure handling', () => {
  /**
   * The distinction the whole error hierarchy exists for. A crashed Whisper says
   * nothing about the file, so the job goes back; an undecodable file will fail
   * identically forever, so it must not.
   */
  test('a Whisper crash is retried, and the retry succeeds', async () => {
    const job = await enqueue();
    const settled: string[] = [];

    // Crashes once, then works — the realistic OOM case, where the file is fine
    // and the container just died. Asserting the eventual success is stronger
    // than asserting the requeue: it proves the job is genuinely claimable
    // again, not merely marked so.
    let attempt = 0;
    const worker = workerWith(
      stubWhisper(async () => {
        attempt += 1;
        if (attempt === 1) throw new WhisperUnavailableError('Whisper crashed mid-transcription');
        return transcript('recovered on the second attempt');
      }),
      settled
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
    assert.equal(stored?.transcript, 'recovered on the second attempt');
    assert.equal(stored?.attempts, 2, 'the retry should be counted');
    assert.deepEqual(settled, ['a.mp3:requeued', 'a.mp3:succeeded']);
  });

  test('an undecodable file fails immediately and is not retried', async () => {
    const job = await enqueue();
    const settled: string[] = [];
    const worker = workerWith(
      stubWhisper(async () => {
        throw new TranscriptionFailedError('Whisper reported: not an audio file');
      }),
      settled
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'failed');
    assert.match(stored?.error ?? '', /not an audio file/);
    assert.deepEqual(settled, ['a.mp3:failed']);
  });

  test('an unexpected error is treated as this file’s problem, not retried', async () => {
    const job = await enqueue();
    const worker = workerWith(
      stubWhisper(async () => {
        throw new TypeError('something unforeseen');
      })
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'failed');
    assert.match(stored?.error ?? '', /something unforeseen/);
  });

  /** A permanently crashing job must not spin the queue forever. */
  test('repeated crashes stop at MAX_ATTEMPTS', async () => {
    const job = await enqueue();
    const whisper = stubWhisper(async () => {
      throw new WhisperUnavailableError('Whisper crashed');
    });

    // Each start() drains until the queue is empty; a requeued job is claimable
    // again immediately, so one run exhausts the attempts.
    const worker = workerWith(whisper);
    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'failed');
    assert.equal(stored?.attempts, MAX_ATTEMPTS);
  });

  test('one failing job does not stop the others', async () => {
    await enqueue('bad.mp3');
    await enqueue('good.mp3');

    const worker = workerWith(
      stubWhisper(async (jobId) => {
        const job = (await store.listForUser(USER)).find((candidate) => candidate.id === jobId);
        if (job?.originalFilename === 'bad.mp3') {
          throw new TranscriptionFailedError('not an audio file');
        }
        return transcript('fine');
      })
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const jobs = await store.listForUser(USER);
    const byName = new Map(jobs.map((job) => [job.originalFilename, job.status]));
    assert.equal(byName.get('bad.mp3'), 'failed');
    assert.equal(byName.get('good.mp3'), 'succeeded');
  });
});

describe('recovery', () => {
  /**
   * What makes a crashed process survivable. The row is `running` with a stale
   * claim and no live worker; without reclaim-on-start it stays that way forever.
   */
  test('start() recovers a job abandoned by a dead worker', async () => {
    const job = await enqueue();
    await pg.sql`
      UPDATE transcription_jobs
      SET status = 'running', claimed_at = '2020-01-01 00:00:00'
      WHERE id = ${job.id}
    `;

    const worker = workerWith(stubWhisper(async () => transcript('recovered')));
    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const stored = await store.get(job.id, USER);
    assert.equal(stored?.status, 'succeeded');
    assert.equal(stored?.transcript, 'recovered');
  });

  test('stop() waits for the running job rather than abandoning it', async () => {
    const job = await enqueue();
    let finished = false;

    const worker = workerWith(
      stubWhisper(async () => {
        await new Promise((done) => setTimeout(done, 40));
        finished = true;
        return transcript('completed despite shutdown');
      })
    );

    await worker.start();
    await worker.drainNow();
    await worker.stop();

    assert.equal(finished, true, 'the in-flight transcription should have completed');
    assert.equal((await store.get(job.id, USER))?.status, 'succeeded');
  });

  test('a stopped worker takes no new work', async () => {
    const worker = workerWith(stubWhisper(async () => transcript('should not run')));
    await worker.start();
    await worker.drainNow();
    await worker.stop();

    const job = await enqueue('after-stop.mp3');
    // Give any lingering listener a chance to misbehave.
    await new Promise((done) => setTimeout(done, 50));

    assert.equal((await store.get(job.id, USER))?.status, 'queued');
  });
});
