/**
 * Short-lived capability tokens for playing back a recording.
 *
 * ## Why this exists at all
 *
 * Every other route in this app authenticates with a bearer token from
 * `localStorage`. An `<audio src="...">` element cannot do that — the browser
 * issues the media request itself, and there is no hook to attach a header to
 * it. So audio playback needs authority to live in the URL, or not to work.
 *
 * The alternative is fetching the whole file with `fetch` and playing it from
 * an object URL, which does authenticate normally. It is rejected because it
 * downloads the entire recording before the first second plays and gives up
 * range requests entirely: on a forty-minute call that is tens of megabytes and
 * a dead player, and seeking — the whole point of pairing this with transcript
 * timestamps — stops working.
 *
 * ## What the token is
 *
 * An HMAC over the job id and an expiry. Not a JWT: there are no claims to
 * carry and no need for a second token format with its own parsing surface.
 *
 * It deliberately does NOT name the user. Ownership is checked when the token
 * is minted, by a route that authenticates normally; the token then means "the
 * bearer was authorised for this recording", and there is no reason to put a
 * user id in a URL that will sit in browser history and access logs.
 *
 * ## What it gives up, stated plainly
 *
 * For its lifetime the token is a bearer capability: anyone holding the URL can
 * fetch the audio, and deactivating the user does not revoke it. That is the
 * cost of playback working at all, and it is bounded by `TOKEN_TTL_MS` being
 * minutes rather than hours. It is long enough to start playback and to seek
 * around; the player re-mints when it lapses.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * How long a minted URL stays valid.
 *
 * Long enough to cover a pause-and-come-back within one sitting, short enough
 * that a URL leaked from history or a proxy log is stale before it is useful.
 * The client re-mints on demand, so a longer window buys nothing.
 */
export const TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Derived from the access-token secret rather than being a new environment
 * variable, so there is one secret to configure and no way to deploy with this
 * one left at a default while the other is set.
 *
 * Domain-separated by the label: signing with the raw JWT secret would let a
 * signature minted here be meaningful somewhere else that uses the same key.
 */
function signingKey(): Buffer {
  const secret =
    process.env.JWT_ACCESS_SECRET ??
    'change-this-secret-in-production-use-long-random-string-min-256-bits';

  return createHmac('sha256', secret).update('transcription-audio-v1').digest();
}

function sign(jobId: string, expiresAt: number): string {
  return createHmac('sha256', signingKey()).update(`${jobId}.${expiresAt}`).digest('base64url');
}

/**
 * A token for this job, valid for `TOKEN_TTL_MS`.
 *
 * Callers must have already established that the requester owns the job — this
 * function has no way to check and does not try.
 */
export function mintAudioToken(jobId: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + TOKEN_TTL_MS;
  return { token: `${expiresAt}.${sign(jobId, expiresAt)}`, expiresAt };
}

export type AudioTokenResult =
  | { valid: true }
  /** `expired` is separated from `invalid` so the client can re-mint and retry. */
  | { valid: false; reason: 'expired' | 'invalid' };

/**
 * Verifies a token against a job id.
 *
 * The signature is compared in constant time. A plain `===` leaks how much of a
 * forged signature was correct through timing, which is enough to construct a
 * valid one byte by byte given enough attempts — the classic reason this
 * comparison is never written the obvious way.
 *
 * Expiry is checked only after the signature verifies, so an attacker cannot
 * learn anything from the difference between the two failures.
 */
export function verifyAudioToken(
  jobId: string,
  token: string | undefined,
  now = Date.now()
): AudioTokenResult {
  if (!token) return { valid: false, reason: 'invalid' };

  const separator = token.indexOf('.');
  if (separator <= 0) return { valid: false, reason: 'invalid' };

  const expiresAt = Number(token.slice(0, separator));
  const presented = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt)) return { valid: false, reason: 'invalid' };

  const expected = sign(jobId, expiresAt);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);

  // `timingSafeEqual` throws on a length mismatch, which would itself be a
  // timing signal if it were the only guard — but a wrong length is already
  // public information, so a plain length check first is fine.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'invalid' };
  }

  return now > expiresAt ? { valid: false, reason: 'expired' } : { valid: true };
}
