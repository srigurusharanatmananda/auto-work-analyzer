/**
 * Git Work Analyzer
 *
 * Analyzes git commits and file changes to automatically detect work completed
 * and create appropriate ClickUp tasks based on actual development activity.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { distance as levenshteinDistance } from "fastest-levenshtein";
import { ClickUpService } from "./ClickUpService.js";
import { HistoryService } from "./HistoryService.js";
import { workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import { renderTasks } from "../formatting/ClickUpRenderer.js";
import type { Template } from "../formatting/Template.js";
import {
  GitCommit,
  DetectedWork,
  WorkAnalysisResult,
  ClickUpConfig,
} from "../types/index.js";

const execAsync = promisify(exec);

// Simple cache interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class GitWorkAnalyzer {
  private projectPath: string;
  private cache: Map<string, CacheEntry<any>>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private historyService: HistoryService;

  constructor(projectPath: string = process.cwd(), cacheTTL?: number) {
    this.projectPath = projectPath;
    this.cache = new Map();
    this.historyService = new HistoryService();
    if (cacheTTL !== undefined) {
      this.cacheTTL = cacheTTL;
    }
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
    author?: string,
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
      const detectedWork = await this.detectWorkFromCommits(commits);

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
    author?: string,
    branch?: string
  ): Promise<GitCommit[]> {
    try {
      // Create cache key for commits
      const cacheKey = `commits:${startDate || ""}:${endDate || ""}:${author || ""}:${branch || ""}`;

      // Check cache
      const cached = this.getCached<GitCommit[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Optimize git command - add --no-merges to skip merge commits at git level
      let gitCommand =
        'git log --pretty=format:"%H|%an|%ad|%s" --date=short --numstat --no-merges';

      // Add date filtering
      if (startDate) {
        gitCommand += ` --since="${startDate} 00:00:00"`;
      }
      if (endDate) {
        gitCommand += ` --until="${endDate} 23:59:59"`;
      }

      // Add author filtering
      if (author) {
        gitCommand += ` --author="${author}"`;
      }

      // Add branch filtering (add branch name at the end)
      if (branch) {
        gitCommand += ` ${branch}`;
      }

      const { stdout } = await execAsync(gitCommand, {
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
   * Detect work patterns from commits with intelligent duplicate detection
   */
  private async detectWorkFromCommits(
    commits: GitCommit[]
  ): Promise<DetectedWork[]> {
    const workMap = new Map<string, DetectedWork>();

    for (const commit of commits) {
      const workItems = this.analyzeCommit(commit);

      for (const workItem of workItems) {
        const matchingKey = this.findSimilarWorkItem(workItem, workMap);

        if (matchingKey) {
          // Merge with existing similar work
          const existing = workMap.get(matchingKey)!;

          // Merge files (avoid duplicates)
          const existingFileSet = new Set(existing.files);
          for (const file of workItem.files) {
            existingFileSet.add(file);
          }
          existing.files = Array.from(existingFileSet);

          // Merge commits (avoid duplicates)
          const existingCommitHashes = new Set(existing.commits.map(c => c.hash));
          for (const newCommit of workItem.commits) {
            if (!existingCommitHashes.has(newCommit.hash)) {
              existing.commits.push(newCommit);
            }
          }

          // Add estimated hours
          existing.estimatedHours += workItem.estimatedHours;

          // Merge tags (avoid duplicates)
          existing.tags = [...new Set([...existing.tags, ...workItem.tags])];
        } else {
          // Add as new work item
          const key = this.normalizeWorkName(workItem.name);
          workMap.set(key, workItem);
        }
      }
    }

    return Array.from(workMap.values());
  }

  /**
   * Find similar work item using fuzzy matching
   * Returns the key of a similar work item if found, null otherwise
   */
  private findSimilarWorkItem(
    newWork: DetectedWork,
    workMap: Map<string, DetectedWork>
  ): string | null {
    const normalizedNewName = this.normalizeWorkName(newWork.name);
    const similarityThreshold = 0.8; // 80% similarity required

    for (const [key, existingWork] of workMap.entries()) {
      // Check if same work type
      if (existingWork.type !== newWork.type) {
        continue;
      }

      // Calculate similarity
      const similarity = this.calculateSimilarity(normalizedNewName, key);

      if (similarity >= similarityThreshold) {
        return key;
      }
    }

    return null;
  }

  /**
   * Calculate similarity between two strings (0 to 1, where 1 is identical)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Normalize work name for comparison
   */
  private normalizeWorkName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ');    // Normalize whitespace
  }

  /**
   * Analyze a single commit to detect work
   */
  private analyzeCommit(commit: GitCommit): DetectedWork[] {
    const workItems: DetectedWork[] = [];
    const message = commit.message.toLowerCase();
    const files = commit.files;

    // Feature detection patterns
    const featurePatterns = [
      /add\s+(.+)/i,
      /implement\s+(.+)/i,
      /create\s+(.+)/i,
      /build\s+(.+)/i,
      /develop\s+(.+)/i,
    ];

    // Bug fix patterns
    const bugFixPatterns = [
      /fix\s+(.+)/i,
      /resolve\s+(.+)/i,
      /correct\s+(.+)/i,
      /repair\s+(.+)/i,
      /bug\s+(.+)/i,
    ];

    // Improvement patterns
    const improvementPatterns = [
      /improve\s+(.+)/i,
      /enhance\s+(.+)/i,
      /optimize\s+(.+)/i,
      /refactor\s+(.+)/i,
      /update\s+(.+)/i,
    ];

    // Test patterns
    const testPatterns = [
      /test\s+(.+)/i,
      /add\s+test/i,
      /unit\s+test/i,
      /integration\s+test/i,
    ];

    // Documentation patterns
    const docPatterns = [/doc\s+(.+)/i, /document\s+(.+)/i, /readme/i, /docs/i];

    // Determine work type and name
    let workType: DetectedWork["type"] = "improvement";
    let workName = commit.message;

    if (bugFixPatterns.some((pattern) => pattern.test(message))) {
      workType = "bug-fix";
      const match = bugFixPatterns.find((pattern) => pattern.test(message));
      if (match) {
        const result = message.match(match);
        workName = result ? result[1] ?? commit.message : commit.message;
      }
    } else if (featurePatterns.some((pattern) => pattern.test(message))) {
      workType = "feature";
      const match = featurePatterns.find((pattern) => pattern.test(message));
      if (match) {
        const result = message.match(match);
        workName = result ? result[1] ?? commit.message : commit.message;
      }
    } else if (testPatterns.some((pattern) => pattern.test(message))) {
      workType = "test";
      workName = `Test: ${commit.message}`;
    } else if (docPatterns.some((pattern) => pattern.test(message))) {
      workType = "documentation";
      workName = `Documentation: ${commit.message}`;
    } else if (improvementPatterns.some((pattern) => pattern.test(message))) {
      workType = "improvement";
      const match = improvementPatterns.find((pattern) =>
        pattern.test(message)
      );
      if (match) {
        const result = message.match(match);
        workName = result ? result[1] ?? commit.message : commit.message;
      }
    }

    // Determine complexity based on file changes and lines
    const complexity = this.determineComplexity(commit);
    const estimatedHours = this.estimateHours(commit, complexity);

    // Generate tags based on file types and patterns
    const tags = this.generateTags(files, message);

    workItems.push({
      type: workType,
      name: workName,
      description: this.generateDescription(commit, workType),
      files,
      commits: [commit],
      complexity,
      estimatedHours,
      tags,
    });

    return workItems;
  }

  /**
   * Determine work complexity based on commit data
   */
  private determineComplexity(commit: GitCommit): "low" | "medium" | "high" {
    const totalChanges = commit.insertions + commit.deletions;
    const fileCount = commit.files.length;

    if (totalChanges < 50 && fileCount <= 3) {
      return "low";
    } else if (totalChanges < 200 && fileCount <= 10) {
      return "medium";
    } else {
      return "high";
    }
  }

  /**
   * Estimate hours based on commit complexity
   */
  private estimateHours(
    commit: GitCommit,
    complexity: "low" | "medium" | "high"
  ): number {
    const baseHours = {
      low: 0.5,
      medium: 2,
      high: 4,
    };

    const fileMultiplier = Math.min(commit.files.length / 5, 2); // Cap at 2x
    return baseHours[complexity] * (1 + fileMultiplier);
  }

  /**
   * Generate tags based on file types and commit message
   */
  private generateTags(files: string[], message: string): string[] {
    const tags: string[] = [];

    // File type tags
    if (files.some((f) => f.includes(".tsx") || f.includes(".jsx")))
      tags.push("frontend");
    if (files.some((f) => f.includes(".ts") && !f.includes(".tsx")))
      tags.push("backend");
    if (files.some((f) => f.includes(".css") || f.includes(".scss")))
      tags.push("styling");
    if (files.some((f) => f.includes(".test.") || f.includes(".spec.")))
      tags.push("testing");
    if (files.some((f) => f.includes("api/") || f.includes("routes/")))
      tags.push("api");
    if (files.some((f) => f.includes("components/"))) tags.push("components");
    if (files.some((f) => f.includes("utils/") || f.includes("services/")))
      tags.push("utilities");

    // Message-based tags
    if (message.includes("auth")) tags.push("authentication");
    if (message.includes("payment")) tags.push("payment");
    if (message.includes("analytics")) tags.push("analytics");
    if (message.includes("clickup")) tags.push("clickup");
    if (message.includes("admin")) tags.push("admin");
    if (message.includes("ui") || message.includes("ux")) tags.push("ui-ux");

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Generate description for work item
   */
  private generateDescription(
    commit: GitCommit,
    workType: DetectedWork["type"]
  ): string {
    const fileCount = commit.files.length;
    const totalChanges = commit.insertions + commit.deletions;

    let description = `${commit.message}\n\n`;
    description += `Files changed: ${fileCount}\n`;
    description += `Lines added: ${commit.insertions}\n`;
    description += `Lines deleted: ${commit.deletions}\n`;
    description += `Total changes: ${totalChanges}\n\n`;

    if (commit.files.length > 0) {
      description += `Key files:\n${commit.files
        .slice(0, 5)
        .map((f) => `- ${f}`)
        .join("\n")}`;
      if (commit.files.length > 5) {
        description += `\n... and ${commit.files.length - 5} more files`;
      }
    }

    return description;
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
  async createTasksFromWork(
    workAnalysis: WorkAnalysisResult,
    config: ClickUpConfig,
    batchSize: number = 5,
    opts?: { template?: Template; repository?: string }
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
        ? renderTasks(
            workItemsFromAnalysis(workAnalysis, opts.repository),
            opts.template
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
      const analysisId = this.historyService.addAnalysisHistory({
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
