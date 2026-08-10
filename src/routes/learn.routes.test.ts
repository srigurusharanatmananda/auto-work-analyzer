/**
 * Exercises the learn router end to end over HTTP, the same way
 * templates.routes.mount.test.ts proves a router is mounted and
 * authenticated — `express()` + a real `listen(0)` + `fetch` — but goes
 * further into the authenticated behaviour, because that behaviour is the
 * whole point of this router.
 *
 * `authenticate`/`anyRole` construct a real `AuthService`, which needs
 * Postgres — exactly what `templates.routes.mount.test.ts`'s header says
 * cannot happen under `bun test` in this repo. So this file replaces those
 * two modules with in-memory fakes via `mock.module`, imported fresh (via
 * dynamic `import()`, after the mock is installed) so `learn.routes.ts`
 * links against the fakes rather than the real, DB-backed middleware.
 * `afterAll` restores the real modules so no other test file that resolves
 * '../middleware/auth.middleware.js' or '../middleware/policy.js' after this
 * one sees the fake.
 *
 * `ProgressService`, `AudioCache` and `SpeechClient` do not need that
 * treatment — the router's `LearnRouterDeps` already injects those, so the
 * fakes below are passed straight in, no module mocking required.
 */
import { afterAll, describe, expect, mock, test } from 'bun:test';
import express from 'express';
import type { ProgressService } from '../learn/Progress.js';
import type { AudioCache } from '../learn/AudioCache.js';
import type { SpeechClient, SynthesisResult, SynthesizeOptions } from '../learn/SpeechClient.js';
import { DEFAULT_PROSODY, SpeechUnavailableError, SynthesisFailedError } from '../learn/SpeechClient.js';
import { sanskritManifest } from '../learn/content/sanskrit.js';

const TEST_USER_ID = 'learn-test-user';

// --- Real modules, captured before mocking so they can be restored. ---
const realAuthMiddleware = await import('../middleware/auth.middleware.js');
const realPolicy = await import('../middleware/policy.js');

// A fixed, always-valid caller — no JWT, no user table, no Postgres. The
// router only ever reads `req.user!.userId`, which this supplies directly.
mock.module('../middleware/auth.middleware.js', () => ({
  ...realAuthMiddleware,
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: TEST_USER_ID, email: 'learner@example.com', role: 'user', fullName: 'Learner' };
    next();
  },
}));
mock.module('../middleware/policy.js', () => ({
  ...realPolicy,
  anyRole: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

afterAll(() => {
  mock.module('../middleware/auth.middleware.js', () => realAuthMiddleware);
  mock.module('../middleware/policy.js', () => realPolicy);
});

// Imported dynamically, and only after the mocks above are installed, so this
// module (and the two it wires in) resolve against the fakes rather than the
// real, Postgres-backed middleware.
const { createLearnRouter } = await import('./learn.routes.js');

/** In-memory stand-in for ProgressService. One Set per (userId, language). */
function fakeProgress(): ProgressService & { seenByKey: Map<string, Set<string>>; recordSeenCalls: number } {
  const seenByKey = new Map<string, Set<string>>();
  const keyOf = (userId: string, language: string) => `${userId}:${language}`;

  return {
    seenByKey,
    recordSeenCalls: 0,
    async seenLessonIds(userId: string, language: string) {
      return new Set(seenByKey.get(keyOf(userId, language)) ?? []);
    },
    async recordSeen(userId: string, language: string, lessonId: string, _correct: boolean) {
      const key = keyOf(userId, language);
      const set = seenByKey.get(key) ?? new Set<string>();
      set.add(lessonId);
      seenByKey.set(key, set);
      (this as any).recordSeenCalls += 1;
    },
    close() {},
  } as unknown as ProgressService & { seenByKey: Map<string, Set<string>>; recordSeenCalls: number };
}

/** In-memory stand-in for AudioCache, keyed the same way the real one is (by triple). */
function fakeAudioCache(): AudioCache & { store: Map<string, Buffer>; getCalls: number; putCalls: number } {
  const store = new Map<string, Buffer>();
  const keyFor = (text: string, voice: string, prosody: string) => JSON.stringify([text, voice, prosody]);

  return {
    store,
    getCalls: 0,
    putCalls: 0,
    async get(text: string, voice: string, prosody: string) {
      (this as any).getCalls += 1;
      return store.get(keyFor(text, voice, prosody)) ?? null;
    },
    async put(text: string, voice: string, prosody: string, audio: Buffer) {
      (this as any).putCalls += 1;
      store.set(keyFor(text, voice, prosody), audio);
    },
  } as unknown as AudioCache & { store: Map<string, Buffer>; getCalls: number; putCalls: number };
}

/** In-memory stand-in for SpeechClient whose behaviour a test controls directly. */
function fakeSpeechClient(
  behaviour: (options: SynthesizeOptions) => SynthesisResult | Promise<SynthesisResult>
): SpeechClient & { calls: SynthesizeOptions[] } {
  const calls: SynthesizeOptions[] = [];
  return {
    calls,
    async synthesize(options: SynthesizeOptions) {
      calls.push(options);
      return behaviour(options);
    },
  } as unknown as SpeechClient & { calls: SynthesizeOptions[] };
}

function buildApp(deps: Parameters<typeof createLearnRouter>[0]) {
  const app = express();
  app.use(express.json());
  app.use('/api/learn', createLearnRouter(deps));
  return app;
}

async function listen(app: express.Express) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://localhost:${port}/api/learn` };
}

describe('GET /learn/lessons', () => {
  test('returns the whole manifest, in order, regardless of progress', async () => {
    const app = buildApp({ progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/lessons?language=sanskrit`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.lessons).toEqual(sanskritManifest.lessons);
    } finally {
      server.close();
    }
  });

  test('rejects an invalid language', async () => {
    const app = buildApp({ progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/lessons?language=klingon`);
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });
});

describe('GET /learn/next', () => {
  test('returns the first lesson and correct counts for a fresh user', async () => {
    const progress = fakeProgress();
    const app = buildApp({ progressFactory: () => progress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/next?language=sanskrit`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({
        success: true,
        data: {
          lesson: sanskritManifest.lessons[0],
          seenCount: 0,
          total: sanskritManifest.lessons.length,
        },
      });
    } finally {
      server.close();
    }
  });

  test('rejects an invalid language with 400, before touching progress', async () => {
    const progress = fakeProgress();
    const app = buildApp({ progressFactory: () => progress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/next?language=klingon`);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      expect(progress.recordSeenCalls).toBe(0);
    } finally {
      server.close();
    }
  });

  test('missing language is also 400', async () => {
    const app = buildApp({ progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/next`);
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });
});

describe('POST /learn/seen', () => {
  test('an unknown lessonId is 400 and never reaches progress.recordSeen', async () => {
    const progress = fakeProgress();
    const app = buildApp({ progressFactory: () => progress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', lessonId: 'not-a-real-lesson', correct: true }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(progress.recordSeenCalls).toBe(0);
    } finally {
      server.close();
    }
  });

  test('a valid lessonId records progress and returns updated counts', async () => {
    const progress = fakeProgress();
    const app = buildApp({ progressFactory: () => progress });
    const { server, baseUrl } = await listen(app);
    const firstLessonId = sanskritManifest.lessons[0]!.id;

    try {
      const res = await fetch(`${baseUrl}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', lessonId: firstLessonId, correct: true }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(progress.recordSeenCalls).toBe(1);
      expect(progress.seenByKey.get(`${TEST_USER_ID}:sanskrit`)?.has(firstLessonId)).toBe(true);
      expect(body).toEqual({
        success: true,
        data: {
          lesson: sanskritManifest.lessons[1],
          seenCount: 1,
          total: sanskritManifest.lessons.length,
        },
      });
    } finally {
      server.close();
    }
  });

  test('correct defaults to false when omitted', async () => {
    const progress = fakeProgress();
    const recorded: boolean[] = [];
    const original = progress.recordSeen.bind(progress);
    progress.recordSeen = (async (userId: string, language: string, lessonId: string, correct: boolean) => {
      recorded.push(correct);
      return original(userId, language, lessonId, correct);
    }) as ProgressService['recordSeen'];

    const app = buildApp({ progressFactory: () => progress });
    const { server, baseUrl } = await listen(app);
    const firstLessonId = sanskritManifest.lessons[0]!.id;

    try {
      const res = await fetch(`${baseUrl}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', lessonId: firstLessonId }),
      });
      expect(res.status).toBe(200);
      expect(recorded).toEqual([false]);
    } finally {
      server.close();
    }
  });

  test('a non-boolean correct is 400', async () => {
    const app = buildApp({ progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);
    const firstLessonId = sanskritManifest.lessons[0]!.id;

    try {
      const res = await fetch(`${baseUrl}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', lessonId: firstLessonId, correct: 'yes' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });
});

describe('POST /learn/speak', () => {
  test('picks the synthesizer by language, via speechClientFor', async () => {
    const tamilClient = fakeSpeechClient(() => ({
      audio: Buffer.from('tamil-audio'),
      contentType: 'audio/wav',
    }));
    const sanskritClient = fakeSpeechClient(() => ({
      audio: Buffer.from('sanskrit-audio'),
      contentType: 'audio/wav',
    }));
    const speechClientFor = mock((language: string) =>
      language === 'tamil' ? tamilClient : sanskritClient
    );

    const app = buildApp({
      audioCache: fakeAudioCache(),
      speechClientFor,
      progressFactory: fakeProgress,
    });
    const { server, baseUrl } = await listen(app);

    try {
      const tamilRes = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'tamil', text: 'ந' }),
      });
      expect(Buffer.from(await tamilRes.arrayBuffer()).toString()).toBe('tamil-audio');

      const sanskritRes = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न' }),
      });
      expect(Buffer.from(await sanskritRes.arrayBuffer()).toString()).toBe('sanskrit-audio');

      expect(speechClientFor).toHaveBeenCalledWith('tamil');
      expect(speechClientFor).toHaveBeenCalledWith('sanskrit');
    } finally {
      server.close();
    }
  });

  test('a cache hit returns the cached bytes and never calls speechClient', async () => {
    const audioCache = fakeAudioCache();
    const speechClient = fakeSpeechClient(() => {
      throw new Error('should not be called on a cache hit');
    });
    const cachedBytes = Buffer.from('cached-audio-bytes');
    // Pre-seed the cache with exactly what the route will look up: text after
    // transliteration (identity, for both languages today), the default
    // voice, DEFAULT_PROSODY.
    await audioCache.put('न', 'default', DEFAULT_PROSODY, cachedBytes);

    const app = buildApp({ audioCache, speechClientFor: () => speechClient, progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न' }),
      });
      const bytes = Buffer.from(await res.arrayBuffer());

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/wav');
      expect(bytes.equals(cachedBytes)).toBe(true);
      expect(speechClient.calls.length).toBe(0);
    } finally {
      server.close();
    }
  });

  test('a cache miss calls speechClient, then writes the result into the cache', async () => {
    const audioCache = fakeAudioCache();
    const synthesized = Buffer.from('freshly-synthesized');
    const speechClient = fakeSpeechClient(() => ({ audio: synthesized, contentType: 'audio/wav' }));

    const app = buildApp({ audioCache, speechClientFor: () => speechClient, progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न' }),
      });
      const bytes = Buffer.from(await res.arrayBuffer());

      expect(res.status).toBe(200);
      expect(bytes.equals(synthesized)).toBe(true);
      expect(speechClient.calls.length).toBe(1);
      // The cache key is the POST-transliteration text — identity, today, so
      // this equals the raw Devanagari the request sent.
      expect(speechClient.calls[0]!.text).toBe('न');
      expect(audioCache.putCalls).toBe(1);
      expect(audioCache.store.get(JSON.stringify(['न', 'default', DEFAULT_PROSODY]))?.equals(synthesized)).toBe(true);
    } finally {
      server.close();
    }
  });

  test('SpeechUnavailableError from speechClient is 503, not 500', async () => {
    const audioCache = fakeAudioCache();
    const speechClient = fakeSpeechClient(() => {
      throw new SpeechUnavailableError('TTS service is not up yet');
    });

    const app = buildApp({ audioCache, speechClientFor: () => speechClient, progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न' }),
      });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body).toEqual({ success: false, error: 'TTS service is not up yet' });
    } finally {
      server.close();
    }
  });

  test('SynthesisFailedError from speechClient is 500', async () => {
    const audioCache = fakeAudioCache();
    const speechClient = fakeSpeechClient(() => {
      throw new SynthesisFailedError('the model choked on this input');
    });

    const app = buildApp({ audioCache, speechClientFor: () => speechClient, progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न' }),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });

  test('empty text is 400', async () => {
    const app = buildApp({
      audioCache: fakeAudioCache(),
      speechClientFor: () =>
        fakeSpeechClient(() => {
          throw new Error('should not be called');
        }),
      progressFactory: fakeProgress,
    });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: '   ' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('an empty-string voice falls back to the shared default, not a distinct cache entry', async () => {
    const audioCache = fakeAudioCache();
    const synthesized = Buffer.from('audio-for-default-voice');
    const speechClient = fakeSpeechClient(() => ({ audio: synthesized, contentType: 'audio/wav' }));

    const app = buildApp({ audioCache, speechClientFor: () => speechClient, progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न', voice: '' }),
      });

      expect(res.status).toBe(200);
      // '' must resolve to the same CACHE entry an omitted `voice` would —
      // not its own, which would silently split the cache in two for what a
      // caller would expect to be the same request. It must NOT resolve to
      // the literal string 'default' being sent to the synthesizer as a
      // voice name — that string is a cache-key label, not a real voice a
      // provider would recognise, and sending it broke every real Gemini
      // call that omitted a voice. `undefined` here is what lets each
      // backend's own default apply.
      expect(speechClient.calls[0]!.voice).toBeUndefined();
      expect(audioCache.store.has(JSON.stringify(['न', 'default', DEFAULT_PROSODY]))).toBe(true);
    } finally {
      server.close();
    }
  });

  test('a cache-write failure after successful synthesis still serves the audio', async () => {
    const audio = Buffer.from('synthesized-despite-cache-failure');
    const audioCache: AudioCache = {
      async get() {
        return null;
      },
      async put() {
        throw new Error('ENOSPC: no space left on device');
      },
    } as unknown as AudioCache;
    const speechClient = fakeSpeechClient(() => ({ audio, contentType: 'audio/wav' }));

    const app = buildApp({ audioCache, speechClientFor: () => speechClient, progressFactory: fakeProgress });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'sanskrit', text: 'न' }),
      });
      const bytes = Buffer.from(await res.arrayBuffer());

      // The whole point: a cache write failing must not throw away audio
      // that was already successfully synthesized and is sitting in memory.
      expect(res.status).toBe(200);
      expect(bytes.equals(audio)).toBe(true);
    } finally {
      server.close();
    }
  });
});
