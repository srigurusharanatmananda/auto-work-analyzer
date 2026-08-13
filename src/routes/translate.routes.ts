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
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import type { AiClient } from '../ai/AiClient.js';
import { toIAST } from '../learn/ScriptTransliterator.js';
import type { Language } from '../learn/Transliterator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';
import { uploadSingleOrReject } from '../middleware/upload.middleware.js';

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
 * Every multi-field AI response this route parses (translation+meaning,
 * and the OCR endpoint's text+language below) asks for its fields in a
 * single call via plain-text markers, not JSON: a JSON contract needs the
 * model to correctly escape quotes and newlines INSIDE free-form prose
 * fields, which none of this app's four providers enforce (no JSON mode,
 * no schema) — getting that wrong breaks the whole parse. Plain text
 * markers have no escaping requirement at all: a marker is only ever
 * confused with content if the model's own OUTPUT happens to contain that
 * exact marker string verbatim, astronomically less likely than an
 * unescaped quote or newline appearing in a multi-sentence explanation.
 */
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/**
 * Splits a marker-delimited response into named sections, e.g.
 * `parseMarkerSections('===TEXT===\nfoo\n===LANG===\nbar', ['TEXT', 'LANG'])`
 * returns `{sections: {TEXT: 'foo', LANG: 'bar'}, leading: ''}`. A marker
 * missing from the response (the model ignored the format), or found out
 * of the given order, is simply absent from `sections` rather than an
 * error — every caller already has to handle "the model didn't follow the
 * format" as a real, expected case, not an exceptional one.
 *
 * Fence-stripped ONCE here, up front — not per-section, and not only in
 * each caller's own no-markers-at-all fallback — so a model that wraps its
 * WHOLE marked-up answer in a single code fence (marker syntax and all)
 * doesn't leak a trailing ``` into whichever section happens to be last.
 *
 * `leading` is the text before the first marker found (or the whole
 * fence-stripped response, if no marker was found at all) — callers whose
 * OWN primary marker is missing use this rather than the full raw
 * response, so a partially-formatted reply like "I couldn't translate
 * this.\n===MEANING===\nLooks like a proverb." surfaces "I couldn't
 * translate this." as the fallback content, not that entire string with
 * the literal ===MEANING=== scaffolding embedded in it.
 */
function parseMarkerSections(
  raw: string,
  markerNames: string[]
): { sections: Partial<Record<string, string>>; leading: string } {
  const text = stripCodeFence(raw);
  const found = markerNames
    .map((name) => ({ name, marker: `===${name}===`, index: text.indexOf(`===${name}===`) }))
    .filter((entry) => entry.index !== -1)
    .sort((a, b) => a.index - b.index);

  const leading = found.length > 0 ? text.slice(0, found[0].index).trim() : text;

  const sections: Partial<Record<string, string>> = {};
  for (let i = 0; i < found.length; i++) {
    const { name, marker, index } = found[i];
    const end = i + 1 < found.length ? found[i + 1].index : text.length;
    sections[name] = text.slice(index + marker.length, end).trim();
  }
  return { sections, leading };
}

/**
 * If the TRANSLATION marker itself is missing (the model ignored the
 * format entirely, or answered with some other marker but not this one),
 * `leading` — the text before whatever marker WAS found, or the whole
 * fence-stripped response if none was — is used as the translation, with
 * no meaning: the same shape this route had before `meaning` existed,
 * rather than failing the request over one provider's formatting quirk,
 * and never the marker-formatted tail (see `parseMarkerSections`'s own
 * comment on why `leading`, not the raw response, is the right fallback).
 *
 * Checked as `!== undefined`, not truthiness: a model that correctly used
 * the marker but left the section EMPTY (a legitimate, if unusual, "I have
 * nothing to say here" from the model) is reported as an empty string
 * here — the ROUTE HANDLER decides what an empty translation means
 * (currently: a clear error, not a silent 200), which is a policy call
 * that belongs there, not something this parser should paper over by
 * falling back to `leading` on its own.
 */
function parseTranslationResponse(raw: string): { translation: string; meaning?: string } {
  const { sections, leading } = parseMarkerSections(raw, ['TRANSLATION', 'MEANING']);
  if (sections.TRANSLATION !== undefined) {
    return { translation: sections.TRANSLATION, meaning: sections.MEANING || undefined };
  }
  return { translation: leading, meaning: sections.MEANING || undefined };
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
    `Respond in EXACTLY this format, with no other text before, between, or after the two sections:\n` +
    `===TRANSLATION===\n` +
    `(the ${LANGUAGE_LABEL[to]} translation` +
    (isNative(to) ? ', in its native script' : '') +
    ` — no explanation, no transliteration, nothing else in this section)\n` +
    `===MEANING===\n` +
    `(a short (2-4 sentence) explanation, in English, of what this text means or refers to — context, ` +
    `significance, or a notable word/idiom a learner might not catch from the literal translation alone)\n\n` +
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

export interface OcrResult {
  /** The transcribed text, exactly as it appeared in the image. */
  text: string;
  /** `null` when the model couldn't confidently pick one — the caller decides `from` itself in that case, same as it always could. */
  detectedLanguage: TranslateLanguage | null;
}

/**
 * Same "the whole response, fence-stripped, if the model ignored the
 * format" fallback `parseTranslationResponse` uses, and for the same
 * reason: a smaller fallback model (Gemini vision only exists on the
 * Gemini path today, but this stays defensive regardless) answering
 * plainly should still surface SOME text rather than a hard failure. A
 * missing/unrecognized language marker becomes `null`, never a guess.
 *
 * Checked as `!== undefined`, not truthiness — see `parseTranslationResponse`'s
 * identical comment: a genuinely empty TEXT section (the model correctly
 * reporting "no text visible") must come back as an empty string the
 * route's own 422 check turns into a real "no text found" response, not
 * get conflated with "ignored the format" and fall back to `leading`
 * (which, in THIS case — TEXT missing entirely — is the right fallback;
 * only an EMPTY-but-present TEXT section stays as reported).
 */
function parseOcrResponse(raw: string): OcrResult {
  const { sections, leading } = parseMarkerSections(raw, ['TEXT', 'LANGUAGE']);
  if (sections.TEXT !== undefined) {
    const language = sections.LANGUAGE?.trim().toLowerCase();
    return { text: sections.TEXT, detectedLanguage: isTranslateLanguage(language) ? language : null };
  }
  return { text: leading, detectedLanguage: null };
}

function ocrPrompt(): string {
  return (
    `Transcribe ALL text visible in this image exactly as written, preserving line breaks. ` +
    `Then identify which ONE language the text is primarily in.\n\n` +
    `Respond in EXACTLY this format, with no other text before, between, or after the two sections:\n` +
    `===TEXT===\n` +
    `(the transcribed text, exactly as it appears in the image, preserving line breaks — nothing else in this section)\n` +
    `===LANGUAGE===\n` +
    `(exactly one word: english, sanskrit, tamil, or unknown — unknown if the text is illegible, empty, ` +
    `or you cannot confidently pick one of the other three)`
  );
}

/** 10MB comfortably covers a phone photo of a page while staying well under Gemini's own inline-data payload ceiling once base64 inflates it by ~33%. */
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_OCR_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, or HEIC/HEIF images are allowed'));
    }
  },
});

const uploadOcrImage = uploadSingleOrReject(ocrUpload, 'image', `${MAX_OCR_IMAGE_BYTES / (1024 * 1024)}MB`);

export interface DocumentExtractResult {
  text: string;
  detectedLanguage: TranslateLanguage;
}

/**
 * A DETERMINISTIC guess at which script a chunk of extracted text is
 * dominated by, from raw Unicode codepoint ranges alone — no AI call
 * needed, unlike the image-OCR path's own `detectedLanguage` (which has
 * to ask the model, since a photo has no Unicode text to inspect in the
 * first place; extracted PDF text already IS Unicode text). Whichever of
 * Devanagari/Tamil has more codepoints wins; no script characters at all
 * (or a tie, i.e. neither present) reports 'english'. A coarse per-
 * document signal for pre-filling the `from` dropdown, not a claim about
 * every word in a mixed document — the same caveat the OCR path's own
 * language field already carries.
 */
export function detectScriptLanguage(text: string): TranslateLanguage {
  let devanagari = 0;
  let tamil = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0900 && cp <= 0x097f) devanagari++;
    else if (cp >= 0x0b80 && cp <= 0x0bff) tamil++;
  }
  if (devanagari === 0 && tamil === 0) return 'english';
  return devanagari >= tamil ? 'sanskrit' : 'tamil';
}

/**
 * 20MB — PDFs run larger than a single photo (`MAX_OCR_IMAGE_BYTES`
 * above), but this is still parsed entirely in memory (no disk write, no
 * DB row — see `uploadSingleOrReject`'s own memory-storage reasoning),
 * so this stays a bound on RAM per request, not a real storage budget.
 */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed'));
    }
  },
});

const uploadDocument = uploadSingleOrReject(documentUpload, 'document', `${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB`);

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
      // Reachable only via the `from !== to` path (the `from === to`
      // no-AI-needed path always returns the input text itself, already
      // validated non-empty above) — an AI call that succeeded but
      // produced a blank TRANSLATION section, per `parseTranslationResponse`'s
      // own `!== undefined` check. A 200 with an empty translation would
      // read as a broken feature, not a clear failure — the same "AI
      // technically responded but gave us nothing useful" case `/ocr`
      // already 422s on for its own TEXT field.
      if (!data.translation.trim()) {
        res.status(502).json({
          success: false,
          error: 'The AI did not return a translation. Please try again.',
        });
        return;
      }
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

  /**
   * Extracts text from an uploaded image (a photo/screenshot of a page or
   * verse) plus, best-effort, which language it's in — so the UI can
   * populate `POST /` (above) with a from-language already filled in,
   * rather than making the learner guess. Deliberately its own endpoint,
   * not a mode of `POST /`: the request shape (multipart file vs. JSON
   * text) is different enough that folding them together would need the
   * same body-parsing branch this file already avoids elsewhere.
   */
  router.post(
    '/ocr',
    authenticate,
    anyRole,
    // Checked BEFORE `uploadOcrImage` runs, not after: `supportsVision` is a
    // static, per-process condition (whether GOOGLE_API_KEY is configured),
    // not something that depends on the upload at all — a server with no
    // Gemini key would otherwise still pay the full cost of buffering up to
    // 10MB into memory via multer on every single OCR request before ever
    // reaching this check.
    (req: Request, res: Response, next: NextFunction) => {
      if (!deps.aiClient.supportsVision) {
        res.status(503).json({
          success: false,
          error: 'Image upload is not set up — it requires GOOGLE_API_KEY (Gemini) to be configured.',
        });
        return;
      }
      next();
    },
    uploadOcrImage,
    async (req: Request, res: Response) => {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No image uploaded — send it as multipart/form-data under the "image" field.',
        });
        return;
      }

      try {
        const completion = await deps.aiClient.completeWithImage(ocrPrompt(), {
          mimeType: file.mimetype,
          data: file.buffer.toString('base64'),
        });
        const data = parseOcrResponse(completion.text);
        if (!data.text) {
          res.status(422).json({ success: false, error: 'No text was found in that image.' });
          return;
        }
        res.json({ success: true, data });
      } catch (error) {
        console.error('OCR failed:', error);
        res.status(500).json({
          success: false,
          error: 'OCR failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * Extracts a PDF's own text layer directly — no AI call at all, unlike
   * `/ocr` above. This only works for a PDF that HAS a text layer (a
   * document exported from a word processor, or produced by OCR software
   * that embedded the recognized text) — a scanned/photographed page with
   * no such layer has no text for this to find, and this route says so
   * plainly (422) rather than guessing or silently returning nothing.
   * Confirmed against real files, not assumed: a modern PDF's own English
   * prose extracts cleanly, but an older scanned book using a legacy,
   * pre-Unicode Tamil font extracts nothing recognizable as Tamil at all
   * (either no text layer for those pages, or a non-Unicode encoding this
   * route has no way to interpret) — exactly the case this 422 exists
   * for. `/ocr`'s image-upload path remains the fallback for that case.
   */
  router.post('/document', authenticate, anyRole, uploadDocument, async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No document uploaded — send it as multipart/form-data under the "document" field.',
      });
      return;
    }

    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      // Built from `result.pages`, NOT `result.text` — pdf-parse's own
      // concatenated `text` field always inserts a "-- N of M --" page
      // marker between pages (confirmed directly: even a single BLANK
      // page's `result.text` is "\n\n-- 1 of 1 --\n\n", never truly
      // empty). Using it as-is would (a) never let the empty-PDF check
      // below actually fire, and (b) litter every real multi-page
      // extraction with those markers as if they were part of the
      // document's own content.
      const text = result.pages
        .map((page) => page.text)
        .join('\n\n')
        .trim();
      if (!text) {
        res.status(422).json({
          success: false,
          error:
            'No extractable text was found in that PDF — it may be a scanned or image-only document. ' +
            'Try the image upload instead, one page at a time.',
        });
        return;
      }
      const data: DocumentExtractResult = { text, detectedLanguage: detectScriptLanguage(text) };
      res.json({ success: true, data });
    } catch (error) {
      console.error('Document extraction failed:', error);
      res.status(500).json({
        success: false,
        error: 'Document extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await parser?.destroy();
    }
  });

  return router;
}

export default createTranslateRouter;
