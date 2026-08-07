/**
 * History Service for tracking processed commits and created tasks
 * Now uses SQLite database instead of JSON files
 */

import { GitCommit } from '../types/index.js';
import { DatabaseService, AnalysisRecord, AnalysisScope, ProcessedCommitRecord } from './DatabaseService.js';
import type { PostgresHandle } from '../db/client.js';

interface ProcessedCommit {
  hash: string;
  date: string;
  author: string;
  message: string;
  processedAt: string;
  projectPath: string;
  taskId?: string;
  taskName?: string;
}

interface AnalysisHistory {
  id: string;
  /** Undefined for legacy rows and machine-driven runs with no session. */
  userId?: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

export class HistoryService {
  private db: DatabaseService;

  constructor(pg?: PostgresHandle) {
    this.db = new DatabaseService(pg);
  }

  /** This user's processed commits, plus the pre-scoping legacy rows. */
  getProcessedCommits(userId: string): Promise<ProcessedCommit[]> {
    return this.db.getProcessedCommits(userId);
  }

  /**
   * Check if a commit has already been processed BY THIS USER.
   *
   * `userId` is required rather than optional on purpose. It used to be absent
   * and dedup was global; an optional parameter would let a call site that was
   * never updated keep the old shared behaviour, and the symptom of that — one
   * user's scan silently skipping commits because a different user filed them —
   * is invisible until someone notices missing tasks.
   */
  isCommitProcessed(commitHash: string, userId: string): Promise<boolean> {
    return this.db.isCommitProcessed(commitHash, userId);
  }

  /**
   * Filter out commits this user has already filed.
   *
   * `projectPath` is accepted for call-site compatibility and ignored: dedup is
   * keyed on (user, hash). See DatabaseService.isCommitProcessed.
   */
  async filterUnprocessedCommits(
    commits: GitCommit[],
    userId: string,
    _projectPath?: string
  ): Promise<GitCommit[]> {
    // One batched read rather than one query per commit: a day's work can be
    // hundreds of commits, and `filter` cannot await anyway — an async
    // predicate returns a Promise, which is always truthy, so a naive
    // conversion here would silently keep every commit.
    const processed = await Promise.all(
      commits.map((commit) => this.isCommitProcessed(commit.hash, userId))
    );
    return commits.filter((_, index) => !processed[index]);
  }

  /**
   * Mark commits as processed
   */
  async markCommitsAsProcessed(
    commits: GitCommit[],
    projectPath: string,
    userId: string,
    taskMapping?: Map<string, { id: string; name: string }>
  ): Promise<void> {
    for (const commit of commits) {
      const task = taskMapping?.get(commit.hash);
      const processedCommit: ProcessedCommitRecord = {
        hash: commit.hash,
        userId,
        date: commit.date,
        author: commit.author,
        message: commit.message,
        processedAt: new Date().toISOString(),
        projectPath,
        taskId: task?.id,
        taskName: task?.name,
      };
      await this.db.markCommitAsProcessed(processedCommit);
    }
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(scope: AnalysisScope, limit: number = 50): Promise<AnalysisHistory[]> {
    return this.db.getAnalysisHistory(scope, limit);
  }

  /**
   * Add analysis to history
   */
  /**
   * `userId` is a required first parameter rather than a field on the object,
   * and undefined has to be written out. Ownership is the thing that keeps one
   * user's reports out of another's hands, and a caller that forgets an
   * optional field writes an unowned row with nothing to notice; a caller that
   * has to type `undefined` has decided.
   */
  async addAnalysisHistory(
    userId: string | undefined,
    analysis: Omit<AnalysisHistory, 'id' | 'timestamp' | 'userId'>
  ): Promise<string> {
    const newEntry: AnalysisRecord = {
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      timestamp: new Date().toISOString(),
      ...analysis,
    };

    await this.db.saveAnalysis(newEntry);
    return newEntry.id;
  }

  /**
   * Save work item to database
   */
  async saveWorkItem(
    analysisId: string,
    workItemName: string,
    workItemType: string,
    description: string,
    estimatedHours: number,
    complexity: string,
    filesCount: number,
    commitsCount: number
  ): Promise<string> {
    const workItemId = `work-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map complexity string to number (1=low, 2=medium, 3=high)
    const complexityNumber = complexity === 'high' ? 3 : complexity === 'medium' ? 2 : 1;

    await this.db.saveWorkItem({
      id: workItemId,
      analysisId,
      name: workItemName,
      type: workItemType,
      description,
      estimatedHours,
      complexity: complexityNumber,
      filesCount,
      commitsCount,
      createdAt: new Date().toISOString(),
    });

    return workItemId;
  }

  /**
   * Clear old history (older than specified days)
   * Note: This is a no-op now as SQLite can handle large datasets efficiently
   * You can implement manual cleanup if needed
   */
  clearOldHistory(daysToKeep: number = 90): void {
    console.log(`Note: Database can handle large datasets efficiently. Manual cleanup not required.`);
    // Could implement if needed:
    // DELETE FROM processed_commits WHERE DATE(processed_at) < DATE('now', '-${daysToKeep} days')
  }

  /**
   * Get statistics
   */
  async getStatistics(scope: AnalysisScope) {
    const [dbStats, processedCommits] = await Promise.all([
      this.db.getStatistics(scope),
      this.db.getProcessedCommits(scope.userId, undefined, 10000),
    ]);

    const projectStats = new Map<string, number>();
    processedCommits.forEach((commit) => {
      const count = projectStats.get(commit.projectPath) || 0;
      projectStats.set(commit.projectPath, count + 1);
    });

    return {
      totalAnalyses: dbStats.totalAnalyses,
      totalCommitsProcessed: dbStats.totalCommitsProcessed,
      totalTasksCreated: dbStats.totalTasksCreated,
      projectStats: Array.from(projectStats.entries()).map(([path, count]) => ({
        path,
        commitsProcessed: count,
      })),
      oldestEntry: processedCommits[processedCommits.length - 1]?.processedAt,
      newestEntry: processedCommits[0]?.processedAt,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
