/**
 * The one way the front-end talks to the backend.
 *
 * It replaces 44 hand-written `fetch` calls that each repeated the same five
 * concerns — base URL, `Content-Type`, the `Authorization` header,
 * `credentials: 'include'`, and unwrapping the `{ success, data, error }`
 * envelope — and each got to differ in how it reported failure.
 *
 * Three things it does that no call site did:
 *
 *  - **Renews an expired session instead of failing.** `AuthContext` refreshes
 *    on a timer, which covers only the case where the tab is awake and
 *    `tokenExpiresAt` is present. A laptop that slept through the 15-minute
 *    access-token lifetime woke up to every request 401ing, each surfaced as
 *    that component's own generic error, with nothing attempting recovery. A
 *    401 here refreshes once and retries.
 *  - **Refreshes once for a burst, not once per request.** Pages fire several
 *    requests on mount. Without single-flighting, an expired token means N
 *    concurrent refreshes, and since the backend ROTATES refresh tokens, the
 *    losers of that race present a token that has already been consumed — token
 *    reuse, which the backend treats as theft and answers by revoking the whole
 *    family. The bug would look like "logged out at random on page load".
 *  - **Distinguishes "server said no" from "server is not there."** A dead
 *    backend used to surface as `TypeError: Failed to fetch`.
 *
 * Nothing here imports React or Next. The client depends on {@link AuthBridge},
 * an interface, not on `AuthContext` — so this file is unit-testable with a
 * stub `fetch` and the auth layer stays free to change.
 */

import { ApiError } from './ApiError';
import { API_BASE_URL } from './config';

/**
 * What the client needs from whoever owns the session. Implemented by
 * `AuthProvider`; injected rather than imported so the dependency points at an
 * abstraction and not at React state.
 */
export interface AuthBridge {
  /** The current access token, or null when signed out. */
  getAccessToken(): string | null;
  /**
   * Mint a new access token from the refresh cookie. Resolves to the new token,
   * or null when the session cannot be renewed.
   *
   * The client guarantees it will not call this concurrently.
   */
  refreshAccessToken(): Promise<string | null>;
  /** A request failed authentication and refreshing could not rescue it. */
  onAuthenticationLost(): void;
}

/** The response shape every backend route returns. */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  message?: string;
}

/** A successful call: the payload, plus the backend's human-facing sentence. */
export interface ApiResponse<T> {
  data: T;
  /** Present on routes that describe what they did, e.g. "Created 3 tasks". */
  message?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialized as JSON. Omit for GET/DELETE. */
  body?: unknown;
  /** Appended as a query string; undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Send the access token and renew it on 401. Default true.
   *
   * Login, register and refresh set this false — refresh especially, because a
   * 401 from the refresh endpoint triggering a refresh is infinite recursion.
   */
  authenticated?: boolean;
  signal?: AbortSignal;
}

/** Injectable seam for tests; the real one is the global `fetch`. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private auth: AuthBridge | null = null;

  /**
   * The in-progress refresh, shared by every request that 401s while it runs.
   * See the "once for a burst" note in the header — this field is the whole
   * mechanism.
   */
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? API_BASE_URL;
    // Bound, because an unbound `fetch` throws "Illegal invocation" in browsers.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /**
   * Installs the session owner. Called once by `AuthProvider`; until then
   * requests are sent unauthenticated, which is correct during first paint.
   */
  setAuthBridge(auth: AuthBridge | null): void {
    this.auth = auth;
  }

  get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  delete<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /** The payload only. What almost every caller wants. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { data } = await this.send<T>(path, options);
    return data;
  }

  /**
   * The payload plus the backend's `message`. Use when the sentence the server
   * wrote is worth showing — "Created 3 tasks in ClickUp (1 failed)" says more
   * than anything the client could reconstruct from the data.
   */
  async send<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const authenticated = options.authenticated ?? true;

    let response = await this.execute(path, options, authenticated);

    if (response.status === 401 && authenticated && this.auth) {
      const renewed = await this.refreshOnce();
      if (renewed === null) {
        this.auth.onAuthenticationLost();
        throw new ApiError('Your session has expired. Please sign in again.', 401);
      }
      response = await this.execute(path, options, authenticated);
    }

    return this.unwrap<T>(response);
  }

  /** Builds and sends one attempt. No retry logic, no unwrapping. */
  private async execute(
    path: string,
    options: RequestOptions,
    authenticated: boolean
  ): Promise<Response> {
    const headers: Record<string, string> = {};

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (authenticated) {
      // Read the token at send time, not at construction: after a refresh the
      // retry must carry the NEW token, and a captured one would replay the
      // expired one forever.
      const token = this.auth?.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    try {
      return await this.fetchImpl(this.urlFor(path, options.query), {
        method: options.method ?? 'GET',
        headers,
        // Carries the refresh-token cookie. Required on every call, not just
        // the auth ones, because the cookie is httpOnly and same-site.
        credentials: 'include',
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (caught) {
      // An aborted request is the caller's own doing — rethrow it untouched so
      // `error.name === 'AbortError'` still works and it is not reported to the
      // user as a network outage.
      if (caught instanceof Error && caught.name === 'AbortError') throw caught;

      throw new ApiError(
        `Could not reach the server at ${this.baseUrl}. Is the backend running?`,
        0
      );
    }
  }

  /**
   * Shares one refresh across every request that needs it. The `finally` clears
   * the slot so a later expiry starts a fresh attempt rather than replaying this
   * one's result.
   */
  private refreshOnce(): Promise<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.auth!.refreshAccessToken()
        .catch(() => null)
        .finally(() => {
          this.refreshInFlight = null;
        });
    }
    return this.refreshInFlight;
  }

  /** Turns a Response into a payload, or throws the most useful ApiError. */
  private async unwrap<T>(response: Response): Promise<ApiResponse<T>> {
    // 204 has no body to parse and no payload to return.
    if (response.status === 204) {
      return { data: undefined as T };
    }

    let envelope: ApiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as ApiEnvelope<T>;
    } catch {
      // A proxy error page, a crash before the JSON middleware, an empty body.
      if (!response.ok) {
        throw new ApiError(
          `The server returned ${response.status} ${response.statusText}`.trim(),
          response.status
        );
      }
      throw new ApiError('The server returned a response that could not be read', response.status);
    }

    // `success: false` and a non-2xx status both mean failure, and the backend
    // does not always pair them — checking only one would let the other pass.
    if (!response.ok || envelope.success === false) {
      throw new ApiError(
        envelope.error ?? `The server returned ${response.status}`,
        response.status,
        envelope.details
      );
    }

    return {
      data: envelope.data as T,
      ...(envelope.message !== undefined ? { message: envelope.message } : {}),
    };
  }

  /** `<origin>/api<path>`, plus any query string. */
  private urlFor(path: string, query?: RequestOptions['query']): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}/api${normalized}`;

    if (!query) return url;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }

    const serialized = params.toString();
    return serialized ? `${url}?${serialized}` : url;
  }
}

/**
 * The app-wide instance. `AuthProvider` installs the session on mount; every
 * component imports this rather than building its own.
 */
export const api = new ApiClient();
