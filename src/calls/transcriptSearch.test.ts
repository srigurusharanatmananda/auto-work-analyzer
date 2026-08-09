/**
 * Highlighting and query escaping.
 *
 * The interesting cases are all ones where a plausible implementation returns
 * something rather than failing: wildcards that silently widen the search,
 * timestamps that are confidently wrong, offsets that mark the wrong word.
 */
import { describe, expect, test } from 'bun:test';
import {
  buildHighlights,
  countOccurrences,
  escapeLikePattern,
  segmentSpans,
} from './transcriptSearch.js';
import type { TranscriptSegment } from '../transcription/WhisperClient.js';

/** Builds segments and the transcript exactly as WhisperClient joins them. */
function whisper(...texts: Array<[string, number, number]>): {
  segments: TranscriptSegment[];
  transcript: string;
} {
  const segments = texts.map(([text, start, end]) => ({ text, start, end }));
  return {
    segments,
    transcript: segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(' '),
  };
}

describe('escapeLikePattern', () => {
  test('neutralises the wildcards', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  /** Escaped first, or the escapes added afterwards get double-escaped. */
  test('escapes the escape character before the wildcards', () => {
    expect(escapeLikePattern('a\\%b')).toBe('a\\\\\\%b');
  });

  test('leaves an ordinary phrase alone', () => {
    expect(escapeLikePattern('signed contract')).toBe('signed contract');
  });
});

describe('countOccurrences', () => {
  test('is case-insensitive', () => {
    expect(countOccurrences('Contract and contract', 'contract')).toBe(2);
  });

  /** "hahaha" is one repeated sound, not three overlapping matches. */
  test('does not count overlapping matches', () => {
    expect(countOccurrences('hahaha', 'haha')).toBe(1);
  });

  test('is zero for an absent phrase, and for an empty query', () => {
    expect(countOccurrences('nothing here', 'contract')).toBe(0);
    expect(countOccurrences('nothing here', '   ')).toBe(0);
  });
});

describe('segmentSpans', () => {
  test('maps each segment to its place in the joined transcript', () => {
    const { segments, transcript } = whisper(['Hello there', 0, 2], ['how are you', 2, 4]);

    const spans = segmentSpans(transcript, segments);

    expect(transcript).toBe('Hello there how are you');
    expect(spans?.map((s) => [s.start, s.end])).toEqual([
      [0, 11],
      [12, 23],
    ]);
  });

  /** `filter(Boolean)` drops them from the transcript, so the walk must too. */
  test('skips segments that trim to nothing', () => {
    const { segments, transcript } = whisper(['One', 0, 1], ['   ', 1, 2], ['Two', 2, 3]);

    expect(transcript).toBe('One Two');
    expect(segmentSpans(transcript, segments)?.map((s) => s.segment.start)).toEqual([0, 2]);
  });

  /**
   * The load-bearing refusal. A hand-edited transcript no longer lines up with
   * its segments, and guessing gives every result a timestamp that points at
   * the wrong moment — worse than having none, because it looks right.
   */
  test('returns null when the transcript was edited away from its segments', () => {
    const { segments } = whisper(['Hello there', 0, 2], ['how are you', 2, 4]);

    expect(segmentSpans('Hello there how are you all', segments)).toBeNull();
  });

  test('returns an empty span list for a transcript with no segments', () => {
    expect(segmentSpans('', [])).toEqual([]);
  });
});

describe('buildHighlights', () => {
  test('finds every occurrence, up to the cap', () => {
    const transcript = Array.from({ length: 8 }, (_, i) => `item ${i} contract`).join('. ');

    expect(buildHighlights(transcript, [], 'contract').length).toBe(5);
    expect(buildHighlights(transcript, [], 'contract', { max: 2 }).length).toBe(2);
    expect(countOccurrences(transcript, 'contract')).toBe(8);
  });

  test('matches case-insensitively, like the ILIKE that selected the row', () => {
    expect(buildHighlights('Sign the Contract today', [], 'contract')).toHaveLength(1);
  });

  test('reports where the match sits in the excerpt it returns', () => {
    const [hit] = buildHighlights('please sign the contract today', [], 'contract');

    expect(hit!.text.slice(hit!.matchStart, hit!.matchEnd)).toBe('contract');
  });

  /**
   * The excerpt is trimmed and may be prefixed with an ellipsis; offsets that
   * ignored either would mark the wrong characters, and only sometimes.
   */
  test('offsets survive elision and trimming', () => {
    const lead = 'a'.repeat(40) + ' ' + 'padding words here '.repeat(12);
    const [hit] = buildHighlights(`${lead}the contract clause ${lead}`, [], 'contract');

    expect(hit!.text.startsWith('…')).toBe(true);
    expect(hit!.text.endsWith('…')).toBe(true);
    expect(hit!.text.slice(hit!.matchStart, hit!.matchEnd)).toBe('contract');
  });

  test('does not cut the excerpt mid-word', () => {
    const transcript = `${'word '.repeat(60)}contract ${'word '.repeat(60)}`.trim();
    const [hit] = buildHighlights(transcript, [], 'contract');

    // Every token in the excerpt is a whole word from the source.
    for (const token of hit!.text.replace(/…/g, '').trim().split(/\s+/)) {
      expect(['word', 'contract']).toContain(token);
    }
  });

  test('carries the timing of the segment the match falls in', () => {
    const { segments, transcript } = whisper(
      ['Good morning everyone', 0, 3],
      ['please sign the contract', 3, 7],
      ['and send it back', 7, 9]
    );

    const [hit] = buildHighlights(transcript, segments, 'contract');

    expect(hit!.startSeconds).toBe(3);
    expect(hit!.endSeconds).toBe(7);
  });

  /**
   * The bug in the implementation this is modelled on: it took the first
   * segment that matched a permanently-true condition, so every highlight in
   * every result got the *first* segment's timing.
   */
  test('gives different occurrences different timings', () => {
    const { segments, transcript } = whisper(
      ['the contract is ready', 0, 4],
      ['nothing relevant', 4, 6],
      ['the contract is signed', 6, 10]
    );

    expect(buildHighlights(transcript, segments, 'contract').map((h) => h.startSeconds)).toEqual([
      0, 6,
    ]);
  });

  /**
   * Whisper cuts on pauses, so a searched-for phrase routinely straddles a
   * boundary. Scanning segment by segment would miss this one entirely.
   */
  test('finds a phrase spanning two segments', () => {
    const { segments, transcript } = whisper(['please send the signed', 0, 3], ['contract', 3, 5]);

    const [hit] = buildHighlights(transcript, segments, 'signed contract');

    expect(hit).toBeDefined();
    expect(hit!.startSeconds).toBe(0);
  });

  test('omits timings rather than guessing when segments do not line up', () => {
    const { segments } = whisper(['the contract is ready', 0, 4]);

    const [hit] = buildHighlights('edited: the contract is ready', segments, 'contract');

    expect(hit).toBeDefined();
    expect(hit!.startSeconds).toBeNull();
    expect(hit!.endSeconds).toBeNull();
  });

  test('returns nothing for an empty query or an empty transcript', () => {
    expect(buildHighlights('some words', [], '  ')).toEqual([]);
    expect(buildHighlights('', [], 'contract')).toEqual([]);
  });

  test('handles a match at the very start and the very end', () => {
    expect(buildHighlights('contract signed', [], 'contract')[0]!.text).toBe('contract signed');
    expect(buildHighlights('signed contract', [], 'contract')[0]!.matchEnd).toBe(15);
  });

  /**
   * A transcript with no whitespace cannot be widened to a word boundary; the
   * search must still terminate rather than walking the whole string.
   */
  test('terminates on text with no word boundaries', () => {
    const transcript = 'x'.repeat(500) + 'contract' + 'x'.repeat(500);
    const [hit] = buildHighlights(transcript, [], 'contract');

    expect(hit!.text.slice(hit!.matchStart, hit!.matchEnd)).toBe('contract');
    expect(hit!.text.length).toBeLessThan(transcript.length);
  });
});
