/**
 * Is this IP address one the server must never be talked into fetching?
 *
 * Ingesting a recording from a URL means the *server* makes the request, with
 * the server's network position. On a developer laptop that reaches
 * `localhost:3000`; on a cloud host it reaches the instance metadata endpoint at
 * `169.254.169.254`, which hands out credentials to anyone who asks. So the
 * question this module answers is the whole of the SSRF defence, and it is
 * deliberately a separate, exhaustively tested unit rather than a regex inlined
 * at the call site.
 *
 * It takes an *address*, never a hostname. Resolving the name is the caller's
 * job (`ssrfGuard.ts`), because a name can resolve to several addresses and
 * every one of them has to pass.
 *
 * Ranges are matched numerically. The obvious shortcut — a regex on the dotted
 * string, which is what the implementation this replaces did — cannot express
 * `100.64.0.0/10` or `172.16.0.0/12` without either missing hosts or blocking
 * legitimate ones, and silently ignores every IPv6 form.
 */

import { isIPv4, isIPv6 } from "node:net";

/** [first address, last address] of a blocked IPv4 range, inclusive. */
type V4Range = readonly [number, number];

function v4(a: number, b: number, c: number, d: number): number {
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
}

/** The last address in `a.b.c.d/bits`. */
function v4End(a: number, b: number, c: number, d: number, bits: number): number {
  return (v4(a, b, c, d) + 2 ** (32 - bits) - 1) >>> 0;
}

function v4Cidr(a: number, b: number, c: number, d: number, bits: number): V4Range {
  return [v4(a, b, c, d), v4End(a, b, c, d, bits)];
}

/**
 * Everything that is not a routable public host.
 *
 * Wider than "private". Documentation, benchmarking and reserved space are
 * blocked too: none of them can legitimately serve a recording, so allowing
 * them buys nothing and each is a place a redirect could park.
 */
const BLOCKED_V4: readonly V4Range[] = [
  v4Cidr(0, 0, 0, 0, 8), // "this network" — 0.0.0.0 reaches every local interface
  v4Cidr(10, 0, 0, 0, 8), // private
  v4Cidr(100, 64, 0, 0, 10), // carrier-grade NAT
  v4Cidr(127, 0, 0, 0, 8), // loopback — the whole /8, not just 127.0.0.1
  v4Cidr(169, 254, 0, 0, 16), // link-local, and with it cloud instance metadata
  v4Cidr(172, 16, 0, 0, 12), // private
  v4Cidr(192, 0, 0, 0, 24), // IETF protocol assignments
  v4Cidr(192, 0, 2, 0, 24), // TEST-NET-1
  v4Cidr(192, 168, 0, 0, 16), // private
  v4Cidr(198, 18, 0, 0, 15), // benchmarking
  v4Cidr(198, 51, 100, 0, 24), // TEST-NET-2
  v4Cidr(203, 0, 113, 0, 24), // TEST-NET-3
  v4Cidr(224, 0, 0, 0, 4), // multicast
  v4Cidr(240, 0, 0, 0, 4), // reserved, and 255.255.255.255 with it
];

function toV4Number(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    // `Number` would accept "" and " 1"; the length check rejects "01" too,
    // which `isIPv4` already refuses but this function is also reached from the
    // IPv6 path where the tail is not pre-validated.
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }

  return v4(octets[0]!, octets[1]!, octets[2]!, octets[3]!);
}

/**
 * Expands an IPv6 address to its eight 16-bit groups.
 *
 * Returns null for anything malformed rather than throwing — callers treat
 * "cannot understand this address" as blocked, which is the safe direction.
 */
function toHextets(address: string): number[] | null {
  let text = address;

  // A trailing dotted quad ("::ffff:127.0.0.1") is the embedding form, and it
  // is exactly how a loopback address gets past a naive IPv6 check. Fold it
  // into two hextets so the range test below sees it.
  const dotted = text.lastIndexOf(":") + 1;
  if (text.slice(dotted).includes(".")) {
    const packed = toV4Number(text.slice(dotted));
    if (packed === null) return null;
    const high = (packed >>> 16).toString(16);
    const low = (packed & 0xffff).toString(16);
    text = `${text.slice(0, dotted)}${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const parse = (group: string): number[] | null => {
    if (group === "") return [];
    const out: number[] = [];
    for (const part of group.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };

  const head = parse(halves[0]!);
  const tail = halves.length === 2 ? parse(halves[1]!) : [];
  if (head === null || tail === null) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const gap = 8 - head.length - tail.length;
  if (gap < 1) return null;
  return [...head, ...Array<number>(gap).fill(0), ...tail];
}

/**
 * True when the address is loopback, private, link-local, or otherwise not a
 * public host — and true, deliberately, for anything unparseable.
 *
 * The unparseable case matters: an address this function cannot classify is one
 * whose reachability it cannot vouch for, and the cost of wrongly blocking a
 * recording is a clear error message, while the cost of wrongly allowing one is
 * a credential leak.
 */
export function isBlockedAddress(address: string): boolean {
  if (isIPv4(address)) {
    const value = toV4Number(address);
    if (value === null) return true;
    return BLOCKED_V4.some(([start, end]) => value >= start && value <= end);
  }

  if (!isIPv6(address)) return true;

  const groups = toHextets(address);
  if (groups === null) return true;

  const [g0, g1] = [groups[0]!, groups[1]!];

  // Unspecified (::) and loopback (::1) — the same test, since both are seven
  // zero groups followed by 0 or 1.
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7]! <= 1) return true;

  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7  unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  if (g0 === 0x0100 && g1 === 0x0000) return true; // 100::/64 discard-only

  // Forms that carry an IPv4 address inside them. Each is a way to reach 127.0.0.1
  // or the metadata endpoint while looking like a v6 address.
  const embedded = (a: number, b: number): string =>
    [a >>> 8, a & 0xff, b >>> 8, b & 0xff].join(".");

  // ::ffff:0:0/96 — IPv4-mapped.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return isBlockedAddress(embedded(groups[6]!, groups[7]!));
  }
  // ::a.b.c.d — IPv4-compatible, the deprecated form, and the one this guard
  // originally missed. It is NOT caught by the mapped test above, which
  // requires the ffff marker in group 5, so `::169.254.169.254` sailed through
  // as a public address. Deprecated does not mean unresolvable: the resolver
  // and the socket both still honour it.
  //
  // The non-zero test keeps `::` and `::1` out — they are already handled by
  // the unspecified/loopback case, and treating `::` as embedded 0.0.0.0 here
  // would be a second answer to a question already answered.
  if (groups.slice(0, 6).every((group) => group === 0) && (groups[6]! | groups[7]!) !== 0) {
    return isBlockedAddress(embedded(groups[6]!, groups[7]!));
  }
  // 64:ff9b::/96 — NAT64.
  if (g0 === 0x0064 && g1 === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) {
    return isBlockedAddress(embedded(groups[6]!, groups[7]!));
  }
  // 2002::/16 — 6to4 carries the v4 address in the next two groups.
  if (g0 === 0x2002) {
    return isBlockedAddress(embedded(groups[1]!, groups[2]!));
  }

  return false;
}
