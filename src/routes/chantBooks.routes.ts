/**
 * HTTP surface for a learner's own uploaded chant books: upload + parse
 * into numbered verses (`BookVerseParser.ts`), browse them, and get one
 * verse's full pāda/word/gloss/meaning breakdown — computed on the AI on
 * demand the first time it's asked for (`ChantBookBreakdown.ts`), then
 * cached in `chant_book_verses.processed_data` (see `db/schema.ts`'s own
 * comment on that table for why this is lazy).
 *
 * Follows `resources.routes.ts`'s shape: a `createChantBooksRouter(deps)`
 * factory with `??`-defaulted dependencies, and `/:id/verses...` routes
 * registered so Express's own path-matching order isn't a concern (no
 * bare `/:id` route exists here to swallow anything, unlike that file's
 * own `/uploads`-before-`/:id` ordering note).
 *
 * Audio for a book verse reuses `POST /api/learn/speak` directly, the
 * same reasoning `chanting.routes.ts`'s own header already gives for the
 * built-in Guru Gita content — nothing here wraps that endpoint a second
 * time.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type { AiClient } from '../ai/AiClient.js';
import { ChantBooksStore } from '../learn/ChantBooks.js';
import { ChantBookVersesStore } from '../learn/ChantBookVerses.js';
import { parseBookVerses, BookParseError } from '../learn/BookVerseParser.js';
import { computeBreakdown, BreakdownParseError, BreakdownReconstructionError } from '../learn/ChantBookBreakdown.js';
import { splitIntoSyllables } from '../learn/Akshara.js';
import type { Language } from '../learn/Transliterator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';
import { uploadSingleOrReject } from '../middleware/upload.middleware.js';

export interface ChantBooksRouterDeps {
  aiClient: AiClient;
  booksFactory?: () => ChantBooksStore;
  versesFactory?: () => ChantBookVersesStore;
  /** Where uploaded books are written. Required whenever uploads are exercised — same reasoning as `ResourcesRouterDeps.storageRoot`. */
  storageRoot?: string;
  maxUploadBytes?: number;
}

/** Books are extracted-text, not scanned-image PDFs — smaller than `resources.routes.ts`'s own 500MB allowance for a scanned book, but generous for a text-based one. */
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.pdf', '.txt']);
/** Same value and reasoning as `translate.routes.ts`'s own `DOCUMENT_PARSE_TIMEOUT_MS` — kept as its own constant here rather than importing a private one across route files. */
const DOCUMENT_PARSE_TIMEOUT_MS = 30_000;

function isLanguage(value: unknown): value is Language {
  return value === 'sanskrit' || value === 'tamil';
}

async function extractText(filePath: string, extension: string): Promise<string> {
  if (extension === '.txt') {
    return (await readFile(filePath, 'utf-8')).trim();
  }
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`PDF parsing timed out after ${DOCUMENT_PARSE_TIMEOUT_MS}ms — the file may be malformed or unusually complex`)),
        DOCUMENT_PARSE_TIMEOUT_MS
      );
    });
    try {
      const result = await Promise.race([parser.getText(), timeout]);
      return result.pages.map((page) => page.text).join('\n\n').trim();
    } finally {
      clearTimeout(timer!);
    }
  } finally {
    await parser.destroy();
  }
}

export function createChantBooksRouter(deps: ChantBooksRouterDeps): Router {
  const router = Router();
  const newBooks = deps.booksFactory ?? (() => new ChantBooksStore());
  const newVerses = deps.versesFactory ?? (() => new ChantBookVersesStore());
  const uploadsDir = resolve(deps.storageRoot ?? 'storage', 'chant-book-uploads');
  const maxUploadBytes = deps.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(uploadsDir, { recursive: true })
          .then(() => cb(null, uploadsDir))
          .catch((error) => cb(error, uploadsDir));
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: maxUploadBytes },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_UPLOAD_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
        cb(null, true);
        return;
      }
      cb(new Error('Only PDF or plain-text (.txt) files are supported.'));
    },
  });
  const uploadBook = uploadSingleOrReject(upload, 'file', `${Math.round(maxUploadBytes / 1024 / 1024)}MB`);

  router.get('/', authenticate, anyRole, async (req: Request, res: Response) => {
    const languageParam = req.query.language;
    if (!isLanguage(languageParam)) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }
    const books = newBooks();
    try {
      const data = await books.list(req.user!.userId, languageParam);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Failed to load chant books:', error);
      res.status(500).json({ success: false, error: 'Failed to load your books', details: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      books.close();
    }
  });

  router.post('/', authenticate, anyRole, uploadBook, async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const languageParam = req.body?.language;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded — send it as multipart/form-data under the "file" field.' });
      return;
    }
    if (!isLanguage(languageParam) || !title) {
      await unlink(file.path).catch(() => {});
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil', and title is required" });
      return;
    }

    let rawText: string;
    try {
      rawText = await extractText(file.path, extname(file.originalname).toLowerCase());
    } catch (error) {
      await unlink(file.path).catch(() => {});
      console.error('Failed to extract text from uploaded book:', error);
      res.status(500).json({ success: false, error: 'Could not read that file', details: error instanceof Error ? error.message : 'Unknown error' });
      return;
    }

    let parsedVerses;
    try {
      parsedVerses = parseBookVerses(rawText);
    } catch (error) {
      await unlink(file.path).catch(() => {});
      if (error instanceof BookParseError) {
        res.status(422).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }

    const books = newBooks();
    const verses = newVerses();
    try {
      const book = await books.create(req.user!.userId, languageParam, title, file.originalname, file.filename, file.size);
      await verses.createMany(book.id, parsedVerses);
      res.status(201).json({ success: true, data: { ...book, verseCount: parsedVerses.length } });
    } catch (error) {
      await unlink(file.path).catch(() => {});
      console.error('Failed to save chant book:', error);
      res.status(500).json({ success: false, error: 'Failed to save your book', details: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      books.close();
      verses.close();
    }
  });

  router.get('/:id/verses', authenticate, anyRole, async (req: Request, res: Response) => {
    const books = newBooks();
    const verses = newVerses();
    try {
      const book = await books.get(req.user!.userId, req.params.id);
      if (!book) {
        res.status(404).json({ success: false, error: 'No such book' });
        return;
      }
      const data = await verses.listSummaries(book.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Failed to load book verses:', error);
      res.status(500).json({ success: false, error: 'Failed to load verses', details: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      books.close();
      verses.close();
    }
  });

  router.get('/:id/verses/:verseNumber', authenticate, anyRole, async (req: Request, res: Response) => {
    const verseNumber = Number(req.params.verseNumber);
    if (!Number.isInteger(verseNumber) || verseNumber < 1) {
      res.status(400).json({ success: false, error: 'verseNumber must be a positive integer' });
      return;
    }

    const books = newBooks();
    const verses = newVerses();
    try {
      const book = await books.get(req.user!.userId, req.params.id);
      if (!book) {
        res.status(404).json({ success: false, error: 'No such book' });
        return;
      }
      const verse = await verses.get(book.id, verseNumber);
      if (!verse) {
        res.status(404).json({ success: false, error: `No verse ${verseNumber} in this book` });
        return;
      }

      let breakdown = verse.breakdown;
      if (!breakdown) {
        if (!deps.aiClient.isConfigured) {
          res.status(503).json({ success: false, error: 'Breaking down a verse requires an AI provider, which is not configured.' });
          return;
        }
        try {
          breakdown = await computeBreakdown(deps.aiClient, verse.rawText, book.language);
        } catch (error) {
          if (error instanceof BreakdownParseError || error instanceof BreakdownReconstructionError) {
            // The specific parser/reconstruction message is internal detail
            // (e.g. "Pāda 2, line ... has no separator") — logged for
            // debugging, not shown as-is to a learner who has no way to act
            // on it. Same "clear but generic" tone translate.routes.ts uses
            // for its own AI-response-format failures.
            console.error('Verse breakdown failed:', error.message);
            res.status(502).json({ success: false, error: 'Could not break down that verse — try again.' });
            return;
          }
          throw error;
        }
        await verses.setBreakdown(book.id, verseNumber, breakdown);
      }

      res.json({
        success: true,
        data: {
          bookId: book.id,
          verseNumber,
          rawText: verse.rawText,
          padas: breakdown.padas.map((pada) => ({ ...pada, syllables: splitIntoSyllables(pada.text) })),
          meaning: breakdown.meaning,
          citation: breakdown.citation,
        },
      });
    } catch (error) {
      console.error('Failed to compute verse breakdown:', error);
      res.status(500).json({ success: false, error: 'Failed to break down that verse', details: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      books.close();
      verses.close();
    }
  });

  router.delete('/:id', authenticate, anyRole, async (req: Request, res: Response) => {
    const books = newBooks();
    try {
      const book = await books.remove(req.user!.userId, req.params.id);
      if (!book) {
        res.status(404).json({ success: false, error: 'No such book' });
        return;
      }
      const filePath = resolve(uploadsDir, book.storedFilename);
      await unlink(filePath).catch(() => {});
      res.json({ success: true, data: { id: book.id } });
    } catch (error) {
      console.error('Failed to delete chant book:', error);
      res.status(500).json({ success: false, error: 'Failed to delete that book', details: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      books.close();
    }
  });

  return router;
}

export default createChantBooksRouter;
