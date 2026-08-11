/**
 * Reading capability tokens for uploaded books.
 *
 * Mirrors `src/transcription/audioTokens.test.ts` — same shape, same reason
 * the tests that matter are the ones about what must NOT verify: another
 * upload's token, a tampered expiry, a lapsed one.
 */
import { describe, expect, test } from 'bun:test';
import { TOKEN_TTL_MS, mintUploadToken, verifyUploadToken } from './resourceUploadTokens.js';
import { mintAudioToken } from '../transcription/audioTokens.js';

const NOW = 1_800_000_000_000;

describe('minting', () => {
  test('a fresh token verifies for the upload it was minted for', () => {
    const { token } = mintUploadToken('upload-1', NOW);

    expect(verifyUploadToken('upload-1', token, NOW)).toEqual({ valid: true });
  });

  test('expires TOKEN_TTL_MS after minting', () => {
    const { expiresAt } = mintUploadToken('upload-1', NOW);

    expect(expiresAt).toBe(NOW + TOKEN_TTL_MS);
  });

  /** The URL is a capability, so it must not be guessable from the upload id. */
  test('two uploads get unrelated signatures', () => {
    expect(mintUploadToken('upload-1', NOW).token).not.toBe(mintUploadToken('upload-2', NOW).token);
  });

  /**
   * Domain separation, proven rather than asserted from the label strings:
   * a token minted by the AUDIO module, for the same id, must not verify here
   * — otherwise a leaked audio-playback URL would double as a capability to
   * read an upload of the same id.
   */
  test('a same-id token minted by audioTokens.ts does not verify here', () => {
    const { token } = mintAudioToken('same-id', NOW);

    expect(verifyUploadToken('same-id', token, NOW)).toEqual({ valid: false, reason: 'invalid' });
  });
});

describe('what must not verify', () => {
  /**
   * The load-bearing one. Upload ids are handed out freely in list responses,
   * so if a token were not bound to its upload, holding any one of them would
   * be enough to read every uploaded book on the server — including other
   * users'.
   */
  test("another upload's token", () => {
    const { token } = mintUploadToken('upload-1', NOW);

    expect(verifyUploadToken('upload-2', token, NOW)).toEqual({ valid: false, reason: 'invalid' });
  });

  /** The expiry is inside the signature, so pushing it out invalidates it. */
  test('a token whose expiry has been edited forward', () => {
    const { token } = mintUploadToken('upload-1', NOW);
    const [, signature] = token.split('.');
    const forged = `${NOW + 10 * TOKEN_TTL_MS}.${signature}`;

    expect(verifyUploadToken('upload-1', forged, NOW)).toEqual({ valid: false, reason: 'invalid' });
  });

  test('a tampered signature', () => {
    const { token } = mintUploadToken('upload-1', NOW);
    const [expiry, signature] = token.split('.');
    const flipped = `${signature!.slice(0, -1)}${signature!.endsWith('A') ? 'B' : 'A'}`;

    expect(verifyUploadToken('upload-1', `${expiry}.${flipped}`, NOW)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  test('nothing at all, or something shaped wrong', () => {
    for (const bad of [undefined, '', '.', 'nodot', '.onlysig', 'notanumber.sig']) {
      expect(verifyUploadToken('upload-1', bad, NOW)).toEqual({ valid: false, reason: 'invalid' });
    }
  });

  /** A signature of a different length must not throw — timingSafeEqual does. */
  test('a signature of the wrong length is rejected, not an exception', () => {
    expect(() => verifyUploadToken('upload-1', `${NOW + 1000}.short`, NOW)).not.toThrow();
    expect(verifyUploadToken('upload-1', `${NOW + 1000}.short`, NOW)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});

describe('expiry', () => {
  test('valid right up to the moment it lapses', () => {
    const { token, expiresAt } = mintUploadToken('upload-1', NOW);

    expect(verifyUploadToken('upload-1', token, expiresAt)).toEqual({ valid: true });
  });

  /**
   * Reported separately from `invalid` so the client can re-mint and retry —
   * an expired link is a normal event during a long reading session, not an
   * error. This is exactly why TOKEN_TTL_MS is hours, not minutes — see the
   * module comment on why 10 minutes (the audio-token default) was too short
   * for a book someone actually reads for a while.
   */
  test('reports expiry distinctly once it has', () => {
    const { token, expiresAt } = mintUploadToken('upload-1', NOW);

    expect(verifyUploadToken('upload-1', token, expiresAt + 1)).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  /** An expired token for the WRONG upload is invalid, not merely expired. */
  test('a bad signature outranks a lapsed clock', () => {
    const { token, expiresAt } = mintUploadToken('upload-1', NOW);

    expect(verifyUploadToken('upload-2', token, expiresAt + 1)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});
