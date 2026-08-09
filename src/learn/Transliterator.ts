/**
 * Devanagari and Tamil, as shown to the learner, are not what the speech
 * synthesiser is fed. See `docs/specs/2026-08-08-learning-module-design.md`.
 *
 * Feeding Sanskrit-in-Devanagari to Indic-Parler-TTS triggers Hindi phonology
 * — specifically schwa deletion, which drops the inherent vowel Sanskrit
 * keeps: `rāma` comes out `rām`. Kannada script carries no such convention,
 * so `sanskrit_tts` and Vāgdhenu both synthesise from a Kannada
 * transliteration instead. This module is that seam: Devanagari in, Kannada
 * out, invisible to the learner.
 *
 * Tamil is the second route the seam needs, but not the same route. Tamil
 * script is consonant-ambiguous by design — a single grapheme like `த` covers
 * what Kannada spells with four distinct letters (t/th/d/dh), and which one
 * is meant is carried by spoken convention, not by the text. Transliterating
 * it into Kannada does not disambiguate that; it just picks one, silently,
 * and the probe below shows it picking wrong (`தமிழ்` becomes `dhamizh`, not
 * `tamizh`). Indic-Parler-TTS supports Tamil natively, so the correct move is
 * not to route it through Kannada at all — the identity function is the
 * accurate one. The route exists as a named case rather than a fallthrough so
 * a third language is a data change, not a rewrite of this file.
 */

import Sanscript from '@indic-transliteration/sanscript';

export type Language = 'sanskrit' | 'tamil';

/**
 * Text for the learner's screen, in Devanagari (Sanskrit) or Tamil script, in;
 * text for `SpeechClient` to synthesise, in.
 *
 * Never throws: Sanscript passes through characters it does not recognise
 * (punctuation, digits, Latin already mixed into the string) rather than
 * rejecting them, and that is the right behaviour here too — a lesson string
 * is authored content, not untrusted input.
 */
export function transliterateForSynthesis(text: string, language: Language): string {
  if (language === 'tamil') {
    return text;
  }

  return Sanscript.t(text, 'devanagari', 'kannada');
}
