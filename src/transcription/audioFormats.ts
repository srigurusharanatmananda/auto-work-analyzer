/**
 * What counts as audio we can transcribe, and what to call it on the way back.
 *
 * Extracted from `transcription.routes.ts` when URL ingestion became a second
 * consumer. The two must agree: a file rejected on upload but accepted from a
 * URL would be a queued job that dies in the worker, which surfaces minutes
 * later as a transcription failure rather than as the plain "that format is not
 * supported" the caller should have got immediately.
 */

/**
 * Extensions ffmpeg (inside Whisper) reliably decodes.
 *
 * An allowlist rather than a blocklist, and checked on extension rather than
 * only mimetype because browsers report audio mimetypes inconsistently — Safari
 * sends `application/octet-stream` for perfectly good m4a.
 */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".mp3",
  ".m4a",
  ".wav",
  ".aac",
  ".ogg",
  ".opus",
  ".flac",
  ".webm",
  ".mp4",
  ".mpga",
  ".mpeg",
]);

/** For error messages, in a stable order so the text does not shuffle. */
export const ALLOWED_EXTENSIONS_LIST = [...ALLOWED_EXTENSIONS].join(", ");

/**
 * Extension -> what to tell the browser it is receiving.
 *
 * A wrong or absent `Content-Type` makes some browsers refuse to play a file
 * they can decode perfectly well, so this is not cosmetic. Derived from the
 * extension because that is the only thing that survived the upload — the
 * original mimetype is not stored, and browsers report audio mimetypes
 * inconsistently enough that it would not be worth trusting if it were.
 */
export const AUDIO_MIME_TYPES: Readonly<Record<string, string>> = {
  ".mp3": "audio/mpeg",
  ".mpga": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};
