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
import type { ClickUpConfig } from "../types/index.js";

const execFileAsync = promisify(execFile);

/** A fetch needing credentials must fail, not hang the whole run. */
const FETCH_TIMEOUT_MS = 60_000;

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
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
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
        try {
          await fetchRepo(repo.path);
        } catch (error) {
          // Recorded, not fatal: stale local history is still worth scanning,
          // and the flag tells the user why a repo may look thin.
          result.fetchFailed = error instanceof Error ? error.message : String(error);
        }

        const analyzer =
          this.deps.analyzerFactory?.(repo.path, userId) ??
          new GitWorkAnalyzer(repo.path, undefined, this.deps.grouper, userId);

        // "--all" is load-bearing: git log with no revision argument walks HEAD
        // only, so work committed on a branch that is not checked out would be
        // invisible. The Reports tab's "All Branches" option passes undefined and
        // therefore does NOT do this.
        const analysis = await analyzer.analyzeWork(
          opts.date,
          opts.date,
          settings.authorIdentities.length > 0 ? settings.authorIdentities : undefined,
          "--all",
          false
        );

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
