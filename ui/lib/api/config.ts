/**
 * Where the API lives — the single answer, for the whole front-end.
 *
 * Before this existed, `http://localhost:3009` was written out in fifteen files,
 * which meant the UI could only ever talk to a backend on this machine on that
 * port. Deploying it anywhere required editing fifteen files identically and
 * getting all fifteen right.
 *
 * `NEXT_PUBLIC_API_URL` is the origin only — no `/api` suffix and no trailing
 * slash. `ApiClient` adds the `/api` prefix, so a caller writes
 * `api.post('/preview-tasks')` and nothing repeats the mount point either.
 *
 * Next inlines `process.env.NEXT_PUBLIC_API_URL` at BUILD time, and only where
 * the property is accessed literally — which is why it is read here, once, and
 * exported as a value rather than looked up at each call site.
 */

/**
 * Used when nothing is configured. This is the port `bun run webhook` serves on,
 * so a developer who has cloned the repo and started both halves gets a working
 * app with no env file — the same behaviour the hard-coded constants gave.
 */
export const DEFAULT_API_BASE_URL = 'http://localhost:3009';

/**
 * Normalizes a configured origin: trims, and strips trailing slashes so joining
 * a path cannot produce `//api/...`. Blank or unset falls back to the default —
 * an empty env var is a mistake, not a request for relative URLs.
 *
 * Exported for tests; app code should use {@link API_BASE_URL}.
 */
export function resolveApiBaseUrl(configured?: string): string {
  const trimmed = configured?.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;
  return trimmed.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
