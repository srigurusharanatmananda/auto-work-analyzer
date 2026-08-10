/**
 * One end-of-day scan across every enabled repository.
 *
 * This class ORCHESTRATES and does not format: work items come from
 * GitWorkAnalyzer (which groups via the injected CommitGrouper), rendering and
 * status mapping go through the same two functions the HTTP routes use, and the
 * destination comes from DestinationResolver. If this file ever starts building
 * a task name, the canonical pipeline has been bypassed and preview/created
 * parity is broken again.
 *
 * Per-repo isolation is the rule: a repo that fails to fetch, fails to analyse,
 * or whose ClickUp list rejects a task must never prevent the remaining repos
 * from being processed. Every outcome lands in the summary, because an
 * unattended job whose failures are invisible is worse than no job.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { discoverRepos, DiscoveryResult, SkippedDir } from "./RepoDiscovery.js";
import { ScanRegistry } from "./ScanRegistry.js";
import { GitWorkAnalyzer } from "../services/GitWorkAnalyzer.js";
import { ClickUpService } from "../services/ClickUpService.js";
import {
  annotateStatusMapping,
  buildPreview,
  createRenderedTasks,
} from "../routes/tasks.routes.js";
import { workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import type { CommitGrouper } from "../grouping/CommitGrouper.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";
import type { ClickUpConfig, WorkAnalysisResult } from "../types/index.js";

const execFileAsync = promisify(execFile);

/** A fetch needing credentials must fail, not hang the whole run. */
const FETCH_TIMEOUT_MS = 60_000;

/**
 * analyzeWork() has no single subprocess handle to bound the way gitFetch
 * bounds "git fetch": it shells out to git for `git log` with no timeout of
 * its own (see GitWorkAnalyzer.getCommitsForDateRange), can call an AI grouper
 * over the network, and touches SQLite via HistoryService. There is nothing
 * clean to thread a native timeout through across all of that, so `withTimeout`
 * below races it instead — generous enough that even a large repo finishes
 * comfortably inside it, short enough that one repo stuck on a slow disk or a
 * hung AI call cannot swallow the rest of the sequential scan.
 */
const ANALYZE_TIMEOUT_MS = 5 * 60_000;

/** Thrown by `withTimeout` when the timer, not the raced promise, loses. */
class TimeoutError extends Error {}

/**
 * Races `promise` against a timer of `ms` milliseconds.
 *
 * This is an OUTER race, not a cancellation: analyzeWork's own git subprocess
 * or AI call has no handle out here to kill, so losing the race only stops
 * this loop from waiting on it — whatever analyzeWork was doing keeps running
 * in the background, unobserved, until it settles (or the process exits).
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface RepoScanResult {
  slug: string;
  /**
   * The local clone this result came from. `slug` is derived from the git
   * remote and is not unique — the same remote can be cloned twice under
   * different directory names — so a UI listing these results needs `path`
   * to tell two rows apart, the same reason `ScannedRepo` in RepoDiscovery.ts
   * carries it.
   */
  path: string;
  commits: number;
  workItems: number;
  tasksCreated: number;
  destination: string | null;
  fetchFailed?: string;
  /**
   * Set when analyzeWork() lost the ANALYZE_TIMEOUT_MS race instead of
   * returning. Recorded, not fatal, the same as `fetchFailed` above — the loop
   * moves on to the next repo rather than throwing, but the day's work for
   * this repo was not analysed and nothing was filed for it.
   */
  analyzeTimedOut?: string;
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
  /**
   * How long the fetch and analyze steps actually took, so a repo that is slow
   * but stays under ANALYZE_TIMEOUT_MS is still visible in the summary instead
   * of looking identical to a fast one. `analyzeMs` is set whether analyzeWork
   * finished, failed, or timed out — whatever wall-clock time was actually
   * spent waiting on it.
   */
  fetchMs?: number;
  analyzeMs?: number;
}

export interface ScanRunSummary {
  date: string;
  dryRun: boolean;
  repos: RepoScanResult[];
  skipped: SkippedDir[];
  totalTasksCreated: number;
}

export interface DailyScannerDeps {
  registry: ScanRegistry;
  resolver: DestinationResolver;
  grouper: CommitGrouper;
  analyzerFactory?: (projectPath: string, userId: string) => GitWorkAnalyzer;
  clickUpFactory?: (config: ClickUpConfig) => ClickUpService;
  discover?: typeof discoverRepos;
  fetchRepo?: (path: string) => Promise<void>;
  /**
   * Overrides ANALYZE_TIMEOUT_MS. Exists so a test can shrink a 5-minute wait
   * to a handful of milliseconds instead of actually waiting 5 minutes to
   * prove the race fires; production callers should never need it.
   */
  analyzeTimeoutMs?: number;
}

async function gitFetch(path: string): Promise<void> {
  await execFileAsync("git", ["fetch", "--all", "--prune"], {
    cwd: path,
    timeout: FETCH_TIMEOUT_MS,
  });
}

export class DailyScanner {
  constructor(private deps: DailyScannerDeps) {}

  async run(userId: string, opts: { date: string; dryRun?: boolean }): Promise<ScanRunSummary> {
    const dryRun = opts.dryRun === true;
    const settings = await this.deps.registry.getSettings(userId);
    const discover = this.deps.discover ?? discoverRepos;
    const fetchRepo = this.deps.fetchRepo ?? gitFetch;
    const analyzeTimeoutMs = this.deps.analyzeTimeoutMs ?? ANALYZE_TIMEOUT_MS;

    const discovery: DiscoveryResult = await discover(settings.root, settings.owner);
    const results: RepoScanResult[] = [];

    // Sequential: ClickUp rate-limits, and it keeps the failure report readable.
    for (const repo of discovery.repos) {
      const binding = await this.deps.registry.getBinding(userId, repo.slug);
      if (binding && !binding.enabled) continue;

      const result: RepoScanResult = {
        slug: repo.slug,
        path: repo.path,
        commits: 0,
        workItems: 0,
        tasksCreated: 0,
        destination: null,
      };

      try {
        const fetchStart = Date.now();
        try {
          await fetchRepo(repo.path);
        } catch (error) {
          // Recorded, not fatal: stale local history is still worth scanning,
          // and the flag tells the user why a repo may look thin.
          result.fetchFailed = error instanceof Error ? error.message : String(error);
        }
        result.fetchMs = Date.now() - fetchStart;

        const analyzer =
          this.deps.analyzerFactory?.(repo.path, userId) ??
          new GitWorkAnalyzer(repo.path, undefined, this.deps.grouper, userId);

        let analysis: WorkAnalysisResult;
        const analyzeStart = Date.now();
        try {
          // "--all" is load-bearing: git log with no revision argument walks
          // HEAD only, so work committed on a branch that is not checked out
          // would be invisible. The Reports tab's "All Branches" option passes
          // undefined and therefore does NOT do this.
          analysis = await withTimeout(
            analyzer.analyzeWork(
              opts.date,
              opts.date,
              settings.authorIdentities.length > 0 ? settings.authorIdentities : undefined,
              "--all",
              false
            ),
            analyzeTimeoutMs,
            `analyzeWork exceeded ${analyzeTimeoutMs}ms for ${repo.slug}`
          );
        } catch (error) {
          if (error instanceof TimeoutError) {
            // Recorded, not fatal: this repo is skipped for today, but a
            // pathological repo must never stop the rest of the org's repos
            // from being scanned. See ANALYZE_TIMEOUT_MS for why this is a
            // race rather than a guaranteed kill of analyzeWork's own work.
            result.analyzeTimedOut = error.message;
            results.push(result);
            continue;
          }
          throw error;
        } finally {
          // One assignment, not one per exit path: `analyzeMs` is documented
          // to always be set once this step is done, however it ended — a
          // future new catch branch (or an early return) added between here
          // and where this used to be duplicated could otherwise forget to
          // set it on that one new path.
          result.analyzeMs = Date.now() - analyzeStart;
        }

        result.commits = analysis.totalCommits;
        result.workItems = analysis.detectedWork.length;

        if (analysis.detectedWork.length === 0) {
          results.push(result);
          continue;
        }

        const resolved = await this.deps.resolver.resolve(
          userId,
          binding?.destinationId,
          binding?.templateId
        );
        result.destination = resolved.destination?.name ?? null;

        const items = workItemsFromAnalysis(analysis, repo.slug).map((item) => ({
          ...item,
          tags: [...item.tags, repo.slug],
        }));

        // buildPreview + annotateStatusMapping rather than renderTasks directly,
        // for one load-bearing reason: git-derived items carry status "complete",
        // and ClickUp answers 400 "Status not found" for a status the target list
        // does not define. A list whose statuses are e.g.
        // [researching, developing, deployed] would reject EVERY task. These are
        // the same two functions the HTTP routes use, so the scan cannot drift
        // from them.
        let preview = buildPreview(items, resolved.template);
        if (resolved.listId) {
          try {
            const statuses = await resolved.clickUp.getListStatuses(resolved.listId);
            preview = annotateStatusMapping(preview, statuses);
          } catch (error) {
            // Unknown statuses: send what was rendered, which is the pre-slice-2
            // behaviour, and say so rather than failing the repo.
            result.error = `Could not read list statuses: ${
              error instanceof Error ? error.message : error
            }`;
          }
        }
        const rendered = preview.items;

        if (dryRun) {
          result.wouldCreate = rendered.map((entry) => ({
            name: entry.task.name,
            description: entry.task.description ?? "",
          }));
          results.push(result);
          continue;
        }

        const clickUp = this.deps.clickUpFactory?.(resolved.config) ?? resolved.clickUp;
        const outcome = await createRenderedTasks(rendered, clickUp, resolved.listId);
        result.tasksCreated = outcome.created.length;
        if (outcome.failed.length > 0) {
          const reasons = outcome.failed.map((f) => f.reason).join("; ");
          result.error = `${outcome.failed.length} task(s) rejected: ${reasons}`;
        }

        // Only a real run records progress. A dry run that marked commits
        // processed would make the first real run create nothing.
        // Awaited, and this one is load-bearing. The lease marks the day
        // complete as soon as this returns; if the dedup rows are still being
        // written, a SIGTERM in that window leaves a completed day with no
        // record of what was processed — and the next run of that date creates
        // every task a second time, which is the duplication the lease exists
        // to prevent. Unawaited, a failure here also escaped the surrounding
        // try instead of landing in `result.error`.
        await analyzer.markScanCommitsProcessed(analysis, repo.path);
        await this.deps.registry.markScanned(userId, repo.slug, opts.date);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      }

      results.push(result);
    }

    return {
      date: opts.date,
      dryRun,
      repos: results,
      skipped: discovery.skipped,
      totalTasksCreated: results.reduce((sum, r) => sum + r.tasksCreated, 0),
    };
  }
}
