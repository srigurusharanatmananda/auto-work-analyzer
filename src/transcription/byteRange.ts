/**
 * `Range: bytes=...` parsing, for seekable audio.
 *
 * Serving the whole file on every request is not merely wasteful here, it
 * breaks the feature: dragging the scrubber to 20:00 makes the browser ask for
 * the bytes around 20:00, and a server that answers 200 with the file from zero
 * leaves the player either re-downloading from the start or refusing to seek at
 * all. Range support is what makes a transcript timestamp clickable.
 *
 * Parsing is separated from the route because the edge cases — suffix ranges,
 * open-ended ranges, unsatisfiable ranges, an empty file — are all off-by-one
 * territory, and a wrong `Content-Range` produces silent truncation rather than
 * an error.
 */

export type ByteRange =
  /** Serve the whole thing, 200. No usable Range header was present. */
  | { kind: 'full' }
  /** Serve `[start, end]` inclusive, 206. */
  | { kind: 'partial'; start: number; end: number }
  /** 416, with `Content-Range: bytes * /size`. */
  | { kind: 'unsatisfiable' };

/**
 * RFC 9110 §14.1.1. Only `bytes` is understood, and only a single range.
 *
 * A multi-range request is answered with the full body, which the spec
 * explicitly permits — multipart/byteranges is real work for a case no media
 * element generates.
 */
export function parseByteRange(header: string | undefined, size: number): ByteRange {
  if (!header) return { kind: 'full' };

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: 'full' };

  const [, rawStart, rawEnd] = match;

  // `bytes=-N`: the LAST n bytes, not "from 0 to n". Reading it the obvious way
  // serves the beginning of the file for a request that asked for the end,
  // which plays as audio and is simply the wrong audio.
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!rawEnd || !Number.isFinite(suffix)) return { kind: 'full' };
    if (suffix === 0 || size === 0) return { kind: 'unsatisfiable' };

    return { kind: 'partial', start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start)) return { kind: 'full' };

  // A start at or past the end is unsatisfiable, and an empty file cannot
  // satisfy any range at all — `bytes=0-` against zero bytes included.
  if (size === 0 || start >= size) return { kind: 'unsatisfiable' };

  // An absent end means "to the end of the file"; one past the end is clamped
  // rather than rejected, which is what every media element expects when it
  // guesses at a length.
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (!Number.isFinite(end) || end < start) return { kind: 'unsatisfiable' };

  return { kind: 'partial', start, end };
}
