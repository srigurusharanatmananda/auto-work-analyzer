/**
 * POST /api/webhook creates real ClickUp tasks with no user session, so this
 * check is the whole of its access control. The case that matters most is the
 * one the original code got wrong: no secret configured.
 */
import { describe, expect, test } from "bun:test";
import { checkWebhookSecret } from "./webhookSecret.js";

const SECRET = "s3cret-value-long-enough";

describe("checkWebhookSecret", () => {
  test("an unconfigured secret closes the endpoint rather than opening it", () => {
    // The regression this file exists for: `if (configured && provided !== configured)`
    // skipped verification entirely when nothing was configured.
    const result = checkWebhookSecret(undefined, "anything");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(503);
  });

  test("an empty or whitespace secret counts as unconfigured", () => {
    for (const configured of ["", "   "]) {
      const result = checkWebhookSecret(configured, configured);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.status).toBe(503);
    }
  });

  test("the 503 says what to do about it, without echoing any secret", () => {
    const result = checkWebhookSecret(undefined, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("WEBHOOK_SECRET");
    expect(result.error).not.toContain(SECRET);
  });

  test("the matching secret is accepted", () => {
    expect(checkWebhookSecret(SECRET, SECRET)).toEqual({
      ok: true,
      status: null,
      error: null,
    });
  });

  test("a wrong secret is rejected with 401", () => {
    const result = checkWebhookSecret(SECRET, "wrong-but-same-length!!");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
  });

  test("a prefix of the real secret is rejected", () => {
    // Guards the length-mismatch branch, which must fail rather than throw.
    const result = checkWebhookSecret(SECRET, SECRET.slice(0, 5));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
  });

  test("a missing or non-string secret is rejected, not coerced", () => {
    for (const provided of [undefined, null, 42, {}, [SECRET]]) {
      const result = checkWebhookSecret(SECRET, provided);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.status).toBe(401);
    }
  });

  test("the 401 does not reveal the configured secret", () => {
    const result = checkWebhookSecret(SECRET, "wrong");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toContain(SECRET);
  });
});
