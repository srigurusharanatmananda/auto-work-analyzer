/**
 * The network half of the guard, with the network stubbed.
 *
 * Both dependencies are injected, so these tests resolve no names and open no
 * sockets. That is not only for speed: the cases worth testing are a hostname
 * that resolves to 127.0.0.1 and a redirect into the metadata endpoint, and
 * neither can be arranged against the real internet.
 */

import { describe, expect, test } from "bun:test";
import { assertPublicHost, resolveFetchableUrl, type HostLookup } from "./ssrfGuard.js";

const publicLookup: HostLookup = async () => ["93.184.216.34"];

/** A fetch that returns 200 for everything — the no-redirect baseline. */
const alwaysOk = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;

/** A fetch that 302s along `chain`, then 200s. */
function redirectingFetch(chain: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const target = chain[url];
    return target
      ? new Response(null, { status: 302, headers: { location: target } })
      : new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
}

describe("assertPublicHost", () => {
  test("accepts a name that resolves publicly", async () => {
    expect((await assertPublicHost("example.com", { lookup: publicLookup })).ok).toBe(true);
  });

  test("refuses a name that resolves to loopback", async () => {
    const result = await assertPublicHost("evil.example", {
      lookup: async () => ["127.0.0.1"],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/127\.0\.0\.1/);
  });

  /**
   * Every address, not any. A name with one good record and one bad one is
   * deliberate, and which one the eventual fetch picks is not ours to choose.
   */
  test("refuses when only one of several addresses is private", async () => {
    const result = await assertPublicHost("mixed.example", {
      lookup: async () => ["93.184.216.34", "169.254.169.254"],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/169\.254\.169\.254/);
  });

  test("refuses a name that resolves to a private IPv6 address", async () => {
    const result = await assertPublicHost("six.example", { lookup: async () => ["::1"] });

    expect(result.ok).toBe(false);
  });

  test("refuses a name that resolves to nothing at all", async () => {
    expect((await assertPublicHost("void.example", { lookup: async () => [] })).ok).toBe(false);
  });

  test("refuses a name the resolver rejects, rather than treating it as unknown-good", async () => {
    const result = await assertPublicHost("nx.example", {
      lookup: async () => {
        throw new Error("ENOTFOUND");
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/could not be resolved/);
  });
});

describe("resolveFetchableUrl", () => {
  test("passes a direct link straight through", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: publicLookup,
      fetchImpl: alwaysOk,
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://cdn.example.com/a.mp3");
    expect(result.redirected).toBe(false);
  });

  test("follows a redirect and returns where it landed", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: publicLookup,
      fetchImpl: redirectingFetch({
        "https://cdn.example.com/a.mp3": "https://files.example.com/real.mp3",
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://files.example.com/real.mp3");
    expect(result.redirected).toBe(true);
  });

  /**
   * The case the whole module exists for. The pasted link is impeccable; the
   * redirect is where the server actually goes.
   */
  test("refuses a redirect into the cloud metadata endpoint", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: publicLookup,
      fetchImpl: redirectingFetch({
        "https://cdn.example.com/a.mp3": "http://169.254.169.254/latest/meta-data/a.mp3",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/redirects/);
  });

  test("refuses a redirect that changes the scheme to something local", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: publicLookup,
      fetchImpl: redirectingFetch({
        "https://cdn.example.com/a.mp3": "file:///etc/passwd.mp3",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/redirects somewhere unusable/);
  });

  test("refuses a redirect to a host that resolves privately", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: async (hostname) => (hostname === "cdn.example.com" ? ["93.184.216.34"] : ["10.0.0.5"]),
      fetchImpl: redirectingFetch({
        "https://cdn.example.com/a.mp3": "https://internal.example.com/a.mp3",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/private address/);
  });

  test("gives up on a redirect loop instead of following it forever", async () => {
    const result = await resolveFetchableUrl("https://a.example.com/x.mp3", {
      lookup: publicLookup,
      maxRedirects: 3,
      fetchImpl: redirectingFetch({
        "https://a.example.com/x.mp3": "https://b.example.com/x.mp3",
        "https://b.example.com/x.mp3": "https://a.example.com/x.mp3",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/redirects more than 3 times/);
  });

  test("resolves a relative Location against the current URL", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/calls/a.mp3", {
      lookup: publicLookup,
      fetchImpl: redirectingFetch({ "https://cdn.example.com/calls/a.mp3": "/moved/b.mp3" }),
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://cdn.example.com/moved/b.mp3");
  });

  test("a 3xx with no Location is a response, not a redirect", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: publicLookup,
      fetchImpl: (async () => new Response(null, { status: 304 })) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
  });

  test("reports a link that is not there", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/gone.mp3", {
      lookup: publicLookup,
      fetchImpl: (async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/nothing at that link/);
  });

  /**
   * A 405 is a statement about HEAD, not about the file. yt-dlp and ffmpeg both
   * GET, so failing here would reject working links.
   */
  test("tolerates a server that refuses HEAD", async () => {
    for (const status of [401, 403, 405, 500]) {
      const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
        lookup: publicLookup,
        fetchImpl: (async () => new Response(null, { status })) as unknown as typeof fetch,
      });

      expect(result.ok).toBe(true);
    }
  });

  test("reports an unreachable host rather than throwing", async () => {
    const result = await resolveFetchableUrl("https://cdn.example.com/a.mp3", {
      lookup: publicLookup,
      fetchImpl: (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Could not reach cdn\.example\.com/);
  });

  test("refuses a bad link before making any request at all", async () => {
    let called = false;
    const result = await resolveFetchableUrl("file:///etc/passwd.mp3", {
      lookup: publicLookup,
      fetchImpl: (async () => {
        called = true;
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });
});
