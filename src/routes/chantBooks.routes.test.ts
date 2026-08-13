/**
 * Exercises the chant-books router end to end over HTTP, the same way
 * `resources.routes.test.ts` does — real `express()` + `listen(0)` +
 * `fetch`, `authenticate`/`anyRole` faked via `mock.module`, and real file
 * uploads to a temp directory (PDF extraction needs a real file on disk;
 * `.txt` uploads are used for most tests since they need no binary
 * fixture and exercise the exact same parsing/breakdown code paths).
 */
import { afterAll, describe, expect, mock, test } from 'bun:test';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiClient, type AiProvider } from '../ai/AiClient.js';
import type { ChantBooksStore, ChantBook } from '../learn/ChantBooks.js';
import type { ChantBookVersesStore, ChantBookVerse, ChantBookVerseBreakdown } from '../learn/ChantBookVerses.js';

const TEST_USER_ID = 'chant-books-test-user';
const OTHER_USER_ID = 'someone-else';

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

const { createChantBooksRouter } = await import('./chantBooks.routes.js');

function fakeProvider(response: string): AiProvider {
  return { name: 'Fake', generate: async () => response };
}

function fakeBooks(): ChantBooksStore & { store: Map<string, ChantBook> } {
  const store = new Map<string, ChantBook>();
  let counter = 0;
  return {
    store,
    async list(userId, language) {
      return [...store.values()].filter((b) => b.userId === userId && b.language === language);
    },
    async get(userId, id) {
      const found = store.get(id);
      return found && found.userId === userId ? found : null;
    },
    async create(userId, language, title, originalFilename, storedFilename, sizeBytes) {
      const created: ChantBook = {
        id: `book-${++counter}`,
        userId,
        language,
        title,
        originalFilename,
        storedFilename,
        sizeBytes,
        createdAt: new Date(counter).toISOString(),
      };
      store.set(created.id, created);
      return created;
    },
    async remove(userId, id) {
      const found = store.get(id);
      if (!found || found.userId !== userId) return null;
      store.delete(id);
      return found;
    },
    close() {},
  } as unknown as ChantBooksStore & { store: Map<string, ChantBook> };
}

function fakeVerses(): ChantBookVersesStore & { store: Map<string, ChantBookVerse[]> } {
  const store = new Map<string, ChantBookVerse[]>();
  let counter = 0;
  return {
    store,
    async listSummaries(bookId) {
      return (store.get(bookId) ?? []).map((v) => ({
        verseNumber: v.verseNumber,
        rawText: v.rawText,
        hasBreakdown: v.breakdown !== null,
      }));
    },
    async get(bookId, verseNumber) {
      return (store.get(bookId) ?? []).find((v) => v.verseNumber === verseNumber) ?? null;
    },
    async createMany(bookId, verses) {
      const rows: ChantBookVerse[] = verses.map((v) => ({
        id: `verse-${++counter}`,
        bookId,
        verseNumber: v.verseNumber,
        rawText: v.rawText,
        breakdown: null,
        processedAt: null,
      }));
      store.set(bookId, [...(store.get(bookId) ?? []), ...rows]);
    },
    async setBreakdown(bookId, verseNumber, breakdown: ChantBookVerseBreakdown) {
      const rows = store.get(bookId) ?? [];
      const row = rows.find((v) => v.verseNumber === verseNumber);
      if (row) {
        row.breakdown = breakdown;
        row.processedAt = new Date().toISOString();
      }
    },
    close() {},
  } as unknown as ChantBookVersesStore & { store: Map<string, ChantBookVerse[]> };
}

function buildApp(deps: Parameters<typeof createChantBooksRouter>[0]) {
  const app = express();
  app.use(express.json());
  app.use('/api/chant-books', createChantBooksRouter(deps));
  return app;
}

async function listen(app: express.Express) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://localhost:${port}/api/chant-books` };
}

function txtFormData(text: string, language: string, title: string, filename = 'book.txt'): FormData {
  const body = new FormData();
  body.append('file', new Blob([text], { type: 'text/plain' }), filename);
  body.append('language', language);
  body.append('title', title);
  return body;
}

const SANSKRIT_DANDA_TEXT = 'first verse text here ॥ १॥\nsecond verse text here ॥ २॥\nthird verse text here ॥ ३॥';

describe('POST /chant-books', () => {
  test('uploads a .txt file, parses it, and creates the book with its verses', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'chant-books-test-'));
    const app = buildApp({ aiClient: new AiClient([]), booksFactory: fakeBooks, versesFactory: fakeVerses, storageRoot });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        body: txtFormData(SANSKRIT_DANDA_TEXT, 'sanskrit', 'My Test Book'),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.title).toBe('My Test Book');
      expect(body.data.language).toBe('sanskrit');
      expect(body.data.verseCount).toBe(3);
    } finally {
      server.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  test('rejects a document with no numbered verses (422, naming the reason)', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'chant-books-test-'));
    const app = buildApp({ aiClient: new AiClient([]), booksFactory: fakeBooks, versesFactory: fakeVerses, storageRoot });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        body: txtFormData('just ordinary prose with no verse markers at all', 'sanskrit', 'Unparseable'),
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toContain('numbered verses');
    } finally {
      server.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  test('rejects missing language/title', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'chant-books-test-'));
    const app = buildApp({ aiClient: new AiClient([]), booksFactory: fakeBooks, versesFactory: fakeVerses, storageRoot });
    const { server, baseUrl } = await listen(app);
    try {
      const form = new FormData();
      form.append('file', new Blob([SANSKRIT_DANDA_TEXT], { type: 'text/plain' }), 'book.txt');
      const res = await fetch(baseUrl, { method: 'POST', body: form });
      expect(res.status).toBe(400);
    } finally {
      server.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  test('rejects an unsupported file extension', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'chant-books-test-'));
    const app = buildApp({ aiClient: new AiClient([]), booksFactory: fakeBooks, versesFactory: fakeVerses, storageRoot });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        body: txtFormData(SANSKRIT_DANDA_TEXT, 'sanskrit', 'Bad Extension', 'book.docx'),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});

describe('GET /chant-books', () => {
  test('lists only the caller\'s own books for the given language', async () => {
    const books = fakeBooks();
    await books.create(TEST_USER_ID, 'sanskrit', 'Mine', 'a.txt', 'a.txt', 10);
    await books.create(OTHER_USER_ID, 'sanskrit', 'Someone else\'s', 'b.txt', 'b.txt', 10);
    await books.create(TEST_USER_ID, 'tamil', 'Wrong language', 'c.txt', 'c.txt', 10);

    const app = buildApp({ aiClient: new AiClient([]), booksFactory: () => books, versesFactory: fakeVerses });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}?language=sanskrit`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toBe('Mine');
    } finally {
      server.close();
    }
  });
});

describe('GET /chant-books/:id/verses/:verseNumber', () => {
  test('computes and caches the breakdown on first request, reusing it on the second without another AI call', async () => {
    const books = fakeBooks();
    const verses = fakeVerses();
    const book = await books.create(TEST_USER_ID, 'sanskrit', 'Book', 'a.txt', 'a.txt', 10);
    await verses.createMany(book.id, [{ verseNumber: 1, rawText: 'कैलास शिखरे' }]);

    let callCount = 0;
    const provider: AiProvider = {
      name: 'Fake',
      generate: async () => {
        callCount++;
        return '===PADA===\nकैलास शिखरे — on the peak of Kailāsa (locative)\n===MEANING===\nOn the peak of Kailāsa.';
      },
    };

    const app = buildApp({ aiClient: new AiClient([provider]), booksFactory: () => books, versesFactory: () => verses });
    const { server, baseUrl } = await listen(app);
    try {
      const first = await fetch(`${baseUrl}/${book.id}/verses/1`);
      const firstBody = await first.json();
      expect(first.status).toBe(200);
      expect(firstBody.data.meaning).toBe('On the peak of Kailāsa.');
      expect(firstBody.data.padas[0].iast).toBe('kailāsa śikhare');
      expect(firstBody.data.padas[0].syllables.length).toBeGreaterThan(0);
      expect(callCount).toBe(1);

      const second = await fetch(`${baseUrl}/${book.id}/verses/1`);
      const secondBody = await second.json();
      expect(second.status).toBe(200);
      expect(secondBody.data.meaning).toBe('On the peak of Kailāsa.');
      expect(callCount).toBe(1); // cached — no second AI call
    } finally {
      server.close();
    }
  });

  test('503s when no AI provider is configured and the verse has no cached breakdown yet', async () => {
    const books = fakeBooks();
    const verses = fakeVerses();
    const book = await books.create(TEST_USER_ID, 'sanskrit', 'Book', 'a.txt', 'a.txt', 10);
    await verses.createMany(book.id, [{ verseNumber: 1, rawText: 'कैलास शिखरे' }]);

    const app = buildApp({ aiClient: new AiClient([]), booksFactory: () => books, versesFactory: () => verses });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/${book.id}/verses/1`);
      expect(res.status).toBe(503);
    } finally {
      server.close();
    }
  });

  test('404s for another user\'s book (ownership scoping)', async () => {
    const books = fakeBooks();
    const verses = fakeVerses();
    const book = await books.create(OTHER_USER_ID, 'sanskrit', 'Not yours', 'a.txt', 'a.txt', 10);
    await verses.createMany(book.id, [{ verseNumber: 1, rawText: 'कैलास शिखरे' }]);

    const app = buildApp({ aiClient: new AiClient([fakeProvider('unused')]), booksFactory: () => books, versesFactory: () => verses });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/${book.id}/verses/1`);
      expect(res.status).toBe(404);
    } finally {
      server.close();
    }
  });

  test('502s with a clear message when the AI response fails the reconstruction check, without caching the bad result', async () => {
    const books = fakeBooks();
    const verses = fakeVerses();
    const book = await books.create(TEST_USER_ID, 'sanskrit', 'Book', 'a.txt', 'a.txt', 10);
    await verses.createMany(book.id, [{ verseNumber: 1, rawText: 'कैलास शिखरे' }]);

    const provider = fakeProvider('===PADA===\nगलत — wrong content entirely\n===MEANING===\nWrong.');
    const app = buildApp({ aiClient: new AiClient([provider]), booksFactory: () => books, versesFactory: () => verses });
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/${book.id}/verses/1`);
      expect(res.status).toBe(502);

      const summaries = await verses.listSummaries(book.id);
      expect(summaries[0].hasBreakdown).toBe(false); // not cached
    } finally {
      server.close();
    }
  });
});

describe('DELETE /chant-books/:id', () => {
  test('removes the book (verse rows cascade in the real DB; here just the book row) and is scoped to the caller', async () => {
    const books = fakeBooks();
    const bookA = await books.create(TEST_USER_ID, 'sanskrit', 'Mine', 'a.txt', 'a.txt', 10);
    const bookB = await books.create(OTHER_USER_ID, 'sanskrit', 'Not mine', 'b.txt', 'b.txt', 10);

    const app = buildApp({ aiClient: new AiClient([]), booksFactory: () => books, versesFactory: fakeVerses });
    const { server, baseUrl } = await listen(app);
    try {
      const notMine = await fetch(`${baseUrl}/${bookB.id}`, { method: 'DELETE' });
      expect(notMine.status).toBe(404);
      expect(books.store.has(bookB.id)).toBe(true);

      const mine = await fetch(`${baseUrl}/${bookA.id}`, { method: 'DELETE' });
      expect(mine.status).toBe(200);
      expect(books.store.has(bookA.id)).toBe(false);
    } finally {
      server.close();
    }
  });
});
