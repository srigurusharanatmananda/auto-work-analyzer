/**
 * The half of the SSRF defence that needs the network.
 *
 * `mediaUrl.ts` decides whether a link is the right *shape*. This decides
 * whether the host it names actually points somewhere public, and where the
 * server ends up after following it. Both are needed, and neither is
 * sufficient: `https://cdn.example.com/a.mp3` passes every syntactic check and
 * can resolve to 127.0.0.1, or 302 to the metadata endpoint.
 *
 * ## What this does not close
 *
 * Between this check and the fetch that ffmpeg or yt-dlp performs, the name is
 * resolved a second time — by a different resolver, in a different process,
 * moments later. A DNS record with a one-second TTL can answer publicly here
 * and privately there. Closing that properly means pinning the address and
 * carrying the hostname in a `Host` header, which breaks TLS certificate
 * validation for exactly the https links this is meant to protect.
 *
 * So the residual risk is stated rather than papered over: an attacker who
 * controls a DNS zone can still, with the right timing, aim one fetch at a
 * private address. What is closed is the whole of the easy surface — literal
 * addresses in every encoding, reserved names, redirects, and hostnames that
 * simply resolve private. The remaining hole needs an attacker-controlled
 * authoritative nameserver and a race, and the real fix for it is an egress
 * firewall, which is a deployment concern and not something this file can do.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { classifyMediaUrl } from "./mediaUrl.js";
import { isBlockedAddress } from "./privateAddress.js";

/** Every address a hostname resolves to. Injected so tests need no network. */
export type HostLookup = (hostname: string) => Promise<string[]>;

export interface SsrfGuardOptions {
  lookup?: HostLookup;
  fetchImpl?: typeof fetch;
  /**
   * Redirect hops to follow before giving up.
   *
   * Low on purpose. A CDN uses one or two; a chain longer than this is either
   * broken or someone walking the guard through a series of hosts hoping one
   * check is cheaper than the last.
   */
  maxRedirects?: number;
  /** Per-hop, not for the whole chain. */
  timeoutMs?: number;
}

export type FetchableUrl =
  | { ok: true; url: string; redirected: boolean; reason?: undefined }
  | { ok: false; url?: undefined; redirected?: undefined; reason: string };

const DEFAULT_MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 10_000;

const defaultLookup: HostLookup = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

/**
 * Resolves a hostname and refuses it unless *every* address is public.
 *
 * Every, not any: a name with one public and one private A record is a
 * deliberate attack, and picking the public one and hoping the fetch agrees is
 * not a check. A name that resolves to nothing is refused too — there is no
 * recording behind it either way, and "the resolver said nothing" is not
 * evidence that a host is safe.
 */
/**
 * Both members declare both fields, matching `ActionItemOutcome` and for the
 * same reason: `strictNullChecks` is off repo-wide, which defeats narrowing a
 * discriminated union by its `ok` flag.
 */
export type HostVerdict =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string };

export async function assertPublicHost(
  hostname: string,
  options: SsrfGuardOptions = {}
): Promise<HostVerdict> {
  const lookup = options.lookup ?? defaultLookup;

  let addresses: string[];
  try {
    addresses = await lookup(hostname);
  } catch {
    return { ok: false, reason: `${hostname} could not be resolved` };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: `${hostname} resolved to no addresses` };
  }

  const blocked = addresses.find((address) => isBlockedAddress(address));
  if (blocked !== undefined) {
    return {
      ok: false,
      reason: `${hostname} resolves to ${blocked}, which is not a public address`,
    };
  }

  return { ok: true };
}

/**
 * Walks the redirect chain by hand, re-checking every hop, and returns the URL
 * that actually holds the bytes.
 *
 * `redirect: 'manual'` is the whole point. Letting fetch follow redirects means
 * the first check is the only check, and a redirect is the cheapest way past a
 * URL allowlist there is: the link the user pastes is vetted, and the one the
 * server fetches is chosen by the host it was pointed at.
 *
 * Each hop goes back through `classifyMediaUrl` as well as the address check,
 * so a redirect cannot change the scheme to `file:` or the kind of thing being
 * fetched either.
 */
export async function resolveFetchableUrl(
  startUrl: string,
  options: SsrfGuardOptions = {}
): Promise<FetchableUrl> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let current = startUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const verdict = classifyMediaUrl(current);
    if (!verdict.ok) {
      return {
        ok: false,
        reason: hop === 0 ? verdict.reason : `That link redirects somewhere unusable: ${verdict.reason}`,
      };
    }

    const host = await assertPublicHost(verdict.hostname, options);
    if (!host.ok) {
      return {
        ok: false,
        reason: hop === 0 ? host.reason : `That link redirects to a private address: ${host.reason}`,
      };
    }

    let response: Response;
    try {
      response = await fetchImpl(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return {
        ok: false,
        reason: `Could not reach ${verdict.hostname}: ${error instanceof Error ? error.message : "request failed"}`,
      };
    }

    const location = response.headers.get("location");
    // 3xx without a Location is not a redirect, whatever the status says.
    if (response.status >= 300 && response.status < 400 && location) {
      // Resolved against the current URL, because a Location header is allowed
      // to be relative — and a relative one cannot leave the host anyway.
      current = new URL(location, current).toString();
      continue;
    }

    // A HEAD that is refused is not a verdict on the URL: plenty of servers
    // answer 405, and yt-dlp and ffmpeg both use GET regardless. Only a
    // definite "not there" is worth failing on, and only for direct files —
    // YouTube answers HEAD with a 200 that means nothing.
    if (verdict.kind === "file" && (response.status === 404 || response.status === 410)) {
      return { ok: false, reason: `There is nothing at that link (${response.status})` };
    }

    return { ok: true, url: current, redirected: current !== startUrl };
  }

  return { ok: false, reason: `That link redirects more than ${maxRedirects} times` };
}
