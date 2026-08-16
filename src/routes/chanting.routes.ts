/**
 * HTTP surface for the chanting-practice feature: verse content
 * (`src/learn/content/chanting.ts` — data, not code, same reasoning as
 * `resources.routes.ts`) plus the syllable/metrical-weight breakdown each
 * pāda needs for its pronunciation display (`src/learn/Akshara.ts`).
 *
 * Audio is deliberately NOT a route here — `POST /api/learn/speak` (see
 * `learn.routes.ts`) already accepts arbitrary Sanskrit text with
 * `language: 'sanskrit'` and this feature's verses are Sanskrit, so the UI
 * reuses that endpoint directly rather than this file wrapping it a second
 * time for no reason.
 *
 * Follows `resources.routes.ts`'s shape: a `createChantingRouter()`
 * factory, though this one needs no injectable dependencies at all — verse
 * content is static and `splitIntoSyllables` is a pure function, so there
 * is nothing here a test would ever need to fake.
 */
import { Router, Request, Response } from 'express';
import { guruGitaVerses, verseById, type ChantPada } from '../learn/content/chanting.js';
import { splitIntoSyllables, type Syllable } from '../learn/Akshara.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

interface PadaWithSyllables extends ChantPada {
  syllables: Syllable[];
}

function padaWithSyllables(pada: ChantPada): PadaWithSyllables {
  return { ...pada, syllables: splitIntoSyllables(pada.text) };
}

export function createChantingRouter(): Router {
  const router = Router();

  /**
   * The verse list, minus each verse's own syllable breakdown/citation —
   * just enough for a picker UI.
   *
   * `firstLine` (the opening pāda, in Devanagari) is here rather than left
   * to the client to derive: with 182 verses the picker's search box is the
   * only practical way to reach one, and searching only English `meaning`
   * would leave a learner who remembers how a verse BEGINS — the normal way
   * a chanted text is remembered — with nothing to type. Sending one pāda,
   * not all four, keeps this list a list.
   */
  router.get('/verses', authenticate, anyRole, (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: guruGitaVerses.map((verse) => ({
        id: verse.id,
        source: verse.source,
        verseNumber: verse.verseNumber,
        meaning: verse.meaning,
        firstLine: verse.padas[0]?.text ?? '',
      })),
    });
  });

  /** One verse in full, with each pāda's syllable/weight breakdown computed server-side so the UI never re-implements the phonology rules. */
  router.get('/verses/:id', authenticate, anyRole, (req: Request, res: Response) => {
    const verse = verseById(req.params.id);
    if (!verse) {
      res.status(404).json({ success: false, error: `No verse with id '${req.params.id}'` });
      return;
    }

    res.json({
      success: true,
      data: {
        ...verse,
        padas: verse.padas.map(padaWithSyllables),
      },
    });
  });

  return router;
}
