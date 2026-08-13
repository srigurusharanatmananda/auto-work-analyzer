/**
 * Turns one raw uploaded-book verse into the same pāda/word/gloss/meaning
 * breakdown the built-in Guru Gita content has (`content/chanting.ts`) —
 * computed live, on demand, the first time a learner asks to chant that
 * specific verse (see `db/schema.ts`'s own comment on `chantBookVerses`
 * for why this is lazy rather than done for a whole book at upload time).
 *
 * Response format is plain-text markers, not JSON — the same reasoning
 * `translate.routes.ts` already documents at length for its own AI
 * responses: no provider this app uses enforces JSON mode/schema, and a
 * free-form English gloss containing an unescaped quote or newline would
 * break `JSON.parse`. Each pāda is its own `===PADA===` block; within it,
 * one word per line as `<devanagari> — <gloss>`, splitting each line on
 * only its FIRST " — " (the word itself is always pure Devanagari, so an
 * em dash never appears there; a gloss containing a second em dash later
 * in its own prose — as several already-shipped Guru Gita glosses do — is
 * still parsed correctly, since only the first occurrence marks the
 * boundary).
 */
import type { AiClient } from '../ai/AiClient.js';
import { toIAST } from './ScriptTransliterator.js';
import type { Language } from './Transliterator.js';
import type { ChantWord, ChantPada } from './content/chanting.js';
import type { ChantBookVerseBreakdown } from './ChantBookVerses.js';

const LANGUAGE_LABEL: Record<Language, string> = {
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

export function buildBreakdownPrompt(rawText: string, language: Language): string {
  const label = LANGUAGE_LABEL[language];
  return (
    `Break down the following ${label} verse for a language-learning app's chanting-practice feature.\n\n` +
    `${label} text:\n${rawText}\n\n` +
    `1. Split the verse into its natural pādas (verse-quarters, or whatever the metre's own natural line/half-line division is — most verses of this kind are anuṣṭubh, 4 pādas of ~8 syllables each, but use your judgement rather than forcing exactly 4 if the metre genuinely differs). If the given text is short, looks like a single line, or seems incomplete on its own, still segment it — even a single short line is at least one valid pāda. NEVER write an explanatory note in place of an actual pāda ("this looks incomplete", "no additional pāda", etc.) — segment and gloss whatever text you were actually given, exactly as given, with no commentary about its completeness.\n` +
    `2. Within each pāda, segment the ${label} text into words for glossing. A single space-delimited unit is normally one word, even if it is morphologically a compound — do not split a compound into sub-word entries unless there is a strong reason to. CRITICAL: concatenating a pāda's own words (space-joined) must reconstruct that pāda's own text EXACTLY — never drop, duplicate, or alter a character from the source.\n` +
    `3. Gloss each word: an accurate English gloss, including case/number/person/tense in parentheses where grammatically relevant (e.g. "(locative)", "(accusative, object)", "(imperfect verb)").\n` +
    `4. Write an overall "meaning": a natural, readable English rendering of the WHOLE verse in reading order — your own independent wording, grammatically derived from the ${label}, not a strict word-for-word concatenation.\n\n` +
    `Respond in EXACTLY this format, with no other text before, between, or after the pāda blocks and the meaning section:\n` +
    `===PADA===\n` +
    `(one line per word: <word in ${label} script> — <gloss>)\n` +
    `===PADA===\n` +
    `(repeat for every pāda)\n` +
    `===MEANING===\n` +
    `(the overall meaning, as described above)`
  );
}

interface ParsedWord {
  devanagari: string;
  gloss: string;
}

interface ParsedBreakdown {
  padaWords: ParsedWord[][];
  meaning: string;
}

export class BreakdownParseError extends Error {}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

export function parseBreakdownResponse(raw: string): ParsedBreakdown {
  const text = stripCodeFence(raw);
  const meaningIndex = text.lastIndexOf('===MEANING===');
  if (meaningIndex === -1) {
    throw new BreakdownParseError('The AI response had no "===MEANING===" section.');
  }

  const padaSection = text.slice(0, meaningIndex);
  const meaning = text.slice(meaningIndex + '===MEANING==='.length).trim();

  const padaBlocks = padaSection
    .split('===PADA===')
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  if (padaBlocks.length === 0) {
    throw new BreakdownParseError('The AI response had no "===PADA===" blocks.');
  }

  const padaWords: ParsedWord[][] = padaBlocks.map((block, blockIndex) => {
    const lines = block.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    const words = lines.map((line) => {
      const sepIndex = line.indexOf(' — ');
      if (sepIndex === -1) {
        throw new BreakdownParseError(`Pāda ${blockIndex + 1}, line "${line}" has no " — " separator between word and gloss.`);
      }
      return { devanagari: line.slice(0, sepIndex).trim(), gloss: line.slice(sepIndex + 3).trim() };
    });
    if (words.length === 0) {
      throw new BreakdownParseError(`Pāda ${blockIndex + 1} has no word lines.`);
    }
    return words;
  });

  if (!meaning) {
    throw new BreakdownParseError('The "===MEANING===" section was empty.');
  }

  return { padaWords, meaning };
}

/** No AI provider guarantees exact reconstruction, so this is verified mechanically rather than trusted — the same discipline this session's own Guru Gita content-generation work established. */
export class BreakdownReconstructionError extends Error {}

function toPadas(padaWords: ParsedWord[][], language: Language): ChantPada[] {
  return padaWords.map((words) => {
    const chantWords: ChantWord[] = words.map((w) => ({
      devanagari: w.devanagari,
      iast: toIAST(w.devanagari, language),
      gloss: w.gloss,
    }));
    const text = chantWords.map((w) => w.devanagari).join(' ');
    return { text, iast: toIAST(text, language), words: chantWords };
  });
}

/**
 * Whitespace-insensitive AND Unicode-normalization-insensitive: PDF text
 * extraction commonly yields NFD-decomposed combining vowel signs for some
 * fonts/producers, while an LLM's own generated script text is typically
 * NFC-composed — visually and semantically identical either way, but a
 * bare string comparison would see them as different characters and
 * reject a genuinely-correct breakdown.
 */
function normalizeForComparison(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, '');
}

/**
 * Computes a full breakdown for one raw verse: an AI call for the semantic
 * work (pāda split, word segmentation, gloss, meaning), then this app's own
 * deterministic `toIAST` for every transliteration (never left to the AI —
 * see `content/chanting.ts`'s own header for why: confirmed byte-identical
 * to hand-verified content when generated this way, unlike free-form AI
 * transliteration). Mechanically verifies the AI's own word segmentation
 * reconstructs the source verbatim (ignoring whitespace) before returning
 * anything — throws `BreakdownReconstructionError` rather than silently
 * shipping content that dropped or altered a character.
 */
export async function computeBreakdown(
  aiClient: AiClient,
  rawText: string,
  language: Language
): Promise<ChantBookVerseBreakdown> {
  const prompt = buildBreakdownPrompt(rawText, language);
  const completion = await aiClient.complete(prompt);
  const parsed = parseBreakdownResponse(completion.text);

  const padas = toPadas(parsed.padaWords, language);

  const reconstructed = normalizeForComparison(padas.map((p) => p.text).join(''));
  const source = normalizeForComparison(rawText);
  if (reconstructed !== source) {
    throw new BreakdownReconstructionError(
      "The AI's word breakdown did not reconstruct the original verse text exactly — try again."
    );
  }

  return {
    padas,
    meaning: parsed.meaning,
    citation: `Word segmentation, gloss, and meaning: AI-generated on demand from the uploaded book's own text (${completion.provider}), mechanically verified to reconstruct the source verse exactly before being shown. IAST transliteration: this app's own deterministic transliterator, not AI-generated.`,
  };
}
