/**
 * The URL-ingestion HTTP contract.
 *
 * `mediaUrl`, `ssrfGuard` and `AudioFetcher` are each tested on their own. What
 * this pins is that the route actually *consults* them, in the right order, and
 * that a rejection at any layer stops the request before the next one runs —
 * a guard that is written but not reached is the failure mode worth testing
 * for, and this repo has had one before (`authorize()` applied to zero routes).
 *
 * Nothing here touches the network. The resolver and the fetcher are both
 * injected, which is the only way to test "this hostname resolves to
 * 169.254.169.254" at all.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createTranscriptionRouter } from './transcription.routes.js';
import { TranscriptionJobStore } from '../transcription/TranscriptionJobStore.js';
import { AudioFetcher, AudioFetchError } from '../transcription/AudioFetcher.js';
import { createTestUser } from '../testing/authFixture.js';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';

let pg: TestDatabase;
let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let user: Awaited<ReturnType<typeof createTestUser>>;
let storageRoot: string;
let audioDir: string;

/** Every URL the fetcher was asked for — empty means the guards stopped it. */
let fetched: Array<{ url: string; kind: string }>;
/** Every URL the SSRF guard was asked about. */
let resolved: string[];

/** Swapped per test to make the guard say no. */
let resolveVerdict: (url: string) => { ok: boolean; url?: string; reason?: string };
/** Swapped per test to make the download fail. */
let fetchBehaviour: (url: string, kind: string) => Promise<{ path: string; bytes: number }>;

async function fromUrl(body: unknown, auth: string | null = user.authHeader) {
  const response = await fetch(`${baseUrl}/from-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as any };
}

before(async () => {
  pg = await createTestDatabase();
  storageRoot = await mkdtemp(join(tmpdir(), 'awa-fromurl-'));
  audioDir = join(storageRoot, 'audio');

  const stubFetcher = {
    fetch: async (url: string, kind: string) => {
      fetched.push({ url, kind });
      return fetchBehaviour(url, kind);
    },
  } as unknown as AudioFetcher;

  const app = express();
  app.use(express.json());
  app.use(
    '/api/transcription',
    createTranscriptionRouter({
      store: new TranscriptionJobStore(),
      storageRoot,
      fetcher: stubFetcher,
      resolveUrl: (async (url: string) => {
        resolved.push(url);
        return resolveVerdict(url);
      }) as any,
      // Off for the bulk of the suite. The real limit is 10 per 15 minutes and
      // these tests make more requests than that between them, so leaving it on
      // would turn a working limiter into a wall of assertion failures halfway
      // down the file. It is proved separately, on the mount below.
      rateLimiter: (_req, _res, next) => next(),
    })
  );

  // A second mount with NO rateLimiter, so the default is the thing under test.
  app.use(
    '/api/throttled',
    createTranscriptionRouter({
      store: new TranscriptionJobStore(),
      storageRoot,
      fetcher: stubFetcher,
      resolveUrl: (async (url: string) => ({ ok: true, url })) as any,
    })
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

beforeEach(async () => {
  fetched = [];
  resolved = [];
  resolveVerdict = (url) => ({ ok: true, url });
  // The default: pretend the download worked, leaving a real file behind so the
  // Whisper path check has something to look at.
  fetchBehaviour = async () => {
    const path = join(audioDir, `${Math.random().toString(36).slice(2)}.mp3`);
    await writeFile(path, 'audio');
    return { path, bytes: 5 };
  };
  await rm(audioDir, { recursive: true, force: true });
  await import('node:fs/promises').then((fs) => fs.mkdir(audioDir, { recursive: true }));
});

describe('POST /from-url — the happy path', () => {
  test('queues a job for a direct audio link', async () => {
    const { status, body } = await fromUrl({ url: 'https://cdn.example.com/calls/standup.mp3' });

    assert.equal(status, 202);
    assert.equal(body.data.status, 'queued');
    assert.equal(body.data.originalFilename, 'standup.mp3');
    assert.deepEqual(fetched.map((f) => f.kind), ['file']);
  });

  test('queues a job for a YouTube link', async () => {
    const { status, body } = await fromUrl({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    assert.equal(status, 202);
    assert.equal(body.data.originalFilename, 'youtube-dQw4w9WgXcQ');
    assert.deepEqual(fetched.map((f) => f.kind), ['youtube']);
  });

  test('carries the title and date onto the job', async () => {
    const { body } = await fromUrl({
      url: 'https://cdn.example.com/a.mp3',
      callTitle: '  Acme renewal  ',
      callDate: '2026-08-01',
    });

    assert.equal(body.data.callTitle, 'Acme renewal');
    assert.equal(body.data.callDate, '2026-08-01');
  });

  /**
   * The name comes from the link the user pasted, not the one the redirects
   * landed on — a CDN's signed URL is not something anyone would recognise in
   * their recordings list.
   */
  test('names the recording after the pasted link, not the redirect target', async () => {
    resolveVerdict = () => ({ ok: true, url: 'https://cdn2.example.com/blob/9f8a7b6c?sig=xyz.mp3' });

    const { body } = await fromUrl({ url: 'https://cdn.example.com/calls/kickoff.mp3' });

    assert.equal(body.data.originalFilename, 'kickoff.mp3');
    // But the bytes come from where the redirect actually pointed.
    assert.match(fetched[0]!.url, /cdn2\.example\.com/);
  });
});

describe('POST /from-url — the guards are actually reached', () => {
  /**
   * The point of the whole file. A guard that exists but is never called is
   * indistinguishable from no guard, so each of these asserts on the *absence*
   * of the next step, not merely on the status code.
   */
  test('a scheme that is not http refuses before anything is resolved', async () => {
    const { status, body } = await fromUrl({ url: 'file:///etc/passwd.mp3' });

    assert.equal(status, 400);
    assert.match(body.error, /Only http and https/);
    assert.equal(resolved.length, 0, 'must not resolve');
    assert.equal(fetched.length, 0, 'must not fetch');
  });

  test('a private literal address refuses before anything is resolved', async () => {
    for (const url of [
      'http://127.0.0.1/a.mp3',
      'http://169.254.169.254/a.mp3',
      'http://[::1]/a.mp3',
      'http://10.0.0.1/a.mp3',
      'http://2130706433/a.mp3',
    ]) {
      resolved = [];
      fetched = [];
      const { status } = await fromUrl({ url });

      assert.equal(status, 400, url);
      assert.equal(resolved.length, 0, url);
      assert.equal(fetched.length, 0, url);
    }
  });

  test('a host merely claiming to be YouTube in its query string is refused', async () => {
    const { status } = await fromUrl({ url: 'https://evil.example.com/?x=youtube.com/watch' });

    assert.equal(status, 400);
    assert.equal(fetched.length, 0);
  });

  /** The check the syntactic layer cannot make. */
  test('a name that resolves privately is refused, and nothing is downloaded', async () => {
    resolveVerdict = () => ({
      ok: false,
      reason: 'cdn.example.com resolves to 169.254.169.254, which is not a public address',
    });

    const { status, body } = await fromUrl({ url: 'https://cdn.example.com/a.mp3' });

    assert.equal(status, 400);
    assert.match(body.error, /169\.254\.169\.254/);
    assert.equal(resolved.length, 1, 'the guard must have been consulted');
    assert.equal(fetched.length, 0, 'and must have stopped the download');
  });

  test('a playlist is refused with an explanation, not a generic error', async () => {
    const { status, body } = await fromUrl({ url: 'https://example.com/live.m3u8' });

    assert.equal(status, 400);
    assert.match(body.error, /playlist/);
    assert.equal(fetched.length, 0);
  });
});

describe('POST /from-url — failures', () => {
  test('a download failure is a 502, not a 500', async () => {
    fetchBehaviour = async () => {
      throw new AudioFetchError('That video is private');
    };

    const { status, body } = await fromUrl({ url: 'https://www.youtube.com/watch?v=abc' });

    // 502: the server worked, the upstream did not. A 500 would blame this app
    // for a video someone else made private.
    assert.equal(status, 502);
    assert.equal(body.error, 'That video is private');
  });

  test('no job is created when the download fails', async () => {
    fetchBehaviour = async () => {
      throw new AudioFetchError('nope');
    };
    await fromUrl({ url: 'https://cdn.example.com/x.mp3' });

    const list = await fetch(`${baseUrl}/jobs`, {
      headers: { Authorization: user.authHeader },
    }).then((r) => r.json() as any);

    assert.ok(
      !list.data.some((job: any) => job.originalFilename === 'x.mp3'),
      'a failed download must not leave a queued job'
    );
  });

  test('rejects a malformed callDate before fetching anything', async () => {
    const { status, body } = await fromUrl({
      url: 'https://cdn.example.com/a.mp3',
      callDate: '01-08-2026',
    });

    assert.equal(status, 400);
    assert.match(body.error, /YYYY-MM-DD/);
    assert.equal(fetched.length, 0);
  });

  test('asks for a link when the body has none', async () => {
    for (const body of [{}, { url: '' }, { url: '   ' }, { url: 42 }]) {
      const { status } = await fromUrl(body);
      assert.equal(status, 400);
    }
  });
});

describe('POST /from-url — access', () => {
  /**
   * Ordered before anything else on purpose: this route makes the server open
   * outbound connections, so an unauthenticated caller must not be able to
   * reach even the URL parser.
   */
  test('requires authentication', async () => {
    const { status } = await fromUrl({ url: 'https://cdn.example.com/a.mp3' }, null);

    assert.equal(status, 401);
    assert.equal(fetched.length, 0);
  });

  test('files the job against the caller', async () => {
    await fromUrl({ url: 'https://cdn.example.com/mine.mp3' });

    const list = await fetch(`${baseUrl}/jobs`, {
      headers: { Authorization: user.authHeader },
    }).then((r) => r.json() as any);

    assert.ok(list.data.some((job: any) => job.originalFilename === 'mine.mp3'));
  });

  test('leaves no orphan audio behind for a rejected link', async () => {
    await fromUrl({ url: 'http://127.0.0.1/a.mp3' });

    assert.deepEqual(await readdir(audioDir), []);
  });
});

describe('POST /from-url — throttling', () => {
  /**
   * Not a test of express-rate-limit; a test that the route has a limiter at
   * all. This is the one endpoint where the caller spends a few dozen bytes and
   * the server spends up to 500 MB of egress plus a Whisper slot, so an
   * unthrottled version of it is a denial-of-service primitive handed to every
   * authenticated user.
   */
  test('the default limiter is applied, and it eventually says no', async () => {
    const url = `${baseUrl.replace('/transcription', '/throttled')}/from-url`;
    const call = () =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user.authHeader },
        body: JSON.stringify({ url: 'https://cdn.example.com/a.mp3' }),
      });

    let sawLimit = false;
    for (let attempt = 0; attempt < 15 && !sawLimit; attempt += 1) {
      sawLimit = (await call()).status === 429;
    }

    assert.ok(sawLimit, 'an unthrottled /from-url is a denial-of-service primitive');
  });
});
