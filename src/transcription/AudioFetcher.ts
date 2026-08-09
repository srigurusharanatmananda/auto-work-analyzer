/**
 * Getting the bytes of a recording from a link onto disk.
 *
 * Runs only after `classifyMediaUrl` and `resolveFetchableUrl` have both passed
 * — this class does no validation of its own and must never be handed a URL
 * that has not been through them.
 *
 * ## Two paths, and why not one
 *
 * A direct file link is downloaded with `fetch` and written straight to disk.
 * The implementation this is modelled on ran every URL through
 * `ffmpeg -i <url>`, which works, but means ffmpeg does the network I/O — and
 * ffmpeg speaks a long list of protocols, several of which read local files,
 * and it re-resolves the hostname itself so the guard's verdict does not follow
 * it in. Downloading in-process keeps the fetch under the same size cap, the
 * same timeout, and the same TLS stack as the rest of the server, and needs no
 * subprocess at all. Whisper decodes the file afterwards regardless of format,
 * so there was never anything for ffmpeg to do here.
 *
 * YouTube genuinely needs yt-dlp: the media is not at a URL, it is behind a
 * player negotiation. That path spawns, and it spawns with an argument array
 * rather than a shell string, so nothing in the URL can become a command.
 */

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { ALLOWED_EXTENSIONS } from "./audioFormats.js";
import type { MediaUrlKind } from "./mediaUrl.js";

const execFileAsync = promisify(execFile);

/** Same ceiling as an upload — the source of the bytes should not change the limit. */
export const MAX_FETCH_BYTES = 500 * 1024 * 1024;

/**
 * How long a download or extraction may take.
 *
 * Generous: a two-hour recording over a slow link is a legitimate twenty-minute
 * download. The cap exists so a host that accepts the connection and then
 * dribbles one byte a minute cannot hold a worker forever.
 */
export const FETCH_TIMEOUT_MS = 30 * 60 * 1000;

export interface FetchedAudio {
  /** Absolute path on disk, in the same directory uploads land in. */
  path: string;
  bytes: number;
}

export interface AudioFetcherDeps {
  /** Must be the directory bind-mounted into Whisper, as with uploads. */
  audioDir: string;
  ytDlpPath?: string;
  maxBytes?: number;
  timeoutMs?: number;
  /** Injected so tests exercise the size cap and failure handling without a network. */
  fetchImpl?: typeof fetch;
  /** Injected so tests do not need yt-dlp installed. */
  runCommand?: (file: string, args: string[], options: { timeout: number }) => Promise<unknown>;
}

/** Raised for anything the caller should show the user verbatim. */
export class AudioFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioFetchError";
  }
}

export class AudioFetcher {
  constructor(private readonly deps: AudioFetcherDeps) {}

  private get maxBytes(): number {
    return this.deps.maxBytes ?? MAX_FETCH_BYTES;
  }

  private get timeoutMs(): number {
    return this.deps.timeoutMs ?? FETCH_TIMEOUT_MS;
  }

  /**
   * A uuid filename, exactly as multer's `filename` callback produces for an
   * upload. Nothing from the URL reaches the filesystem, which takes traversal
   * and collisions off the table without needing to sanitise anything.
   */
  private destination(extension: string): string {
    return join(this.deps.audioDir, `${randomUUID()}${extension}`);
  }

  async fetch(url: string, kind: MediaUrlKind): Promise<FetchedAudio> {
    await mkdir(this.deps.audioDir, { recursive: true });
    return kind === "youtube" ? this.fetchYoutube(url) : this.fetchFile(url);
  }

  /**
   * Streams the response to disk, aborting the moment it grows past the cap.
   *
   * The cap is enforced on bytes seen, not on `Content-Length`: that header is
   * whatever the remote server chose to say, and a server willing to fill this
   * disk is not one that will declare it honestly.
   */
  private async fetchFile(url: string): Promise<FetchedAudio> {
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    const extension = extname(new URL(url).pathname).toLowerCase();

    // Re-checked rather than assumed. The URL may have arrived here through a
    // redirect, and `resolveFetchableUrl` vetted the hop's safety, not whether
    // the thing at the end is still a format Whisper can read.
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new AudioFetchError("That link does not end in an audio file we can transcribe");
    }

    const path = this.destination(extension);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(url, { redirect: "error", signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      throw new AudioFetchError(
        `Could not download that recording: ${error instanceof Error ? error.message : "request failed"}`
      );
    }

    if (!response.ok) {
      clearTimeout(timer);
      throw new AudioFetchError(`That link answered ${response.status}, so there was nothing to fetch`);
    }
    if (!response.body) {
      clearTimeout(timer);
      throw new AudioFetchError("That link returned an empty response");
    }

    // A hand-rolled reader loop rather than `pipeline` over a `TransformStream`.
    // Both express the same thing, but the cap has to be able to abandon the
    // download mid-chunk, and doing that from inside a transform means throwing
    // across a stream boundary and hoping the error lands somewhere useful. Here
    // the check, the abort and the error are three lines in the same scope.
    let seen = 0;
    const sink = createWriteStream(path);
    const reader = response.body.getReader();

    // A write stream with no 'error' listener throws uncaught, taking the
    // server down. Attaching one only inside the backpressure wait covered the
    // wrong window: a disk error (ENOSPC, EACCES, EIO) arrives when the disk
    // says so, not when this loop happens to be waiting on 'drain'. So the
    // listener lives as long as the stream does, and the loop reads what it
    // captured. First error wins — later ones are consequences of it.
    let sinkError: Error | undefined;
    sink.on("error", (error: Error) => {
      sinkError ??= error;
    });

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        seen += value.byteLength;
        if (seen > this.maxBytes) {
          // Abort the request too, not just the loop — otherwise the remote goes
          // on sending and the socket stays open until it decides otherwise.
          controller.abort();
          throw new AudioFetchError(
            `That recording is larger than the ${Math.round(this.maxBytes / 1024 / 1024)} MB limit`
          );
        }

        if (!sink.write(value)) {
          // Wakes on either event, and detaches both. The old version attached
          // a `once("error")` per round that was never removed when 'drain'
          // won, so a long download accumulated listeners until Node warned
          // about a leak.
          await new Promise<void>((resolve) => {
            const wake = (): void => {
              sink.off("drain", wake);
              sink.off("error", wake);
              resolve();
            };
            sink.once("drain", wake);
            sink.once("error", wake);
          });
        }

        if (sinkError) throw sinkError;
      }

      await new Promise<void>((resolve, reject) => {
        sink.end((error?: Error | null) => (error ? reject(error) : resolve()));
      });
      // `end`'s callback does not report an error the stream emitted earlier,
      // so a failed write would otherwise finish as a success with a truncated
      // file — the worst outcome available here.
      if (sinkError) throw sinkError;
    } catch (error) {
      // Closed and *awaited* before the file is removed. `createWriteStream`
      // opens lazily, so destroying it can still complete the open afterwards —
      // which recreates the file a moment after the unlink deleted it, leaving
      // an empty orphan no row points at. Caught by the cleanup test.
      await closed(sink);
      await reader.cancel().catch((): void => {});
      await discard(path);
      throw error instanceof AudioFetchError
        ? error
        : new AudioFetchError(
            `The download did not finish: ${error instanceof Error ? error.message : "stream failed"}`
          );
    } finally {
      clearTimeout(timer);
    }

    if (seen === 0) {
      await discard(path);
      throw new AudioFetchError("That link returned an empty file");
    }

    return { path, bytes: seen };
  }

  /**
   * Hands the URL to yt-dlp, which negotiates with the player and writes mp3.
   *
   * The URL has already been confirmed to be a YouTube watch/live/shorts link
   * on a YouTube hostname, so this is not "spawn a downloader at whatever the
   * user typed" — the host allowlist in `mediaUrl.ts` is what makes the spawn
   * defensible, and removing it would make this an arbitrary-fetch primitive.
   */
  private async fetchYoutube(url: string): Promise<FetchedAudio> {
    const run = this.deps.runCommand ?? ((file, args, options) => execFileAsync(file, args, options));
    const path = this.destination(".mp3");

    const args = [
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--no-playlist",
      // Belt and braces with --no-playlist: a link that somehow named a
      // playlist would otherwise download all of it.
      "--playlist-items",
      "1",
      // yt-dlp can run a downloader binary and post-processing commands if the
      // extractor or a config file asks it to. Neither is wanted here.
      "--no-exec",
      "--ignore-config",
      `--max-filesize=${this.maxBytes}`,
      "--no-progress",
      "-o",
      path,
      "--",
      url,
    ];

    try {
      await run(this.deps.ytDlpPath ?? "yt-dlp", args, { timeout: this.timeoutMs });
    } catch (error) {
      await discard(path);
      throw new AudioFetchError(explainYtDlpFailure(error));
    }

    let bytes: number;
    try {
      bytes = (await stat(path)).size;
    } catch {
      // yt-dlp exits 0 when --max-filesize skips the video, so a clean exit is
      // not proof anything was written.
      throw new AudioFetchError(
        "yt-dlp finished without producing audio — the video may be too large, or unavailable"
      );
    }

    return { path, bytes };
  }
}

/** Destroys a write stream and resolves once the descriptor is really gone. */
function closed(sink: ReturnType<typeof createWriteStream>): Promise<void> {
  return new Promise<void>((resolve) => {
    if (sink.destroyed && sink.closed) {
      resolve();
      return;
    }
    sink.once("close", () => resolve());
    sink.destroy();
  });
}

async function discard(path: string): Promise<void> {
  await rm(path, { force: true }).catch((): void => {});
}

/**
 * Turns yt-dlp's stderr into something worth showing.
 *
 * Its failures are almost all actionable by the person who pasted the link —
 * the video is private, or age-gated, or the machine is being asked to prove it
 * is not a bot — and "yt-dlp exited 1" tells them none of that.
 */
function explainYtDlpFailure(error: unknown): string {
  const stderr = String((error as { stderr?: string })?.stderr ?? "");
  const killed = (error as { killed?: boolean })?.killed === true;
  const missing = (error as { code?: string })?.code === "ENOENT";

  if (missing) return "yt-dlp is not installed on the server, so YouTube links cannot be fetched";
  if (killed) return "Fetching that video took too long and was stopped";
  if (/Sign in to confirm|not a bot|cookies/i.test(stderr)) {
    return "YouTube is asking this server to sign in before it will serve that video";
  }
  if (/Private video/i.test(stderr)) return "That video is private";
  if (/members-only|join this channel/i.test(stderr)) return "That video is members-only";
  if (/Video unavailable|does not exist/i.test(stderr)) return "That video is unavailable";
  if (/age/i.test(stderr) && /confirm|restricted/i.test(stderr)) return "That video is age-restricted";

  const tail = stderr.trim().split("\n").pop();
  return tail ? `Could not fetch that video: ${tail}` : "Could not fetch that video";
}
