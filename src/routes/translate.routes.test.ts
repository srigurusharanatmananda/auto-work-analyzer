/**
 * Exercises the translate router end to end over HTTP, the same way
 * `learn.routes.test.ts` does — real `express()` + `listen(0)` + `fetch`,
 * with `authenticate`/`anyRole` replaced by in-memory fakes via
 * `mock.module` so this can run under `bun test` without Postgres.
 *
 * `AiClient` needs no such treatment — it is a concrete class the router
 * takes as a dependency, so a real instance built from a fake `AiProvider`
 * (the same pattern `AiClient.test.ts` uses) is passed straight in.
 */
import { afterAll, describe, expect, mock, test } from 'bun:test';
import express from 'express';
import { AiClient, type AiProvider, type AiVisionProvider } from '../ai/AiClient.js';

const TEST_USER_ID = 'translate-test-user';

const realAuthMiddleware = await import('../middleware/auth.middleware.js');
const realPolicy = await import('../middleware/policy.js');

mock.module('../middleware/auth.middleware.js', () => ({
  ...realAuthMiddleware,
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: TEST_USER_ID, email: 'learner@example.com', role: 'user', fullName: 'Learner' };
    next();
  },
}));
mock.module('../middleware/policy.js', () => ({
  ...realPolicy,
  anyRole: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

afterAll(() => {
  mock.module('../middleware/auth.middleware.js', () => realAuthMiddleware);
  mock.module('../middleware/policy.js', () => realPolicy);
});

const { createTranslateRouter, detectScriptLanguage, getTextWithTimeout, DocumentParseTimeoutError } = await import(
  './translate.routes.js'
);

function fakeProvider(response: string): AiProvider {
  return { name: 'Fake', generate: async () => response };
}

function fakeVisionProvider(response: string): AiVisionProvider {
  return { name: 'Fake Vision', generateFromImage: async () => response };
}

/**
 * A hand-built, minimal single-page PDF with a real text-showing (Tj)
 * operator — deliberately not a fixture file on disk: this repo has no
 * binary-test-fixture convention, and a scratchpad-relative path would be
 * neither portable nor committed anyway. pdf.js's own recovery mode
 * (which `pdf-parse` is built on) tolerates the simplified/missing xref
 * table here — confirmed directly against the installed library before
 * relying on it in these tests, not assumed.
 */
function minimalPdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, '\\$1');
  const stream = `BT /F1 24 Tf 10 100 Td (${escaped}) Tj ET`;
  const pdf =
    `%PDF-1.1\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 200 200]/Contents 5 0 R>>endobj\n` +
    `4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
    `5 0 obj<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n` +
    `trailer<</Size 6/Root 1 0 R>>\n%%EOF`;
  return Buffer.from(pdf, 'utf-8');
}

/** Same minimal PDF structure, with a zero-length content stream — a real "this PDF has a page but nothing on it" case, confirmed to extract as genuinely empty text (not just visually blank). */
function emptyPdf(): Buffer {
  const pdf =
    `%PDF-1.1\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/Resources<<>>/MediaBox[0 0 200 200]/Contents 5 0 R>>endobj\n` +
    `5 0 obj<</Length 0>>\nstream\nendstream\nendobj\n` +
    `trailer<</Size 6/Root 1 0 R>>\n%%EOF`;
  return Buffer.from(pdf, 'utf-8');
}

function pdfFormData(buffer: Buffer, filename = 'test.pdf'): FormData {
  const form = new FormData();
  form.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);
  return form;
}

function csvFormData(csvText: string, from: string, to: string, filename = 'test.csv'): FormData {
  const form = new FormData();
  form.append('csv', new Blob([csvText], { type: 'text/csv' }), filename);
  form.append('from', from);
  form.append('to', to);
  return form;
}

/** An AiProvider whose response depends on which row's text is being translated — `translate()`'s own prompt embeds the source text verbatim, so matching on it lets a test fail exactly one row of a batch. */
function flakyProvider(failOn: string, response: string): AiProvider {
  return {
    name: 'Flaky',
    generate: async (prompt: string) => {
      if (prompt.includes(failOn)) throw new Error('row boom');
      return response;
    },
  };
}

function pngFormData(): FormData {
  const form = new FormData();
  // Content doesn't need to be a real PNG — fileFilter only checks the
  // declared mimetype/field name, and the fake AiVisionProvider below never
  // actually decodes the bytes.
  form.append('image', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'test.png');
  return form;
}

function buildApp(aiClient: AiClient) {
  const app = express();
  app.use(express.json());
  app.use('/api/translate', createTranslateRouter({ aiClient }));
  return app;
}

async function listen(app: express.Express) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  return { server, baseUrl: `http://localhost:${port}/api/translate` };
}

describe('POST /translate', () => {
  test('rejects an empty text', async () => {
    const app = buildApp(new AiClient([fakeProvider('unused')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '   ', from: 'english', to: 'sanskrit' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('rejects an invalid language', async () => {
    const app = buildApp(new AiClient([fakeProvider('unused')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'klingon' }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('same from/to language is transliteration-only, no AI call', async () => {
    const app = buildApp(
      new AiClient([
        {
          name: 'Should not be called',
          generate: async () => {
            throw new Error('AI must not be called for a same-language request');
          },
        },
      ])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'sanskrit' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('नमस्ते');
      expect(body.data.translationTransliteration).toBe('namaste');
    } finally {
      server.close();
    }
  });

  test('english to english is a true no-op with nothing to transliterate', async () => {
    const app = buildApp(
      new AiClient([{ name: 'unused', generate: async () => { throw new Error('must not be called'); } }])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual({ translation: 'hello' });
    } finally {
      server.close();
    }
  });

  test('english to sanskrit calls the AI and transliterates the result', async () => {
    const app = buildApp(new AiClient([fakeProvider('नमस्ते')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'sanskrit' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('नमस्ते');
      expect(body.data.translationTransliteration).toBe('namaste');
      expect(body.data.sourceTransliteration).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('sanskrit to english calls the AI and transliterates the source', async () => {
    const app = buildApp(new AiClient([fakeProvider('Greetings')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('Greetings');
      expect(body.data.sourceTransliteration).toBe('namaste');
      expect(body.data.translationTransliteration).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('sanskrit to tamil transliterates both source and result', async () => {
    const app = buildApp(new AiClient([fakeProvider('வணக்கம்')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'tamil' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('வணக்கம்');
      expect(body.data.sourceTransliteration).toBe('namaste');
      expect(typeof body.data.translationTransliteration).toBe('string');
    } finally {
      server.close();
    }
  });

  test('503s a real cross-language request when no AI provider is configured', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'sanskrit' }),
      });
      expect(res.status).toBe(503);
    } finally {
      server.close();
    }
  });

  test('transliteration-only still works with no AI provider configured', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'sanskrit' }),
      });
      expect(res.status).toBe(200);
    } finally {
      server.close();
    }
  });

  test('parses a marker-delimited {translation, meaning} response into separate fields', async () => {
    const response = '===TRANSLATION===\nनमस्ते\n===MEANING===\nA common Sanskrit greeting.';
    const app = buildApp(new AiClient([fakeProvider(response)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'sanskrit' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('नमस्ते');
      expect(body.data.meaning).toBe('A common Sanskrit greeting.');
      // translationTransliteration is derived from the PARSED translation
      // field, not the raw marker-delimited blob — proves the markers were
      // actually stripped before transliteration ran, not just left in.
      expect(body.data.translationTransliteration).toBe('namaste');
    } finally {
      server.close();
    }
  });

  test('a translation or meaning containing quotes/newlines survives intact (the whole reason this is not JSON)', async () => {
    const response =
      '===TRANSLATION===\nHe said "hello"\nacross two lines\n===MEANING===\nA quoted greeting, spanning\nmultiple lines too.';
    const app = buildApp(new AiClient([fakeProvider(response)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('He said "hello"\nacross two lines');
      expect(body.data.meaning).toBe('A quoted greeting, spanning\nmultiple lines too.');
    } finally {
      server.close();
    }
  });

  test('strips a markdown code fence around a plain answer before falling back (a common model deviation)', async () => {
    const fenced = '```\nGreetings\n```';
    const app = buildApp(new AiClient([fakeProvider(fenced)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      // Must be the fence-STRIPPED text, not the raw fenced blob — a
      // regression test for a real bug caught in review: the fallback
      // path once returned the un-stripped `raw` here, leaking literal
      // backtick markers into the translation.
      expect(body.data.translation).toBe('Greetings');
      expect(body.data.meaning).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('a response with no markers at all falls back to treating it as the translation, with no meaning', async () => {
    const app = buildApp(new AiClient([fakeProvider('Greetings')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('Greetings');
      expect(body.data.meaning).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('a translation marker with no meaning marker still extracts the translation, with no meaning', async () => {
    // parseMarkerSections extracts whatever markers ARE present rather than
    // requiring every marker before trusting any of them — a model that
    // only partially followed the format still gets its translation shown
    // cleanly, not buried behind a literal "===TRANSLATION===" the user
    // would otherwise see.
    const app = buildApp(new AiClient([fakeProvider('===TRANSLATION===\nGreetings, no meaning section here')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('Greetings, no meaning section here');
      expect(body.data.meaning).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test('a genuinely empty TRANSLATION section is a clear 502, not a silent 200 with blank content', async () => {
    const app = buildApp(new AiClient([fakeProvider('===TRANSLATION===\n\n===MEANING===\nSome context.')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });

  test('when TRANSLATION is missing but a later marker (MEANING) is present, only the leading text becomes the translation — not the whole response with the marker scaffolding embedded in it', async () => {
    const response = "I couldn't translate this confidently.\n===MEANING===\nLooks like a proverb.";
    const app = buildApp(new AiClient([fakeProvider(response)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe("I couldn't translate this confidently.");
      expect(body.data.translation).not.toContain('===MEANING===');
      expect(body.data.meaning).toBe('Looks like a proverb.');
    } finally {
      server.close();
    }
  });

  test('a code fence wrapping the ENTIRE marked-up response is stripped once, up front — not left dangling on the last section', async () => {
    const response = '```\n===TRANSLATION===\nGreetings\n===MEANING===\nAn informal hello.\n```';
    const app = buildApp(new AiClient([fakeProvider(response)]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'नमस्ते', from: 'sanskrit', to: 'english' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.translation).toBe('Greetings');
      // The regression this guards: without stripping the fence BEFORE
      // marker-parsing, the trailing ``` used to end up appended to
      // whichever section came last.
      expect(body.data.meaning).toBe('An informal hello.');
    } finally {
      server.close();
    }
  });

  test('every provider failing surfaces as a 500 with details', async () => {
    const app = buildApp(
      new AiClient([{ name: 'Failing', generate: async () => { throw new Error('boom'); } }])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello', from: 'english', to: 'tamil' }),
      });
      expect(res.status).toBe(500);
    } finally {
      server.close();
    }
  });
});

describe('POST /translate/ocr', () => {
  test('rejects a request with no image field', async () => {
    const app = buildApp(new AiClient([], fakeVisionProvider('unused')));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: new FormData() });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('rejects a disallowed file type via the same upload-error-to-400 shape as other uploads', async () => {
    const app = buildApp(new AiClient([], fakeVisionProvider('unused')));
    const { server, baseUrl } = await listen(app);
    try {
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array([1, 2, 3])], { type: 'text/plain' }), 'test.txt');
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });

  test('503s when no vision provider is configured (no GOOGLE_API_KEY)', async () => {
    const app = buildApp(new AiClient([fakeProvider('unused')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      expect(res.status).toBe(503);
    } finally {
      server.close();
    }
  });

  test('the vision check runs BEFORE multer buffers the upload — an oversized file with no vision provider still 503s, not 400', async () => {
    // If the size check ran first, this would be a 400 (LIMIT_FILE_SIZE)
    // instead — this proves the ordering, not just the outcome.
    const app = buildApp(new AiClient([fakeProvider('unused')]));
    const { server, baseUrl } = await listen(app);
    try {
      const form = new FormData();
      const oversized = new Uint8Array(11 * 1024 * 1024); // over the 10MB limit
      form.append('image', new Blob([oversized], { type: 'image/png' }), 'big.png');
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: form });
      expect(res.status).toBe(503);
    } finally {
      server.close();
    }
  });

  test('extracts text and detected language from a valid marker response', async () => {
    const response = '===TEXT===\nनमस्ते\n===LANGUAGE===\nsanskrit';
    const app = buildApp(new AiClient([], fakeVisionProvider(response)));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.text).toBe('नमस्ते');
      expect(body.data.detectedLanguage).toBe('sanskrit');
    } finally {
      server.close();
    }
  });

  test('an "unknown" or unrecognized language marker becomes null, never a guess', async () => {
    const response = '===TEXT===\nsome illegible scrawl\n===LANGUAGE===\nunknown';
    const app = buildApp(new AiClient([], fakeVisionProvider(response)));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.detectedLanguage).toBeNull();
    } finally {
      server.close();
    }
  });

  test('a response with no markers at all falls back to the fence-stripped whole text, with no detected language', async () => {
    const app = buildApp(new AiClient([], fakeVisionProvider('```\nplain text, no markers\n```')));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.text).toBe('plain text, no markers');
      expect(body.data.detectedLanguage).toBeNull();
    } finally {
      server.close();
    }
  });

  test('a code fence wrapping the ENTIRE marked-up OCR response is stripped once, up front — LANGUAGE does not end up with a trailing fence', async () => {
    const response = '```\n===TEXT===\nनमस्ते\n===LANGUAGE===\nsanskrit\n```';
    const app = buildApp(new AiClient([], fakeVisionProvider(response)));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.text).toBe('नमस्ते');
      // The regression this guards: without stripping the fence first,
      // this used to come back as "sanskrit\n```" — failing
      // isTranslateLanguage's exact match and silently degrading to null.
      expect(body.data.detectedLanguage).toBe('sanskrit');
    } finally {
      server.close();
    }
  });

  test('when TEXT is missing but LANGUAGE is present, the leading text (not the whole response) becomes the fallback text', async () => {
    const response = "I can't read this clearly.\n===LANGUAGE===\nunknown";
    const app = buildApp(new AiClient([], fakeVisionProvider(response)));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.text).toBe("I can't read this clearly.");
      expect(body.data.text).not.toContain('===LANGUAGE===');
    } finally {
      server.close();
    }
  });

  test('422s when no text was found in the image', async () => {
    const app = buildApp(new AiClient([], fakeVisionProvider('===TEXT===\n===LANGUAGE===\nunknown')));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      expect(res.status).toBe(422);
    } finally {
      server.close();
    }
  });

  test('a failing vision provider surfaces as a 500 with details', async () => {
    const failingVision: AiVisionProvider = {
      name: 'Fake Vision',
      generateFromImage: async () => {
        throw new Error('vision boom');
      },
    };
    const app = buildApp(new AiClient([], failingVision));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/ocr`, { method: 'POST', body: pngFormData() });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.details).toBe('vision boom');
    } finally {
      server.close();
    }
  });
});

describe('detectScriptLanguage', () => {
  test('pure ASCII/Latin text has no confident script signal (null, not a guessed english)', () => {
    // Zero Devanagari/Tamil codepoints is not proof of English — a legacy
    // pre-Unicode Tamil/Sanskrit font extracts as unrecognizable Latin-range
    // text too, so this deliberately returns null rather than 'english'.
    expect(detectScriptLanguage('Hello world, how are you?')).toBeNull();
  });

  test('no script characters at all (empty string) is null, not a crash', () => {
    expect(detectScriptLanguage('')).toBeNull();
  });

  test('Devanagari-dominant text is sanskrit', () => {
    expect(detectScriptLanguage('नमस्ते, this is mostly नमस्ते नमस्ते Devanagari')).toBe('sanskrit');
  });

  test('Tamil-dominant text is tamil', () => {
    expect(detectScriptLanguage('வணக்கம், this is mostly வணக்கம் வணக்கம் Tamil')).toBe('tamil');
  });

  test('a Devanagari/Tamil tie favors sanskrit (documented tie-break, not an accident)', () => {
    expect(detectScriptLanguage('न' + 'த')).toBe('sanskrit');
  });
});

describe('getTextWithTimeout', () => {
  test('resolves with the parser result when it finishes before the timeout', async () => {
    const fakeParser = { getText: async () => ({ text: 'ok', pages: [], total: 0, getPageText: () => '' }) };
    const result = await getTextWithTimeout(fakeParser, 1000);
    expect(result.text).toBe('ok');
  });

  test('rejects with DocumentParseTimeoutError once the timeout elapses, without waiting on the slow call', async () => {
    const neverResolves = { getText: () => new Promise<never>(() => {}) };
    await expect(getTextWithTimeout(neverResolves, 25)).rejects.toBeInstanceOf(DocumentParseTimeoutError);
  });
});

describe('POST /translate/document', () => {
  test('rejects a request with no document field', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/document`, { method: 'POST', body: new FormData() });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('rejects a non-PDF file via the same upload-error-to-400 shape as other uploads', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const form = new FormData();
      form.append('document', new Blob([new Uint8Array([1, 2, 3])], { type: 'text/plain' }), 'test.txt');
      const res = await fetch(`${baseUrl}/document`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });

  test('extracts text from a real PDF text layer, no AI call needed', async () => {
    // No AI provider configured at all — proves this path genuinely needs
    // none, unlike /ocr's vision requirement.
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/document`, {
        method: 'POST',
        body: pdfFormData(minimalPdf('Hello world')),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.text).toContain('Hello world');
      // Plain ASCII has no Devanagari/Tamil codepoints, so this is the null
      // "no confident signal" case, not a positive 'english' detection —
      // see detectScriptLanguage's own doc comment for why.
      expect(body.data.detectedLanguage).toBeNull();
    } finally {
      server.close();
    }
  });

  test('422s a PDF with no extractable text, naming the likely cause (scanned/image-only)', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/document`, { method: 'POST', body: pdfFormData(emptyPdf()) });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('image upload');
    } finally {
      server.close();
    }
  });

  test('does not leak pdf-parse\'s own "-- N of M --" page-separator markers into the extracted text', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/document`, {
        method: 'POST',
        body: pdfFormData(minimalPdf('Hello world')),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      // Checks the SPECIFIC marker pattern, not a bare '--' substring — a
      // bare check would false-positive on any legitimately extracted em
      // dash or Markdown-style rule with no page-marker bug present at all.
      expect(body.data.text).not.toMatch(/--\s*\d+\s*of\s*\d+\s*--/);
    } finally {
      server.close();
    }
  });

  test('a corrupt/unparseable PDF surfaces as a 500 with details, not a crash', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const garbage = Buffer.from('%PDF-1.1\nthis is not a real pdf structure at all');
      const res = await fetch(`${baseUrl}/document`, { method: 'POST', body: pdfFormData(garbage) });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });
});

describe('POST /translate/batch', () => {
  test('rejects a request with no csv field', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const form = new FormData();
      form.append('from', 'english');
      form.append('to', 'sanskrit');
      const res = await fetch(`${baseUrl}/batch`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('rejects missing/invalid from or to', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData('hello\nworld', 'english', 'klingon'),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('422s a CSV with no usable text', async () => {
    // Same-language (english -> english): deliberately not exercising the
    // isConfigured gate below, since this test is about the empty-CSV
    // check, not about AI setup.
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData('\n\n,,\n', 'english', 'english'),
      });
      expect(res.status).toBe(422);
    } finally {
      server.close();
    }
  });

  test('rejects a CSV over the row cap, naming the cap', async () => {
    // Same-language, for the same reason as the empty-CSV test above.
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const rows = Array.from({ length: 21 }, (_, i) => `row ${i}`).join('\n');
      const res = await fetch(`${baseUrl}/batch`, { method: 'POST', body: csvFormData(rows, 'english', 'english') });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('20');
    } finally {
      server.close();
    }
  });

  test('503s a cross-language batch when no AI provider is configured, before parsing the CSV', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData('one\ntwo', 'english', 'sanskrit'),
      });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      server.close();
    }
  });

  test('strips a leading UTF-8 BOM instead of leaking it into the first row', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const csvWithBom = '﻿alpha\nbeta';
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData(csvWithBom, 'english', 'english'),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.rows[0].source).toBe('alpha');
    } finally {
      server.close();
    }
  });

  test('rejects a renamed .txt file with no .csv extension, even if the browser labels it text/plain', async () => {
    const app = buildApp(new AiClient([]));
    const { server, baseUrl } = await listen(app);
    try {
      const form = new FormData();
      form.append('csv', new Blob(['alpha\nbeta'], { type: 'text/plain' }), 'notes.txt');
      form.append('from', 'english');
      form.append('to', 'english');
      const res = await fetch(`${baseUrl}/batch`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test('same from/to language batch is transliteration-only, no AI call, first column only', async () => {
    const app = buildApp(
      new AiClient([
        {
          name: 'Should not be called',
          generate: async () => {
            throw new Error('AI must not be called for a same-language batch');
          },
        },
      ])
    );
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData('नमस्ते,ignored second column\nॐ शान्तिः', 'sanskrit', 'sanskrit'),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.rows).toHaveLength(2);
      expect(body.data.rows[0].source).toBe('नमस्ते');
      expect(body.data.rows[0].translation).toBe('नमस्ते');
      expect(body.data.rows[0].translationTransliteration).toBe('namaste');
    } finally {
      server.close();
    }
  });

  test('cross-language batch translates every row', async () => {
    const app = buildApp(new AiClient([fakeProvider('===TRANSLATION===\nGreetings\n===MEANING===\nA salutation.')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData('one\ntwo\nthree', 'english', 'sanskrit'),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.rows).toHaveLength(3);
      for (const row of body.data.rows) {
        expect(row.translation).toBe('Greetings');
        expect(row.meaning).toBe('A salutation.');
        expect(row.error).toBeUndefined();
      }
    } finally {
      server.close();
    }
  });

  test('one failing row is reported on that row alone — the rest of the batch still succeeds', async () => {
    // 'beta', not 'two' — the prompt's own boilerplate ("...before, between,
    // or after the two sections") contains "two", so a naive failOn of
    // 'two' would (and, caught during development, did) match every row's
    // prompt, not just the intended one.
    const app = buildApp(new AiClient([flakyProvider('beta', '===TRANSLATION===\nGreetings\n===MEANING===\nHi.')]));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/batch`, {
        method: 'POST',
        body: csvFormData('alpha\nbeta\ngamma', 'english', 'sanskrit'),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.rows).toHaveLength(3);
      expect(body.data.rows[0].translation).toBe('Greetings');
      expect(body.data.rows[1].error).toBeTruthy();
      expect(body.data.rows[1].translation).toBeUndefined();
      expect(body.data.rows[2].translation).toBe('Greetings');
    } finally {
      server.close();
    }
  });
});
