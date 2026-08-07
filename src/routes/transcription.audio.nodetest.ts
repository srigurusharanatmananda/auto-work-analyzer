/**
 * Serving a recording back for playback.
 *
 * Real files on a real temp disk, because the things worth testing are the
 * things a mock would let pass: that the bytes served match the bytes asked
 * for, that a row pointing outside the storage directory cannot be used to read
 * the filesystem, and that the capability token is actually the gate.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createTranscriptionRouter } from './transcription.routes.js';
import { TranscriptionJobStore } from '../transcription/TranscriptionJobStore.js';
import { createTestUser } from '../testing/authFixture.js';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';

let pg: TestDatabase;
let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let alice: Awaited<ReturnType<typeof createTestUser>>;
let bob: Awaited<ReturnType<typeof createTestUser>>;
let storageRoot: string;

/** 1000 bytes, each the low byte of its own offset — so a slice self-identifies. */
const SIZE = 1000;
const CONTENT = Buffer.from(Array.from({ length: SIZE }, (_, i) => i % 256));

const audioDir = () => join(storageRoot, 'audio');

async function seedJob(
  id: string,
  userId: string,
  options: { audioPath?: string; write?: boolean } = {}
): Promise<void> {
  const { write = true } = options;
  const path = options.audioPath ?? join(audioDir(), `${id}.mp3`);

  if (write && !options.audioPath) {
    await mkdir(audioDir(), { recursive: true });
    await writeFile(path, CONTENT);
  }

  await pg.sql`
    INSERT INTO transcription_jobs
      (id, user_id, audio_path, original_filename, status, transcript, segments)
    VALUES (${id}, ${userId}, ${path}, ${`${id}.mp3`}, 'succeeded', 'hello', '[]')
  `;
}

/** Mints a playback URL the way the client does. */
async function mint(jobId: string, auth: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}/jobs/${jobId}/audio-token`, {
    method: 'POST',
    headers: { Authorization: auth },
  });
  return { status: response.status, body: await response.json() };
}

async function play(url: string, range?: string): Promise<Response> {
  return fetch(`http://localhost:${(server.address() as AddressInfo).port}${url}`, {
    headers: range ? { Range: range } : {},
  });
}

before(async () => {
  pg = await createTestDatabase();
  storageRoot = await mkdtemp(join(tmpdir(), 'awa-audio-'));

  const app = express();
  app.use(
    '/api/transcription',
    createTranscriptionRouter({ store: new TranscriptionJobStore(), storageRoot })
  );

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/transcription`;
  alice = await createTestUser({ userId: 'user-alice', email: 'alice@example.com' });
  bob = await createTestUser({ userId: 'user-bob', email: 'bob@example.com' });
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

describe('POST /jobs/:id/audio-token', () => {
  test('mints a URL for the owner', async () => {
    await seedJob('j1', 'user-alice');

    const { status, body } = await mint('j1', alice.authHeader);

    assert.equal(status, 200, JSON.stringify(body));
    assert.match(body.data.url, /^\/api\/transcription\/jobs\/j1\/audio\?token=/);
    assert.ok(new Date(body.data.expiresAt).getTime() > Date.now());
  });

  /** Ownership is checked HERE — the streaming route has no session to check. */
  test("refuses another user's job, indistinguishably from a missing one", async () => {
    await seedJob('j1', 'user-alice');

    assert.equal((await mint('j1', bob.authHeader)).status, 404);
  });

  test('requires authentication', async () => {
    await seedJob('j1', 'user-alice');

    const response = await fetch(`${baseUrl}/jobs/j1/audio-token`, { method: 'POST' });

    assert.equal(response.status, 401);
  });
});

describe('GET /jobs/:id/audio', () => {
  test('serves the whole file, and says it is seekable', async () => {
    await seedJob('j1', 'user-alice');
    const { body } = await mint('j1', alice.authHeader);

    const response = await play(body.data.url);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('content-length'), String(SIZE));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), CONTENT);
  });

  /**
   * The bytes are checked, not just the status. A 206 carrying the wrong slice
   * is the failure that actually happens, and it plays as a jump to the wrong
   * moment rather than as an error.
   */
  test('a range gets 206 and exactly those bytes', async () => {
    await seedJob('j1', 'user-alice');
    const { body } = await mint('j1', alice.authHeader);

    const response = await play(body.data.url, 'bytes=100-199');

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes 100-199/${SIZE}`);
    assert.equal(response.headers.get('content-length'), '100');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), CONTENT.subarray(100, 200));
  });

  test('an open-ended range runs to the end of the file', async () => {
    await seedJob('j1', 'user-alice');
    const { body } = await mint('j1', alice.authHeader);

    const response = await play(body.data.url, 'bytes=900-');

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes 900-999/${SIZE}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), CONTENT.subarray(900));
  });

  test('a suffix range serves the END of the file', async () => {
    await seedJob('j1', 'user-alice');
    const { body } = await mint('j1', alice.authHeader);

    const response = await play(body.data.url, 'bytes=-50');

    assert.equal(response.status, 206);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), CONTENT.subarray(950));
  });

  test('an unsatisfiable range gets 416 with the real size', async () => {
    await seedJob('j1', 'user-alice');
    const { body } = await mint('j1', alice.authHeader);

    const response = await play(body.data.url, 'bytes=99999-');

    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), `bytes */${SIZE}`);
  });
});

describe('GET /jobs/:id/audio — authority', () => {
  test('no token at all is refused', async () => {
    await seedJob('j1', 'user-alice');

    assert.equal((await play('/api/transcription/jobs/j1/audio')).status, 403);
  });

  test('a garbage token is refused', async () => {
    await seedJob('j1', 'user-alice');

    assert.equal((await play('/api/transcription/jobs/j1/audio?token=nonsense')).status, 403);
  });

  /**
   * Job ids appear in every list response, so a token that worked for any job
   * would be a key to every recording on the server.
   */
  test("a valid token for a DIFFERENT job will not open this one", async () => {
    await seedJob('j1', 'user-alice');
    await seedJob('j2', 'user-bob');
    const { body } = await mint('j1', alice.authHeader);

    const token = new URL(`http://x${body.data.url}`).searchParams.get('token')!;
    const response = await play(
      `/api/transcription/jobs/j2/audio?token=${encodeURIComponent(token)}`
    );

    assert.equal(response.status, 403);
  });
});

describe('GET /jobs/:id/audio — the row is not trusted', () => {
  /**
   * The path was validated on upload, but a row outlives a request. Anything
   * that ever writes `audio_path` must not become a way to read the disk.
   */
  test('a path outside the storage directory is refused', async () => {
    const outside = join(storageRoot, 'not-audio-secrets.txt');
    await writeFile(outside, 'secret');
    await seedJob('j1', 'user-alice', { audioPath: outside });

    const { body } = await mint('j1', alice.authHeader);
    const response = await play(body.data.url);

    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes('secret'), 'the file must not be served');
  });

  test('traversal out of the storage directory is refused', async () => {
    await seedJob('j1', 'user-alice', {
      audioPath: join(audioDir(), '..', '..', 'etc', 'hosts'),
    });

    const { body } = await mint('j1', alice.authHeader);

    assert.equal((await play(body.data.url)).status, 404);
  });

  /**
   * A directory whose name merely starts with the storage path is a different
   * directory. `startsWith(audioDir)` without the separator would serve from
   * `<root>/audio-backup` as though it were `<root>/audio`.
   */
  test('a sibling directory with a prefix name is refused', async () => {
    const sibling = join(storageRoot, 'audio-backup');
    await mkdir(sibling, { recursive: true });
    const path = join(sibling, 'leak.mp3');
    await writeFile(path, CONTENT);
    await seedJob('j1', 'user-alice', { audioPath: path });

    const { body } = await mint('j1', alice.authHeader);

    assert.equal((await play(body.data.url)).status, 404);
  });

  test('a row whose file is gone is a 404, not a 500', async () => {
    await seedJob('j1', 'user-alice', { write: false });

    const { body } = await mint('j1', alice.authHeader);
    const response = await play(body.data.url);

    assert.equal(response.status, 404);
    assert.match((await response.json()).error, /no longer on disk/);
  });
});
