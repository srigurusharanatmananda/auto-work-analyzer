/**
 * Git Work Analyzer
 *
 * Analyzes git commits and file changes to automatically detect work completed
 * and create appropriate ClickUp tasks based on actual development activity.
 */

import { exec, execFile } from "child_process";
import { promisify } from "util";
import { ClickUpService } from "./ClickUpService.js";
import { HistoryService } from "./HistoryService.js";
import { detectedWorkFromItems, workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import { HeuristicCommitGrouper } from "../grouping/HeuristicCommitGrouper.js";
import type { CommitGrouper } from "../grouping/CommitGrouper.js";
import { renderTasks } from "../formatting/ClickUpRenderer.js";
import type { RenderedTask } from "../formatting/ClickUpRenderer.js";
import { mapStatus } from "../formatting/StatusMapper.js";
import type { Template } from "../formatting/Template.js";
import {
  GitCommit,
  DetectedWork,
  GroupingInfo,
  WorkAnalysisResult,
  ClickUpConfig,
} from "../types/index.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Simple cache interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Rewrites each rendered task's status to the target list's real status,
 * dropping any that cannot be matched. Mirrors `annotateStatusMapping` in
 * tasks.routes.ts — this path renders internally, so it cannot reuse it, but it
 * must not disagree with it either.
 *
 * `null`/`undefined` means "could not read the list's statuses" — leave every
 * status alone, which is the pre-slice-2 behaviour and the safe degradation.
 *
 * An EMPTY ARRAY is different and must not be conflated with it: the caller
 * read the list successfully and it defines no statuses, so any status we send
 * is a guaranteed `400 {"err":"Status not found"}` from ClickUp. This used to
 * return `rendered` unchanged for `[]` while `annotateStatusMapping` dropped
 * the status, so the preview promised "will be left at the list default" and
 * then every create failed — the exact failure slice 2 exists to prevent,
 * surviving on the path slice 2 added `availableStatuses` to.
 */
function mapRenderedStatuses(
  rendered: RenderedTask[],
  availableStatuses?: string[] | null
): RenderedTask[] {
  if (!availableStatuses) return rendered;

  return rendered.map((entry) => {
    const mapping = mapStatus(entry.task.status, availableStatuses);
    if (!mapping) return entry;

    const task = { ...entry.task };
    if (mapping.to) {
      task.status = mapping.to;
    } else {
      delete task.status;
      console.warn(
        `Status "${mapping.from}" does not exist in the target list — leaving "${task.name}" at the list default.`
      );
    }
    return { ...entry, task };
  });
}

export class GitWorkAnalyzer {
  private projectPath: string;
  private cache: Map<string, CacheEntry<any>>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private historyService: HistoryService;
  /** Owns the keyword grouping this class used to inline. */
  private heuristics = new HeuristicCommitGrouper();

  /**
   * Optional. When supplied, `analyzeWork` groups commits with it instead of the
   * keyword heuristic — which is what makes AI grouping reachable from
   * /api/analyze, and therefore from the product at all. Left unset by the CLI
   * and the exported helpers so their output is unchanged.
   */
  private grouper?: CommitGrouper;

  constructor(
    projectPath: string = process.cwd(),
    cacheTTL?: number,
    grouper?: CommitGrouper
  ) {
    this.projectPath = projectPath;
    this.cache = new Map();
    this.historyService = new HistoryService();
    if (cacheTTL !== undefined) {
      this.cacheTTL = cacheTTL;
    }
    this.grouper = grouper;
  }

  /**
   * Get data from cache if valid
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Analyze work for a specific date or date range
   */
  async analyzeWork(
    date?: string,
    endDate?: string,
    author?: string | string[],
    branch?: string,
    includeProcessed: boolean = false
  ): Promise<WorkAnalysisResult> {
    try {
      // Validate inputs
      this.validateDateInputs(date, endDate);

      // Create cache key
      const cacheKey = `analysis:${date || "today"}:${endDate || ""}:${author || "all"}:${branch || "all"}`;

      // Check cache
      const cached = this.getCached<WorkAnalysisResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // Verify git repository exists
      await this.verifyGitRepository();

      // Get commits for the specified date range
      const allCommits = await this.getCommitsForDateRange(date, endDate, author, branch);

      // Filter out already processed commits to prevent duplicates (only if includeProcessed is false)
      const commits = includeProcessed
        ? allCommits
        : this.historyService.filterUnprocessedCommits(allCommits, this.projectPath);

      console.log(
        `Found ${allCommits.length} total commits${
          includeProcessed
            ? ''
            : `, ${commits.length} unprocessed (${allCommits.length - commits.length} already processed)`
        }`
      );

      // Analyze the commits to detect work patterns
      const analysisDate = date || new Date().toISOString().split("T")[0]!;
      const { work: detectedWork, grouping } = await this.detectWorkFromCommits(
        commits,
        analysisDate
      );
      if (grouping) {
        console.log(
          `📦 Grouped by ${grouping.mode}${
            grouping.fallbackReason ? ` (AI unavailable: ${grouping.fallbackReason})` : ""
          }`
        );
      }

      // Calculate summary statistics (optimized with Set)
      const totalFilesChanged = new Set(commits.flatMap((c) => c.files)).size;
      const totalLinesAdded = commits.reduce((sum, c) => sum + c.insertions, 0);
      const totalLinesDeleted = commits.reduce(
        (sum, c) => sum + c.deletions,
        0
      );

      const summary = this.generateWorkSummary(detectedWork, commits.length);

      const result: WorkAnalysisResult = {
        date: date || new Date().toISOString().split("T")[0],
        totalCommits: commits.length,
        totalFilesChanged,
        totalLinesAdded,
        totalLinesDeleted,
        detectedWork,
        summary,
        grouping,
      };

      // Store in cache
      this.setCached(cacheKey, result);

      return result;
    } catch (error) {
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("not a git repository")) {
          throw new Error(
            `Not a git repository: ${this.projectPath}. Please ensure you're running this from a git project.`
          );
        } else if (error.message.includes("fatal")) {
          throw new Error(
            `Git error: ${error.message}. Please check your git installation and repository.`
          );
        }
      }

      throw new Error(
        `Failed to analyze work: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate date inputs
   */
  private validateDateInputs(startDate?: string, endDate?: string): void {
    if (startDate && !this.isValidDateFormat(startDate)) {
      throw new Error(
        `Invalid start date format: ${startDate}. Expected YYYY-MM-DD format.`
      );
    }

    if (endDate && !this.isValidDateFormat(endDate)) {
      throw new Error(
        `Invalid end date format: ${endDate}. Expected YYYY-MM-DD format.`
      );
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new Error(
          `Start date (${startDate}) must be before or equal to end date (${endDate}).`
        );
      }
    }
  }

  /**
   * Check if date is in valid format (YYYY-MM-DD)
   */
  private isValidDateFormat(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Verify that the project path is a git repository
   */
  private async verifyGitRepository(): Promise<void> {
    try {
      await execAsync("git rev-parse --git-dir", { cwd: this.projectPath });
    } catch (error) {
      throw new Error(
        `Not a git repository: ${this.projectPath}. Please ensure you're in a git project.`
      );
    }
  }

  /**
   * Get commits for a specific date range
   */
  private async getCommitsForDateRange(
    startDate?: string,
    endDate?: string,
    author?: string | string[],
    branch?: string
  ): Promise<GitCommit[]> {
    try {
      const authors = author === undefined ? [] : Array.isArray(author) ? author : [author];

      // Create cache key for commits
      const cacheKey = `commits:${startDate || ""}:${endDate || ""}:${authors.join(",")}:${branch || ""}`;

      // Check cache
      const cached = this.getCached<GitCommit[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // argv, not a shell string. The previous form interpolated `author` and
      // `branch` into a command run through a shell, so a value containing shell
      // metacharacters would have been executed. Nothing exploited it — author
      // came from an authenticated user and branch from a dropdown — but the
      // org-wide scanner feeds this a configurable identity list across
      // discovered directories, and argv removes the question entirely.
      //
      // Note the --pretty value has no surrounding quotes here: those were shell
      // quoting. Passing them in an argv element would make git treat them as
      // literal characters in the format string.
      const args = [
        "log",
        "--pretty=format:%H|%an|%ad|%s",
        "--date=short",
        "--numstat",
        "--no-merges",
      ];

      if (startDate) args.push(`--since=${startDate} 00:00:00`);
      if (endDate) args.push(`--until=${endDate} 23:59:59`);
      // Repeated --author flags OR together in git, and each matches the author
      // name as well as the email — which is what makes multi-identity
      // attribution work for someone who commits as a work address in one repo
      // and a personal one in another.
      for (const identity of authors) args.push(`--author=${identity}`);
      if (branch) args.push(branch);

      const { stdout } = await execFileAsync("git", args, {
        cwd: this.projectPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
      });

      const commits = this.parseGitLog(stdout);

      // Store in cache
      this.setCached(cacheKey, commits);

      return commits;
    } catch (error) {
      throw new Error(
        `Failed to get git commits: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Parse git log output into structured data
   */
  private parseGitLog(logOutput: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const lines = logOutput.trim().split("\n");

    let currentCommit: Partial<GitCommit> | null = null;

    // Patterns to identify merge commits
    const mergePatterns = [
      /^merge pull request #\d+/i,
      /^merge branch/i,
      /^merge remote-tracking branch/i,
      /^merge \w+ into \w+/i,
      /^merged in [a-z0-9-]+\//i,
      /^merge:/i,
    ];

    for (const line of lines) {
      if (line.includes("|")) {
        // This is a commit header
        if (currentCommit && !this.isMergeCommit(currentCommit.message || "", mergePatterns)) {
          commits.push(currentCommit as GitCommit);
        }

        const [hash, author, date, message] = line.split("|");
        currentCommit = {
          hash: hash ?? "",
          author: author ?? "",
          date: date ?? "",
          message: message ?? "",
          files: [],
          insertions: 0,
          deletions: 0,
        };
      } else if (currentCommit && line.trim() && !line.startsWith("commit")) {
        // This is a file change line
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const file = parts[2] || parts[1];
          const insertions = parseInt(parts[0] || "0") || 0;
          const deletions = parseInt(parts[1] || "0") || 0;

          currentCommit.files!.push(file ?? "");
          currentCommit.insertions! += insertions;
          currentCommit.deletions! += deletions;
        }
      }
    }

    if (currentCommit && !this.isMergeCommit(currentCommit.message || "", mergePatterns)) {
      commits.push(currentCommit as GitCommit);
    }

    return commits;
  }

  /**
   * Check if a commit message indicates a merge commit
   */
  private isMergeCommit(message: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(message.trim()));
  }

  /**
   * Detect work patterns from commits.
   *
   * Delegates to HeuristicCommitGrouper, which owns the keyword classification
   * and fuzzy merge this class used to inline. Same logic, one copy — the AI
   * grouper's fallback path and /api/analyze cannot drift apart.
   */
  private async detectWorkFromCommits(
    commits: GitCommit[],
    analysisDate: string
  ): Promise<{ work: DetectedWork[]; grouping?: GroupingInfo }> {
    if (!this.grouper) {
      return { work: this.heuristics.detectWork(commits) };
    }

    // The grouper speaks canonical WorkItems; this path and everything
    // downstream of analyzeWork speaks DetectedWork, hence the adapter. A
    // grouper that fails internally already falls back to the heuristic and
    // reports why, so there is nothing to catch here.
    const result = await this.grouper.group(commits, {
      analysisDate,
      repository: this.projectPath.split("/").filter(Boolean).pop(),
    });

    return {
      work: detectedWorkFromItems(result.items),
      grouping: { mode: result.mode, fallbackReason: result.fallbackReason },
    };
  }

  /**
   * Generate work summary
   */
  private generateWorkSummary(
    detectedWork: DetectedWork[],
    commitCount: number
  ): string {
    const workTypes = detectedWork.reduce((acc, work) => {
      acc[work.type] = (acc[work.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalHours = detectedWork.reduce(
      (sum, work) => sum + work.estimatedHours,
      0
    );

    let summary = `Completed ${commitCount} commits with ${detectedWork.length} distinct work items.\n\n`;
    summary += `Work breakdown:\n`;

    Object.entries(workTypes).forEach(([type, count]) => {
      summary += `- ${type}: ${count} items\n`;
    });

    summary += `\nEstimated total time: ${totalHours.toFixed(1)} hours`;

    return summary;
  }

  /**
   * Create ClickUp tasks from detected work (with batch processing)
   */
  /**
   * Records the analysed commits as processed, without creating tasks.
   *
   * The org-wide scanner creates tasks itself through the canonical renderer, so
   * it cannot use createTasksFromWork — but the dedup bookkeeping that method
   * performs is exactly what makes a second run of the same day a no-op. This
   * exposes only that half.
   */
  markScanCommitsProcessed(analysis: WorkAnalysisResult, projectPath: string): void {
    const commits = analysis.detectedWork.flatMap((work) => work.commits);
    if (commits.length === 0) return;
    this.historyService.markCommitsAsProcessed(commits, projectPath);
  }

  async createTasksFromWork(
    workAnalysis: WorkAnalysisResult,
    config: ClickUpConfig,
    batchSize: number = 5,
    opts?: {
      template?: Template;
      repository?: string;
      /**
       * The target list's real statuses. Rendered statuses are mapped onto
       * these, and any that cannot be matched are dropped so ClickUp applies
       * the list default.
       *
       * This matters more here than on the canonical path: git-derived work
       * items default to `status: "complete"` (see GitWorkSource), and a list
       * whose done column is named anything else rejects the create outright.
       * Omit, or pass null, to send statuses unmapped as before.
       */
      availableStatuses?: string[] | null;
      /**
       * Who the analysis row this writes belongs to. Undefined for callers with
       * no session — the CLI and the secret-authenticated webhook — whose rows
       * are unowned and visible only to admins.
       */
      userId?: string;
    }
  ): Promise<any[]> {
    try {
      const clickUpService = new ClickUpService(config);
      const createdTasks: any[] = [];

      // When a template is supplied, run the individual work items through the
      // same canonical renderer the {workItems} path uses, so this legacy path
      // stops formatting tasks with its own hand-rolled emoji/priority/
      // timeEstimate logic. Indexed to line up with workAnalysis.detectedWork
      // (workItemsFromAnalysis and renderTasks both map in input order).
      // `repository` is threaded through so a template using {{repository}}
      // renders the same value here as it does on /api/preview-tasks, which
      // already passes it. Without it the preview showed the repo and the
      // created task showed an empty string — the exact divergence this path
      // exists to eliminate.
      const renderedTasks = opts?.template
        ? mapRenderedStatuses(
            renderTasks(
              workItemsFromAnalysis(workAnalysis, opts.repository),
              opts.template
            ),
            opts.availableStatuses
          )
        : null;

      // Create summary task
      const summaryTask = await clickUpService.createTask({
        name: `📊 Daily Work Summary - ${workAnalysis.date}`,
        description: workAnalysis.summary,
        priority: "normal",
        tags: ["daily-summary", "automated", workAnalysis.date],
        subtasks: workAnalysis.detectedWork.map((work) => ({
          name: `${
            work.type === "feature"
              ? "✅"
              : work.type === "bug-fix"
              ? "🐛"
              : "🔧"
          } ${work.name}`,
          description: work.description,
          priority:
            work.complexity === "high"
              ? "high"
              : work.complexity === "medium"
              ? "normal"
              : "low",
        })),
      });

      createdTasks.push(summaryTask);

      // Batch process individual tasks for better performance
      const workItems = workAnalysis.detectedWork;

      // Remember which created task belongs to which work item by index instead
      // of re-deriving it from the task name later. Name matching mis-attributes
      // commits whenever two names collide, which needs no custom template at
      // all: `name.includes(name.substring(0, 30))` makes "Stabilize the
      // meditation player layout" swallow "...layout v2", so the second item's
      // commits get recorded against the first item's ClickUp task id. That hits
      // the no-template callers (cli.ts, webhook-server.ts, the exported
      // createTasksFromWork wrapper) too, so the index is built for both paths.
      // The offset into `createdTasks` cannot be used for this: failed creations
      // are filtered out of it below.
      const createdByItemIndex: (any | null)[] = new Array(workItems.length).fill(null);

      for (let i = 0; i < workItems.length; i += batchSize) {
        const batch = workItems.slice(i, i + batchSize);

        // Process batch in parallel
        const batchPromises = batch.map((work, batchIndex) => {
          if (renderedTasks) {
            const taskData = renderedTasks[i + batchIndex].task;
            return clickUpService.createTask(taskData).catch((error): null => {
              console.error(`Failed to create task for ${work.name}:`, error);
              return null; // Return null for failed tasks
            });
          }

          // Get the most recent commit date for due date
          const commitDate = work.commits.length > 0
            ? work.commits[work.commits.length - 1].date
            : workAnalysis.date;

          return clickUpService.createTask({
            name: `${
              work.type === "feature"
                ? "✅"
                : work.type === "bug-fix"
                ? "🐛"
                : "🔧"
            } ${work.name}`,
            description: work.description,
            priority:
              work.complexity === "high"
                ? "high"
                : work.complexity === "medium"
                ? "normal"
                : "low",
            status: "complete",
            tags: [work.type, "git-analyzed", workAnalysis.date, ...work.tags],
            timeEstimate: work.estimatedHours * 60 * 60 * 1000, // Convert to milliseconds
            dueDate: commitDate, // Set due date to the commit date
          }).catch((error): null => {
            console.error(`Failed to create task for ${work.name}:`, error);
            return null; // Return null for failed tasks
          });
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);

        // batchResults is 1:1 with `batch`, which is workItems[i .. i+batchSize)
        batchResults.forEach((task, batchIndex) => {
          createdByItemIndex[i + batchIndex] = task;
        });

        // Add successful tasks
        createdTasks.push(...batchResults.filter((task) => task !== null));

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < workItems.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Save analysis to history first and get the analysis ID
      const analysisId = this.historyService.addAnalysisHistory(opts?.userId, {
        projectPath: this.projectPath,
        date: workAnalysis.date,
        endDate: undefined,
        author: undefined,
        totalCommits: workAnalysis.totalCommits,
        totalWorkItems: workAnalysis.detectedWork.length,
        tasksCreated: createdTasks.filter((t) => t !== null).length,
        summary: workAnalysis.summary,
      });

      // Save work items to database and mark commits as processed
      const allCommits = workAnalysis.detectedWork.flatMap((work) => work.commits);
      const taskMapping = new Map<string, { id: string; name: string }>();

      // Save each work item and map commits to their created tasks
      workAnalysis.detectedWork.forEach((work, workIndex) => {
        // Save work item to database
        this.historyService.saveWorkItem(
          analysisId,
          work.name,
          work.type,
          work.description,
          work.estimatedHours,
          work.complexity,
          work.files.length,
          work.commits.length
        );

        // Map commits to their created ClickUp tasks
        work.commits.forEach((commit) => {
          const task = createdByItemIndex[workIndex];
          if (task) {
            taskMapping.set(commit.hash, { id: task.id, name: task.name });
          }
        });
      });

      // Mark these commits as processed
      this.historyService.markCommitsAsProcessed(
        allCommits,
        this.projectPath,
        taskMapping
      );

      return createdTasks;
    } catch (error) {
      throw new Error(
        `Failed to create tasks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
