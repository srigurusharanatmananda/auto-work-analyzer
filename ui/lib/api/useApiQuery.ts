'use client';

/**
 * Read a resource on mount, with loading and error state.
 *
 * Eight components wrote the same twenty lines — a `data` state, a `loading`
 * state, an `error` state, a fetch in a `useEffect`, and a try/catch that
 * toasted. They differed only in ways that were accidents rather than
 * decisions: some set `loading` before the auth check and some after, some left
 * `loading` true forever on an early return, and none of them cancelled a
 * request when their component unmounted.
 *
 * Deliberately read-only. Mutations (create, update, delete) stay explicit
 * `api.post(...)` calls in their handlers, because they are one-shot actions
 * with their own toasts and follow-up state — wrapping those in a hook hides
 * control flow rather than removing repetition.
 *
 * Lives outside the `@/lib/api` barrel on purpose: that barrel is the transport
 * layer and has no React dependency, and importing a hook through it would drag
 * React into anything that only wanted `API_BASE_URL`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, messageFor, type RequestOptions } from './index';

export interface UseApiQueryOptions {
  /** Appended as a query string. Changing it re-runs the request. */
  query?: RequestOptions['query'];
  /**
   * Skip the request while false — for a resource that depends on something the
   * component does not have yet. Defaults to true.
   */
  enabled?: boolean;
  /** Shown when the failure has no message of its own. */
  errorMessage?: string;
}

export interface UseApiQueryResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  /** Re-runs the request — after a mutation, or from a "Try again" button. */
  reload: () => Promise<void>;
}

export function useApiQuery<T>(
  path: string,
  options: UseApiQueryOptions = {}
): UseApiQueryResult<T> {
  const { query, enabled = true, errorMessage = 'Failed to load' } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  /**
   * Callers write `query={{ limit: 10 }}`, a fresh object every render. Keying
   * the effect on the object would re-request on every render forever; keying on
   * its serialization asks the question that was actually meant — did the
   * parameters change?
   */
  const queryKey = query ? JSON.stringify(query) : '';

  /**
   * Identifies the newest request. A slow first response must not overwrite a
   * fast second one — the classic out-of-order bug behind "the list shows the
   * previous filter's results".
   */
  const requestId = useRef(0);

  const run = useCallback(async () => {
    if (!enabled) return;

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.get<T>(path, query ? { query } : {});
      if (id !== requestId.current) return;
      setData(result);
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(messageFor(caught, errorMessage));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
    // `query` is covered by `queryKey`; including the object itself would defeat
    // the point of serializing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, enabled, errorMessage]);

  useEffect(() => {
    void run();
    // Invalidate any in-flight request so its result cannot land after the
    // component has moved on.
    return () => {
      requestId.current += 1;
    };
  }, [run]);

  return { data, error, isLoading, reload: run };
}
