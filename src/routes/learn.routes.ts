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
 * support Tamil — see GeminiSpeechClient.ts). One instance per language, not
 * per request — both clients are stateless enough to share.
 *
 * Sanskrit ALSO uses Gemini now, whenever GOOGLE_API_KEY is set. That
 * reverses this function's original routing, and the reason is measured,
 * not assumed:
 *
 *  - The self-hosted Indic-Parler-TTS container (services/tts) is CPU-only
 *    and takes MINUTES per phrase, so it is only usable at all via
 *    pre-warmed AudioCache entries. In practice pregeneration never
 *    finished: of the Guru Gita's 182 verses, exactly one (5 cache items)
 *    was ever warmed, so verse 1 played instantly and every other verse
 *    fell through to a live synthesis that hung and then failed — the
 *    reported bug. Warming the other 905 items would take days of CPU.
 *  - GeminiSpeechClient.ts's header notes Gemini does not LIST Sanskrit
 *    among its supported languages. Not listed turns out not to mean
 *    unsupported: verified directly against the live API (2026-08-13) by
 *    synthesising `देवि उवाच । कैलास शिखरे रम्ये...` — it returned ~8s of
 *    intelligible Devanagari speech in seconds. Sanskrit in Devanagari is
 *    read close enough to Hindi (which IS listed) for this to work.
 *
 * So: a real backend that answers in seconds beats a nominally-better one
 * that in practice answers never. The self-hosted client stays the fallback
 * for a deployment with no Google key, and `LEARN_SANSKRIT_TTS=self-hosted`
 * forces it back for anyone who has actually warmed the cache or is running
 * the container on a GPU.
 */
export function defaultSpeechClientFor(
  env: NodeJS.ProcessEnv = process.env
): (language: Language) => SpeechSynthesizer {
  // `env` feeds the CLIENTS as well as the routing decision. It used to feed
  // only the decision, while the clients read `process.env` themselves — so
  // `defaultSpeechClientFor({ GOOGLE_API_KEY: k })` with no key in the real
  // environment returned a Gemini client that threw on every call. A seam
  // that looks injectable and is only half-injectable is worse than none,
  // because the tests that use it still pass.
  const gemini = new GeminiSpeechClient({ apiKey: env.GOOGLE_API_KEY });
  const selfHosted = new SpeechClient({ baseUrl: env.TTS_API_URL });
  const googleKey = env.GOOGLE_API_KEY;
  const hasGoogleKey = !!googleKey && googleKey !== 'your_google_api_key_here';
  const sanskrit = env.LEARN_SANSKRIT_TTS === 'self-hosted' || !hasGoogleKey ? selfHosted : gemini;
  return (language) => (language === 'tamil' ? gemini : sanskrit);
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
 *
 * Exported (not just module-local) so both pregeneration scripts
 * (`scripts/pregenerate-sanskrit-audio.ts`, `scripts/pregenerate-chanting-
 * audio.ts`) write cache entries under the same key this route reads —
 * three independent copies of the same magic string used to exist, silently
 * drifting apart if this one ever changed.
 */
export const DEFAULT_VOICE = 'default';

/**
 * The cache key's voice component, which must identify the BACKEND as well as
 * the voice.
 *
 * `AudioCache` keys on (text, voice, prosody), and both backends historically
 * wrote under the bare `'default'` label — so the same key could hold
 * Indic-Parler bytes or Gemini bytes depending on which backend happened to
 * run first. That is not academic: routing Sanskrit to Gemini left the five
 * already-warmed Parler entries for Guru Gita verse 1 in place, so verse 1
 * would have played in one voice and verses 2-182 in another. It also breaks
 * the `LEARN_SANSKRIT_TTS=self-hosted` override in the other direction — the
 * pregeneration scripts' cache-hit skip would find Gemini's entries, generate
 * nothing, and the route would keep serving Gemini audio despite the flag.
 *
 * Including the backend makes the two sets of entries disjoint, so switching
 * backends is a cache miss (correct) rather than a silent wrong-voice hit.
 * Exported so both pregeneration scripts derive the identical key rather than
 * re-deriving it and drifting.
 */
export function cacheVoiceKeyFor(client: SpeechSynthesizer, voice?: string): string {
  const backend = client instanceof SpeechClient ? 'parler' : 'gemini';
  return `${voice && voice.trim() !== '' ? voice.trim() : DEFAULT_VOICE}@${backend}`;
}

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

  /**
   * The whole manifest, in order — not scoped to this user's progress.
   * Public curriculum data (`content/sanskrit.ts`/`content/tamil.ts` are
   * already static, checked-in content, nothing secret about them), added
   * specifically so the UI can implement "go back to a lesson I already
   * saw": `GET /next` only ever returns the single next UNSEEN lesson, with
   * no notion of a previous one, so there was nothing for a "Previous"
   * button to show. The UI fetches this once per language and combines it
   * with `seenCount` from `/next`/`/seen` to know how far is unlocked.
   */
  router.get('/lessons', authenticate, anyRole, (req: Request, res: Response) => {
    const languageParam = req.query.language;
    const manifest = typeof languageParam === 'string' ? manifestFor(languageParam) : null;

    if (!manifest) {
      res.status(400).json({ success: false, error: "language must be 'sanskrit' or 'tamil'" });
      return;
    }

    res.json({ success: true, data: { lessons: manifest.lessons } });
  });

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
    //
    // Set strictly above SpeechClient's own DEFAULT_SYNTHESIZE_TIMEOUT_MS
    // (10 min): that inner timeout is what should actually fire on a slow
    // cache miss, since it raises the more specific SpeechUnavailableError.
    // This outer one existing at all is a backstop against a future
    // SpeechSynthesizer implementation that does not enforce its own bound.
    const SPEAK_TIMEOUT_MS = 11 * 60 * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SPEAK_TIMEOUT_MS);

    // Resolved before the cache lookup, not just before synthesis: the cache
    // key depends on WHICH backend would answer, so the two must agree.
    const speechClient = speechClientFor(manifest.language);
    const cacheVoiceKey = cacheVoiceKeyFor(speechClient, requestedVoice);

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

      const result = await speechClient.synthesize({
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
        // `message` goes to the log, `learnerMessage` (when the throw site set
        // one) goes to the learner — see SpeechUnavailableError's own comment
        // for why the two must not be the same string.
        console.error('Speech unavailable:', error.message);
        res.status(503).json({
          success: false,
          error: error.learnerMessage ?? 'Text-to-speech is unavailable right now — try again shortly.',
        });
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
