/**
 * Playback capability tokens.
 *
 * These are the only authority on the audio route, so the tests that matter are
 * the ones about what must NOT verify: another job's token, a tampered expiry,
 * a lapsed one.
 */
import { describe, expect, test } from 'bun:test';
import { TOKEN_TTL_MS, mintAudioToken, verifyAudioToken } from './audioTokens.js';

const NOW = 1_800_000_000_000;

describe('minting', () => {
  test('a fresh token verifies for the job it was minted for', () => {
    const { token } = mintAudioToken('job-1', NOW);

    expect(verifyAudioToken('job-1', token, NOW)).toEqual({ valid: true });
  });

  test('expires TOKEN_TTL_MS after minting', () => {
    const { expiresAt } = mintAudioToken('job-1', NOW);

    expect(expiresAt).toBe(NOW + TOKEN_TTL_MS);
  });

  /** The URL is a capability, so it must not be guessable from the job id. */
  test('two jobs get unrelated signatures', () => {
    expect(mintAudioToken('job-1', NOW).token).not.toBe(mintAudioToken('job-2', NOW).token);
  });
});

describe('what must not verify', () => {
  /**
   * The load-bearing one. Job ids are handed out freely in list responses, so
   * if a token were not bound to its job, holding any one of them would be
   * enough to play every recording on the server — including other users'.
   */
  test("another job's token", () => {
    const { token } = mintAudioToken('job-1', NOW);

    expect(verifyAudioToken('job-2', token, NOW)).toEqual({ valid: false, reason: 'invalid' });
  });

  /** The expiry is inside the signature, so pushing it out invalidates it. */
  test('a token whose expiry has been edited forward', () => {
    const { token } = mintAudioToken('job-1', NOW);
    const [, signature] = token.split('.');
    const forged = `${NOW + 10 * TOKEN_TTL_MS}.${signature}`;

    expect(verifyAudioToken('job-1', forged, NOW)).toEqual({ valid: false, reason: 'invalid' });
  });

  test('a tampered signature', () => {
    const { token } = mintAudioToken('job-1', NOW);
    const [expiry, signature] = token.split('.');
    const flipped = `${signature!.slice(0, -1)}${signature!.endsWith('A') ? 'B' : 'A'}`;

    expect(verifyAudioToken('job-1', `${expiry}.${flipped}`, NOW)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  test('nothing at all, or something shaped wrong', () => {
    for (const bad of [undefined, '', '.', 'nodot', '.onlysig', 'notanumber.sig']) {
      expect(verifyAudioToken('job-1', bad, NOW)).toEqual({ valid: false, reason: 'invalid' });
    }
  });

  /** A signature of a different length must not throw — timingSafeEqual does. */
  test('a signature of the wrong length is rejected, not an exception', () => {
    expect(() => verifyAudioToken('job-1', `${NOW + 1000}.short`, NOW)).not.toThrow();
    expect(verifyAudioToken('job-1', `${NOW + 1000}.short`, NOW)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});

describe('expiry', () => {
  test('valid right up to the moment it lapses', () => {
    const { token, expiresAt } = mintAudioToken('job-1', NOW);

    expect(verifyAudioToken('job-1', token, expiresAt)).toEqual({ valid: true });
  });

  /**
   * Reported separately from `invalid` so the client can re-mint and retry —
   * an expired link is a normal event during a long listen, not an error.
   */
  test('reports expiry distinctly once it has', () => {
    const { token, expiresAt } = mintAudioToken('job-1', NOW);

    expect(verifyAudioToken('job-1', token, expiresAt + 1)).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  /** An expired token for the WRONG job is invalid, not merely expired. */
  test('a bad signature outranks a lapsed clock', () => {
    const { token, expiresAt } = mintAudioToken('job-1', NOW);

    expect(verifyAudioToken('job-2', token, expiresAt + 1)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});
