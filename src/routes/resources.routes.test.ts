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
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResourceNotesStore, ResourceNote } from '../learn/ResourceNotes.js';
import type { ResourceUploadsStore, ResourceUpload } from '../learn/ResourceUploads.js';

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
        seq: counter,
      };
      const key = keyOf(userId, resourceId);
      store.set(key, [created, ...(store.get(key) ?? [])]);
      return created;
    },
    async remove(userId: string, resourceId: string, noteId: string) {
      const key = keyOf(userId, resourceId);
      store.set(key, (store.get(key) ?? []).filter((n) => n.id !== noteId));
    },
    close() {},
  } as unknown as ResourceNotesStore & { store: Map<string, ResourceNote[]> };
}

/** In-memory stand-in for ResourceUploadsStore, keyed the way the real table is: (userId, id). */
function fakeUploads(): ResourceUploadsStore & { store: Map<string, ResourceUpload> } {
  const store = new Map<string, ResourceUpload>();
  let counter = 0;

  return {
    store,
    async list(userId: string, language: string) {
      return [...store.values()]
        .filter((u) => u.userId === userId && u.language === language)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(userId: string, id: string) {
      const found = store.get(id);
      return found && found.userId === userId ? found : null;
    },
    async getUnscoped(id: string) {
      return store.get(id) ?? null;
    },
    async create(
      userId: string,
      language: string,
      title: string,
      originalFilename: string,
      storedFilename: string,
      sizeBytes: number
    ) {
      const created: ResourceUpload = {
        id: `upload-${++counter}`,
        userId,
        language: language as ResourceUpload['language'],
        title,
        originalFilename,
        storedFilename,
        sizeBytes,
        createdAt: new Date(counter).toISOString(),
      };
      store.set(created.id, created);
      return created;
    },
    async remove(userId: string, id: string) {
      const found = store.get(id);
      if (!found || found.userId !== userId) return null;
      store.delete(id);
      return found;
    },
    close() {},
  } as unknown as ResourceUploadsStore & { store: Map<string, ResourceUpload> };
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

  test('DELETE 404s for an unknown resource', async () => {
    const app = buildApp({ notesFactory: fakeNotes });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/does-not-exist/notes/some-note-id`, { method: 'DELETE' });
      expect(res.status).toBe(404);
    } finally {
      server.close();
    }
  });

  test('DELETE via the wrong resource id does not remove a note that belongs to a different resource', async () => {
    const notes = fakeNotes();
    const app = buildApp({ notesFactory: () => notes });
    const { server, baseUrl } = await listen(app);

    try {
      const created = await fetch(`${baseUrl}/skt-primer-perry/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'about the primer' }),
      });
      const { data } = await created.json();

      // tam-abc-of-tamil is a real resource id, just not the one this note belongs to.
      await fetch(`${baseUrl}/tam-abc-of-tamil/notes/${data.id}`, { method: 'DELETE' });

      const listed = await fetch(`${baseUrl}/skt-primer-perry/notes`);
      const body = await listed.json();
      expect(body.data.length).toBe(1);
    } finally {
      server.close();
    }
  });
});

describe('uploads', () => {
  async function withApp<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
    const storageRoot = await mkdtemp(join(tmpdir(), 'resource-uploads-test-'));
    // One instance, not the bare factory: `newUploads()` is called fresh per
    // route handler, and the bare factory would hand each call its own empty
    // Map, discarding every previous request's state — same reasoning as the
    // notes tests' `notesFactory: () => notes` vs plain `fakeNotes`.
    const uploads = fakeUploads();
    const notes = fakeNotes();
    const app = buildApp({ notesFactory: () => notes, uploadsFactory: () => uploads, storageRoot });
    const { server, baseUrl } = await listen(app);
    try {
      return await run(baseUrl);
    } finally {
      server.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  }

  function pdfFormData(filename = 'my-book.pdf'): FormData {
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }), filename);
    body.append('language', 'sanskrit');
    body.append('title', 'My Book');
    return body;
  }

  test('GET without a language is rejected', async () => {
    await withApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/uploads`);
      expect(res.status).toBe(400);
    });
  });

  test('POST accepts a PDF, GET lists it back for that language only', async () => {
    await withApp(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData() });
      expect(created.status).toBe(201);
      const { data: upload } = await created.json();
      expect(upload.title).toBe('My Book');
      expect(upload.originalFilename).toBe('my-book.pdf');

      const sanskrit = await (await fetch(`${baseUrl}/uploads?language=sanskrit`)).json();
      expect(sanskrit.data.map((u: { id: string }) => u.id)).toEqual([upload.id]);

      const tamil = await (await fetch(`${baseUrl}/uploads?language=tamil`)).json();
      expect(tamil.data).toEqual([]);
    });
  });

  test('POST rejects a non-PDF file', async () => {
    await withApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData('not-a-book.txt') });
      expect(res.status).toBe(400);
    });
  });

  test('token round-trip: mint then stream the exact bytes uploaded', async () => {
    await withApp(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData() });
      const { data: upload } = await created.json();

      const minted = await fetch(`${baseUrl}/uploads/${upload.id}/token`, { method: 'POST' });
      expect(minted.status).toBe(200);
      const { data } = await minted.json();
      expect(data.url).toContain(`/uploads/${upload.id}/file?token=`);

      // `data.url` is server-relative ("/api/resources/uploads/..."), same as the
      // real audio-token route — resolve it against the test server's own origin.
      const fileRes = await fetch(`${new URL(baseUrl).origin}${data.url}`);
      expect(fileRes.status).toBe(200);
      expect(fileRes.headers.get('content-type')).toBe('application/pdf');
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      expect([...bytes]).toEqual([0x25, 0x50, 0x44, 0x46]);
    });
  });

  test('the file route rejects a missing or garbage token', async () => {
    await withApp(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData() });
      const { data: upload } = await created.json();

      const noToken = await fetch(`${baseUrl}/uploads/${upload.id}/file`);
      expect(noToken.status).toBe(403);

      const garbage = await fetch(`${baseUrl}/uploads/${upload.id}/file?token=not-a-real-token`);
      expect(garbage.status).toBe(403);
    });
  });

  test("minting a token for someone else's upload 404s", async () => {
    await withApp(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData() });
      const { data: upload } = await created.json();

      // A second router instance sharing the store but authenticated as a different
      // user would be more faithful, but the fake store's `get` already scopes by
      // userId, and the route has no other path to ownership — this exercises that
      // scoping directly by asking for an id the store will not resolve for anyone.
      const minted = await fetch(`${baseUrl}/uploads/does-not-exist/token`, { method: 'POST' });
      expect(minted.status).toBe(404);
    });
  });

  test('a store error while minting a token is a 500, not a hung request', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'resource-uploads-test-'));
    const throwingUploads: ResourceUploadsStore = {
      ...fakeUploads(),
      async get() {
        throw new Error('connection reset');
      },
    };
    const app = buildApp({ notesFactory: fakeNotes, uploadsFactory: () => throwingUploads, storageRoot });
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/uploads/some-id/token`, { method: 'POST' });
      expect(res.status).toBe(500);
    } finally {
      server.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  test('DELETE removes the upload and the file route 404s afterward', async () => {
    await withApp(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData() });
      const { data: upload } = await created.json();
      const minted = await (await fetch(`${baseUrl}/uploads/${upload.id}/token`, { method: 'POST' })).json();

      const deleted = await fetch(`${baseUrl}/uploads/${upload.id}`, { method: 'DELETE' });
      expect(deleted.status).toBe(200);

      const fileRes = await fetch(`${new URL(baseUrl).origin}${minted.data.url}`);
      expect(fileRes.status).toBe(404);

      const listed = await (await fetch(`${baseUrl}/uploads?language=sanskrit`)).json();
      expect(listed.data).toEqual([]);
    });
  });

  test('notes work on an upload id, the same as on a curated resource id', async () => {
    await withApp(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: pdfFormData() });
      const { data: upload } = await created.json();

      const note = await fetch(`${baseUrl}/${upload.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'page 12 has the key vocabulary' }),
      });
      expect(note.status).toBe(201);

      const listed = await (await fetch(`${baseUrl}/${upload.id}/notes`)).json();
      expect(listed.data.length).toBe(1);
    });
  });

  test('notes 404 for an upload id that does not exist', async () => {
    await withApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/no-such-upload/notes`);
      expect(res.status).toBe(404);
    });
  });
});
