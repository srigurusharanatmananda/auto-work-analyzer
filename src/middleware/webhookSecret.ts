/**
 * The shared-secret check for POST /api/webhook.
 *
 * That endpoint is unauthenticated by design — CI and git hooks call it, and
 * they hold a secret rather than a user session. But it runs a git analysis and
 * then `createTasksFromWork`, so it creates **real ClickUp tasks**. The check it
 * had was:
 *
 *     if (config.webhook.secret && secret !== config.webhook.secret) → 401
 *
 * which skips verification entirely when no secret is configured, leaving the
 * endpoint fully open to anyone who can reach the port. An unset secret is not
 * consent; it is an unfinished configuration, and the safe reading of it is
 * "closed", not "open to all".
 *
 * Extracted into its own module so it can be tested without booting the server.
 */
import { timingSafeEqual } from 'node:crypto';

/**
 * Flat rather than a discriminated union on purpose: this repo compiles with
 * `strictNullChecks: false`, under which TypeScript will not narrow
 * `{ ok: true } | { ok: false; status }` from an `if (!result.ok)` test, so the
 * caller cannot reach `.status` without a cast. `status` and `error` are null
 * exactly when `ok` is true.
 */
export interface WebhookSecretResult {
  ok: boolean;
  status: 401 | 503 | null;
  error: string | null;
}

/** Constant-time comparison that tolerates unequal lengths. */
function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  // timingSafeEqual throws on a length mismatch, and returning early on length
  // would leak it. Compare against a fixed-size digest-like padding instead: a
  // mismatch in length simply fails, in constant time relative to `left`.
  if (left.length !== right.length) {
    // Still burn a comparison so the failure path is not measurably shorter.
    timingSafeEqual(left, left);
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * Decides whether a webhook request may proceed.
 *
 * @param configured the server's WEBHOOK_SECRET, if any
 * @param provided   the `secret` field from the request body, unvalidated
 */
export function checkWebhookSecret(
  configured: string | undefined,
  provided: unknown
): WebhookSecretResult {
  if (!configured || configured.trim().length === 0) {
    // 503, not 401: the caller has done nothing wrong and no secret they could
    // send would work. This is the server refusing to offer the endpoint.
    return {
      ok: false,
      status: 503,
      error:
        'The webhook endpoint is disabled because WEBHOOK_SECRET is not configured. ' +
        'Set it to a random string of at least 16 characters to enable it.',
    };
  }

  if (typeof provided !== 'string' || !secretsMatch(configured, provided)) {
    return { ok: false, status: 401, error: 'Invalid webhook secret' };
  }

  return { ok: true, status: null, error: null };
}
