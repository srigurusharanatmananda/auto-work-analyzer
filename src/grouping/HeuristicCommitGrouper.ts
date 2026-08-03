/**
 * The pre-existing keyword grouping, moved out of GitWorkAnalyzer.
 *
 * This is the fallback path: it never fails, never needs a network call, and
 * always covers every input commit. GitWorkAnalyzer now delegates to
 * `detectWork` rather than keeping a second copy, so /api/analyze and the AI
 * grouper's fallback cannot drift apart.
 *
 * Everything here is behaviour-preserving. The grouping rule is NOT "bucket by
 * type" — it is per-commit classification followed by a fuzzy merge of
 * same-type work whose names are ≥80% similar, which is what GitWorkAnalyzer
 * did and what /api/analyze consumers already see.
 */

import { distance as levenshteinDistance } from "fastest-levenshtein";
import { workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import type { DetectedWork, GitCommit, WorkAnalysisResult } from "../types/index.js";
import type { CommitGrouper, GroupingContext, GroupingResult } from "./CommitGrouper.js";

/** Name similarity, 0–1, above which two same-type work items are merged. */
const SIMILARITY_THRESHOLD = 0.8;

export class HeuristicCommitGrouper implements CommitGrouper {
  async group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult> {
    if (commits.length === 0) {
      return { items: [], mode: "heuristic" };
    }

    // Adapt through workItemsFromAnalysis rather than building WorkItems here,
    // so this path and the legacy `{ workAnalysis }` request path produce
    // identical items — same tags, same priority mapping, same completedDate
    // rule — from the same detected work.
    const detectedWork = this.detectWork(commits);
    const analysis: WorkAnalysisResult = {
      date: context.analysisDate,
      totalCommits: commits.length,
      totalFilesChanged: new Set(commits.flatMap((commit) => commit.files)).size,
      totalLinesAdded: commits.reduce((sum, commit) => sum + commit.insertions, 0),
      totalLinesDeleted: commits.reduce((sum, commit) => sum + commit.deletions, 0),
      detectedWork,
      summary: "",
    };

    return { items: workItemsFromAnalysis(analysis, context.repository), mode: "heuristic" };
  }

  /**
   * Detect work patterns from commits with intelligent duplicate detection.
   *
   * Public because GitWorkAnalyzer.analyzeWork needs exactly this, in
   * DetectedWork shape, to build its WorkAnalysisResult.
   */
  detectWork(commits: GitCommit[]): DetectedWork[] {
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
          const existingCommitHashes = new Set(existing.commits.map((c) => c.hash));
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
   * Find similar work item using fuzzy matching.
   * Returns the key of a similar work item if found, null otherwise.
   */
  private findSimilarWorkItem(
    newWork: DetectedWork,
    workMap: Map<string, DetectedWork>
  ): string | null {
    const normalizedNewName = this.normalizeWorkName(newWork.name);

    for (const [key, existingWork] of workMap.entries()) {
      // Check if same work type
      if (existingWork.type !== newWork.type) {
        continue;
      }

      // Calculate similarity
      const similarity = this.calculateSimilarity(normalizedNewName, key);

      if (similarity >= SIMILARITY_THRESHOLD) {
        return key;
      }
    }

    return null;
  }

  /** Similarity between two strings (0 to 1, where 1 is identical). */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /** Normalize work name for comparison. */
  private normalizeWorkName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " "); // Normalize whitespace
  }

  /** Analyze a single commit to detect work. */
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
      const match = improvementPatterns.find((pattern) => pattern.test(message));
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

  /** Determine work complexity based on commit data. */
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

  /** Estimate hours based on commit complexity. */
  private estimateHours(commit: GitCommit, complexity: "low" | "medium" | "high"): number {
    const baseHours = {
      low: 0.5,
      medium: 2,
      high: 4,
    };

    const fileMultiplier = Math.min(commit.files.length / 5, 2); // Cap at 2x
    return baseHours[complexity] * (1 + fileMultiplier);
  }

  /** Generate tags based on file types and commit message. */
  private generateTags(files: string[], message: string): string[] {
    const tags: string[] = [];

    // File type tags
    if (files.some((f) => f.includes(".tsx") || f.includes(".jsx"))) tags.push("frontend");
    if (files.some((f) => f.includes(".ts") && !f.includes(".tsx"))) tags.push("backend");
    if (files.some((f) => f.includes(".css") || f.includes(".scss"))) tags.push("styling");
    if (files.some((f) => f.includes(".test.") || f.includes(".spec."))) tags.push("testing");
    if (files.some((f) => f.includes("api/") || f.includes("routes/"))) tags.push("api");
    if (files.some((f) => f.includes("components/"))) tags.push("components");
    if (files.some((f) => f.includes("utils/") || f.includes("services/"))) tags.push("utilities");

    // Message-based tags
    if (message.includes("auth")) tags.push("authentication");
    if (message.includes("payment")) tags.push("payment");
    if (message.includes("analytics")) tags.push("analytics");
    if (message.includes("clickup")) tags.push("clickup");
    if (message.includes("admin")) tags.push("admin");
    if (message.includes("ui") || message.includes("ux")) tags.push("ui-ux");

    return [...new Set(tags)]; // Remove duplicates
  }

  /** Generate description for work item. */
  private generateDescription(commit: GitCommit, _workType: DetectedWork["type"]): string {
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
}
