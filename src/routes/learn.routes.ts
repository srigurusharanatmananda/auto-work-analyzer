/**
 * HTTP surface for the Sanskrit/Tamil learning module.
 *
 * Every backend piece already exists — `Curriculum` (what's next),
 * `Progress` (what's been seen), `AudioCache` + `SpeechClient` (text to
 * speech, cached) and `Transliterator` (script the learner sees vs. script
 * the synthesiser is fed). This file only wires them behind three routes; see
 * `docs/specs/2026-08-08-learning-module-design.md`.
 *
 * Follows `reports.routes.ts`'s shape: a `createLearnRouter(deps)` factory
 * with `??`-defaulted dependencies, so tests can inject fakes for the
 * database-backed `ProgressService` and the filesystem/network-backed
 * `AudioCache`/`SpeechClient` without touching Postgres or a socket.
 */
import { Router, Request, Response } from 'express';
import { nextLesson, type Lesson, type Manifest } from '../learn/Curriculum.js';
import { sanskritManifest } from '../learn/content/sanskrit.js';
import { tamilManifest } from '../learn/content/tamil.js';
import { ProgressService } from '../learn/Progress.js';
import { AudioCache } from '../learn/AudioCache.js';
import { SpeechClient, DEFAULT_PROSODY, SpeechUnavailableError } from '../learn/SpeechClient.js';
import { transliterateForSynthesis } from '../learn/Transliterator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

export interface LearnRouterDeps {
  /** Overridden in tests; each call gets a fresh connection, as before (mirrors ReportsRouterDeps.databaseFactory). */
  progressFactory?: () => ProgressService;
  audioCache?: AudioCache;
  speechClient?: SpeechClient;
}

/**
 * Voice used when the caller does not name one. One literal, shared by the
 * cache lookup and the synthesis call, so a request that omits `voice`
 * reliably hits the same cache entry a previous omitted-`voice` request wrote.
 */
const DEFAULT_VOICE = 'default';

/** The only two languages this module teaches. `null` for anything else. */
function manifestFor(language: string): Manifest | null {
  if (language === 'sanskrit') return sanskritManifest;
  if (language === 'tamil') return tamilManifest;
  return null;
}

/** Shape shared by GET /learn/next and POST /learn/seen, so a client can update its state from either response. */
function progressPayload(
  manifest: Manifest,
  seen: ReadonlySet<string>
): { lesson: Lesson | null; seenCount: number; total: number } {
  return {
    lesson: nextLesson(manifest, seen),
    seenCount: seen.size,
    total: manifest.lessons.length,
  };
}

export function createLearnRouter(deps: LearnRouterDeps = {}): Router {
  const router = Router();
  const newProgress = deps.progressFactory ?? (() => new ProgressService());
  const audioCache = deps.audioCache ?? new AudioCache();
  const speechClient = deps.speechClient ?? new SpeechClient();

  router.get('/next', authenticate, anyRole, async (req: Request, res: Response) => {
    const languageParam = req.query.language;
    const manifest = typeof languageParam === 'string' ? manifestFor(languageParam) : null;

    if (!manifest) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }

    const progress = newProgress();
    try {
      const seen = await progress.seenLessonIds(req.user!.userId, manifest.language);
      res.json({ success: true, data: progressPayload(manifest, seen) });
    } catch (error) {
      console.error('Failed to load next lesson:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load next lesson',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      progress.close();
    }
  });

  router.post('/seen', authenticate, anyRole, async (req: Request, res: Response) => {
    const { language, lessonId, correct } = req.body ?? {};
    const manifest = typeof language === 'string' ? manifestFor(language) : null;

    if (!manifest) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }

    // Stops a client-side bug, or a stale cached lesson id, from silently
    // recording progress against a lesson that no longer (or never did) exist.
    if (typeof lessonId !== 'string' || !manifest.lessons.some((lesson) => lesson.id === lessonId)) {
      res.status(400).json({
        success: false,
        error: `lessonId must be an id from the '${manifest.language}' manifest`,
      });
      return;
    }

    if (correct !== undefined && typeof correct !== 'boolean') {
      res.status(400).json({ success: false, error: 'correct must be a boolean' });
      return;
    }

    const progress = newProgress();
    try {
      await progress.recordSeen(req.user!.userId, manifest.language, lessonId, correct === true);
      // Recomputed, not just echoed back — so the client can update its state
      // from this one round trip without a second request to GET /learn/next.
      const seen = await progress.seenLessonIds(req.user!.userId, manifest.language);
      res.json({ success: true, data: progressPayload(manifest, seen) });
    } catch (error) {
      console.error('Failed to record lesson seen:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record lesson seen',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      progress.close();
    }
  });

  router.post('/speak', authenticate, anyRole, async (req: Request, res: Response) => {
    const { language, text, voice } = req.body ?? {};
    const manifest = typeof language === 'string' ? manifestFor(language) : null;

    if (!manifest) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }

    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ success: false, error: 'text must be a non-empty string' });
      return;
    }

    if (voice !== undefined && typeof voice !== 'string') {
      res.status(400).json({ success: false, error: 'voice must be a string' });
      return;
    }

    // Always run, for every language — the identity function for Tamil, so
    // this is a uniform step, not a per-language branch.
    const synthesisText = transliterateForSynthesis(text.trim(), manifest.language);
    // `voice ?? DEFAULT_VOICE` only substitutes on null/undefined, so a
    // caller sending `voice: ''` would silently split the cache from every
    // other request for the same text instead of falling back to the shared
    // default. Trim, then treat blank the same as absent.
    const trimmedVoice = typeof voice === 'string' ? voice.trim() : '';
    const resolvedVoice = trimmedVoice !== '' ? trimmedVoice : DEFAULT_VOICE;

    // A learner is waiting synchronously on this request, unlike a background
    // transcription job — SpeechClient's own default health-check timeout
    // (3 minutes, generous by design for a slow-loading model) would leave
    // "Play audio" hung that long on every cache miss while no TTS server
    // exists. Aborting sooner makes SpeechClient's own poll loop notice on
    // its next iteration and throw SpeechUnavailableError, which the catch
    // below already turns into a fast 503.
    const SPEAK_TIMEOUT_MS = 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SPEAK_TIMEOUT_MS);

    try {
      const cached = await audioCache.get(synthesisText, resolvedVoice, DEFAULT_PROSODY);
      if (cached) {
        // AudioCache stores raw bytes only, with no content-type metadata, so
        // this hardcodes the format Indic-Parler-TTS is expected to emit —
        // the same format SpeechClient.ts itself defaults to when the TTS
        // server's response omits a content-type header.
        res.setHeader('Content-Type', 'audio/wav');
        res.send(cached);
        return;
      }

      const result = await speechClient.synthesize({
        text: synthesisText,
        voice: resolvedVoice,
        prosody: DEFAULT_PROSODY,
        signal: controller.signal,
      });

      try {
        await audioCache.put(synthesisText, resolvedVoice, DEFAULT_PROSODY, result.audio);
      } catch (cacheError) {
        // The synthesis already succeeded and the caller is still waiting on
        // audio it paid for — a cache write failing (disk full, EACCES) is a
        // reason to skip the cache, not to throw away bytes already in hand
        // and fail the whole request as if synthesis itself had failed.
        console.error('Failed to write learn-audio cache entry (serving audio anyway):', cacheError);
      }

      res.setHeader('Content-Type', result.contentType);
      res.send(result.audio);
    } catch (error) {
      // Distinguished from every other failure: "the TTS service is not up"
      // is the expected, common case right now (no TTS server exists yet),
      // and a caller needs to be able to tell that apart from "broke".
      if (error instanceof SpeechUnavailableError) {
        res.status(503).json({ success: false, error: error.message });
        return;
      }
      console.error('Failed to synthesize speech:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to synthesize speech',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      clearTimeout(timer);
    }
  });

  return router;
}

export default createLearnRouter;
