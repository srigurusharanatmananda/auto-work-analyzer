/**
 * Native script <-> IAST romanization, for a human reading it — a different
 * job from `Transliterator.ts`'s `transliterateForSynthesis`, which routes
 * text to whatever a speech synthesiser wants and is identity for both
 * languages today. This one is for the translate/transliterate tool: a
 * learner who cannot yet read Devanagari or Tamil script still wants to see
 * how a word is pronounced, and vice versa — typing IAST to get real script.
 *
 * Sanscript's Tamil route inherits the same consonant-ambiguity Sanscript
 * itself cannot resolve that `Transliterator.ts`'s own header documents for
 * Devanagari->Tamil (த is spelled the same whether it sounds like "ta" or
 * "dha" — the difference is carried by convention, not the text): IAST->Tamil
 * for an ambiguous consonant is a best-effort default, not a guarantee.
 */
import Sanscript from '@indic-transliteration/sanscript';
import type { Language } from './Transliterator.js';

const SCRIPT_FOR: Record<Language, string> = {
  sanskrit: 'devanagari',
  tamil: 'tamil',
};

/** Native script (Devanagari or Tamil) to IAST romanization. */
export function toIAST(text: string, language: Language): string {
  return Sanscript.t(text, SCRIPT_FOR[language], 'iast');
}

/** IAST romanization to native script (Devanagari or Tamil). */
export function fromIAST(text: string, language: Language): string {
  return Sanscript.t(text, 'iast', SCRIPT_FOR[language]);
}
