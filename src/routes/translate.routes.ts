/**
 * Translate and transliterate freely between English, Sanskrit, and Tamil.
 *
 * Two genuinely different operations live behind one endpoint because a
 * learner wants both together, not one or the other: translation (what does
 * this MEAN) needs an LLM — there is no mechanical way to go from Devanagari
 * to English — while transliteration (what does this SOUND like, in a script
 * you can already read) is a deterministic script conversion `ScriptTransliterator.ts`
 * already does via `@indic-transliteration/sanscript`, no AI call needed.
 * Every response includes both where they apply, so pasting a Sanskrit
 * sentence gets you its English meaning AND its IAST romanization in one
 * request, not two.
 */
import { Router, Request, Response } from 'express';
import type { AiClient } from '../ai/AiClient.js';
import { toIAST } from '../learn/ScriptTransliterator.js';
import type { Language } from '../learn/Transliterator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

export type TranslateLanguage = 'english' | Language;

const LANGUAGE_LABEL: Record<TranslateLanguage, string> = {
  english: 'English',
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

function isTranslateLanguage(value: unknown): value is TranslateLanguage {
  return value === 'english' || value === 'sanskrit' || value === 'tamil';
}

function isNative(language: TranslateLanguage): language is Language {
  return language !== 'english';
}

export interface TranslateRouterDeps {
  aiClient: AiClient;
}

export interface TranslateResult {
  translation: string;
  /**
   * A short explanation of what the text means or refers to — context,
   * significance, or a notable word/idiom a learner might not catch from
   * the literal translation alone. Always in English, regardless of `to`.
   * Only present when an AI call was actually made (`from !== to`) — a
   * pure transliteration request (see below) has no AI involvement to ask.
   */
  meaning?: string;
  /** IAST romanization of `translation`, only when `to` is sanskrit/tamil. */
  translationTransliteration?: string;
  /** IAST romanization of the ORIGINAL input, only when `from` is sanskrit/tamil. */
  sourceTransliteration?: string;
}

/**
 * The model is asked for one JSON object covering both fields in a single
 * call, not two separate prompts — half the latency/cost for the same
 * result. Models reliably wrap JSON in a ```json fence despite being told
 * not to; stripped defensively rather than trusted to comply. If parsing
 * still fails (a model that ignores the JSON instruction entirely), the
 * raw response is treated as the translation on its own, with no meaning
 * — the same shape this route had before `meaning` existed — rather than
 * failing the whole request over one provider's formatting quirk.
 */
function parseTranslationResponse(raw: string): { translation: string; meaning?: string } {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed?.translation === 'string') {
      return {
        translation: parsed.translation,
        meaning: typeof parsed?.meaning === 'string' ? parsed.meaning : undefined,
      };
    }
  } catch {
    // Fall through to the raw-text fallback below.
  }
  return { translation: raw.trim() };
}

/**
 * `from === to` is not an error — asking to "translate" a language into
 * itself is the tool's way of saying "I just want the transliteration,"
 * which needs no AI call at all. English-to-English has nothing to
 * romanize, so it is a true no-op.
 */
async function translate(
  aiClient: AiClient,
  text: string,
  from: TranslateLanguage,
  to: TranslateLanguage
): Promise<TranslateResult> {
  if (from === to) {
    if (!isNative(from)) return { translation: text };
    return { translation: text, translationTransliteration: toIAST(text, from) };
  }

  const prompt =
    `Translate the following ${LANGUAGE_LABEL[from]} text into ${LANGUAGE_LABEL[to]}, and explain what it means.\n\n` +
    `Respond with ONLY a JSON object (no markdown code fence, no other text) with exactly two fields:\n` +
    `{"translation": "the ${LANGUAGE_LABEL[to]} translation` +
    (isNative(to) ? ', in its native script' : '') +
    ` — no explanation, no transliteration, no quotation marks inside this field", ` +
    `"meaning": "a short (2-4 sentence) explanation, in English, of what this text means or refers to — ` +
    `context, significance, or a notable word/idiom a learner might not catch from the literal translation alone"}\n\n` +
    `${LANGUAGE_LABEL[from]} text:\n${text}`;

  const completion = await aiClient.complete(prompt);
  const { translation, meaning } = parseTranslationResponse(completion.text);

  return {
    translation,
    meaning,
    translationTransliteration: isNative(to) ? toIAST(translation, to) : undefined,
    sourceTransliteration: isNative(from) ? toIAST(text, from) : undefined,
  };
}

export function createTranslateRouter(deps: TranslateRouterDeps): Router {
  const router = Router();

  router.post('/', authenticate, anyRole, async (req: Request, res: Response) => {
    const { text, from, to } = req.body ?? {};

    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ success: false, error: 'text must be a non-empty string' });
      return;
    }
    if (!isTranslateLanguage(from) || !isTranslateLanguage(to)) {
      res.status(400).json({ success: false, error: "from/to must be 'english', 'sanskrit', or 'tamil'" });
      return;
    }

    // Only a real translation needs a provider — transliteration-only
    // (from === to) must keep working even with no AI configured, since it
    // never reaches `aiClient.complete`.
    if (from !== to && !deps.aiClient.isConfigured) {
      res.status(503).json({
        success: false,
        error: 'Translation is not set up — no AI provider is configured.',
      });
      return;
    }

    try {
      const data = await translate(deps.aiClient, text.trim(), from, to);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Translation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

export default createTranslateRouter;
