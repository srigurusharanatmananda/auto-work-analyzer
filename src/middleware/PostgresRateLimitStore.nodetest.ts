/**
 * `rate_limit_hits`: the shared counter behind `PostgresRateLimitStore`.
 *
 * Runs against a real Postgres schema of its own, under `tsx --test` — the
 * same fixture `Progress.nodetest.ts` uses.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { PostgresRateLimitStore } from './PostgresRateLimitStore.js';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';

const WINDOW_MS = 60_000;

let db: TestDatabase;
let now: number;
let store: PostgresRateLimitStore;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  // The fixture's schema is dropped wholesale in `after`, but truncating
  // between tests (the same pattern Progress.nodetest.ts uses) keeps each
  // test's assertions independent of what an earlier test left behind.
  await db.sql`TRUNCATE rate_limit_hits`;
  now = Date.parse('2026-08-10T00:00:00.000Z');
  store = new PostgresRateLimitStore({
    limiter: 'test-limiter',
    windowMs: WINDOW_MS,
    sql: db,
    now: () => now,
  });
});

describe('increment', () => {
  test('the first hit for a key starts a window at 1', async () => {
    const result = await store.increment('client-a');
    assert.equal(result.totalHits, 1);
    assert.equal(result.resetTime?.getTime(), now + WINDOW_MS);
  });

  test('repeated hits inside the same window accumulate', async () => {
    await store.increment('client-a');
    await store.increment('client-a');
    const third = await store.increment('client-a');
    assert.equal(third.totalHits, 3);
  });

  test('two different keys accumulate independently', async () => {
    await store.increment('client-a');
    await store.increment('client-a');
    const b = await store.increment('client-b');
    assert.equal(b.totalHits, 1);
  });

  test('two different limiters do not share a counter for the same key', async () => {
    const other = new PostgresRateLimitStore({
      limiter: 'other-limiter',
      windowMs: WINDOW_MS,
      sql: db,
      now: () => now,
    });

    await store.increment('shared-key');
    await store.increment('shared-key');
    const otherResult = await other.increment('shared-key');

    assert.equal(otherResult.totalHits, 1, 'a different limiter must start its own window');
  });
});

describe('window expiry', () => {
  test('a hit after the window has elapsed resets the count to 1 and starts a new window', async () => {
    await store.increment('client-a');
    await store.increment('client-a');

    now += WINDOW_MS + 1; // past the reset time returned above

    const result = await store.increment('client-a');
    assert.equal(result.totalHits, 1, 'the elapsed window must not carry its count forward');
    assert.equal(result.resetTime?.getTime(), now + WINDOW_MS);
  });

  test('a hit exactly at the reset time also starts a new window', async () => {
    const first = await store.increment('client-a');
    now = first.resetTime!.getTime();

    const result = await store.increment('client-a');
    assert.equal(result.totalHits, 1);
  });
});

describe('decrement', () => {
  test('decrementing reduces the count within the window', async () => {
    await store.increment('client-a');
    await store.increment('client-a');
    await store.decrement('client-a');

    const result = await store.get('client-a');
    assert.equal(result?.totalHits, 1);
  });

  test('decrementing below zero floors at zero rather than going negative', async () => {
    await store.increment('client-a');
    await store.decrement('client-a');
    await store.decrement('client-a');

    const result = await store.get('client-a');
    assert.equal(result?.totalHits, 0);
  });

  test('decrementing a key with no row is a no-op', async () => {
    await store.decrement('never-seen');
    const result = await store.get('never-seen');
    assert.equal(result, undefined);
  });
});

describe('express-rate-limit integration', () => {
  /**
   * The real bug this guards against: express-rate-limit's own double-count
   * guard buckets stores by `store.constructor.name` when `localKeys` is
   * falsy — which every instance of THIS class shares, regardless of
   * `limiter`. Production stacks two of these (`apiRateLimiter` mounted
   * globally, `authRateLimiter` mounted on auth routes specifically) on the
   * same request, and without a distinct `prefix` per instance (see
   * `prefixFor`), that single request would throw `ERR_ERL_DOUBLE_COUNT` —
   * not a contrived scenario, the normal path for every `/api/auth/*`
   * request. Exercised here with two REAL `rateLimit()` middlewares stacked
   * on one real Express route, not by asserting on `prefix`/`localKeys`
   * directly, since what actually matters is that express-rate-limit's own
   * validation logic is satisfied end to end.
   */
  test('two different limiters stacked on one request do not trigger a false double-count', async () => {
    const outer = rateLimit({
      windowMs: WINDOW_MS,
      limit: 100,
      store: new PostgresRateLimitStore({ limiter: 'api-like', windowMs: WINDOW_MS, sql: db, now: () => now }),
    });
    const inner = rateLimit({
      windowMs: WINDOW_MS,
      limit: 5,
      store: new PostgresRateLimitStore({ limiter: 'auth-like', windowMs: WINDOW_MS, sql: db, now: () => now }),
    });

    const app = express();
    app.use(outer);
    app.get('/login', inner, (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    try {
      const port = (server.address() as { port: number }).port;
      const res = await fetch(`http://localhost:${port}/login`);
      assert.equal(res.status, 200, 'a request through two independently-scoped limiters must succeed, not 500');
      const body = await res.json();
      assert.deepEqual(body, { ok: true });
    } finally {
      server.close();
    }
  });
});

describe('resetKey', () => {
  test('resetKey clears the counter entirely', async () => {
    await store.increment('client-a');
    await store.increment('client-a');
    await store.resetKey('client-a');

    const result = await store.get('client-a');
    assert.equal(result, undefined);

    const fresh = await store.increment('client-a');
    assert.equal(fresh.totalHits, 1, 'after a reset, the next hit starts a fresh window');
  });
});
