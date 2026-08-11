/**
 * HTTP surface for reading resources: the curated list (`src/learn/content/
 * resources.ts` — data, not code, same reasoning as the curriculum
 * manifests), a learner's own notes on each one (`ResourceNotes.ts`,
 * Postgres-backed, per-user), and a learner's own uploaded books
 * (`ResourceUploads.ts`, same pattern).
 *
 * Follows `learn.routes.ts`'s shape: a `createResourcesRouter(deps)` factory
 * with `??`-defaulted dependencies, so tests can inject fakes without
 * touching Postgres or disk.
 *
 * The `/uploads...` routes are registered BEFORE `/:id` — Express matches in
 * registration order, and `/:id` would otherwise swallow `GET /uploads`
 * itself (id = "uploads") before it ever reached its own handler.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { resources, resourcesFor, resourceById, type ResourceLanguage } from '../learn/content/resources.js';
import { ResourceNotesStore } from '../learn/ResourceNotes.js';
import { ResourceUploadsStore } from '../learn/ResourceUploads.js';
import { mintUploadToken, verifyUploadToken } from '../learn/resourceUploadTokens.js';
import { parseByteRange } from '../transcription/byteRange.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

export interface ResourcesRouterDeps {
  /** Overridden in tests; each call gets a fresh connection, as before (mirrors LearnRouterDeps.progressFactory). */
  notesFactory?: () => ResourceNotesStore;
  /** Same reasoning as `notesFactory`. */
  uploadsFactory?: () => ResourceUploadsStore;
  /** Where uploaded books are written. Required whenever uploads are exercised — no on-disk default, same reasoning as `TranscriptionRouterDeps.storageRoot`. */
  storageRoot?: string;
}

/** Generous for a scanned book with images per page; a text-only PDF is a fraction of this. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.pdf']);

function isResourceLanguage(value: unknown): value is ResourceLanguage {
  return value === 'sanskrit' || value === 'tamil';
}

export function createResourcesRouter(deps: ResourcesRouterDeps = {}): Router {
  const router = Router();
  const newNotes = deps.notesFactory ?? (() => new ResourceNotesStore());
  const newUploads = deps.uploadsFactory ?? (() => new ResourceUploadsStore());
  const uploadsDir = resolve(deps.storageRoot ?? 'storage', 'resource-uploads');

  /**
   * A note can live on a curated resource OR on the caller's own upload —
   * the notes routes below accept either as `:id`. Curated ids are static and
   * checked synchronously; an upload id needs a scoped DB lookup, so this is
   * async even though the curated branch never awaits anything.
   */
  async function resourceIsReadable(userId: string, id: string): Promise<boolean> {
    if (resourceById(id)) return true;
    const uploads = newUploads();
    try {
      return (await uploads.get(userId, id)) !== null;
    } finally {
      uploads.close();
    }
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        // Created on demand — same reasoning as `transcription.routes.ts`'s audioDir.
        mkdir(uploadsDir, { recursive: true })
          .then(() => cb(null, uploadsDir))
          .catch((error) => cb(error, uploadsDir));
      },
      filename: (_req, file, cb) => {
        // A uuid, keeping only the extension — the browser-supplied name is
        // stored in the database for display, never trusted on the filesystem.
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_UPLOAD_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
        cb(null, true);
        return;
      }
      cb(new Error('Only PDF files are supported.'));
    },
  });

  /** Turns multer's rejections into 400s — see `transcription.routes.ts`'s `acceptAudio` for why. */
  const acceptUpload = (req: Request, res: Response, next: () => void): void => {
    upload.single('file')(req, res, (error: any) => {
      if (!error) {
        next();
        return;
      }
      res.status(400).json({
        success: false,
        error:
          error?.code === 'LIMIT_FILE_SIZE'
            ? `That file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`
            : error instanceof Error
              ? error.message
              : 'Upload rejected',
      });
    });
  };

  router.get('/uploads', authenticate, anyRole, async (req: Request, res: Response) => {
    const languageParam = req.query.language;
    if (!isResourceLanguage(languageParam)) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }

    const uploads = newUploads();
    try {
      const data = await uploads.list(req.user!.userId, languageParam);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Failed to load resource uploads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load your uploads',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      uploads.close();
    }
  });

  router.post('/uploads', authenticate, anyRole, acceptUpload, async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const languageParam = req.body?.language;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    if (!isResourceLanguage(languageParam) || !title) {
      await unlink(file.path).catch(() => {});
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil', and title is required" });
      return;
    }

    const uploads = newUploads();
    try {
      const data = await uploads.create(
        req.user!.userId,
        languageParam,
        title,
        file.originalname,
        file.filename,
        file.size
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      await unlink(file.path).catch(() => {});
      console.error('Failed to save resource upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save your upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      uploads.close();
    }
  });

  router.delete('/uploads/:id', authenticate, anyRole, async (req: Request, res: Response) => {
    const uploads = newUploads();
    try {
      const removed = await uploads.remove(req.user!.userId, req.params.id);
      if (removed) {
        await unlink(resolve(uploadsDir, removed.storedFilename)).catch(() => {});
      }
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('Failed to delete resource upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete your upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      uploads.close();
    }
  });

  /**
   * POST /api/resources/uploads/:id/token
   *
   * Mints a short-lived URL the reader `<iframe>` can actually fetch. This is
   * the route that checks ownership; the streaming route below checks only the
   * signature, because a framed request carries no Authorization header — same
   * split as `transcription.routes.ts`'s audio-token pair.
   */
  router.post('/uploads/:id/token', authenticate, anyRole, async (req: Request, res: Response) => {
    const uploads = newUploads();
    try {
      const found = await uploads.get(req.user!.userId, req.params.id);
      if (!found) {
        res.status(404).json({ success: false, error: 'No such upload' });
        return;
      }

      const { token, expiresAt } = mintUploadToken(found.id);
      res.json({
        success: true,
        data: {
          url: `/api/resources/uploads/${found.id}/file?token=${encodeURIComponent(token)}`,
          expiresAt: new Date(expiresAt).toISOString(),
        },
      });
    } finally {
      uploads.close();
    }
  });

  /**
   * GET /api/resources/uploads/:id/file?token=...
   *
   * Streams the PDF, with range support for progressive rendering. Authorised
   * by the signed token only, unscoped by user — see `resourceUploadTokens.ts`.
   */
  router.get('/uploads/:id/file', async (req: Request, res: Response) => {
    const verdict = verifyUploadToken(req.params.id, req.query.token as string | undefined);
    if (verdict.valid === false) {
      const expired = verdict.reason === 'expired';
      res.status(expired ? 401 : 403).json({
        success: false,
        error: expired ? 'This link has expired. Reopen the book.' : 'Not authorised to read this upload.',
      });
      return;
    }

    const uploads = newUploads();
    let found;
    try {
      found = await uploads.getUnscoped(req.params.id);
    } finally {
      uploads.close();
    }
    if (!found) {
      res.status(404).json({ success: false, error: 'No such upload' });
      return;
    }

    // Belt and braces — same reasoning as `transcription.routes.ts`'s audioDir check.
    const path = resolve(uploadsDir, found.storedFilename);
    if (!path.startsWith(uploadsDir + sep)) {
      console.error(`Refusing to serve ${path}: outside ${uploadsDir}`);
      res.status(404).json({ success: false, error: 'Upload is not available' });
      return;
    }

    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      res.status(404).json({ success: false, error: 'This upload is no longer on disk' });
      return;
    }

    const range = parseByteRange(req.headers.range, size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=0');
    // Same relaxation, same reasoning, as the audio streaming route: the UI and
    // API are different origins, and the URL's own token is what keeps this
    // private, not helmet's default same-origin CORP.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (range.kind === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${size}`);
      res.status(416).end();
      return;
    }

    const { start, end } = range.kind === 'partial' ? range : { start: 0, end: Math.max(0, size - 1) };
    if (range.kind === 'partial') {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length', String(size === 0 ? 0 : end - start + 1));

    if (req.method === 'HEAD' || size === 0) {
      res.end();
      return;
    }

    const stream = createReadStream(path, { start, end });
    stream.on('error', () => res.end());
    req.on('close', () => stream.destroy());
    stream.pipe(res);
  });

  router.get('/', authenticate, anyRole, (req: Request, res: Response) => {
    const languageParam = req.query.language;

    if (languageParam !== undefined && !isResourceLanguage(languageParam)) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }

    const data = isResourceLanguage(languageParam) ? resourcesFor(languageParam) : resources;
    res.json({ success: true, data });
  });

  router.get('/:id', authenticate, anyRole, (req: Request, res: Response) => {
    const resource = resourceById(req.params.id);

    if (!resource) {
      res.status(404).json({ success: false, error: 'No such resource' });
      return;
    }

    res.json({ success: true, data: resource });
  });

  router.get('/:id/notes', authenticate, anyRole, async (req: Request, res: Response) => {
    if (!(await resourceIsReadable(req.user!.userId, req.params.id))) {
      res.status(404).json({ success: false, error: 'No such resource' });
      return;
    }

    const notes = newNotes();
    try {
      const data = await notes.list(req.user!.userId, req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Failed to load resource notes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load resource notes',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      notes.close();
    }
  });

  router.post('/:id/notes', authenticate, anyRole, async (req: Request, res: Response) => {
    if (!(await resourceIsReadable(req.user!.userId, req.params.id))) {
      res.status(404).json({ success: false, error: 'No such resource' });
      return;
    }

    const { note } = req.body ?? {};
    if (typeof note !== 'string' || note.trim().length === 0) {
      res.status(400).json({ success: false, error: 'note must be a non-empty string' });
      return;
    }

    const notes = newNotes();
    try {
      const data = await notes.create(req.user!.userId, req.params.id, note.trim());
      res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Failed to save resource note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save resource note',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      notes.close();
    }
  });

  router.delete('/:id/notes/:noteId', authenticate, anyRole, async (req: Request, res: Response) => {
    if (!(await resourceIsReadable(req.user!.userId, req.params.id))) {
      res.status(404).json({ success: false, error: 'No such resource' });
      return;
    }

    const notes = newNotes();
    try {
      await notes.remove(req.user!.userId, req.params.id, req.params.noteId);
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('Failed to delete resource note:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete resource note',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      notes.close();
    }
  });

  return router;
}

export default createResourcesRouter;
