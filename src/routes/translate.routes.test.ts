/**
 * Exercises the translate router end to end over HTTP, the same way
 * `learn.routes.test.ts` does — real `express()` + `listen(0)` + `fetch`,
 * with `authenticate`/`anyRole` replaced by in-memory fakes via
 * `mock.module` so this can run under `bun test` without Postgres.
 *
 * `AiClient` needs no such treatment — it is a concrete class the router
 * takes as a dependency, so a real instance built from a fake `AiProvider`
 * (the same pattern `AiClient.test.ts` uses) is passed straight in.
 */
import { afterAll, describe, expect, mock, test } from 'bun:test';
import express from 'express';
import { AiClient, type AiProvider } from '../ai/AiClient.js';

const TEST_USER_ID = 'translate-test-user';

const realAuthMiddleware = await import('../middleware/auth.middleware.js');
const realPolicy = await import('../middleware/policy.js');

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

const { createTranslateRouter } = await import('./translate.routes.js');

function fakeProvider(response: string): AiProvider {
  return { name: 'Fake', generate: async () => response };
}

function buildApp(aiClient: AiClient) {
  const app = express();
  app.use(express.json());
  app.use('/api/translate', createTranslateRouter({ aiClient }));
  return app;
}

async function listen(app: express.Express) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://localhost:${port}/api/translate` };
}

describe('POST /translate', () => {
  test('rejects an empty text', async () => {
    const app = buildApp(new AiClient([fakeProvider('unused')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '   ', from: 'english', to: 'sanskrit' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('rejects an invalid language', async () => {
    const app = buildApp(new AiClient([fakeProvider('unused')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'klingon' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('same from/to language is transliteration-only, no AI call', async () => {
    const app = buildApp(
      new AiClient([
        {
          name: 'Should not be called',
          generate: async () => {
            throw new Error('AI must not be called for a same-language request');
          },
        },
      ])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'sanskrit' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('नमस्ते');
      expect(body.data.translationTransliteration).toBe('namaste');
    } finally {
      server.close();
    }
  });

  test('english to english is a true no-op with nothing to transliterate', async () => {
    const app = buildApp(
      new AiClient([{ name: 'unused', generate: async () => { throw new Error('must not be called'); } }])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual({ translation: 'hello' });
    } finally {
      server.close();
    }
  });

  test('english to sanskrit calls the AI and transliterates the result', async () => {
    const app = buildApp(new AiClient([fakeProvider('नमस्ते')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'sanskrit' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('नमस्ते');
      expect(body.data.translationTransliteration).toBe('namaste');
      expect(body.data.sourceTransliteration).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('sanskrit to english calls the AI and transliterates the source', async () => {
    const app = buildApp(new AiClient([fakeProvider('Greetings')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('Greetings');
      expect(body.data.sourceTransliteration).toBe('namaste');
      expect(body.data.translationTransliteration).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('sanskrit to tamil transliterates both source and result', async () => {
    const app = buildApp(new AiClient([fakeProvider('வணக்கம்')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'tamil' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('வணக்கம்');
      expect(body.data.sourceTransliteration).toBe('namaste');
      expect(typeof body.data.translationTransliteration).toBe('string');
    } finally {
      server.close();
    }
  });

  test('503s a real cross-language request when no AI provider is configured', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'sanskrit' }),
      });
      expect(res.status).toBe(503);
    } finally {
      server.close();
    }
  });

  test('transliteration-only still works with no AI provider configured', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'sanskrit' }),
      });
      expect(res.status).toBe(200);
    } finally {
      server.close();
    }
  });

  test('parses a marker-delimited {translation, meaning} response into separate fields', async () => {
    const response = '===TRANSLATION===\nनमस्ते\n===MEANING===\nA common Sanskrit greeting.';
    const app = buildApp(new AiClient([fakeProvider(response)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'sanskrit' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('नमस्ते');
      expect(body.data.meaning).toBe('A common Sanskrit greeting.');
      // translationTransliteration is derived from the PARSED translation
      // field, not the raw marker-delimited blob — proves the markers were
      // actually stripped before transliteration ran, not just left in.
      expect(body.data.translationTransliteration).toBe('namaste');
    } finally {
      server.close();
    }
  });

  test('a translation or meaning containing quotes/newlines survives intact (the whole reason this is not JSON)', async () => {
    const response =
      '===TRANSLATION===\nHe said "hello"\nacross two lines\n===MEANING===\nA quoted greeting, spanning\nmultiple lines too.';
    const app = buildApp(new AiClient([fakeProvider(response)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('He said "hello"\nacross two lines');
      expect(body.data.meaning).toBe('A quoted greeting, spanning\nmultiple lines too.');
    } finally {
      server.close();
    }
  });

  test('strips a markdown code fence around a plain answer before falling back (a common model deviation)', async () => {
    const fenced = '```\nGreetings\n```';
    const app = buildApp(new AiClient([fakeProvider(fenced)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      // Must be the fence-STRIPPED text, not the raw fenced blob — a
      // regression test for a real bug caught in review: the fallback
      // path once returned the un-stripped `raw` here, leaking literal
      // backtick markers into the translation.
      expect(body.data.translation).toBe('Greetings');
      expect(body.data.meaning).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('a response with no markers at all falls back to treating it as the translation, with no meaning', async () => {
    const app = buildApp(new AiClient([fakeProvider('Greetings')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('Greetings');
      expect(body.data.meaning).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('a translation marker with no meaning marker after it falls back to the whole response', async () => {
    const app = buildApp(new AiClient([fakeProvider('===TRANSLATION===\nGreetings, no meaning section here')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('===TRANSLATION===\nGreetings, no meaning section here');
      expect(body.data.meaning).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('every provider failing surfaces as a 500 with details', async () => {
    const app = buildApp(
      new AiClient([{ name: 'Failing', generate: async () => { throw new Error('boom'); } }])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'tamil' }),
      });
      expect(res.status).toBe(500);
    } finally {
      server.close();
    }
  });
});
