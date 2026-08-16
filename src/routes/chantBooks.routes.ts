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
import { readFile, unlink } from 'node:fs/promises';
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
import { createUuidDiskStorage, uploadSingleOrReject } from '../middleware/upload.middleware.js';

export interface ChantBooksRouterDeps {
  aiClient: AiClient;
  booksFactory?: () => ChantBooksStore;
  versesFactory?: () => ChantBookVersesStore;
  /** Where uploaded books are written. Required whenever uploads are exercised — same reasoning as `ResourcesRouterDeps.storageRoot`. */
  storageRoot?: string;
  maxUploadBytes?: number;
}

/**
 * Same 500MB allowance `resources.routes.ts` gives a scanned book: multer
 * streams the upload straight to disk, so this bounds disk usage.
 *
 * It does NOT bound RAM on its own, and the analogy to `resources.routes.ts`
 * stops there — that route only stores what it takes, while this one parses
 * it, and `extractText` below must read the whole file into one Buffer
 * because pdf-parse has no streaming API. `withExclusivePdfParse` is what
 * makes the peak bounded: one parse at a time, so the worst case is one
 * file's buffer rather than one per concurrent upload.
 *
 * This was 50MB, on the reasoning that a chant book is extracted-text
 * rather than scanned-image PDF and so would be far smaller. That reasoning
 * doesn't survive contact with real books: a scripture edition is routinely
 * hundreds of pages carrying embedded fonts and page images *alongside* its
 * text layer, and 50MB rejected ordinary uploads.
 *
 * To be clear about what the raise does and does not buy: this admits large
 * TEXT-LAYER books. A PDF that is purely page images still has nothing to
 * extract and is rejected below, at any size — there is no OCR in this
 * path.
 */
const DEFAULT_MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.pdf', '.txt']);
/**
 * Was 30s, copied from `translate.routes.ts`'s own `DOCUMENT_PARSE_TIMEOUT_MS`
 * — but that bounds a single translated page, whereas this bounds extracting
 * text from a whole book, and the size limit above is now ten times what it
 * was. A several-hundred-page PDF genuinely takes longer than 30s to walk,
 * and aborting it mid-parse looks to the learner like a corrupt file rather
 * than a timeout. Still bounded, just at book scale.
 */
const DOCUMENT_PARSE_TIMEOUT_MS = 5 * 60_000;

/**
 * Only one PDF is parsed at a time, process-wide.
 *
 * Multer streams the upload to disk, so the 500MB cap above really does bound
 * disk rather than RAM — but `extractText` then undoes that by reading the
 * whole file into a single Buffer for pdf-parse, which has no streaming API.
 * `translate.routes.ts` faces the same constraint and answers it by capping at
 * 20MB; a chant book cannot, because a real scripture edition is genuinely
 * large. So the cap stays at 500MB and the CONCURRENCY is bounded instead:
 * without this, a handful of simultaneous large uploads allocate their buffers
 * at once and OOM-kill the API for every user, and pdf.js parsing is
 * CPU-bound enough to stall the event loop for minutes besides.
 *
 * A queue rather than a rejection: an upload that waits is a slow upload, an
 * upload that 503s is a lost one, and the learner has already spent the
 * transfer time by the time we get here.
 */
let pdfParseQueue: Promise<unknown> = Promise.resolve();
export function withExclusivePdfParse<T>(run: () => Promise<T>): Promise<T> {
  // `.catch(() => {})` on the tail, not on the returned promise: one upload's
  // failure must not reject the next one's turn, but the caller still needs
  // to see its own error.
  const turn = pdfParseQueue.then(run);
  pdfParseQueue = turn.catch(() => {});
  return turn;
}

function isLanguage(value: unknown): value is Language {
  return value === 'sanskrit' || value === 'tamil';
}

async function extractText(filePath: string, extension: string): Promise<string> {
  if (extension === '.txt') {
    return (await readFile(filePath, 'utf-8')).trim();
  }
  return withExclusivePdfParse(async () => {
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
  });
}

export function createChantBooksRouter(deps: ChantBooksRouterDeps): Router {
  const router = Router();
  const newBooks = deps.booksFactory ?? (() => new ChantBooksStore());
  const newVerses = deps.versesFactory ?? (() => new ChantBookVersesStore());
  const uploadsDir = resolve(deps.storageRoot ?? 'storage', 'chant-book-uploads');
  const maxUploadBytes = deps.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  const upload = multer({
    storage: createUuidDiskStorage(uploadsDir),
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

    const extension = extname(file.originalname).toLowerCase();
    let rawText: string;
    try {
      rawText = await extractText(file.path, extension);
    } catch (error) {
      await unlink(file.path).catch(() => {});
      console.error('Failed to extract text from uploaded book:', error);
      res.status(500).json({ success: false, error: 'Could not read that file', details: error instanceof Error ? error.message : 'Unknown error' });
      return;
    }

    // Extraction succeeding but yielding nothing is the scanned-PDF case,
    // and it needs its own message. Left to fall through, empty text
    // reaches `parseBookVerses` and comes back "Could not find numbered
    // verses in this document" — which tells the learner their book is
    // badly numbered when the truth is that it is page images with no text
    // layer at all, and sends them off to re-check numbering they cannot
    // fix. There is no OCR anywhere in this path, so the honest advice is
    // a different source file, not "try again".
    if (!rawText) {
      await unlink(file.path).catch(() => {});
      res.status(422).json({
        success: false,
        error:
          extension === '.pdf'
            ? 'That PDF has no extractable text — it looks like page images (a scan) rather than a text-layer PDF. Try a PDF you can select text in, or paste the verses into a .txt file.'
            : 'That file is empty.',
      });
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
    let createdBookId: string | undefined;
    try {
      const book = await books.create(req.user!.userId, languageParam, title, file.originalname, file.filename, file.size);
      createdBookId = book.id;
      await verses.createMany(book.id, parsedVerses);
      res.status(201).json({ success: true, data: { ...book, verseCount: parsedVerses.length } });
    } catch (error) {
      await unlink(file.path).catch(() => {});
      // Book creation and verse-row insertion are two separate writes, not
      // one transaction — if the second fails after the first succeeded,
      // clean up the now-orphaned book row (pointing at a file that was
      // just deleted above) rather than leaving a zero-verse book behind.
      if (createdBookId) {
        await books.remove(req.user!.userId, createdBookId).catch(() => {});
      }
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

      // splitIntoSyllables (Akshara.ts, @vipran/aksharas) analyses
      // Devanagari specifically — confirmed directly, not assumed: it
      // returns an empty array for Tamil text, silently dropping the
      // whole guru/laghu breakdown rather than erroring. No Tamil
      // equivalent exists in this codebase yet (the built-in Guru Gita
      // chanting content is Sanskrit-only, so this gap never surfaced
      // before a Tamil book could be uploaded), so Tamil verses
      // deliberately get an empty `syllables` array rather than a
      // misleading Sanskrit-only analysis — the UI hides that section
      // when it's empty instead of showing a blank one.
      res.json({
        success: true,
        data: {
          bookId: book.id,
          verseNumber,
          rawText: verse.rawText,
          padas: breakdown.padas.map((pada) => ({
            ...pada,
            syllables: book.language === 'sanskrit' ? splitIntoSyllables(pada.text) : [],
          })),
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
