/**
 * The auth endpoints, as functions.
 *
 * Was six methods that each repeated the same eight lines of fetch, headers,
 * credentials and envelope handling; all of that now lives in `ApiClient`. What
 * is left is the part that is actually about authentication: which path, which
 * payload, and — the one thing that is not boilerplate — which calls must go out
 * WITHOUT a token.
 *
 * Login, register and refresh are unauthenticated on purpose. Refresh
 * especially: it is the endpoint the client calls to recover from a 401, so
 * letting a 401 from it trigger a refresh would recurse forever.
 *
 * These throw `ApiError` rather than returning `{ success: false }`. Callers
 * were already wrapping every one in try/catch and converting failures to
 * throws; doing it once here removes the branch that was easy to forget.
 */

import { api } from '../api';
import { AuthTokens, LoginCredentials, RegisterData, User } from '../types/auth';

/** What a successful sign-in yields. */
export interface Session extends AuthTokens {
  user: User;
}

export const AuthService = {
  login(credentials: LoginCredentials): Promise<Session> {
    return api.post<Session>('/auth/login', credentials, { authenticated: false });
  },

  register(data: RegisterData): Promise<void> {
    return api.post<void>('/auth/register', data, { authenticated: false });
  },

  /**
   * Exchanges the refresh cookie for a new access token.
   *
   * Unauthenticated (the cookie is the credential, and see the header) and
   * driven by `ApiClient`'s renewal path, which single-flights it.
   */
  refresh(): Promise<AuthTokens> {
    return api.post<AuthTokens>('/auth/refresh', undefined, { authenticated: false });
  },

  logout(): Promise<void> {
    return api.post<void>('/auth/logout');
  },

  currentUser(): Promise<{ user: User }> {
    return api.get<{ user: User }>('/auth/me');
  },

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    return api.put<void>('/auth/password', { oldPassword, newPassword });
  },
};
