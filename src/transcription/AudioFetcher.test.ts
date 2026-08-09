/**
 * Getting bytes onto disk — with the network and yt-dlp stubbed.
 *
 * The size cap gets the most attention, because it is the only thing standing
 * between a link and a full disk, and because the obvious implementation
 * (trust `Content-Length`) fails against exactly the host you would want it to
 * hold against.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AudioFetcher, AudioFetchError } from "./AudioFetcher.js";

let audioDir: string;

beforeEach(async () => {
  audioDir = await mkdtemp(join(tmpdir(), "awa-fetch-"));
});

afterEach(async () => {
  await rm(audioDir, { recursive: true, force: true });
});

/** A fetch that answers with `body` and a 200. */
function serving(body: Uint8Array | string, init: ResponseInit = {}): typeof fetch {
  return (async () => new Response(body, { status: 200, ...init })) as unknown as typeof fetch;
}

describe("AudioFetcher — direct file links", () => {
  test("writes the response to disk under a uuid name", async () => {
    const fetcher = new AudioFetcher({ audioDir, fetchImpl: serving("audio-bytes") });

    const result = await fetcher.fetch("https://cdn.example.com/calls/standup.mp3", "file");

    expect(result.bytes).toBe(11);
    expect(await readFile(result.path, "utf8")).toBe("audio-bytes");
    // The name from the URL must not reach the filesystem.
    expect(result.path).not.toContain("standup");
    expect(result.path.endsWith(".mp3")).toBe(true);
  });

  test("keeps the extension so Whisper knows what it is decoding", async () => {
    const fetcher = new AudioFetcher({ audioDir, fetchImpl: serving("x") });

    for (const [url, extension] of [
      ["https://cdn.example.com/a.wav", ".wav"],
      ["https://cdn.example.com/a.M4A", ".m4a"],
    ] as const) {
      const result = await fetcher.fetch(url, "file");
      expect(result.path.endsWith(extension)).toBe(true);
    }
  });

  /**
   * The cap counts bytes as they arrive. A `Content-Length` of 1 is not
   * evidence of anything — a host willing to fill the disk will happily lie
   * about how much it is about to send.
   */
  test("stops a download that outgrows the cap despite a small Content-Length", async () => {
    const fetcher = new AudioFetcher({
      audioDir,
      maxBytes: 1024,
      fetchImpl: serving(new Uint8Array(4096), { headers: { "content-length": "1" } }),
    });

    await expect(fetcher.fetch("https://cdn.example.com/a.mp3", "file")).rejects.toThrow(
      /larger than the 0 MB limit|larger than the 1 MB limit/
    );
  });

  test("leaves nothing on disk when a download is aborted", async () => {
    const fetcher = new AudioFetcher({
      audioDir,
      maxBytes: 16,
      fetchImpl: serving(new Uint8Array(4096)),
    });

    await expect(fetcher.fetch("https://cdn.example.com/a.mp3", "file")).rejects.toThrow();
    expect(await readdir(audioDir)).toEqual([]);
  });

  test("refuses a format Whisper cannot decode, without making a request", async () => {
    let called = false;
    const fetcher = new AudioFetcher({
      audioDir,
      fetchImpl: (async () => {
        called = true;
        return new Response("x");
      }) as unknown as typeof fetch,
    });

    await expect(fetcher.fetch("https://cdn.example.com/a.pdf", "file")).rejects.toThrow(
      AudioFetchError
    );
    expect(called).toBe(false);
  });

  test("reports a non-200 rather than writing an error page as audio", async () => {
    const fetcher = new AudioFetcher({
      audioDir,
      fetchImpl: (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch,
    });

    await expect(fetcher.fetch("https://cdn.example.com/a.mp3", "file")).rejects.toThrow(/403/);
    expect(await readdir(audioDir)).toEqual([]);
  });

  test("treats an empty body as a failure, not a zero-second recording", async () => {
    const fetcher = new AudioFetcher({ audioDir, fetchImpl: serving("") });

    await expect(fetcher.fetch("https://cdn.example.com/a.mp3", "file")).rejects.toThrow(/empty/);
    expect(await readdir(audioDir)).toEqual([]);
  });

  test("reports a connection failure in words", async () => {
    const fetcher = new AudioFetcher({
      audioDir,
      fetchImpl: (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as unknown as typeof fetch,
    });

    await expect(fetcher.fetch("https://cdn.example.com/a.mp3", "file")).rejects.toThrow(
      /Could not download that recording/
    );
  });
});

describe("AudioFetcher — YouTube", () => {
  /** A stub yt-dlp that writes the file its `-o` argument names. */
  function fakeYtDlp(contents = "mp3-bytes") {
    const seen: string[][] = [];
    const run = async (_file: string, args: string[]) => {
      seen.push(args);
      const output = args[args.indexOf("-o") + 1]!;
      await writeFile(output, contents);
      return {};
    };
    return { run, seen };
  }

  test("extracts audio and reports where it landed", async () => {
    const { run } = fakeYtDlp();
    const fetcher = new AudioFetcher({ audioDir, runCommand: run });

    const result = await fetcher.fetch("https://www.youtube.com/watch?v=abc", "youtube");

    expect(result.bytes).toBe(9);
    expect(result.path.endsWith(".mp3")).toBe(true);
  });

  /**
   * The URL goes in as one argument after `--`, so nothing in it can be read as
   * a flag or reach a shell.
   */
  test("passes the URL as a terminated argument, never as a shell string", async () => {
    const { run, seen } = fakeYtDlp();
    const fetcher = new AudioFetcher({ audioDir, runCommand: run });

    await fetcher.fetch("https://www.youtube.com/watch?v=--help", "youtube");

    const args = seen[0]!;
    expect(args[args.length - 2]).toBe("--");
    expect(args[args.length - 1]).toBe("https://www.youtube.com/watch?v=--help");
  });

  test("refuses to let yt-dlp run other programs or read a config file", async () => {
    const { run, seen } = fakeYtDlp();
    const fetcher = new AudioFetcher({ audioDir, runCommand: run });

    await fetcher.fetch("https://www.youtube.com/watch?v=abc", "youtube");

    expect(seen[0]).toContain("--no-exec");
    expect(seen[0]).toContain("--ignore-config");
    expect(seen[0]).toContain("--no-playlist");
  });

  /**
   * yt-dlp exits 0 when `--max-filesize` skips a video. A clean exit is not
   * proof that anything was written, and reporting success here would queue a
   * job pointed at a file that does not exist.
   */
  test("a clean exit that produced no file is still a failure", async () => {
    const fetcher = new AudioFetcher({ audioDir, runCommand: async () => ({}) });

    await expect(fetcher.fetch("https://www.youtube.com/watch?v=abc", "youtube")).rejects.toThrow(
      /without producing audio/
    );
  });

  test("explains the failures a user can do something about", async () => {
    const cases: Array<[string, RegExp]> = [
      ["ERROR: Sign in to confirm you're not a bot", /asking this server to sign in/],
      ["ERROR: Private video. Sign in if you've been granted access", /private/i],
      ["ERROR: Video unavailable", /unavailable/i],
      ["ERROR: Join this channel to get access to members-only content", /members-only/],
    ];

    for (const [stderr, expected] of cases) {
      const fetcher = new AudioFetcher({
        audioDir,
        runCommand: async () => {
          throw Object.assign(new Error("exit 1"), { stderr });
        },
      });

      await expect(
        fetcher.fetch("https://www.youtube.com/watch?v=abc", "youtube")
      ).rejects.toThrow(expected);
    }
  });

  test("says so when yt-dlp is not installed", async () => {
    const fetcher = new AudioFetcher({
      audioDir,
      runCommand: async () => {
        throw Object.assign(new Error("spawn yt-dlp ENOENT"), { code: "ENOENT" });
      },
    });

    await expect(fetcher.fetch("https://www.youtube.com/watch?v=abc", "youtube")).rejects.toThrow(
      /not installed on the server/
    );
  });

  test("leaves no partial file behind when extraction fails", async () => {
    const fetcher = new AudioFetcher({
      audioDir,
      runCommand: async (_file, args) => {
        await writeFile(args[args.indexOf("-o") + 1]!, "partial");
        throw Object.assign(new Error("exit 1"), { stderr: "ERROR: Video unavailable" });
      },
    });

    await expect(fetcher.fetch("https://www.youtube.com/watch?v=abc", "youtube")).rejects.toThrow();
    expect(await readdir(audioDir)).toEqual([]);
  });
});
