/**
 * Exercises the resources router end to end over HTTP, the same way
 * `learn.routes.test.ts` does — real `express()` + `listen(0)` + `fetch`,
 * with `authenticate`/`anyRole` replaced by in-memory fakes via
 * `mock.module` so this can run under `bun test` without Postgres.
 * `ResourceNotesStore` does not need that treatment — the router's
 * `ResourcesRouterDeps` already injects it, so a fake is passed straight in.
 */
import { afterAll, describe, expect, mock, test } from 'bun:test';
import express from 'express';
import type { ResourceNotesStore, ResourceNote } from '../learn/ResourceNotes.js';

const TEST_USER_ID = 'resources-test-user';

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

const { createResourcesRouter } = await import('./resources.routes.js');

/** In-memory stand-in for ResourceNotesStore. One array per (userId, resourceId). */
function fakeNotes(): ResourceNotesStore & { store: Map<string, ResourceNote[]> } {
  const store = new Map<string, ResourceNote[]>();
  const keyOf = (userId: string, resourceId: string) => `${userId}:${resourceId}`;
  let counter = 0;

  return {
    store,
    async list(userId: string, resourceId: string) {
      return [...(store.get(keyOf(userId, resourceId)) ?? [])];
    },
    async create(userId: string, resourceId: string, note: string) {
      const created: ResourceNote = {
        id: `note-${++counter}`,
        resourceId,
        note,
        createdAt: new Date(counter).toISOString(),
        updatedAt: new Date(counter).toISOString(),
      };
      const key = keyOf(userId, resourceId);
      store.set(key, [created, ...(store.get(key) ?? [])]);
      return created;
    },
    async remove(userId: string, noteId: string) {
      for (const [key, notes] of store) {
        if (!key.startsWith(`${userId}:`)) continue;
        store.set(key, notes.filter((n) => n.id !== noteId));
      }
    },
    close() {},
  } as unknown as ResourceNotesStore & { store: Map<string, ResourceNote[]> };
}

function buildApp(deps: Parameters<typeof createResourcesRouter>[0]) {
  const app = express();
  app.use(express.json());
  app.use('/api/resources', createResourcesRouter(deps));
  return app;
}

async function listen(app: express.Express) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://localhost:${port}/api/resources` };
}

describe('GET /resources', () => {
  test('returns every resource when no language is given', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(baseUrl);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.some((r: { language: string }) => r.language === 'sanskrit')).toBe(true);
      expect(body.data.some((r: { language: string }) => r.language === 'tamil')).toBe(true);
    } finally {
      server.close();
    }
  });

  test('filters by language', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}?language=tamil`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.every((r: { language: string }) => r.language === 'tamil')).toBe(true);
    } finally {
      server.close();
    }
  });

  test('rejects an invalid language', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}?language=klingon`);
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });
});

describe('GET /resources/:id', () => {
  test('returns a known resource', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/skt-primer-perry`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.id).toBe('skt-primer-perry');
    } finally {
      server.close();
    }
  });

  test('404s for an unknown resource', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/does-not-exist`);
      expect(res.status).toBe(404);
    } finally {
      server.close();
    }
  });
});

describe('notes', () => {
  test('POST creates a note, GET lists it back', async () => {
    const notes = fakeNotes();
    const app = buildApp({ notesFactory: () => notes });
    const { server, baseUrl } = await listen(app);

    try {
      const created = await fetch(`${baseUrl}/skt-primer-perry/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Lesson I is straightforward.' }),
      });
      expect(created.status).toBe(201);

      const listed = await fetch(`${baseUrl}/skt-primer-perry/notes`);
      const body = await listed.json();

      expect(body.data.length).toBe(1);
      expect(body.data[0].note).toBe('Lesson I is straightforward.');
    } finally {
      server.close();
    }
  });

  test('POST rejects an empty note', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/skt-primer-perry/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: '   ' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('POST 404s for an unknown resource', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/does-not-exist/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'hello' }),
      });
      expect(res.status).toBe(404);
    } finally {
      server.close();
    }
  });

  test('DELETE removes a note', async () => {
    const notes = fakeNotes();
    const app = buildApp({ notesFactory: () => notes });
    const { server, baseUrl } = await listen(app);

    try {
      const created = await fetch(`${baseUrl}/skt-primer-perry/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'to be deleted' }),
      });
      const { data } = await created.json();

      const deleted = await fetch(`${baseUrl}/skt-primer-perry/notes/${data.id}`, { method: 'DELETE' });
      expect(deleted.status).toBe(200);

      const listed = await fetch(`${baseUrl}/skt-primer-perry/notes`);
      const body = await listed.json();
      expect(body.data.length).toBe(0);
    } finally {
      server.close();
    }
  });
});
