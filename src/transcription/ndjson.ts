/**
 * Incremental NDJSON (newline-delimited JSON) reader.
 *
 * Whisper streams one JSON object per line as it transcribes, so the bytes
 * arriving from `fetch` do not align with line boundaries: a chunk can end
 * mid-object, and one chunk can carry several objects.
 *
 * Split out from the transcription client for one reason — the reference
 * implementation inlined this and got the ending wrong. Its trailing-buffer
 * branch handled only the `_error` and `_done` control objects, so a final
 * SEGMENT arriving without a trailing newline was silently dropped: a
 * transcript quietly missing its last few seconds, with no error anywhere.
 * Here the flush path and the streaming path are the same code, so they cannot
 * disagree.
 */

export class NdjsonParser<T> {
  private buffer = '';

  /** Feeds a chunk of text; returns whatever complete objects it completed. */
  push(chunk: string): T[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // The last element is either an incomplete line or '' — either way it is
    // not ready to parse, so it stays buffered.
    this.buffer = lines.pop() ?? '';
    return lines.filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as T);
  }

  /**
   * Parses whatever is left once the stream ends.
   *
   * A well-behaved producer ends with a newline and this returns nothing. It is
   * for the one that does not.
   */
  flush(): T[] {
    const remainder = this.buffer.trim();
    this.buffer = '';
    if (remainder.length === 0) return [];

    try {
      return [JSON.parse(remainder) as T];
    } catch (error) {
      // A truncated final line means the stream was cut off mid-object. There
      // is nothing to recover, and throwing here would turn a mostly-complete
      // transcript into a total failure.
      if (error instanceof SyntaxError) return [];
      throw error;
    }
  }
}
