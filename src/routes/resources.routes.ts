/**
 * HTTP surface for reading resources: the curated list (`src/learn/content/
 * resources.ts` — data, not code, same reasoning as the curriculum
 * manifests) plus a learner's own notes on each one (`ResourceNotes.ts`,
 * Postgres-backed, per-user).
 *
 * Follows `learn.routes.ts`'s shape: a `createResourcesRouter(deps)` factory
 * with `??`-defaulted dependencies, so tests can inject a fake
 * `ResourceNotesStore` without touching Postgres.
 */
import { Router, Request, Response } from 'express';
import { resources, resourcesFor, resourceById, type ResourceLanguage } from '../learn/content/resources.js';
import { ResourceNotesStore } from '../learn/ResourceNotes.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

export interface ResourcesRouterDeps {
  /** Overridden in tests; each call gets a fresh connection, as before (mirrors LearnRouterDeps.progressFactory). */
  notesFactory?: () => ResourceNotesStore;
}

function isResourceLanguage(value: unknown): value is ResourceLanguage {
  return value === 'sanskrit' || value === 'tamil';
}

export function createResourcesRouter(deps: ResourcesRouterDeps = {}): Router {
  const router = Router();
  const newNotes = deps.notesFactory ?? (() => new ResourceNotesStore());

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
    if (!resourceById(req.params.id)) {
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
    if (!resourceById(req.params.id)) {
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
    if (!resourceById(req.params.id)) {
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
