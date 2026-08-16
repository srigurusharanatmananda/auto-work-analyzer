/**
 * Real `express()` + `listen(0)` + `fetch`, same shape as
 * `resources.routes.test.ts` — `authenticate`/`anyRole` replaced by
 * in-memory fakes so this runs under `bun test` without Postgres. No other
 * dependency to fake: `createChantingRouter()` takes none.
 */
import { afterAll, describe, expect, mock, test } from 'bun:test';
import express from 'express';

const TEST_USER_ID = 'chanting-test-user';

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

const { createChantingRouter } = await import('./chanting.routes.js');

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/chanting', createChantingRouter());
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://localhost:${port}/api/chanting` };
}

describe('GET /verses', () => {
  test('lists verses without their padas/citation', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/verses`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // All 182 verses of the short recension — see content/chanting.ts's
      // own file header for the sourcing/verification behind that count.
      expect(body.data).toHaveLength(182);
      const verse1 = body.data.find((v: { id: string }) => v.id === 'guru-gita-1');
      expect(verse1).toEqual({
        id: 'guru-gita-1',
        source: expect.stringContaining('Guru Gita'),
        verseNumber: 1,
        meaning: expect.stringContaining('Kailāsa'),
        // The opening pāda only — the picker searches on it, so it has to
        // be here, but sending all four would make this a detail response.
        firstLine: expect.stringContaining('कैलास'),
      });
      for (const entry of body.data) {
        expect(entry.padas).toBeUndefined();
      }
    } finally {
      server.close();
    }
  });
});

describe('GET /verses/:id', () => {
  test('returns the full verse with a computed syllable breakdown per pāda', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/verses/guru-gita-1`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.padas).toHaveLength(4);
      for (const pada of body.data.padas) {
        expect(pada.syllables).toHaveLength(8);
        expect(pada.syllables[7].weight).toBe('anceps');
      }
    } finally {
      server.close();
    }
  });

  test('404s for an unknown verse id', async () => {
    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/verses/does-not-exist`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });
});
