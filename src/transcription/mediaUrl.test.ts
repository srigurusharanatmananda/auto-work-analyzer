/**
 * What the server will and will not go and fetch.
 *
 * The rejection cases are the point of the file. Several of them are links the
 * implementation this replaces accepted, and each one is a note against
 * reintroducing the shortcut that let it through.
 */

import { describe, expect, test } from "bun:test";
import { classifyMediaUrl, filenameForUrl, MAX_URL_LENGTH } from "./mediaUrl.js";

describe("classifyMediaUrl — YouTube", () => {
  test("accepts the link shapes a single video comes in", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/live/abc123",
      "https://www.youtube.com/shorts/abc123",
    ]) {
      const verdict = classifyMediaUrl(url);
      expect(verdict.ok).toBe(true);
      expect(verdict.kind).toBe("youtube");
    }
  });

  /**
   * The bug this file exists for. The old patterns were regexes run against the
   * whole URL string, so any host could carry "youtube.com/watch" in its query
   * and have yt-dlp pointed at it.
   */
  test("a hostile host cannot claim to be YouTube through its query string", () => {
    const verdict = classifyMediaUrl("https://evil.example.com/?x=youtube.com/watch");

    expect(verdict.ok).toBe(false);
  });

  test("a lookalike host is not YouTube", () => {
    for (const url of [
      "https://notyoutube.com/watch?v=x",
      "https://youtube.com.evil.example/watch?v=x",
      "https://evil.example/youtube.com/watch",
    ]) {
      expect(classifyMediaUrl(url).ok).toBe(false);
    }
  });

  test("userinfo cannot disguise the real host", () => {
    const verdict = classifyMediaUrl("https://www.youtube.com@evil.example/watch?v=x");

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/username or password/);
  });

  test("a playlist or channel is not one recording", () => {
    for (const url of [
      "https://www.youtube.com/playlist?list=PL123",
      "https://www.youtube.com/@somechannel",
      "https://www.youtube.com/",
    ]) {
      const verdict = classifyMediaUrl(url);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/single video/);
    }
  });
});

describe("classifyMediaUrl — direct files", () => {
  test("accepts a link to a supported audio file", () => {
    const verdict = classifyMediaUrl("https://cdn.example.com/calls/standup.mp3");

    expect(verdict.ok).toBe(true);
    expect(verdict.kind).toBe("file");
    expect(verdict.hostname).toBe("cdn.example.com");
  });

  test("the extension is read from the path, not the query string", () => {
    expect(classifyMediaUrl("https://example.com/download?file=x.mp3").ok).toBe(false);
    expect(classifyMediaUrl("https://example.com/a.mp3?token=abc").ok).toBe(true);
  });

  test("rejects a file type Whisper cannot decode", () => {
    const verdict = classifyMediaUrl("https://example.com/notes.pdf");

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/does not end in an audio file/);
  });
});

describe("classifyMediaUrl — playlists", () => {
  /**
   * Refused deliberately, and with an explanation rather than the generic
   * unsupported-format message, because "the stream link does not work" is
   * otherwise indistinguishable from a bug.
   */
  test("a playlist is refused because its contents choose the next fetch", () => {
    for (const url of [
      "https://example.com/live/stream.m3u8",
      "https://example.com/dash/manifest.mpd",
    ]) {
      const verdict = classifyMediaUrl(url);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/playlist/);
    }
  });
});

describe("classifyMediaUrl — the schemes and hosts it refuses", () => {
  /**
   * `file:` parses, has an empty hostname so no address check fires, and can
   * end in `.mp4`. ffmpeg reads local files, so the old code would have handed
   * over anything on disk.
   */
  test("only http and https are fetchable", () => {
    for (const url of [
      "file:///etc/passwd.mp4",
      "ftp://example.com/a.mp3",
      "gopher://example.com/a.mp3",
      "data:audio/mp3;base64,AAAA",
    ]) {
      const verdict = classifyMediaUrl(url);
      expect(verdict.ok).toBe(false);
    }
  });

  test("blocks a literal address that is not public, in every spelling", () => {
    for (const url of [
      "http://127.0.0.1/a.mp3",
      "http://localhost/a.mp3",
      "http://169.254.169.254/a.mp3",
      "http://[::1]/a.mp3",
      "http://10.0.0.5/a.mp3",
      "http://192.168.1.1/a.mp3",
      // WHATWG URL normalises all of these to 127.0.0.1 before we see them.
      "http://2130706433/a.mp3",
      "http://0177.0.0.1/a.mp3",
      "http://127.1/a.mp3",
    ]) {
      expect(classifyMediaUrl(url).ok).toBe(false);
    }
  });

  test("a public literal address is fine", () => {
    expect(classifyMediaUrl("https://8.8.8.8/a.mp3").ok).toBe(true);
  });
});

describe("classifyMediaUrl — input handling", () => {
  test("empty and non-string input asks for a link rather than erroring", () => {
    for (const value of ["", "   ", null, undefined, 42, {}]) {
      const verdict = classifyMediaUrl(value);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/Paste a link/);
    }
  });

  test("surrounding whitespace is forgiven", () => {
    expect(classifyMediaUrl("  https://example.com/a.mp3  ").ok).toBe(true);
  });

  test("an absurdly long link is refused before anything parses it", () => {
    const url = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}.mp3`;

    expect(classifyMediaUrl(url).ok).toBe(false);
  });

  /** Each refusal says something different — see the note in the module header. */
  test("the reasons are distinguishable from each other", () => {
    const reasons = [
      "file:///x.mp3",
      "https://example.com/x.pdf",
      "https://example.com/x.m3u8",
      "http://127.0.0.1/x.mp3",
      "https://www.youtube.com/playlist?list=x",
    ].map((url) => classifyMediaUrl(url).reason);

    expect(new Set(reasons).size).toBe(reasons.length);
  });
});

describe("filenameForUrl", () => {
  test("names a YouTube recording by its video id", () => {
    expect(filenameForUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube")).toBe(
      "youtube-dQw4w9WgXcQ"
    );
    expect(filenameForUrl("https://youtu.be/abc123", "youtube")).toBe("youtube-abc123");
  });

  test("names a direct link by its filename, decoded", () => {
    expect(filenameForUrl("https://cdn.example.com/calls/team%20standup.mp3", "file")).toBe(
      "team standup.mp3"
    );
  });
});
