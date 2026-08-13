/**
 * Splits raw extracted book text into individually-numbered verses, using
 * explicit verse-number markers only — no paragraph/blank-line heuristic
 * fallback. A book that doesn't number its verses this way is rejected with
 * a clear reason rather than guessed at, per this feature's own design
 * choice: reliable segmentation over broad-but-occasionally-wrong coverage.
 *
 * Two real marker conventions exist in the wild and both are tried:
 *   - danda-wrapped, marker TERMINATES the verse (the convention this app's
 *     own Guru Gita source uses): `कैलास शिखरे रम्ये... ॥ १॥`
 *   - standalone numeral line, marker PRECEDES the verse (the convention
 *     the harekrsna.cz Guru Gita cross-reference PDF and many printed
 *     Thirukkural editions use): `1.\nverse text here`
 * Numerals may be plain Arabic digits, Devanagari digits, or Tamil digits —
 * whichever convention a given book actually uses, not assumed per language
 * (a Sanskrit text transcribed with plain "1." numbering is just as real as
 * one using Devanagari ॥१॥, and vice versa for Tamil).
 *
 * Known, accepted limitation of the danda-wrapped (marker-terminates-verse)
 * convention specifically: unmarked front matter before the very first
 * marker (a title, dedication, invocation) has no separator of its own —
 * only each verse's OWN terminator exists — so it folds into verse 1's own
 * text rather than being stripped. Not silently wrong, just not solved:
 * solving it would need a heuristic ("this line looks like a title, not a
 * verse") this feature deliberately doesn't take on, per its own
 * reliable-over-broad design choice.
 */

const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const TAMIL_DIGITS = '௦௧௨௩௪௫௬௭௮௯';

export interface ParsedBookVerse {
  verseNumber: number;
  rawText: string;
}

export class BookParseError extends Error {}

function decodeNumeral(numeralStr: string): number | null {
  if (numeralStr.length === 0) return null;
  if (/^[0-9]+$/.test(numeralStr)) return parseInt(numeralStr, 10);
  for (const digits of [DEVANAGARI_DIGITS, TAMIL_DIGITS]) {
    if ([...numeralStr].every((ch) => digits.includes(ch))) {
      const arabic = [...numeralStr].map((ch) => digits.indexOf(ch)).join('');
      return parseInt(arabic, 10);
    }
  }
  return null;
}

/** A single script's digits, so a marker can't straddle two numeral systems (e.g. one Devanagari, one Arabic digit) inside the same number. */
const NUMERAL_ALTERNATION = `[0-9]+|[${DEVANAGARI_DIGITS}]+|[${TAMIL_DIGITS}]+`;

function isSequential(verses: ParsedBookVerse[]): boolean {
  for (let i = 1; i < verses.length; i++) {
    if (verses[i].verseNumber <= verses[i - 1].verseNumber) return false;
  }
  return true;
}

/** Danda-wrapped markers (॥ N ॥) — the marker terminates the verse text that precedes it. */
function parseDandaWrapped(text: string): ParsedBookVerse[] {
  const markerRe = new RegExp(`॥\\s*(${NUMERAL_ALTERNATION})\\s*॥`, 'g');
  const matches = [...text.matchAll(markerRe)];
  const verses: ParsedBookVerse[] = [];
  let prevEnd = 0;
  for (const match of matches) {
    const verseNumber = decodeNumeral(match[1]);
    if (verseNumber === null) continue;
    const rawText = text.slice(prevEnd, match.index).trim();
    if (rawText) verses.push({ verseNumber, rawText });
    prevEnd = match.index! + match[0].length;
  }
  return verses;
}

/**
 * A numeral at the START of its own line (optionally with a trailing '.')
 * — the marker precedes the verse text that follows it. Does NOT require
 * the numeral to be the entire line: a real PDF-extraction artifact
 * (confirmed directly, not hypothesised — the actual Guru Gita cross-
 * reference PDF this app's own content was sourced from has this exact
 * defect at verse 67) sometimes runs the marker and the verse's first word
 * onto the same physical line ("67. AkhaNDa..."), and requiring a clean
 * line all to itself would silently swallow that verse into the
 * previous one instead of erroring loudly. Line-start anchoring plus the
 * caller's own strictly-increasing-sequence check are what keep this from
 * false-positiving on an unrelated number that happens to start a line.
 */
function parseStandaloneLine(text: string): ParsedBookVerse[] {
  const markerRe = new RegExp(`(?:^|\\n)[ \\t]*(${NUMERAL_ALTERNATION})\\.?[ \\t]*`, 'g');
  const matches = [...text.matchAll(markerRe)];
  const verses: ParsedBookVerse[] = [];
  for (let i = 0; i < matches.length; i++) {
    const verseNumber = decodeNumeral(matches[i][1]);
    if (verseNumber === null) continue;
    const contentStart = matches[i].index! + matches[i][0].length;
    const contentEnd = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const rawText = text.slice(contentStart, contentEnd).trim();
    if (rawText) verses.push({ verseNumber, rawText });
  }
  return verses;
}

/**
 * Tries BOTH the danda-wrapped and standalone-line conventions and takes
 * whichever produces MORE verses (each still required to be at least 2, in
 * strictly increasing — not necessarily consecutive — order): a single
 * stray match (a page number, a footnote reference) is not enough to call
 * a book "numbered", and a non-increasing sequence means the pattern
 * matched something that isn't really a verse marker. Deliberately NOT
 * "whichever succeeds first, danda-wrapped by default" — a book using only
 * the standalone-line convention can still contain a couple of unrelated
 * danda-wrapped-looking fragments (e.g. two footnoted citations with
 * increasing numbers) that would otherwise be accepted immediately,
 * folding the whole real book into one or two giant "verses" before the
 * correct, far more complete standalone-line parse ever got a chance.
 */
export function parseBookVerses(rawText: string): ParsedBookVerse[] {
  const candidates = [parseDandaWrapped(rawText), parseStandaloneLine(rawText)]
    .filter((verses) => verses.length >= 2 && isSequential(verses))
    .sort((a, b) => b.length - a.length);

  if (candidates.length > 0) return candidates[0];

  throw new BookParseError(
    'Could not find numbered verses in this document. This app only recognises explicit verse-number markers ' +
      '("॥ 1॥"-style, or a bare number on its own line) — a book without one of those conventions can\'t be split into verses reliably.'
  );
}
