/**
 * Every way an API call can fail, as one type.
 *
 * Components used to hand-roll this at each call site, and each one landed
 * somewhere slightly different: some surfaced `result.error`, some surfaced
 * `HTTP 500`, and a non-JSON response (a proxy error page, say) produced a raw
 * `SyntaxError: Unexpected token '<'` in a toast. One class means one place
 * decides what a user is told, and callers can branch on `status` instead of
 * matching on message text.
 */
export class ApiError extends Error {
  /**
   * HTTP status, or 0 when the request never reached the server. Zero is
   * distinguishable on purpose: "the backend said no" and "the backend is not
   * running" need different advice, and they are the two most common failures
   * in local development.
   */
  readonly status: number;

  /** Whatever the backend put in the envelope's `details`, when it sent any. */
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;

    // Required for `instanceof` to work when targeting ES5-era output.
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** The request never reached the server (offline, wrong port, CORS). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Signed out, or the session could not be renewed. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Signed in, but not allowed to do this. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/**
 * The message to show a user for any thrown value.
 *
 * Callers catch `unknown`, so this is the one place that decides what to do with
 * a non-Error throw rather than each `catch` block guessing.
 */
export function messageFor(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
