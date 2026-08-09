/**
 * Devanagari and Tamil, as shown to the learner, are not always what the
 * speech synthesiser should be fed. See
 * `docs/specs/2026-08-08-learning-module-design.md` for the seam's origin.
 *
 * The design doc's original reasoning — feeding Sanskrit-in-Devanagari
 * triggers Hindi phonology (schwa deletion: `rāma` comes out `rām`), so route
 * through Kannada script instead — was built for `sanskrit_tts` and Vāgdhenu,
 * two Hindi/Kannada-trained models with no dedicated Sanskrit training. The
 * self-hosted backend this app actually shipped with, `ai4bharat/indic-
 * parler-tts` (see `services/tts`), is trained directly on Sanskrit — and
 * empirical testing against the real running container (2026-08-10, `nara`/
 * `नर`, via a Whisper-ASR probe on the output audio, the same methodology as
 * the 2026-08-08 probe below) found the Kannada route makes things *worse*
 * for this model, not better: Kannada input reliably produced audio 2-3x
 * longer than the Devanagari input for the same short word, with the
 * transcribed output containing extra syllables not in the source text — a
 * runaway/babbling generation, not a rendering of the intended word.
 * Devanagari input reliably produced short, appropriately-sized audio. So for
 * this backend, Sanskrit is identity too, matching Tamil below. If a future
 * backend without native Sanskrit training ever replaces this one, that is
 * the point to reintroduce a Kannada-routing case here — not to keep it
 * standing on the chance one might.
 *
 * Tamil was never on the Kannada route for a different reason: Tamil script
 * is consonant-ambiguous by design — a single grapheme like `த` covers what
 * Kannada spells with four distinct letters (t/th/d/dh), and which one is
 * meant is carried by spoken convention, not by the text. Transliterating it
 * into Kannada does not disambiguate that; it just picks one, silently, and
 * the test suite shows it picking wrong (`தமிழ்` becomes `dhamizh`, not
 * `tamizh`). Indic-Parler-TTS supports Tamil natively, so the identity
 * function was already the accurate one there.
 *
 * The function stays keyed on `Language` rather than being deleted outright:
 * the moment either language needs a real script conversion again, this is
 * the one seam that should carry it, not a change scattered across callers.
 */

export type Language = 'sanskrit' | 'tamil';

/**
 * Text for the learner's screen, in Devanagari (Sanskrit) or Tamil script, in;
 * text for `SpeechClient` to synthesise, in. Identity for both languages
 * today — see the file header for why that is a finding, not an oversight.
 */
export function transliterateForSynthesis(text: string, _language: Language): string {
  return text;
}
