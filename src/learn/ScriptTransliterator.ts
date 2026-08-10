/**
 * Native script -> IAST romanization, for a human reading it — a different
 * job from `Transliterator.ts`'s `transliterateForSynthesis`, which routes
 * text to whatever a speech synthesiser wants and is identity for both
 * languages today. This one is for the translate/transliterate tool: a
 * learner who cannot yet read Devanagari or Tamil script still wants to see
 * how a word is pronounced.
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
