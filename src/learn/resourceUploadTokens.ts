/**
 * Short-lived capability tokens for reading an uploaded book/PDF.
 *
 * Same problem, same shape, as `src/transcription/audioTokens.ts`: an
 * `<iframe src="...">` cannot carry an Authorization header, so reading an
 * upload needs authority to live in the URL. See that file's header comment
 * for the full reasoning (bearer-token history-leak tradeoff, why a fetch-
 * to-blob-URL alternative was rejected there) — it applies unchanged here.
 *
 * A separate module rather than a shared one: the two are domain-separated by
 * their HMAC label so a token minted for one can never be replayed as the
 * other, and duplicating ~70 lines keeps that separation obvious at a glance
 * rather than hidden behind a shared parameter someone could pass wrong.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Deliberately much longer than `audioTokens.ts`'s 10 minutes. A PDF viewer
 * does not load a whole book up front — it streams pages progressively as
 * the reader scrolls, issuing fresh range requests against this same
 * `src` URL for as long as the tab stays open. A 10-minute window meant any
 * book actually read for more than 10 minutes started 401ing mid-session —
 * worse the LARGER the book, since a bigger book means a longer reading
 * session, which is exactly the "some PDFs [the bigger ones] are not
 * viewable" report this was sized to fix. Two hours comfortably covers one
 * sitting; the reader has an explicit Reload action for anything longer.
 */
export const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function signingKey(): Buffer {
  const secret =
    process.env.JWT_ACCESS_SECRET ??
    'change-this-secret-in-production-use-long-random-string-min-256-bits';

  return createHmac('sha256', secret).update('resource-upload-v1').digest();
}

function sign(uploadId: string, expiresAt: number): string {
  return createHmac('sha256', signingKey()).update(`${uploadId}.${expiresAt}`).digest('base64url');
}

/** Callers must have already established that the requester owns the upload — this function has no way to check and does not try. */
export function mintUploadToken(uploadId: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + TOKEN_TTL_MS;
  return { token: `${expiresAt}.${sign(uploadId, expiresAt)}`, expiresAt };
}

export type UploadTokenResult =
  | { valid: true }
  | { valid: false; reason: 'expired' | 'invalid' };

/** Verifies a token against an upload id. See `verifyAudioToken` for why the comparison is constant-time and why expiry is checked only after the signature. */
export function verifyUploadToken(
  uploadId: string,
  token: string | undefined,
  now = Date.now()
): UploadTokenResult {
  if (!token) return { valid: false, reason: 'invalid' };

  const separator = token.indexOf('.');
  if (separator <= 0) return { valid: false, reason: 'invalid' };

  const expiresAt = Number(token.slice(0, separator));
  const presented = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt)) return { valid: false, reason: 'invalid' };

  const expected = sign(uploadId, expiresAt);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'invalid' };
  }

  return now > expiresAt ? { valid: false, reason: 'expired' } : { valid: true };
}
