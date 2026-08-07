/**
 * Deciding whether a pasted link is something the server may go and fetch.
 *
 * This is the syntactic half of the SSRF defence: scheme, host shape, and what
 * kind of thing the URL points at. The other half — what the hostname actually
 * resolves to, and where it redirects — is `ssrfGuard.ts`, because it needs the
 * network and this file must stay pure and cheap enough to run on every
 * keystroke if the UI ever wants to.
 *
 * Two mistakes in the implementation this replaces are worth naming, because
 * both look fine on a skim and both hand an attacker the server's network:
 *
 *  - **The YouTube patterns were tested against the whole URL string.** So
 *    `https://evil.com/?x=youtube.com/watch` matched, and yt-dlp was pointed at
 *    evil.com. Host checks must run on `parsed.hostname`, never on the URL.
 *  - **Nothing checked the scheme.** `file:///etc/passwd.mp4` parses, has an
 *    empty hostname so no private-address check fires, ends in `.mp4`, and was
 *    handed to ffmpeg — which reads local files perfectly well.
 *
 * ## Why playlists are not supported
 *
 * `.m3u8` and `.mpd` are lists of further URLs, and ffmpeg fetches every one of
 * them. Those URLs come out of the playlist body, which is written by whoever
 * we are fetching from — so no amount of vetting the URL the user pasted says
 * anything about where the server ends up. There is no pre-flight that closes
 * that, so the format is refused rather than half-guarded. Direct media files
 * and YouTube cover the actual need: getting a recording of a call in.
 */

import { extname } from "node:path";
import { isIP } from "node:net";
import { ALLOWED_EXTENSIONS, ALLOWED_EXTENSIONS_LIST } from "./audioFormats.js";
import { isBlockedAddress } from "./privateAddress.js";

export type MediaUrlKind = "youtube" | "file";

export type MediaUrlVerdict =
  | { ok: true; kind: MediaUrlKind; url: string; hostname: string; reason?: undefined }
  | { ok: false; kind?: undefined; url?: undefined; hostname?: undefined; reason: string };

/**
 * Hosts yt-dlp may be pointed at, matched exactly against the parsed hostname.
 *
 * An allowlist of whole hostnames, not a substring or suffix test: `endsWith`
 * on "youtube.com" also accepts "notyoutube.com", and a subdomain wildcard
 * would accept whatever an open redirect on Google's estate can reach.
 */
const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** Path shapes that carry a single video. Playlists and channels are not one recording. */
const YOUTUBE_PATHS = [/^\/watch$/, /^\/live\/[\w-]+$/, /^\/shorts\/[\w-]+$/, /^\/embed\/[\w-]+$/];

/** Refused with an explanation, because it is the format people will try first. */
const PLAYLIST_EXTENSIONS: ReadonlySet<string> = new Set([".m3u8", ".mpd", ".m3u"]);

/**
 * Names that always mean "this machine" or "this network segment".
 *
 * Refused without consulting DNS. These are reserved by RFC 6761 and RFC 6762,
 * so no public recording can live behind one, and a resolver that returns a
 * public address for `localhost` is a resolver that has been tampered with.
 */
const RESERVED_NAMES = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /\.home\.arpa$/i];

/** Long enough for any real link; a bound stops a megabyte of URL reaching a spawn. */
export const MAX_URL_LENGTH = 2048;

/**
 * Classifies a pasted link, or explains why it will not be fetched.
 *
 * Every rejection reason is written to be shown to the user as-is. "Invalid
 * URL" for all six distinct failures — which is what the previous
 * implementation's single `'invalid'` return gave — makes a supported link that
 * was mistyped indistinguishable from a format that is never going to work.
 */
export function classifyMediaUrl(raw: unknown): MediaUrlVerdict {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "Paste a link to the recording" };
  }

  const text = raw.trim();
  if (text.length > MAX_URL_LENGTH) {
    return { ok: false, reason: `That link is longer than ${MAX_URL_LENGTH} characters` };
  }

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, reason: "That does not look like a link — it needs to start with https://" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      reason: `Only http and https links can be fetched, not ${parsed.protocol.replace(":", "")}`,
    };
  }

  // Credentials in the URL are forwarded by both yt-dlp and ffmpeg, and the
  // userinfo section is also the oldest trick for making a hostile host look
  // like a familiar one: https://youtube.com@evil.com/ is a link to evil.com.
  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "Links with a username or password in them are not accepted" };
  }

  // `hostname` strips the brackets from a v6 literal, but not for `isIP`.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "") {
    return { ok: false, reason: "That link has no host to fetch from" };
  }

  // A literal address skips DNS entirely, so it is checked here as well as in
  // `ssrfGuard` — belt and braces, and it gives a better message than a
  // resolution failure would.
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    return { ok: false, reason: `${hostname} is not a public address, so it will not be fetched` };
  }

  // Names that are local by definition. `ssrfGuard` would catch these too, once
  // they resolved — but a name reserved by RFC 6761/6762 should never be
  // contingent on what a resolver happens to say about it today.
  if (RESERVED_NAMES.some((pattern) => pattern.test(hostname))) {
    return { ok: false, reason: `${hostname} is a local name, so it will not be fetched` };
  }

  if (YOUTUBE_HOSTS.has(hostname)) {
    const isShortLink = hostname.endsWith("youtu.be") && /^\/[\w-]+$/.test(parsed.pathname);
    if (isShortLink || YOUTUBE_PATHS.some((pattern) => pattern.test(parsed.pathname))) {
      return { ok: true, kind: "youtube", url: parsed.toString(), hostname };
    }
    return {
      ok: false,
      reason: "That YouTube link is not a single video — paste a watch, live or shorts link",
    };
  }

  // Extension is taken from the pathname, never the whole URL: a query string
  // of `?download=x.mp3` says nothing about what the server will send.
  const extension = extname(parsed.pathname).toLowerCase();

  if (PLAYLIST_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason:
        `${extension} is a playlist rather than a recording. Every entry in it is another ` +
        `address this server would fetch, chosen by whoever wrote the playlist, so it cannot ` +
        `be checked in advance. Link the audio file itself, or use a YouTube link.`,
    };
  }

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason:
        `That link does not end in an audio file. Supported: ${ALLOWED_EXTENSIONS_LIST}. ` +
        `YouTube links work too.`,
    };
  }

  return { ok: true, kind: "file", url: parsed.toString(), hostname };
}

/**
 * A display name for a link, for the recordings list.
 *
 * The filename for a direct link, the host for anything else — never the full
 * URL, which is often longer than the column and can carry a signed query
 * string nobody should be reading over someone's shoulder.
 */
export function filenameForUrl(url: string, kind: MediaUrlKind): string {
  const parsed = new URL(url);
  if (kind === "youtube") {
    const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop();
    return id ? `youtube-${id}` : "youtube-recording";
  }
  return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "recording");
}
