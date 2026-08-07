/**
 * Searching past transcripts, over real Postgres.
 *
 * The pure highlighting logic is covered in `calls/transcriptSearch.test.ts`.
 * What needs a database is the half that decides *which rows* a caller sees:
 * case folding, wildcard escaping, date bounds, and owner scoping. Each of
 * those fails by returning plausible-looking results rather than by erroring,
 * so none of them can be checked by reading the query.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
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

interface SeedJob {
  id: string;
  userId: string;
  transcript: string;
  segments?: Array<{ text: string; start: number; end: number }>;
  filename?: string;
  callTitle?: string | null;
  callDate?: string | null;
  status?: string;
}

/** Inserts a finished job directly — no Whisper, no worker, no audio. */
async function seed(job: SeedJob): Promise<void> {
  await pg.sql`
    INSERT INTO transcription_jobs
      (id, user_id, audio_path, original_filename, status, transcript, segments,
       language, call_title, call_date)
    VALUES (
      ${job.id}, ${job.userId}, ${`/tmp/${job.id}.mp3`},
      ${job.filename ?? `${job.id}.mp3`}, ${job.status ?? 'succeeded'},
      ${job.transcript}, ${JSON.stringify(job.segments ?? [])},
      'en', ${job.callTitle ?? null}, ${job.callDate ?? null}
    )
  `;
}

async function search(
  auth: string,
  params: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${baseUrl}/search?${query}`, {
    headers: { Authorization: auth },
  });
  return { status: response.status, body: await response.json() };
}

const ids = (body: any): string[] => body.data.results.map((r: any) => r.id);

before(async () => {
  pg = await createTestDatabase();
  storageRoot = await mkdtemp(join(tmpdir(), 'awa-search-'));

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
});

describe('GET /search — matching', () => {
  test('finds a phrase in the transcript body', async () => {
    await seed({ id: 'j1', userId: 'user-alice', transcript: 'please sign the contract today' });
    await seed({ id: 'j2', userId: 'user-alice', transcript: 'nothing relevant here' });

    const { status, body } = await search(alice.authHeader, { q: 'contract' });

    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(ids(body), ['j1']);
    assert.equal(body.data.results[0].matchCount, 1);
    assert.equal(body.data.results[0].highlights.length, 1);
  });

  /**
   * Postgres `LIKE` is case-sensitive. This is the single most likely way for
   * this feature to ship broken, because it works perfectly for every query
   * that happens to match the transcript's own casing.
   */
  test('is case-insensitive', async () => {
    await seed({ id: 'j1', userId: 'user-alice', transcript: 'Sign the Contract today' });

    assert.deepEqual(ids((await search(alice.authHeader, { q: 'contract' })).body), ['j1']);
    assert.deepEqual(ids((await search(alice.authHeader, { q: 'SIGN' })).body), ['j1']);
  });

  test('matches the call title and the uploaded filename too', async () => {
    await seed({
      id: 'j1',
      userId: 'user-alice',
      transcript: 'no keyword in the body at all',
      callTitle: 'Acme renewal',
    });
    await seed({
      id: 'j2',
      userId: 'user-alice',
      transcript: 'also nothing',
      filename: 'acme-standup.mp3',
    });

    assert.deepEqual(ids((await search(alice.authHeader, { q: 'acme' })).body).sort(), [
      'j1',
      'j2',
    ]);
  });

  /**
   * A title match has no excerpt to show. Without the flag the row renders
   * empty and reads as a highlighting failure.
   */
  test('flags a match that is only in the title', async () => {
    await seed({
      id: 'j1',
      userId: 'user-alice',
      transcript: 'body text',
      callTitle: 'Acme renewal',
    });

    const { body } = await search(alice.authHeader, { q: 'acme' });

    assert.equal(body.data.results[0].titleOnlyMatch, true);
    assert.deepEqual(body.data.results[0].highlights, []);
  });

  test('returns timings from the segment the phrase was spoken in', async () => {
    await seed({
      id: 'j1',
      userId: 'user-alice',
      transcript: 'Good morning everyone please sign the contract',
      segments: [
        { text: 'Good morning everyone', start: 0, end: 3 },
        { text: 'please sign the contract', start: 3, end: 7 },
      ],
    });

    const [hit] = (await search(alice.authHeader, { q: 'contract' })).body.data.results[0]
      .highlights;

    assert.equal(hit.startSeconds, 3);
    assert.equal(hit.endSeconds, 7);
  });

  test('an unfinished job is not a result, even when its text would match', async () => {
    await seed({
      id: 'j1',
      userId: 'user-alice',
      transcript: 'partial contract text',
      status: 'running',
    });
    await seed({
      id: 'j2',
      userId: 'user-alice',
      transcript: 'failed contract text',
      status: 'failed',
    });

    assert.deepEqual(ids((await search(alice.authHeader, { q: 'contract' })).body), []);
  });

  test('no phrase browses everything, newest first', async () => {
    await seed({ id: 'j1', userId: 'user-alice', transcript: 'one' });
    await seed({ id: 'j2', userId: 'user-alice', transcript: 'two' });

    const { body } = await search(alice.authHeader, {});

    assert.equal(body.data.results.length, 2);
    assert.equal(body.data.results[0].matchCount, 0);
  });
});

describe('GET /search — the query is data, not pattern syntax', () => {
  /**
   * `%` unescaped is "match anything". The failure is silent and looks like
   * generous matching rather than a bug.
   */
  test('a percent sign matches literally', async () => {
    await seed({ id: 'j1', userId: 'user-alice', transcript: 'margin is 100% this quarter' });
    await seed({ id: 'j2', userId: 'user-alice', transcript: 'entirely unrelated' });

    assert.deepEqual(ids((await search(alice.authHeader, { q: '100%' })).body), ['j1']);
  });

  test('an underscore is not a single-character wildcard', async () => {
    await seed({ id: 'j1', userId: 'user-alice', transcript: 'the file is a_b today' });
    await seed({ id: 'j2', userId: 'user-alice', transcript: 'the file is axb today' });

    assert.deepEqual(ids((await search(alice.authHeader, { q: 'a_b' })).body), ['j1']);
  });

  test('a backslash matches literally', async () => {
    await seed({ id: 'j1', userId: 'user-alice', transcript: 'path C:\\\\temp was mentioned' });

    assert.deepEqual(ids((await search(alice.authHeader, { q: 'C:\\' })).body), ['j1']);
  });
});

describe('GET /search — filters', () => {
  beforeEach(async () => {
    await seed({
      id: 'early',
      userId: 'user-alice',
      transcript: 'contract talk',
      callDate: '2026-01-10',
    });
    await seed({
      id: 'late',
      userId: 'user-alice',
      transcript: 'contract talk',
      callDate: '2026-06-20',
    });
  });

  test('from and to bound the call date inclusively', async () => {
    assert.deepEqual(ids((await search(alice.authHeader, { from: '2026-06-01' })).body), ['late']);
    assert.deepEqual(ids((await search(alice.authHeader, { to: '2026-01-10' })).body), ['early']);
    assert.deepEqual(
      ids((await search(alice.authHeader, { from: '2026-01-10', to: '2026-06-20' })).body).sort(),
      ['early', 'late']
    );
  });

  test('rejects a malformed date rather than ignoring it', async () => {
    const { status, body } = await search(alice.authHeader, { from: '10/01/2026' });

    assert.equal(status, 400);
    assert.match(body.error, /YYYY-MM-DD/);
  });

  test('rejects a reversed range, which can only ever return nothing', async () => {
    const { status } = await search(alice.authHeader, { from: '2026-06-01', to: '2026-01-01' });

    assert.equal(status, 400);
  });

  test('limit is clamped, not trusted', async () => {
    assert.equal((await search(alice.authHeader, { limit: '1' })).body.data.limit, 1);
    assert.equal((await search(alice.authHeader, { limit: '99999' })).body.data.limit, 100);
    assert.equal((await search(alice.authHeader, { limit: '-5' })).body.data.limit, 25);
    assert.equal((await search(alice.authHeader, { limit: 'abc' })).body.data.limit, 25);
  });

  test('limit actually limits', async () => {
    assert.equal((await search(alice.authHeader, { limit: '1' })).body.data.results.length, 1);
  });
});

describe('GET /search — scoping', () => {
  /** A transcript is personal. This is the test that must never go green wrongly. */
  test("never returns another user's transcript", async () => {
    await seed({ id: 'hers', userId: 'user-alice', transcript: 'the contract is signed' });
    await seed({ id: 'his', userId: 'user-bob', transcript: 'the contract is signed' });

    assert.deepEqual(ids((await search(alice.authHeader, { q: 'contract' })).body), ['hers']);
    assert.deepEqual(ids((await search(bob.authHeader, { q: 'contract' })).body), ['his']);
  });

  test('browsing with no phrase is scoped too', async () => {
    await seed({ id: 'hers', userId: 'user-alice', transcript: 'anything' });
    await seed({ id: 'his', userId: 'user-bob', transcript: 'anything' });

    assert.deepEqual(ids((await search(alice.authHeader, {})).body), ['hers']);
  });

  test('requires authentication', async () => {
    const response = await fetch(`${baseUrl}/search?q=contract`);

    assert.equal(response.status, 401);
  });
});
