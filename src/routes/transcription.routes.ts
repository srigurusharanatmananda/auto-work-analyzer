/**
 * Upload audio, watch it transcribe, read the transcript.
 *
 * The upload returns 202 with a job id rather than waiting: transcription takes
 * minutes, so a synchronous response would hold a connection open past every
 * sensible proxy timeout and give the user nothing to look at.
 *
 * Audio is written to disk, NOT held in memory like /api/notes does with its 5 MB
 * text files. A recording is two orders of magnitude larger, and Whisper reads
 * the file from a bind mount rather than receiving bytes over HTTP — so the file
 * has to exist on disk regardless, and buffering it first would only add a copy
 * and a memory spike on a machine with 8 GB.
 */

import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';
import { mediaFetchRateLimiter } from '../middleware/security.middleware.js';
import type { TranscriptionJobStore, TranscriptionJob } from '../transcription/TranscriptionJobStore.js';
import { WhisperClient } from '../transcription/WhisperClient.js';
import type { TranscriptSweeper } from '../calls/TranscriptSweeper.js';
import {
  buildHighlights,
  countOccurrences,
  escapeLikePattern,
} from '../calls/transcriptSearch.js';
import { mintAudioToken, verifyAudioToken } from '../transcription/audioTokens.js';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_EXTENSIONS_LIST,
  AUDIO_MIME_TYPES,
} from '../transcription/audioFormats.js';
import { classifyMediaUrl, filenameForUrl } from '../transcription/mediaUrl.js';
import { resolveFetchableUrl } from '../transcription/ssrfGuard.js';
import { AudioFetcher, AudioFetchError } from '../transcription/AudioFetcher.js';
import { parseByteRange } from '../transcription/byteRange.js';
import { isTranscriptGrouping } from '../calls/ActionItemGrouper.js';

export interface TranscriptionRouterDeps {
  store: TranscriptionJobStore;
  /**
   * Where uploads are written. Must be the directory bind-mounted into the
   * Whisper container, or nothing can be transcribed — see `containerPathFor`.
   */
  storageRoot: string;
  /** Only used to validate the path before enqueueing. */
  whisper?: WhisperClient;
  /**
   * Files action items from finished transcriptions. Absent when no AI provider
   * or destination resolver is configured, in which case the sweep route says
   * so rather than 404ing on a feature that exists.
   */
  sweeper?: TranscriptSweeper;
  /**
   * Downloads a recording from a link. Constructed from `storageRoot` when
   * absent; injected by tests so no request leaves the machine.
   */
  fetcher?: AudioFetcher;
  /**
   * Vets a link before it is fetched. Injected by tests for the same reason —
   * the cases worth covering are hosts that resolve privately, which cannot be
   * arranged against the real internet.
   */
  resolveUrl?: typeof resolveFetchableUrl;
  /**
   * Throttles `/from-url`. Defaults to the real limiter; overridden by tests,
   * which would otherwise exhaust the budget partway through a suite and start
   * reporting 429s as assertion failures.
   *
   * Injected rather than skipped-when-testing, so that the default is still
   * exercised: `transcription.fromUrl.nodetest.ts` mounts a second router
   * without this and confirms it does throttle.
   */
  rateLimiter?: RequestHandler;
}

/** Generous for a long recording; Whisper's own limits bite well before this. */
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Search page size. Capped because each result carries excerpts, and an
 * unbounded `limit` makes one request able to serialise an entire archive.
 */
const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 100;

/**
 * What the client sees. Excludes `audioPath` deliberately: it is a server
 * filesystem path, of no use to a browser and not worth disclosing.
 */
/**
 * How long the audio ran, from the last segment's end time.
 *
 * Derived rather than stored: Whisper reports it, but persisting it would mean
 * a column and a migration for a number already implied by data the job
 * carries. Null while a job is still producing segments — a partial duration
 * would read as "this call was 12 seconds long".
 */
function durationOf(job: TranscriptionJob): number | null {
  if (job.status !== 'succeeded') return null;
  const segments = job.segments ?? [];
  const last = segments[segments.length - 1];
  return last ? Math.round(last.end) : null;
}

function toResponse(job: TranscriptionJob) {
  return {
    id: job.id,
    status: job.status,
    originalFilename: job.originalFilename,
    transcript: job.transcript,
    segments: job.segments,
    language: job.language,
    durationSeconds: durationOf(job),
    error: job.error,
    attempts: job.attempts,
    segmentsSeen: job.segmentsSeen,
    callTitle: job.callTitle,
    callDate: job.callDate,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function createTranscriptionRouter(deps: TranscriptionRouterDeps): Router {
  const router = Router();
  const audioDir = resolve(deps.storageRoot, 'audio');
  const userIdOf = (req: any): string => req.user!.userId;

  const fail = (res: any, error: string, status = 400): void => {
    res.status(status).json({ success: false, error });
  };

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        // Created on demand: a fresh clone has no storage directory, and failing
        // the first upload with ENOENT would be a confusing first experience.
        mkdir(audioDir, { recursive: true })
          .then(() => cb(null, audioDir))
          .catch((error) => cb(error, audioDir));
      },
      filename: (_req, file, cb) => {
        // A uuid, keeping only the extension. The uploaded name is stored in the
        // database for display instead of being trusted on the filesystem, which
        // takes path traversal and collisions off the table at once.
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: MAX_AUDIO_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
        cb(null, true);
        return;
      }
      cb(
        new Error(
          `That file type is not supported. Audio only: ${ALLOWED_EXTENSIONS_LIST}`
        )
      );
    },
  });

  /**
   * Turns multer's rejections into 400s.
   *
   * Left alone they reach Express's default handler and become a 500 "Internal
   * server error", which blames the server for the caller sending a 2 GB video.
   */
  const acceptAudio = (req: any, res: any, next: any): void => {
    upload.single('audio')(req, res, (error: any) => {
      if (!error) {
        next();
        return;
      }
      fail(
        res,
        error?.code === 'LIMIT_FILE_SIZE'
          ? `That file is larger than the ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB limit.`
          : error instanceof Error
            ? error.message
            : 'Upload rejected'
      );
    });
  };

  /**
   * Deletes an upload that will not become a job.
   *
   * Every early return after multer has written the file has to come through
   * here, or the directory accumulates audio no row points at — invisible, and
   * on this disk, expensive.
   */
  const discard = async (path: string): Promise<void> => {
    await unlink(path).catch((error) => {
      console.warn(`Could not delete rejected upload ${path}:`, error?.message ?? error);
    });
  };

  /**
   * POST /api/transcription/upload
   *
   * `authenticate` runs BEFORE multer, unlike /api/notes which parses first.
   * That ordering matters here: multer writes to disk, so parsing before
   * authenticating would hand an unauthenticated caller a way to fill the disk
   * 500 MB at a time. `authenticate` only reads the Authorization header, so it
   * needs nothing from the body and can go first.
   */
  /**
   * Everything that happens once audio is on disk, whoever put it there.
   *
   * Shared by `/upload` and `/from-url`. The two differ only in how the bytes
   * arrive; from this point on a recording pulled from a link and one pushed
   * from a file picker are the same thing, and the moment that stopped being
   * true in code would be the moment one of them quietly skipped the Whisper
   * reachability check or leaked a file on a failed enqueue.
   *
   * Answers the request itself and returns nothing, so a caller cannot forget
   * to — every path out of here either 202s or fails, and both clean up.
   */
  const queueRecording = async (
    res: any,
    details: {
      userId: string;
      path: string;
      originalFilename: string;
      callTitle?: string;
      callDate?: string;
    }
  ): Promise<void> => {
    // Proves Whisper will be able to read it BEFORE a job exists. Otherwise the
    // failure surfaces minutes later as a job that dies on a misconfigured
    // storage root, which reads like a transcription problem and is not.
    const whisper = deps.whisper ?? new WhisperClient({ storageRoot: deps.storageRoot });
    try {
      whisper.containerPathFor(details.path);
    } catch (error) {
      await discard(details.path);
      return fail(
        res,
        error instanceof Error ? error.message : 'That audio is not readable by Whisper',
        500
      );
    }

    let job;
    try {
      job = await deps.store.enqueue({
        userId: details.userId,
        audioPath: details.path,
        originalFilename: details.originalFilename,
        ...(details.callTitle ? { callTitle: details.callTitle } : {}),
        ...(details.callDate ? { callDate: details.callDate } : {}),
      });
    } catch (error) {
      // No row means nothing will ever transcribe or clean up this file.
      await discard(details.path);
      throw error;
    }

    // 202, not 200: the work is accepted, not done.
    res.status(202).json({
      success: true,
      data: toResponse(job),
      message: 'Queued for transcription.',
    });
  };

  router.post('/upload', authenticate, anyRole, acceptAudio, async (req: any, res) => {
    const file = req.file;
    if (!file) return fail(res, 'Attach an audio file as the "audio" field');

    const { callTitle, callDate } = req.body ?? {};
    if (callDate && !DATE_PATTERN.test(callDate)) {
      await discard(file.path);
      return fail(res, 'callDate must be YYYY-MM-DD');
    }

    await queueRecording(res, {
      userId: userIdOf(req),
      path: file.path,
      originalFilename: file.originalname,
      ...(typeof callTitle === 'string' && callTitle.trim() ? { callTitle: callTitle.trim() } : {}),
      ...(callDate ? { callDate } : {}),
    });
  });

  /**
   * POST /api/transcription/from-url — ingest a recording from a link.
   *
   * The dangerous route in this file, and the danger is not the download: it is
   * that an authenticated user gets to choose an address the *server* connects
   * to, from inside whatever network the server sits in. That is SSRF, and on a
   * cloud host the prize is `169.254.169.254`, which hands out credentials to
   * anything that asks.
   *
   * So the link goes through three checks before a byte moves, each covering
   * what the others cannot:
   *
   *  1. `classifyMediaUrl` — scheme, host, and shape. Rejects `file:`, private
   *     literals in every encoding, reserved names, and hosts merely claiming
   *     to be YouTube in a query string.
   *  2. `resolveFetchableUrl` — what the name actually resolves to, and every
   *     redirect hop, re-running check 1 at each one.
   *  3. `AudioFetcher` — a hard size cap and timeout on the transfer itself.
   *
   * The residual risk, stated in `ssrfGuard.ts` rather than hidden: a DNS
   * record that answers publicly here and privately to the fetch moments later.
   * That needs an attacker-controlled nameserver and a race, and the real
   * remedy is an egress firewall.
   *
   * Rate limiting is the other half, and it is a tighter limiter than the rest
   * of the API gets: the caller supplies a string and the server supplies the
   * bandwidth, so the usual "100 requests is not much" reasoning does not hold.
   * The limiter runs after `authenticate` so it can key on the user.
   */
  const throttleFetch = deps.rateLimiter ?? mediaFetchRateLimiter;

  router.post('/from-url', authenticate, anyRole, throttleFetch, async (req: any, res) => {
    const { url, callTitle, callDate } = req.body ?? {};

    if (callDate && !DATE_PATTERN.test(callDate)) {
      return fail(res, 'callDate must be YYYY-MM-DD');
    }

    const verdict = classifyMediaUrl(url);
    if (!verdict.ok) return fail(res, verdict.reason);

    const resolve_ = deps.resolveUrl ?? resolveFetchableUrl;
    const reachable = await resolve_(verdict.url);
    if (!reachable.ok) return fail(res, reachable.reason);

    const fetcher = deps.fetcher ?? new AudioFetcher({ audioDir });
    let fetched;
    try {
      fetched = await fetcher.fetch(reachable.url, verdict.kind);
    } catch (error) {
      if (error instanceof AudioFetchError) return fail(res, error.message, 502);
      throw error;
    }

    await queueRecording(res, {
      userId: userIdOf(req),
      path: fetched.path,
      // The name the user will see in their recordings list. Taken from the URL
      // they pasted, not the one the redirects landed on — that is the one they
      // will recognise.
      originalFilename: filenameForUrl(verdict.url, verdict.kind),
      ...(typeof callTitle === 'string' && callTitle.trim() ? { callTitle: callTitle.trim() } : {}),
      ...(callDate ? { callDate } : {}),
    });
  });

  router.get('/jobs', authenticate, anyRole, async (req, res) => {
    const jobs = await deps.store.listForUser(userIdOf(req));
    res.json({ success: true, data: jobs.map(toResponse) });
  });

  /**
   * GET /api/transcription/search?q=&from=&to=&limit=
   *
   * Registered before `/jobs/:id` only by convention — it is a sibling of
   * `/jobs`, not a child, so there is no shadowing to worry about.
   *
   * An empty `q` is a browse, not an error: the date filters alone are a useful
   * query ("what did I record last week"), and making the box mandatory would
   * turn that into a search for the empty string.
   */
  router.get('/search', authenticate, anyRole, async (req: any, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';

    for (const [name, value] of [
      ['from', from],
      ['to', to],
    ] as const) {
      if (value && !DATE_PATTERN.test(value)) return fail(res, `${name} must be YYYY-MM-DD`);
    }
    if (from && to && from > to) return fail(res, 'from must not be after to');

    // Anything that is not a positive whole number falls back to the default
    // rather than being clamped into range. Clamping `limit=-5` to 1 would
    // answer a nonsense request with a single result, which reads as "you have
    // one recording" — a wrong answer where a sane default is available.
    const requested = Number(req.query.limit);
    const limit =
      Number.isInteger(requested) && requested > 0
        ? Math.min(requested, MAX_SEARCH_LIMIT)
        : DEFAULT_SEARCH_LIMIT;

    const jobs = await deps.store.search(userIdOf(req), {
      pattern: query ? escapeLikePattern(query) : undefined,
      from: from || undefined,
      to: to || undefined,
      limit,
    });

    // Highlighting runs over the rows the query already narrowed to, so the
    // cost is bounded by `limit` rather than by the size of the archive.
    const results = jobs.map((job) => {
      const transcript = job.transcript ?? '';
      const highlights = query ? buildHighlights(transcript, job.segments, query) : [];

      return {
        id: job.id,
        originalFilename: job.originalFilename,
        callTitle: job.callTitle,
        callDate: job.callDate,
        language: job.language,
        durationSeconds: durationOf(job),
        createdAt: job.createdAt,
        sweptAt: job.sweptAt,
        /** Characters, so the UI can show how much text a hit sits in. */
        transcriptLength: transcript.length,
        matchCount: query ? countOccurrences(transcript, query) : 0,
        highlights,
        /**
         * True when the phrase is only in the title or filename. Without this
         * the row appears with no excerpt and looks like a highlighting
         * failure rather than a title match.
         */
        titleOnlyMatch: Boolean(query) && highlights.length === 0,
      };
    });

    res.json({ success: true, data: { query, results, total: results.length, limit } });
  });

  /**
   * Files action items from every finished transcription not yet swept.
   *
   * `dryRun` defaults to TRUE. This route creates real ClickUp tasks with no
   * per-item review, which is the opposite of every other path into ClickUp in
   * this app — so the safe answer has to be the one you get by forgetting the
   * flag, not the one you get by remembering it.
   */
  router.post('/sweep', authenticate, anyRole, async (req, res) => {
    if (!deps.sweeper) {
      return fail(
        res,
        'Sweeping is not configured on this server. It needs an AI provider and a ClickUp destination.',
        400
      );
    }

    const dryRun = req.body?.dryRun !== false;

    // Rejected rather than silently defaulted. A typo'd grouping that quietly
    // became "per-item" would file a different shape than the preview showed,
    // which is exactly the mistake the preview exists to catch.
    const requested = req.body?.grouping;
    if (requested !== undefined && !isTranscriptGrouping(requested)) {
      return fail(res, `Unknown grouping: ${String(requested)}`);
    }

    try {
      const summary = await deps.sweeper.run(userIdOf(req), {
        dryRun,
        ...(requested ? { grouping: requested } : {}),
      });
      res.json({
        success: true,
        data: summary,
        message: dryRun
          ? `Dry run: ${summary.jobs.length} recording(s) would produce tasks. Nothing was created.`
          : `Swept ${summary.jobs.length} recording(s), created ${summary.totalTasksCreated} task(s).`,
      });
    } catch (error) {
      console.error('Transcript sweep failed:', error);
      fail(res, error instanceof Error ? error.message : 'Sweep failed', 500);
    }
  });

  /** 404 for someone else's job — the store scopes it, so ids stay unguessable. */
  router.get('/jobs/:id', authenticate, anyRole, async (req, res) => {
    const job = await deps.store.get(req.params.id, userIdOf(req));
    if (!job) return fail(res, 'No such transcription job', 404);
    res.json({ success: true, data: toResponse(job) });
  });

  /**
   * POST /api/transcription/jobs/:id/audio-token
   *
   * Mints a short-lived URL the `<audio>` element can actually fetch. This is
   * the route that checks ownership; the streaming route below checks only the
   * signature, because a media request carries no Authorization header.
   *
   * POST rather than GET because it creates a capability. A GET that mints
   * credentials is the kind of thing a prefetcher or a link-preview crawler
   * will happily trigger on the user's behalf.
   */
  router.post('/jobs/:id/audio-token', authenticate, anyRole, async (req: any, res) => {
    const job = await deps.store.get(req.params.id, userIdOf(req));
    if (!job) return fail(res, 'No such transcription job', 404);

    const { token, expiresAt } = mintAudioToken(job.id);
    res.json({
      success: true,
      data: {
        url: `/api/transcription/jobs/${job.id}/audio?token=${encodeURIComponent(token)}`,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    });
  });

  /**
   * GET /api/transcription/jobs/:id/audio?token=...
   *
   * Streams the recording, with range support so the player can seek.
   *
   * Authorised by the signed token only — see `audioTokens.ts` for why a bearer
   * header is not an option here.
   */
  router.get('/jobs/:id/audio', async (req, res) => {
    const verdict = verifyAudioToken(req.params.id, req.query.token as string | undefined);
    if (verdict.valid === false) {
      // 401 for an expired token so the client knows to re-mint and retry;
      // 403 for a bad one, which no amount of retrying will fix.
      const expired = verdict.reason === 'expired';
      return fail(
        res,
        expired
          ? 'This playback link has expired. Reload the page.'
          : 'Not authorised to play this recording.',
        expired ? 401 : 403
      );
    }

    // Loaded WITHOUT a user scope, deliberately: the token is the authority
    // here, and there is no session to scope by. The signature already binds
    // the response to this exact job id.
    const job = await deps.store.getUnscoped(req.params.id);
    if (!job) return fail(res, 'No such transcription job', 404);

    // Belt and braces. The path was validated on upload, but this route reads
    // whatever the row says, and a row is a much longer-lived thing than a
    // request — anything that ever writes a path into it must not become a way
    // to read arbitrary files off this disk.
    const path = resolve(job.audioPath);
    if (!path.startsWith(audioDir + sep)) {
      console.error(`Refusing to serve ${path}: outside ${audioDir}`);
      return fail(res, 'Recording is not available', 404);
    }

    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      // The row outlived the file — a cleaned-up disk, or a restore that missed
      // the audio. A 404 says so; a 500 would blame the server for a broken
      // link it can do nothing about.
      return fail(res, 'The audio for this recording is no longer on disk', 404);
    }

    const range = parseByteRange(req.headers.range, size);
    const type = AUDIO_MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';

    // Advertised even on a full response: without it, browsers assume the
    // resource is not seekable and disable the scrubber outright.
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', type);
    // `private` keeps the body out of any shared cache, which is what matters:
    // the URL is a capability, and a proxy holding the audio would outlive the
    // token that authorised it.
    //
    // Deliberately NOT `no-store`. The browser's own cache is where Chrome's
    // media stack buffers, and forbidding it makes scrubbing re-fetch the file
    // repeatedly. There is nothing to gain — a recording in the private disk
    // cache of the machine whose user just played it is not a disclosure.
    res.setHeader('Cache-Control', 'private, max-age=0');
    // helmet sets `Cross-Origin-Resource-Policy: same-origin` globally, which
    // is right for every other route and fatal for this one: the UI is served
    // from a different origin than the API, so the browser fetches the audio
    // successfully (206, correct bytes) and then refuses to let the media
    // element USE it. There is no error and no failed request — the player just
    // sits at readyState 0 showing 0:00 forever.
    //
    // Relaxed here only, and safe to relax here, because the URL already
    // carries its own short-lived capability token; CORP is not what is keeping
    // this recording private.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (range.kind === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }

    const { start, end } =
      range.kind === 'partial' ? range : { start: 0, end: Math.max(0, size - 1) };

    if (range.kind === 'partial') {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length', String(size === 0 ? 0 : end - start + 1));

    if (req.method === 'HEAD' || size === 0) return res.end();

    const stream = createReadStream(path, { start, end });
    // A client that seeks away mid-download aborts the response; without this
    // the file handle stays open, and a few minutes of scrubbing exhausts them.
    res.on('close', () => stream.destroy());
    stream.on('error', (error) => {
      console.error(`Streaming ${path} failed:`, error);
      res.destroy();
    });
    stream.pipe(res);
  });

  /**
   * Cancels a job that has not started.
   *
   * A running job is refused rather than silently accepted: flipping the row
   * would not stop the Whisper call, so the job would go on and overwrite the
   * cancellation on completion — telling the user it was cancelled when it was
   * not is worse than telling them it is too late.
   */
  router.post('/jobs/:id/cancel', authenticate, anyRole, async (req, res) => {
    const userId = userIdOf(req);
    const job = await deps.store.get(req.params.id, userId);
    if (!job) return fail(res, 'No such transcription job', 404);

    if (job.status !== 'queued') {
      return fail(
        res,
        job.status === 'running'
          ? 'That job has already started transcribing and cannot be cancelled.'
          : `That job is already ${job.status}.`,
        409
      );
    }

    await deps.store.cancelQueued(req.params.id, userId);
    res.json({ success: true, data: { id: req.params.id, status: 'cancelled' } });
  });

  return router;
}
