/**
 * Finding a phrase in past transcripts, and pointing at where in the audio it
 * was said.
 *
 * Everything here is pure: string in, matches out. The SQL half lives in
 * `TranscriptionJobStore.search` and only decides *which rows* to consider —
 * narrowing, not ranking. Highlighting is done in process because it needs the
 * segment timings, and asking Postgres to walk a JSON array to find which
 * segment covers character 4,812 is a lot of query for arithmetic that costs
 * nothing here.
 *
 * ## Why substring matching and not `tsvector`
 *
 * Postgres full-text search is the textbook answer and it is the wrong one for
 * this data. `to_tsvector` needs a language configuration to stem with, and
 * these transcripts are explicitly multilingual — Whisper reports `language`
 * per job, and Tamil and Sanskrit are expected. `'english'` would stem Tamil
 * into nonsense, and `'simple'` disables stemming, which leaves you with
 * substring matching that additionally cannot find a phrase inside a word.
 *
 * Substring matching is also what people actually do here: they half-remember a
 * name or a fragment ("the export bug", "Priya") and want the recording it was
 * in. Stemming buys "meeting" finding "meetings"; it costs "contract" finding
 * "subcontractor". For a personal archive of tens to hundreds of recordings the
 * scan is cheap, and being predictable beats being clever.
 */

import type { TranscriptSegment } from '../transcription/WhisperClient.js';

/** A single occurrence, with enough context to read and a place in the audio. */
export interface TranscriptHighlight {
  /** An excerpt around the match, elided at both ends when it is cut. */
  text: string;
  /**
   * Where the match sits inside `text`, so the UI can mark it without
   * searching again — and without getting it wrong when the query happens to
   * appear twice in one excerpt.
   */
  matchStart: number;
  matchEnd: number;
  /** Offset of the match in the whole transcript. Stable sort key. */
  transcriptOffset: number;
  /**
   * When it was said, from the segment covering the match. Null when the
   * transcript and its segments do not line up — see `segmentSpans`.
   */
  startSeconds: number | null;
  endSeconds: number | null;
}

export interface HighlightOptions {
  /** Characters of context on each side. */
  context?: number;
  /** Cap on occurrences reported per transcript. */
  max?: number;
}

const DEFAULT_CONTEXT = 90;
const DEFAULT_MAX = 5;

/** The separator `WhisperClient` joins segments with. */
const SEGMENT_SEPARATOR = ' ';

/**
 * Makes a user's query safe to hand to `ILIKE`.
 *
 * Without this, `%` and `_` in the query are wildcards: searching for `100%`
 * matches every transcript, and `a_b` matches `axb`. Neither errors — they just
 * quietly return the wrong rows, which is the kind of bug nobody reports
 * because it looks like the search "found a lot".
 *
 * The backslash has to be escaped first, or escaping the others would double
 * back over it.
 */
export function escapeLikePattern(query: string): string {
  return query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Where each segment's text lands in the joined transcript.
 *
 * `WhisperClient` builds the transcript as
 * `segments.map(s => s.text.trim()).filter(Boolean).join(' ')`, so the offsets
 * are reconstructible exactly — but only while that holds. Returns null when
 * the reconstruction does not match the stored transcript, which happens for a
 * transcript that was pasted or hand-corrected rather than produced by Whisper.
 *
 * Returning null rather than a best guess is the point. An approximate span
 * yields a timestamp that is confidently wrong, and a user who clicks it lands
 * somewhere else in the recording with no indication anything is off. No
 * timestamp at all is a visible absence.
 */
export function segmentSpans(
  transcript: string,
  segments: TranscriptSegment[]
): Array<{ start: number; end: number; segment: TranscriptSegment }> | null {
  const spans: Array<{ start: number; end: number; segment: TranscriptSegment }> = [];
  let cursor = 0;

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue; // `filter(Boolean)` dropped it from the transcript too.

    if (spans.length > 0) cursor += SEGMENT_SEPARATOR.length;
    spans.push({ start: cursor, end: cursor + text.length, segment });
    cursor += text.length;
  }

  return cursor === transcript.length ? spans : null;
}

/** The segment covering an offset, by binary search — transcripts run long. */
function spanAt(
  spans: Array<{ start: number; end: number; segment: TranscriptSegment }>,
  offset: number
): TranscriptSegment | null {
  let low = 0;
  let high = spans.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const span = spans[mid]!;
    if (offset < span.start) high = mid - 1;
    else if (offset >= span.end) low = mid + 1;
    else return span.segment;
  }

  // Offsets landing on a separator belong to the segment that follows.
  return spans[low]?.segment ?? null;
}

/**
 * Snaps an excerpt's edges to whitespace, so it does not begin or end
 * mid-word.
 *
 * Both scans are bounded by the match itself rather than by the context width.
 * Bounding by the width is the obvious version and it is wrong: when the window
 * clamps at offset 0 the left scan has the whole excerpt to range over, and it
 * happily skips forward *past* the match to the first space it finds, producing
 * an excerpt that does not contain the thing that was searched for.
 *
 * When there is no boundary to snap to — text with no spaces, which some
 * languages and any despaced Whisper output produce — the unsnapped offset is
 * kept rather than collapsing to the match, so the excerpt still has context.
 */
function snapStart(text: string, from: number, notPast: number): number {
  for (let i = from; i <= notPast; i += 1) {
    if (i === 0 || /\s/.test(text[i - 1]!)) return i;
  }
  return from;
}

function snapEnd(text: string, to: number, notBefore: number): number {
  for (let i = to; i >= notBefore; i -= 1) {
    if (i === text.length || /\s/.test(text[i]!)) return i;
  }
  return to;
}

/**
 * Every occurrence of `query` in `transcript`, with context and timings.
 *
 * Case-insensitive, to match the `ILIKE` that selected the row — a search that
 * returns a transcript and then highlights nothing in it reads as a bug.
 *
 * Occurrences are found on the raw string rather than by scanning segments,
 * because a phrase routinely straddles a segment boundary: Whisper cuts on
 * pauses, not on meaning, so "send the signed contract" is often two segments.
 * Searching segment by segment silently misses exactly the multi-word phrases
 * people search for.
 */
export function buildHighlights(
  transcript: string,
  segments: TranscriptSegment[],
  query: string,
  options: HighlightOptions = {}
): TranscriptHighlight[] {
  const needle = query.trim().toLowerCase();
  if (!needle || !transcript) return [];

  const context = options.context ?? DEFAULT_CONTEXT;
  const max = options.max ?? DEFAULT_MAX;
  const haystack = transcript.toLowerCase();
  const spans = segmentSpans(transcript, segments);
  const highlights: TranscriptHighlight[] = [];

  let index = haystack.indexOf(needle);
  while (index !== -1 && highlights.length < max) {
    const matchEndOffset = index + needle.length;
    const from = snapStart(transcript, Math.max(0, index - context), index);
    const to = snapEnd(
      transcript,
      Math.min(transcript.length, matchEndOffset + context),
      matchEndOffset
    );

    const raw = transcript.slice(from, to);
    const dropped = raw.length - raw.trimStart().length;
    const prefix = from > 0 ? '…' : '';
    const suffix = to < transcript.length ? '…' : '';

    // Offsets index the excerpt as rendered — after the ellipsis, after the
    // trim. Reporting them relative to anything else would have the UI mark the
    // wrong characters, and it would only be visibly wrong sometimes.
    const matchStart = prefix.length + (index - from - dropped);
    const segment = spans ? spanAt(spans, index) : null;

    highlights.push({
      text: `${prefix}${raw.trim()}${suffix}`,
      matchStart,
      matchEnd: matchStart + needle.length,
      transcriptOffset: index,
      startSeconds: segment ? segment.start : null,
      endSeconds: segment ? segment.end : null,
    });

    // Advance past this match, not past its first character: overlapping
    // matches of a repeated query ("ha" in "hahaha") are one occurrence to a
    // reader, and reporting three is noise.
    index = haystack.indexOf(needle, index + needle.length);
  }

  return highlights;
}

/**
 * How many times the query occurs in full, independent of the `max` cap on
 * reported highlights — so the UI can say "12 mentions" while showing five.
 */
export function countOccurrences(transcript: string, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle || !transcript) return 0;

  const haystack = transcript.toLowerCase();
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
