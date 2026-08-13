/**
 * Sanskrit syllable (akṣara) segmentation and metrical weight (guru/laghu)
 * classification, for the chanting-practice feature's phrase-by-phrase
 * pronunciation breakdown.
 *
 * Segmentation is delegated to `@vipran/aksharas` (MIT, zero dependencies,
 * npm) rather than hand-rolled: its `analyse()` output was independently
 * verified against Whitney's own worked example (`ब्रह्मणे` → `ब्र`/`ह्म`/
 * `णे`, *Sanskrit Grammar* §77) before adoption, and it already implements
 * the "traditional convention" (Whitney §77, LearnSanskrit.org's own
 * "Syllables" page) of attaching a consonant cluster's onset to the
 * FOLLOWING vowel rather than closing out the preceding syllable — the
 * thing a naive hand-rolled splitter tends to get wrong.
 *
 * What `@vipran/aksharas` does NOT do is metrical weight — that's this
 * file's own addition, verified against three independent grammars before
 * being encoded (Whitney §79, Macdonell's *A Sanskrit Grammar for Students*
 * Appendix II, Apte's Metrical Appendix):
 *
 * A syllable is heavy (guru) if:
 *   - its vowel is long by nature (ā/ī/ū/ṝ), or one of the four
 *     guṇa/vṛddhi diphthongs (e/ai/o/au) — these have NO short counterpart
 *     in the Sanskrit sound inventory and are unconditionally long, not
 *     "usually" long (a common oversimplification this file deliberately
 *     avoids repeating); or
 *   - its vowel carries an anusvāra (ं) or visarga (ः) — either alone
 *     suffices, with no other consonant needed; or
 *   - it is "long by position": two or more consonants stand between its
 *     vowel and the next vowel (a cluster that, per the traditional
 *     syllable-boundary convention above, attaches to the FOLLOWING
 *     syllable's onset — so this is counted by looking at how many
 *     consonants open the next syllable, plus any bare trailing
 *     consonant(s) with no vowel of their own, which `@vipran/aksharas`
 *     surfaces as their own coda-only "akṣara" at the end of a word).
 * Otherwise the syllable is light (laghu).
 *
 * One more real rule, easy to miss: the LAST syllable of a metrical pāda
 * (verse-quarter) is metrically indeterminate (anceps) regardless of its
 * phonetic weight — Whitney §79 and Apte's Metrical Appendix both state
 * this explicitly. Since every caller of this module operates on
 * pada-sized chunks (this feature always displays one verse-quarter at a
 * time, matching how the source material itself breaks a śloka into four
 * phrases), `finalIsAnceps` defaults to `true` rather than requiring every
 * caller to opt in.
 *
 * Word spaces are deliberately ignored, not treated as syllable
 * boundaries — LearnSanskrit.org's own worked example (splitting the
 * Bhagavad Gītā's first line) states this explicitly ("these are
 * irrelevant when it comes to splitting lines into syllables"), and it
 * matters here: a word ending in a short vowel immediately followed by a
 * word starting with a consonant cluster is long by position in real
 * scansion, which a per-word (not per-pāda) split would miss.
 */

import AksharasLib from '@vipran/aksharas';

// The npm package's ESM/CJS interop shape varies by how it's imported —
// verified empirically against the installed package, not assumed. Its own
// CJS build defines named exports (`TokenType`/`VarnaType`) via a
// Parcel-specific dynamic export helper rather than a statically-analyzable
// `exports.foo = ...` assignment — real runtime properties on the default
// object, but invisible to Node's CJS/ESM-interop static analysis (which is
// why `import { VarnaType } from '@vipran/aksharas'` resolves fine under
// `tsc`/Bun but throws "does not provide an export named" under real
// Node/tsx). Reading `VarnaType` off the resolved default object at
// runtime, as below, works under both.
const Aksharas: typeof AksharasLib = (AksharasLib as unknown as { default?: typeof AksharasLib }).default ?? AksharasLib;
const VarnaType = (Aksharas as unknown as { VarnaType: { Svara: string; Vyanjana: string } }).VarnaType;

export type SyllableWeight = 'guru' | 'laghu' | 'anceps';

export interface Syllable {
  /** The Devanagari akṣara as written, e.g. "ब्र", "क्ति", "णे". */
  text: string;
  /**
   * The svara (vowel) this syllable is built on, e.g. "अ", "ऐ", "अं" — or
   * `null` for a bare trailing consonant with no vowel of its own (a
   * word-final coda, e.g. the "म्" that closes "नमः" as its own token in
   * `@vipran/aksharas`'s output). A `null`-vowel entry has no weight of
   * its own; its consonant is folded into the PRECEDING syllable's
   * long-by-position count instead, and it is not returned as a separate
   * `Syllable` in this module's output.
   */
  vowel: string;
  weight: SyllableWeight;
}

const LONG_VOWELS = new Set(['आ', 'ई', 'ऊ', 'ॠ', 'ॡ']);
// e/ai/o/au: the guṇa and vṛddhi diphthongs. Unconditionally long — no
// short counterpart exists — not merely "usually" long.
const DIPHTHONGS = new Set(['ए', 'ऐ', 'ओ', 'औ']);
const ANUSVARA = 'ं'; // ं
const VISARGA = 'ः'; // ः

function isInherentlyLong(vowel: string): boolean {
  // Anusvāra/visarga alone make a syllable heavy regardless of its base
  // vowel's own length (rule 2) — checked first and returned early, so a
  // long-vowel-plus-anusvāra combination (e.g. "आं") is never reached by
  // the base-vowel lookup below at all.
  if (vowel.endsWith(ANUSVARA) || vowel.endsWith(VISARGA)) return true;
  return LONG_VOWELS.has(vowel) || DIPHTHONGS.has(vowel);
}

// `Token.attributes` is typed `Record<string, any>` by the library itself
// (its own `varnas`-storage convention is documented, not typed) — this is
// the narrowed shape actually observed from a real `analyse()` call.
interface AksharaVarna {
  // Not `VarnaType` the type — see the note above on why that enum isn't
  // statically importable here; compared against the same runtime object's
  // own string values instead (VarnaType.Svara/VarnaType.Vyanjana).
  type: string;
  value: string;
}

/**
 * Splits a Devanagari verse line (or word) into syllables with metrical
 * weight. `finalIsAnceps` (default `true`) marks the last vowel-bearing
 * syllable as metrically ambiguous rather than scoring it by the general
 * rule — correct for a single pāda, the unit this feature always displays;
 * pass `false` only when segmenting a fragment that is NOT a pāda boundary
 * (e.g. a sub-phrase for pedagogical chunking where the line continues).
 */
export function splitIntoSyllables(text: string, options: { finalIsAnceps?: boolean } = {}): Syllable[] {
  const finalIsAnceps = options.finalIsAnceps ?? true;
  const analysis = Aksharas.analyse(text);

  // Real (vowel-bearing) syllables only. A bare trailing consonant (no
  // svara) is not its own syllable — its consonant count is folded into
  // the preceding syllable's long-by-position check below instead.
  const entries: Array<{ text: string; vowel: string; followingConsonants: number }> = [];

  for (const token of analysis.aksharas) {
    const varnas = (token.attributes?.varnas ?? []) as AksharaVarna[];
    const svara = varnas.find((v) => v.type === VarnaType.Svara);

    if (!svara) {
      // A bare-consonant coda (word-final halanta, no vowel of its own).
      // Its consonant(s) close out the PRECEDING syllable, if any.
      if (entries.length > 0) {
        entries[entries.length - 1].followingConsonants += varnas.filter((v) => v.type === VarnaType.Vyanjana).length;
      }
      continue;
    }

    // Consonants that OPEN this akṣara belong to ITS OWN onset, not to the
    // previous syllable's coda — per the traditional convention, a cluster
    // attaches to the following vowel. Only consonants standing between
    // the PREVIOUS vowel and this one count toward the previous syllable's
    // long-by-position weight, and that's exactly what `varnas` gives us:
    // this akṣara's own leading vyanjana count.
    const leadingConsonants = varnas.filter((v) => v.type === VarnaType.Vyanjana).length;
    if (entries.length > 0) {
      entries[entries.length - 1].followingConsonants += leadingConsonants;
    }

    entries.push({ text: token.value, vowel: svara.value, followingConsonants: 0 });
  }

  return entries.map((entry, index) => {
    const isFinal = index === entries.length - 1;
    if (isFinal && finalIsAnceps) {
      return { text: entry.text, vowel: entry.vowel, weight: 'anceps' as const };
    }
    const heavy = isInherentlyLong(entry.vowel) || entry.followingConsonants >= 2;
    return { text: entry.text, vowel: entry.vowel, weight: (heavy ? 'guru' : 'laghu') as SyllableWeight };
  });
}
