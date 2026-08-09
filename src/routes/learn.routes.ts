/**
 * HTTP surface for the Sanskrit/Tamil learning module.
 *
 * Every backend piece already exists — `Curriculum` (what's next),
 * `Progress` (what's been seen), `AudioCache` (text to speech, cached),
 * `Transliterator` (script the learner sees vs. script the synthesiser is
 * fed), and two speech backends: `SpeechClient` (self-hosted Indic-Parler-TTS,
 * see `services/tts` — Sanskrit, which Gemini does not support) and
 * `GeminiSpeechClient` (real, already-configured, Tamil-only per Gemini's
 * supported languages). This file only wires them behind three routes; see
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
import {
  SpeechClient,
  DEFAULT_PROSODY,
  SpeechUnavailableError,
  type SpeechSynthesizer,
} from '../learn/SpeechClient.js';
import { GeminiSpeechClient } from '../learn/GeminiSpeechClient.js';
import { transliterateForSynthesis, type Language } from '../learn/Transliterator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

/**
 * Which language gets which speech backend. Tamil uses Gemini (verified to
 * support Tamil — see GeminiSpeechClient.ts); Sanskrit uses the self-hosted
 * Indic-Parler-TTS container (services/tts) via SpeechClient — Gemini has no
 * Sanskrit voice. One instance per language, not per request — both clients
 * are stateless enough to share.
 */
function defaultSpeechClientFor(): (language: Language) => SpeechSynthesizer {
  const gemini = new GeminiSpeechClient();
  const selfHosted = new SpeechClient();
  return (language) => (language === 'tamil' ? gemini : selfHosted);
}

export interface LearnRouterDeps {
  /** Overridden in tests; each call gets a fresh connection, as before (mirrors ReportsRouterDeps.databaseFactory). */
  progressFactory?: () => ProgressService;
  audioCache?: AudioCache;
  /** Picks the synthesizer for a language. See `defaultSpeechClientFor`. */
  speechClientFor?: (language: Language) => SpeechSynthesizer;
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
  const speechClientFor = deps.speechClientFor ?? defaultSpeechClientFor();

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
    // The CACHE key's notion of "no voice specified" — a stable label, not a
    // real provider voice name. Kept separate from what's actually passed to
    // synthesize() below: that must stay `undefined` when the caller didn't
    // ask for one, so each backend's OWN default applies (GeminiSpeechClient
    // defaults to a real Gemini voice, "Kore"; SpeechClient's own server has
    // its own, "Aryan" — see services/tts/main.py's DEFAULT_VOICE). Passing
    // the literal string 'default' straight through —
    // the bug this comment replaces — sent 'default' to the live Gemini API
    // as a voice name, which Gemini does not have, breaking every Tamil
    // request that didn't name a voice explicitly.
    const cacheVoiceKey = trimmedVoice !== '' ? trimmedVoice : DEFAULT_VOICE;
    const requestedVoice = trimmedVoice !== '' ? trimmedVoice : undefined;

    // A learner is waiting synchronously on this request, unlike a background
    // transcription job. This used to be 15s, fast-failing on the assumption
    // that no TTS server existed yet for Sanskrit's client. One now does
    // (services/tts, self-hosted Indic-Parler-TTS, CPU-only because Docker
    // Desktop on macOS cannot pass the Apple GPU through) — and measured
    // against the real container, even a two-character word took several
    // minutes to synthesise. `npm run learn:pregenerate-sanskrit-audio` is
    // the actual fix for that latency (it warms AudioCache so real requests
    // are cache hits, per AudioCache.ts's own design comment: "the same
    // hundred lessons are replayed constantly... this cache is what makes
    // replay free"). This timeout is just the outer safety bound for a cache
    // MISS that slips through anyway, generous enough not to abort mid
    // -synthesis. For GeminiSpeechClient (Tamil), a real API call finishes
    // well inside it regardless.
    const SPEAK_TIMEOUT_MS = 10 * 60 * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SPEAK_TIMEOUT_MS);

    try {
      const cached = await audioCache.get(synthesisText, cacheVoiceKey, DEFAULT_PROSODY);
      if (cached) {
        // AudioCache stores raw bytes only, with no content-type metadata, so
        // this hardcodes the format — audio/wav is what both speech backends
        // produce today: SpeechClient.ts defaults to it when the TTS
        // server's response omits a content-type header, and
        // GeminiSpeechClient wraps Gemini's raw PCM in a WAV header itself.
        res.setHeader('Content-Type', 'audio/wav');
        res.send(cached);
        return;
      }

      const result = await speechClientFor(manifest.language).synthesize({
        text: synthesisText,
        voice: requestedVoice,
        prosody: DEFAULT_PROSODY,
        signal: controller.signal,
      });

      try {
        await audioCache.put(synthesisText, cacheVoiceKey, DEFAULT_PROSODY, result.audio);
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
