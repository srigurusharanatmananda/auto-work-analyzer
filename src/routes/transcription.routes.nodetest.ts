/**
 * The transcription HTTP surface.
 *
 * Real Postgres (authenticate re-reads the user row on every request) and real
 * multer writing to a real temp directory, because the tests that matter here are
 * about the filesystem: that an unauthenticated caller cannot write to disk, and
 * that a rejected upload does not leave a file behind.
 *
 * NOTHING here runs Whisper or starts a worker — jobs are left queued.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createTranscriptionRouter } from './transcription.routes.js';
import { TranscriptionJobStore } from '../transcription/TranscriptionJobStore.js';
import { createTestUser } from '../testing/authFixture.js';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';

let pg: TestDatabase;
let store: TranscriptionJobStore;
let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let authHeader: string;
let userId: string;
let storageRoot: string;

const audioDir = () => join(storageRoot, 'audio');

before(async () => {
  pg = await createTestDatabase();
  store = new TranscriptionJobStore();
  storageRoot = await mkdtemp(join(tmpdir(), 'awa-transcription-'));

  const app = express();
  app.use('/api/transcription', createTranscriptionRouter({ store, storageRoot }));

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/transcription`;
  const user = await createTestUser();
  authHeader = user.authHeader;
  userId = 'user-1';
});

after(async () => {
  server?.close();
  await rm(storageRoot, { recursive: true, force: true });
  await pg?.drop();
});

beforeEach(async () => {
  await pg.sql`TRUNCATE transcription_jobs`;
  await rm(audioDir(), { recursive: true, force: true });
});

/** Files currently on disk in the upload directory. */
async function filesOnDisk(): Promise<string[]> {
  return readdir(audioDir()).catch((): string[] => []);
}

async function uploadAudio(
  filename: string,
  options: { auth?: boolean; fields?: Record<string, string>; bytes?: number } = {}
) {
  const { auth = true, fields = {}, bytes = 1024 } = options;

  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(bytes)]), filename);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);

  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: auth ? { Authorization: authHeader } : {},
    body: form,
  });

  return { status: response.status, body: (await response.json().catch((): null => null)) as any };
}

describe('POST /upload', () => {
  test('accepts audio and returns 202 with a queued job', async () => {
    const { status, body } = await uploadAudio('standup.mp3', {
      fields: { callTitle: 'Weekly sync', callDate: '2026-08-06' },
    });

    assert.equal(status, 202, JSON.stringify(body));
    assert.equal(body.data.status, 'queued');
    assert.equal(body.data.originalFilename, 'standup.mp3');
    assert.equal(body.data.callTitle, 'Weekly sync');
    assert.equal(body.data.callDate, '2026-08-06');
    assert.equal(body.data.transcript, null);
  });

  /** The response is a browser's; a server path is neither useful nor its business. */
  test('never returns the server-side audio path', async () => {
    const { body } = await uploadAudio('a.mp3');

    assert.equal(body.data.audioPath, undefined);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(storageRoot.replace(/\\/g, '\\\\')));
  });

  test('the stored filename is a uuid, not what the client sent', async () => {
    await uploadAudio('../../etc/passwd.mp3');

    const files = await filesOnDisk();
    assert.equal(files.length, 1);
    assert.match(
      files[0]!,
      /^[0-9a-f-]{36}\.mp3$/,
      `expected a uuid filename, got ${files[0]}`
    );
  });

  /**
   * The ordering guard. multer writes to disk, so if it ran before
   * `authenticate` an anonymous caller could fill the disk 500 MB at a time.
   */
  test('an unauthenticated upload writes nothing to disk', async () => {
    const { status } = await uploadAudio('a.mp3', { auth: false });

    assert.equal(status, 401);
    assert.deepEqual(await filesOnDisk(), [], 'a rejected upload must leave no file');
  });

  test('a non-audio file is refused and leaves nothing behind', async () => {
    const { status, body } = await uploadAudio('notes.txt');

    assert.equal(status, 400);
    assert.match(body.error, /not supported|Audio only/i);
    assert.deepEqual(await filesOnDisk(), []);
  });

  /** A written file with no row is invisible and never cleaned up. */
  test('a bad callDate is refused and the uploaded file is deleted', async () => {
    const { status, body } = await uploadAudio('a.mp3', { fields: { callDate: '06/08/2026' } });

    assert.equal(status, 400);
    assert.match(body.error, /YYYY-MM-DD/);
    assert.deepEqual(await filesOnDisk(), [], 'the orphaned upload should be removed');
  });

  test('an upload with no file attached is a 400', async () => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: new FormData(),
    });

    assert.equal(response.status, 400);
  });

  /**
   * Whisper reads the file from a bind mount, so a storage root outside that
   * mount can never work. Failing at upload beats failing minutes later inside a
   * job, where it looks like a transcription problem.
   */
  test('a storage root Whisper cannot read is refused at upload time', async () => {
    const isolated = await mkdtemp(join(tmpdir(), 'awa-elsewhere-'));
    const app = express();
    // The router writes under `isolated`, but the WhisperClient is told the
    // mount is somewhere else entirely.
    app.use(
      '/api/transcription',
      createTranscriptionRouter({
        store,
        storageRoot: isolated,
        whisper: new (await import('../transcription/WhisperClient.js')).WhisperClient({
          storageRoot: join(tmpdir(), 'a-completely-different-root'),
        }),
      })
    );
    const local = app.listen(0);

    try {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(64)]), 'a.mp3');
      const response = await fetch(
        `http://localhost:${(local.address() as AddressInfo).port}/api/transcription/upload`,
        { method: 'POST', headers: { Authorization: authHeader }, body: form }
      );
      const body = (await response.json()) as any;

      assert.equal(response.status, 500);
      assert.match(body.error, /outside the transcription storage root/i);
      assert.deepEqual(
        await readdir(join(isolated, 'audio')).catch((): string[] => []),
        [],
        'the unusable upload should be deleted'
      );
    } finally {
      local.close();
      await rm(isolated, { recursive: true, force: true });
    }
  });
});

describe('GET /jobs', () => {
  test('lists only the caller’s jobs', async () => {
    await uploadAudio('mine.mp3');
    await store.enqueue({
      userId: 'someone-else',
      audioPath: join(audioDir(), 'theirs.mp3'),
      originalFilename: 'theirs.mp3',
    });

    const response = await fetch(`${baseUrl}/jobs`, { headers: { Authorization: authHeader } });
    const body = (await response.json()) as any;

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].originalFilename, 'mine.mp3');
  });

  test('requires authentication', async () => {
    assert.equal((await fetch(`${baseUrl}/jobs`)).status, 401);
  });
});

describe('GET /jobs/:id', () => {
  test('returns the job', async () => {
    const { body: uploaded } = await uploadAudio('a.mp3');

    const response = await fetch(`${baseUrl}/jobs/${uploaded.data.id}`, {
      headers: { Authorization: authHeader },
    });
    const body = (await response.json()) as any;

    assert.equal(response.status, 200);
    assert.equal(body.data.id, uploaded.data.id);
  });

  /** 404 not 403: a job id must not be confirmable by a stranger. */
  test("another user's job is a 404, not a 403", async () => {
    const theirs = await store.enqueue({
      userId: 'someone-else',
      audioPath: join(audioDir(), 'theirs.mp3'),
      originalFilename: 'theirs.mp3',
    });

    const response = await fetch(`${baseUrl}/jobs/${theirs.id}`, {
      headers: { Authorization: authHeader },
    });

    assert.equal(response.status, 404);
  });

  test('an unknown id is a 404', async () => {
    const response = await fetch(`${baseUrl}/jobs/does-not-exist`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(response.status, 404);
  });
});

describe('POST /jobs/:id/cancel', () => {
  test('cancels a queued job', async () => {
    const { body: uploaded } = await uploadAudio('a.mp3');

    const response = await fetch(`${baseUrl}/jobs/${uploaded.data.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });

    assert.equal(response.status, 200);
    assert.equal((await store.get(uploaded.data.id, userId))?.status, 'cancelled');
  });

  /**
   * Refused rather than silently accepted: flipping the row would not stop the
   * Whisper call, so the job would finish and overwrite the cancellation — and
   * telling someone it was cancelled when it was not is worse than saying it is
   * too late.
   */
  test('a running job cannot be cancelled, and says why', async () => {
    const { body: uploaded } = await uploadAudio('a.mp3');
    await store.claimNext();

    const response = await fetch(`${baseUrl}/jobs/${uploaded.data.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const body = (await response.json()) as any;

    assert.equal(response.status, 409);
    assert.match(body.error, /already started/i);
  });

  test('cancelling an unknown job is a 404', async () => {
    const response = await fetch(`${baseUrl}/jobs/nope/cancel`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    assert.equal(response.status, 404);
  });
});

/**
 * Duration is computed from the segments rather than stored, so it is the one
 * response field that can be wrong without the database being wrong.
 */
describe('durationSeconds', () => {
  test('is the end of the last segment on a finished job', async () => {
    const queued = await store.enqueue({
      userId,
      audioPath: join(audioDir(), 'a.mp3'),
      originalFilename: 'a.mp3',
    });
    await store.claimNext();
    await store.markSucceeded(queued.id, {
      transcript: 'one two',
      language: 'en',
      segments: [
        { text: 'one', start: 0, end: 3.36 },
        { text: 'two', start: 3.36, end: 12.4 },
      ],
    });

    const response = await fetch(`${baseUrl}/jobs/${queued.id}`, {
      headers: { Authorization: authHeader },
    });
    const body = (await response.json()) as any;

    assert.equal(body.data.durationSeconds, 12);
  });

  /** A partial duration would read as "this call was 4 seconds long". */
  test('is null while the job is still running', async () => {
    const queued = await store.enqueue({
      userId,
      audioPath: join(audioDir(), 'b.mp3'),
      originalFilename: 'b.mp3',
    });
    await store.claimNext();
    await store.recordProgress(queued.id, 2);

    const response = await fetch(`${baseUrl}/jobs/${queued.id}`, {
      headers: { Authorization: authHeader },
    });
    const body = (await response.json()) as any;

    assert.equal(body.data.status, 'running');
    assert.equal(body.data.durationSeconds, null);
  });

  test('is null when a succeeded job produced no segments at all', async () => {
    const queued = await store.enqueue({
      userId,
      audioPath: join(audioDir(), 'c.mp3'),
      originalFilename: 'c.mp3',
    });
    await store.claimNext();
    await store.markSucceeded(queued.id, { transcript: '', language: 'en', segments: [] });

    const response = await fetch(`${baseUrl}/jobs/${queued.id}`, {
      headers: { Authorization: authHeader },
    });
    const body = (await response.json()) as any;

    assert.equal(body.data.durationSeconds, null);
  });
});
