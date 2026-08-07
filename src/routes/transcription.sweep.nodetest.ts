/**
 * The sweep HTTP contract.
 *
 * `TranscriptSweeper.nodetest.ts` covers what a sweep does. This covers what
 * the route hands it, which is where the dangerous mistakes live: this is the
 * only path into ClickUp with no per-item review, so "what did the body have to
 * say for real tasks to be created" is the question worth pinning.
 *
 * The sweeper is a stub that records its arguments. Running the real one would
 * test extraction again and reach a model.
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
import type {
  SweepOptions,
  SweptJobResult,
  TranscriptSweeper,
} from '../calls/TranscriptSweeper.js';

let pg: TestDatabase;
let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let user: Awaited<ReturnType<typeof createTestUser>>;
let storageRoot: string;

/** Every (userId, options) the route passed to the sweeper. */
let calls: Array<{ userId: string; options: SweepOptions }>;

const stubSweeper = {
  run: async (userId: string, options: SweepOptions) => {
    calls.push({ userId, options });
    return {
      dryRun: options.dryRun === true,
      jobs: [] as SweptJobResult[],
      totalTasksCreated: 0,
    };
  },
} as unknown as TranscriptSweeper;

async function sweep(body: unknown, auth = user.authHeader) {
  const response = await fetch(`${baseUrl}/sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as any };
}

before(async () => {
  pg = await createTestDatabase();
  storageRoot = await mkdtemp(join(tmpdir(), 'awa-sweep-'));

  const app = express();
  app.use(express.json());
  app.use(
    '/api/transcription',
    createTranscriptionRouter({
      store: new TranscriptionJobStore(),
      storageRoot,
      sweeper: stubSweeper,
    })
  );
  // A second mount with NO sweeper, for the not-configured case.
  app.use(
    '/api/bare',
    createTranscriptionRouter({ store: new TranscriptionJobStore(), storageRoot })
  );

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/transcription`;
  user = await createTestUser();
});

after(async () => {
  server?.close();
  await rm(storageRoot, { recursive: true, force: true });
  await pg?.drop();
});

beforeEach(() => {
  calls = [];
});

describe('POST /sweep — dryRun is safe by default', () => {
  /**
   * The load-bearing default. Every other route into ClickUp shows you the
   * tasks and waits; this one does not, so the answer you get by FORGETTING
   * the flag has to be the harmless one.
   */
  test('an empty body is a dry run', async () => {
    const { status } = await sweep({});

    assert.equal(status, 200);
    assert.equal(calls[0]!.options.dryRun, true);
  });

  test('anything other than exactly false is a dry run', async () => {
    for (const value of [undefined, null, 'false', 0, 'no']) {
      calls = [];
      await sweep({ dryRun: value });
      assert.equal(calls[0]!.options.dryRun, true, `dryRun: ${JSON.stringify(value)}`);
    }
  });

  test('only a literal false creates tasks', async () => {
    await sweep({ dryRun: false });

    assert.equal(calls[0]!.options.dryRun, false);
  });
});

describe('POST /sweep — grouping', () => {
  test('is passed through when valid', async () => {
    for (const grouping of ['per-item', 'single-task', 'by-theme']) {
      calls = [];
      const { status } = await sweep({ grouping });

      assert.equal(status, 200);
      assert.equal(calls[0]!.options.grouping, grouping);
    }
  });

  /**
   * Rejected, not silently defaulted. A typo that quietly became "per-item"
   * would file a different shape than the preview showed — and the preview is
   * the only review this path gets.
   */
  test('an unknown grouping is a 400, not a fallback', async () => {
    const { status, body } = await sweep({ grouping: 'by-vibes' });

    assert.equal(status, 400);
    assert.match(body.error, /Unknown grouping/);
    assert.equal(calls.length, 0, 'the sweeper must not run at all');
  });

  test('omitting it leaves the sweeper to decide', async () => {
    await sweep({});

    assert.equal(calls[0]!.options.grouping, undefined);
  });
});

describe('POST /sweep — access', () => {
  test('sweeps for the caller, not a default user', async () => {
    await sweep({});

    assert.equal(calls[0]!.userId, user.userId);
  });

  test('requires authentication', async () => {
    const response = await fetch(`${baseUrl}/sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    assert.equal(response.status, 401);
  });

  /** Explains itself rather than 404ing on a feature that exists. */
  test('says so when no sweeper is configured', async () => {
    const response = await fetch(`${baseUrl.replace('/transcription', '/bare')}/sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: user.authHeader },
      body: '{}',
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /not configured/);
  });
});
