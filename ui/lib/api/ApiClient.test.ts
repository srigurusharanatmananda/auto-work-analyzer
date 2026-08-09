/**
 * The HTTP layer's behaviour, with a stubbed `fetch`. Nothing here opens a
 * socket.
 *
 * The tests that earn their keep are the session-renewal ones. Refresh-on-401
 * is invisible when it works and, when it is subtly wrong, presents as users
 * being signed out at random — a report nobody can reproduce. The
 * single-flight test in particular pins a real hazard: the backend rotates
 * refresh tokens and treats reuse as theft, so two concurrent refreshes revoke
 * the whole token family.
 */

import { describe, expect, mock, test } from 'bun:test';
import { ApiClient, type AuthBridge, type FetchLike } from './ApiClient';
import { ApiError, messageFor } from './ApiError';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './config';

const BASE = 'http://api.test';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Replays the given responses in order; records every request it was sent. */
function stubFetch(responses: Response[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let index = 0;

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const response = responses[Math.min(index, responses.length - 1)]!;
    index += 1;
    return response.clone();
  };

  return { fetchImpl, calls };
}

function authBridge(overrides: Partial<AuthBridge> = {}): AuthBridge {
  return {
    getAccessToken: () => 'token-1',
    refreshAccessToken: async () => 'token-2',
    onAuthenticationLost: () => {},
    ...overrides,
  };
}

function clientWith(responses: Response[], auth?: AuthBridge) {
  const { fetchImpl, calls } = stubFetch(responses);
  const client = new ApiClient({ baseUrl: BASE, fetchImpl });
  if (auth) client.setAuthBridge(auth);
  return { client, calls };
}

describe('resolveApiBaseUrl', () => {
  test('falls back when unset or blank, so a fresh clone still works', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL);
    expect(resolveApiBaseUrl('')).toBe(DEFAULT_API_BASE_URL);
    expect(resolveApiBaseUrl('   ')).toBe(DEFAULT_API_BASE_URL);
  });

  test('strips trailing slashes, which would otherwise produce //api', () => {
    expect(resolveApiBaseUrl('https://awa.example.com/')).toBe('https://awa.example.com');
    expect(resolveApiBaseUrl('https://awa.example.com///')).toBe('https://awa.example.com');
  });
});

describe('request building', () => {
  test('prefixes /api so no caller has to repeat the mount point', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: {} })]);
    await client.get('/reports');

    expect(calls[0]!.url).toBe(`${BASE}/api/reports`);
  });

  test('tolerates a path written without its leading slash', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: {} })]);
    await client.get('reports');

    expect(calls[0]!.url).toBe(`${BASE}/api/reports`);
  });

  test('drops undefined and null query values rather than sending "undefined"', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: {} })]);
    await client.get('/reports', { query: { limit: 10, author: undefined, branch: null } });

    expect(calls[0]!.url).toBe(`${BASE}/api/reports?limit=10`);
  });

  test('sends credentials on every request, not just the auth ones', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: {} })]);
    await client.get('/reports');

    expect(calls[0]!.init.credentials).toBe('include');
  });

  test('sets Content-Type only when there is a body to describe', async () => {
    const { client, calls } = clientWith([
      jsonResponse({ success: true, data: {} }),
      jsonResponse({ success: true, data: {} }),
    ]);

    await client.get('/reports');
    await client.post('/reports', { a: 1 });

    expect((calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect((calls[1]!.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
    expect(calls[1]!.init.body).toBe(JSON.stringify({ a: 1 }));
  });

  test('attaches the bearer token when authenticated', async () => {
    const { client, calls } = clientWith(
      [jsonResponse({ success: true, data: {} })],
      authBridge()
    );
    await client.get('/reports');

    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  test('omits the token when the caller opts out', async () => {
    const { client, calls } = clientWith(
      [jsonResponse({ success: true, data: {} })],
      authBridge()
    );
    await client.post('/auth/login', { email: 'a@b.c' }, { authenticated: false });

    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('envelope handling', () => {
  test('returns the payload, not the envelope', async () => {
    const { client } = clientWith([jsonResponse({ success: true, data: { items: [1, 2] } })]);

    expect(await client.get<{ items: number[] }>('/reports')).toEqual({ items: [1, 2] });
  });

  test('send() also exposes the backend’s message', async () => {
    const { client } = clientWith([
      jsonResponse({ success: true, data: { tasksCreated: 3 }, message: 'Created 3 tasks' }),
    ]);

    const response = await client.send<{ tasksCreated: number }>('/create-tasks');
    expect(response.data.tasksCreated).toBe(3);
    expect(response.message).toBe('Created 3 tasks');
  });

  /**
   * The two failure signals are not always paired — some routes 200 with
   * `success: false`. Checking only the status, as several call sites did,
   * treats those as success and hands the component `undefined` data.
   */
  test('a 200 with success:false is still a failure', async () => {
    const { client } = clientWith([jsonResponse({ success: false, error: 'Nope' })]);

    await expect(client.get('/reports')).rejects.toThrow('Nope');
  });

  test('carries status and details onto the error', async () => {
    const { client } = clientWith([
      jsonResponse({ success: false, error: 'Invalid workItems', details: 'workItems[0]' }, 400),
    ]);

    const error = (await client.post('/create-tasks', {}).catch((caught) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.details).toBe('workItems[0]');
    expect(error.isForbidden).toBe(false);
  });

  /**
   * A crash before the JSON middleware, or a proxy error page, used to surface
   * as "Unexpected token '<'" in a toast.
   */
  test('a non-JSON error body produces a readable message, not a SyntaxError', async () => {
    const { client } = clientWith([
      new Response('<html>502 Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    ]);

    const error = (await client.get('/reports').catch((caught) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toContain('502');
  });

  test('a 204 resolves rather than failing to parse an empty body', async () => {
    const { client } = clientWith([new Response(null, { status: 204 })]);

    expect(await client.delete('/destinations/abc')).toBeUndefined();
  });

  test('an unreachable server is reported as such, not as "Failed to fetch"', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('Failed to fetch');
    };
    const client = new ApiClient({ baseUrl: BASE, fetchImpl });

    const error = (await client.get('/reports').catch((caught) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toContain('Is the backend running?');
  });

  test('an aborted request stays an AbortError for the caller to ignore', async () => {
    const fetchImpl: FetchLike = async () => {
      const abort = new Error('The operation was aborted');
      abort.name = 'AbortError';
      throw abort;
    };
    const client = new ApiClient({ baseUrl: BASE, fetchImpl });

    const error = (await client.get('/reports').catch((caught) => caught)) as Error;

    expect(error.name).toBe('AbortError');
    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe('session renewal', () => {
  test('a 401 refreshes and retries once', async () => {
    let attempt = 0;
    const responses = [
      jsonResponse({ success: false, error: 'Token expired' }, 401),
      jsonResponse({ success: true, data: { ok: true } }),
    ];
    const recorded: RequestInit[] = [];
    const retrying = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async (_url, init) => {
        recorded.push(init);
        const response = responses[Math.min(attempt, responses.length - 1)]!;
        attempt += 1;
        return response.clone();
      },
    });

    let currentToken = 'expired';
    retrying.setAuthBridge(
      authBridge({
        getAccessToken: () => currentToken,
        refreshAccessToken: async () => {
          currentToken = 'fresh';
          return currentToken;
        },
      })
    );

    expect(await retrying.get<{ ok: boolean }>('/reports')).toEqual({ ok: true });
    expect(attempt).toBe(2);

    // The retry must carry the NEW token. Capturing it before the refresh would
    // replay the expired one and 401 forever.
    expect((recorded[0]!.headers as Record<string, string>).Authorization).toBe('Bearer expired');
    expect((recorded[1]!.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  /**
   * `rawRequest` exists so a binary-response call (e.g. audio) gets the same
   * session renewal as every JSON call — the bug this guards against is a
   * caller reimplementing its own fetch and silently losing the retry.
   */
  test('rawRequest also refreshes and retries once, and returns the raw Response unparsed', async () => {
    let attempt = 0;
    const responses = [
      jsonResponse({ success: false, error: 'Token expired' }, 401),
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    ];
    const retrying = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => {
        const response = responses[Math.min(attempt, responses.length - 1)]!;
        attempt += 1;
        return response.clone();
      },
    });

    let currentToken = 'expired';
    retrying.setAuthBridge(
      authBridge({
        getAccessToken: () => currentToken,
        refreshAccessToken: async () => {
          currentToken = 'fresh';
          return currentToken;
        },
      })
    );

    const response = await retrying.rawRequest('/learn/speak', { method: 'POST' });

    expect(attempt).toBe(2);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  /**
   * The token-family hazard. Refresh tokens rotate, so a second concurrent
   * refresh presents an already-consumed token and the backend revokes
   * everything. Users would see "signed out at random on page load".
   */
  test('a burst of 401s triggers exactly one refresh', async () => {
    let attempts = 0;
    const client = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => {
        attempts += 1;
        // Every first attempt 401s; retries (after the 5th call) succeed.
        return attempts <= 5
          ? jsonResponse({ success: false, error: 'Token expired' }, 401)
          : jsonResponse({ success: true, data: { ok: true } });
      },
    });

    const refreshAccessToken = mock(async () => {
      // A real refresh is a round trip; yielding here is what gives the other
      // four requests the chance to start their own if single-flighting is
      // broken.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'fresh';
    });
    client.setAuthBridge(authBridge({ refreshAccessToken }));

    const results = await Promise.all(
      Array.from({ length: 5 }, () => client.get<{ ok: boolean }>('/reports'))
    );

    expect(results).toEqual(Array.from({ length: 5 }, () => ({ ok: true })));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  test('a later expiry starts a new refresh rather than replaying the old one', async () => {
    let attempts = 0;
    const client = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => {
        attempts += 1;
        // Odd attempts 401, even attempts succeed: each request expires once.
        return attempts % 2 === 1
          ? jsonResponse({ success: false, error: 'Token expired' }, 401)
          : jsonResponse({ success: true, data: { ok: true } });
      },
    });

    const refreshAccessToken = mock(async () => 'fresh');
    client.setAuthBridge(authBridge({ refreshAccessToken }));

    await client.get('/reports');
    await client.get('/reports');

    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  test('a failed refresh signs the user out instead of retrying forever', async () => {
    let attempts = 0;
    const client = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => {
        attempts += 1;
        return jsonResponse({ success: false, error: 'Token expired' }, 401);
      },
    });

    const onAuthenticationLost = mock(() => {});
    client.setAuthBridge(
      authBridge({ refreshAccessToken: async () => null, onAuthenticationLost })
    );

    const error = (await client.get('/reports').catch((caught) => caught)) as ApiError;

    expect(error.isUnauthorized).toBe(true);
    expect(error.message).toContain('sign in again');
    expect(onAuthenticationLost).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(1);
  });

  test('a refresh that throws is treated as a failed refresh, not an unhandled error', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => jsonResponse({ success: false, error: 'Token expired' }, 401),
    });

    const onAuthenticationLost = mock(() => {});
    client.setAuthBridge(
      authBridge({
        refreshAccessToken: async () => {
          throw new Error('network down');
        },
        onAuthenticationLost,
      })
    );

    await expect(client.get('/reports')).rejects.toBeInstanceOf(ApiError);
    expect(onAuthenticationLost).toHaveBeenCalledTimes(1);
  });

  /**
   * Refreshing in response to the refresh endpoint's own 401 is infinite
   * recursion. Unauthenticated calls therefore never retry.
   */
  test('an unauthenticated call never triggers a refresh', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => jsonResponse({ success: false, error: 'Invalid credentials' }, 401),
    });

    const refreshAccessToken = mock(async () => 'fresh');
    client.setAuthBridge(authBridge({ refreshAccessToken }));

    await expect(
      client.post('/auth/refresh', undefined, { authenticated: false })
    ).rejects.toThrow('Invalid credentials');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  test('a 401 before any session exists is reported, not refreshed', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      fetchImpl: async () => jsonResponse({ success: false, error: 'Unauthorized' }, 401),
    });
    // No auth bridge installed — first paint, or a signed-out visitor.

    await expect(client.get('/reports')).rejects.toThrow('Unauthorized');
  });

  test('a 403 is not mistaken for an expired session', async () => {
    const refreshAccessToken = mock(async () => 'fresh');
    const { client } = clientWith(
      [jsonResponse({ success: false, error: 'Admins only' }, 403)],
      authBridge({ refreshAccessToken })
    );

    const error = (await client.get('/users').catch((caught) => caught)) as ApiError;

    expect(error.isForbidden).toBe(true);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});

/**
 * Multipart is the audio-upload path. Getting the header wrong here does not
 * throw anywhere in the client — it produces a body multer cannot parse, which
 * surfaces as "no file provided" from a request that plainly had one.
 */
describe('FormData bodies', () => {
  const audioForm = () => {
    const form = new FormData();
    form.append('audio', new Blob(['fake audio']), 'call.m4a');
    form.append('callTitle', 'Weekly sync');
    return form;
  };

  test('passes the FormData through instead of JSON-stringifying it', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: { id: 'job-1' } })]);

    await client.post('/transcription/upload', audioForm());

    expect(calls[0]!.init.body).toBeInstanceOf(FormData);
  });

  /**
   * The boundary is generated by the browser and only it knows the value. A
   * hand-set `Content-Type: multipart/form-data` has no boundary and the server
   * cannot read the parts.
   */
  test('leaves Content-Type unset so the browser can add the boundary', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: {} })]);

    await client.post('/transcription/upload', audioForm());

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  test('still sends the Authorization header', async () => {
    const { client, calls } = clientWith(
      [jsonResponse({ success: true, data: {} })],
      authBridge({ getAccessToken: () => 'token-1' })
    );

    await client.post('/transcription/upload', audioForm());

    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  test('a JSON body is still stringified and still declares its type', async () => {
    const { client, calls } = clientWith([jsonResponse({ success: true, data: {} })]);

    await client.post('/preview-tasks', { transcript: 'hello' });

    expect(calls[0]!.init.body).toBe('{"transcript":"hello"}');
    expect((calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
  });
});

describe('messageFor', () => {
  test('prefers a real message and falls back for non-Errors', () => {
    expect(messageFor(new ApiError('Nope', 400))).toBe('Nope');
    expect(messageFor(new Error('boom'))).toBe('boom');
    expect(messageFor('a thrown string', 'Fallback')).toBe('Fallback');
    expect(messageFor(undefined, 'Fallback')).toBe('Fallback');
  });
});
