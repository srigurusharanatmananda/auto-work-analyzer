/**
 * Range parsing.
 *
 * Every case here fails by serving the wrong bytes rather than by erroring, and
 * wrong bytes of audio play — as a jump to the wrong moment, or as noise.
 */
import { describe, expect, test } from 'bun:test';
import { parseByteRange } from './byteRange.js';

const SIZE = 1000;

describe('no usable header', () => {
  test('an absent Range means the whole file', () => {
    expect(parseByteRange(undefined, SIZE)).toEqual({ kind: 'full' });
  });

  /** Units other than bytes are not understood; the spec says ignore them. */
  test('a unit we do not speak falls back to the whole file', () => {
    expect(parseByteRange('items=0-10', SIZE)).toEqual({ kind: 'full' });
    expect(parseByteRange('bytes=abc', SIZE)).toEqual({ kind: 'full' });
    expect(parseByteRange('bytes=', SIZE)).toEqual({ kind: 'full' });
  });

  /**
   * Multipart byteranges is real work for a case no media element produces, and
   * the spec explicitly allows answering with the full body instead.
   */
  test('a multi-range request gets the whole file', () => {
    expect(parseByteRange('bytes=0-99,200-299', SIZE)).toEqual({ kind: 'full' });
  });
});

describe('ordinary ranges', () => {
  test('a closed range is inclusive at both ends', () => {
    expect(parseByteRange('bytes=0-499', SIZE)).toEqual({ kind: 'partial', start: 0, end: 499 });
  });

  test('an open-ended range runs to the last byte', () => {
    expect(parseByteRange('bytes=500-', SIZE)).toEqual({ kind: 'partial', start: 500, end: 999 });
  });

  /** Players routinely guess a length; clamping is expected, not an error. */
  test('an end past the file is clamped', () => {
    expect(parseByteRange('bytes=900-99999', SIZE)).toEqual({
      kind: 'partial',
      start: 900,
      end: 999,
    });
  });

  test('surrounding whitespace is tolerated', () => {
    expect(parseByteRange('  bytes=0-9  ', SIZE)).toEqual({ kind: 'partial', start: 0, end: 9 });
  });

  test('the last byte alone', () => {
    expect(parseByteRange('bytes=999-999', SIZE)).toEqual({
      kind: 'partial',
      start: 999,
      end: 999,
    });
  });
});

describe('suffix ranges', () => {
  /**
   * `bytes=-N` is the LAST n bytes. Reading it as "from 0 to n" serves the
   * beginning of the recording to a request that asked for the end — which
   * plays perfectly well, and is the wrong audio.
   */
  test('asks for the end of the file, not the beginning', () => {
    expect(parseByteRange('bytes=-100', SIZE)).toEqual({
      kind: 'partial',
      start: 900,
      end: 999,
    });
  });

  test('a suffix longer than the file is the whole file', () => {
    expect(parseByteRange('bytes=-99999', SIZE)).toEqual({ kind: 'partial', start: 0, end: 999 });
  });

  test('a zero-length suffix cannot be satisfied', () => {
    expect(parseByteRange('bytes=-0', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });
});

describe('unsatisfiable ranges', () => {
  test('a start at or past the end', () => {
    expect(parseByteRange('bytes=1000-', SIZE)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=5000-6000', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  test('an end before the start', () => {
    expect(parseByteRange('bytes=500-100', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  /** An empty file satisfies no range at all, including `bytes=0-`. */
  test('any range against an empty file', () => {
    expect(parseByteRange('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=-10', 0)).toEqual({ kind: 'unsatisfiable' });
  });

  test('but an empty file with no Range is just an empty body', () => {
    expect(parseByteRange(undefined, 0)).toEqual({ kind: 'full' });
  });
});
