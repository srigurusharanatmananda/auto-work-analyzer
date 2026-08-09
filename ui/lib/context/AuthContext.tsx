'use client';

/**
 * Session state, and the bridge that lets `ApiClient` renew it.
 *
 * The division of labour: this file owns the session (who is signed in, where
 * the tokens are kept, what happens when they are gone), and `ApiClient` owns
 * HTTP. They meet at {@link AuthBridge} — an interface the client depends on and
 * this provider implements — so neither imports the other's internals.
 *
 * Two things changed here beyond wiring:
 *
 *  - **Persistence is in one place.** Three separate blocks wrote the same three
 *    localStorage keys and two more removed them, so adding a fourth key meant
 *    finding all five. `persistSession` and `clearPersistedSession` are now the
 *    only code that names them.
 *  - **Expiry no longer depends on a timer firing.** The pre-emptive refresh is
 *    still here, but it was the *only* recovery path: no `tokenExpiresAt` in
 *    storage, or a laptop asleep past the 15-minute access-token lifetime, and
 *    nothing ever refreshed. The client's 401 handling is now the backstop, and
 *    this timer is the optimisation that avoids a user-visible round trip.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, messageFor, type AuthBridge } from '../api';
import { AuthService } from '../services/authService';
import { AuthContextType, AuthTokens, LoginCredentials, RegisterData, User } from '../types/auth';

/** The only place these strings appear. */
const STORAGE_KEYS = {
  user: 'user',
  accessToken: 'accessToken',
  expiresAt: 'tokenExpiresAt',
} as const;

/** Renew this long before the token actually expires. */
const REFRESH_LEAD_MS = 60_000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistSession(user: User, tokens: AuthTokens): void {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.expiresAt, tokens.expiresAt);
}

function persistTokens(tokens: AuthTokens): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.expiresAt, tokens.expiresAt);
}

function clearPersistedSession(): void {
  for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key);
}

/**
 * Reads a stored session. Returns null on absent OR corrupt data — a
 * half-parsed user used to throw during the mount effect and leave the app
 * stuck on its loading state with no way out but clearing storage by hand.
 */
function readPersistedSession(): { user: User; accessToken: string } | null {
  try {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const rawUser = localStorage.getItem(STORAGE_KEYS.user);
    if (!accessToken || !rawUser) return null;
    return { user: JSON.parse(rawUser) as User, accessToken };
  } catch {
    clearPersistedSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * The token, readable synchronously by the bridge.
   *
   * The bridge is installed once; a closure over `accessToken` state would
   * capture the value from that render and keep sending the first token
   * forever. This ref is the current one.
   */
  const accessTokenRef = useRef<string | null>(null);
  const applyToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  const endSession = useCallback(
    (notice?: string) => {
      applyToken(null);
      setUser(null);
      clearPersistedSession();
      if (notice) toast.error(notice);
      router.push('/login');
    },
    [applyToken, router]
  );

  /**
   * Installs the bridge before first paint so that a request fired from a
   * child's mount effect already carries the token. `useState`'s initialiser
   * runs before children render; an effect here would not.
   */
  const [bridge] = useState<AuthBridge>(() => ({
    getAccessToken: () => accessTokenRef.current,
    refreshAccessToken: async () => {
      const tokens = await AuthService.refresh();
      applyToken(tokens.accessToken);
      persistTokens(tokens);
      return tokens.accessToken;
    },
    onAuthenticationLost: () => endSession('Your session has expired. Please sign in again.'),
  }));

  useEffect(() => {
    api.setAuthBridge(bridge);
    return () => api.setAuthBridge(null);
  }, [bridge]);

  // Restore a stored session on mount.
  useEffect(() => {
    const stored = readPersistedSession();
    if (stored) {
      applyToken(stored.accessToken);
      setUser(stored.user);
    }
    setIsLoading(false);
  }, [applyToken]);

  const refreshToken = useCallback(async () => {
    try {
      await bridge.refreshAccessToken();
    } catch {
      endSession();
    }
  }, [bridge, endSession]);

  // Renew ahead of expiry so the user never waits on a 401-and-retry. Purely an
  // optimisation now — ApiClient recovers if this never runs.
  useEffect(() => {
    if (!accessToken) return;

    const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
    if (!expiresAt) return;

    const dueIn = new Date(expiresAt).getTime() - Date.now() - REFRESH_LEAD_MS;
    if (Number.isNaN(dueIn)) return;

    if (dueIn <= 0) {
      void refreshToken();
      return;
    }

    const timer = setTimeout(() => void refreshToken(), dueIn);
    return () => clearTimeout(timer);
  }, [accessToken, refreshToken]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const session = await AuthService.login(credentials);
        applyToken(session.accessToken);
        setUser(session.user);
        persistSession(session.user, session);

        toast.success('Login successful!');
        router.push('/');
      } catch (error) {
        toast.error(messageFor(error, 'Login failed'));
        throw error;
      }
    },
    [applyToken, router]
  );

  const register = useCallback(
    async (data: RegisterData) => {
      try {
        await AuthService.register(data);
        toast.success('Registration successful! Please login.');
        router.push('/login');
      } catch (error) {
        toast.error(messageFor(error, 'Registration failed'));
        throw error;
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      // Best effort: the local session is cleared either way, so a backend that
      // is down cannot strand a user in a signed-in-looking app.
      if (accessTokenRef.current) await AuthService.logout();
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      applyToken(null);
      setUser(null);
      clearPersistedSession();
      toast.success('Logged out successfully');
      router.push('/login');
    }
  }, [applyToken, router]);

  const updatePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      try {
        await AuthService.updatePassword(oldPassword, newPassword);
        toast.success('Password updated successfully! Please login again.');
        // The backend revokes every session on a password change, so the token
        // in hand is already dead.
        await logout();
      } catch (error) {
        toast.error(messageFor(error, 'Password update failed'));
        throw error;
      }
    },
    [logout]
  );

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
