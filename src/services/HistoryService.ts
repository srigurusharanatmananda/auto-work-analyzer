/**
 * History Service for tracking processed commits and created tasks
 * Now uses SQLite database instead of JSON files
 */

import { GitCommit } from '../types/index.js';
import { DatabaseService, AnalysisRecord, ProcessedCommitRecord } from './DatabaseService.js';

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

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Get all processed commits
   */
  getProcessedCommits(): ProcessedCommit[] {
    return this.db.getProcessedCommits();
  }

  /**
   * Check if a commit has already been processed
   */
  isCommitProcessed(commitHash: string, projectPath?: string): boolean {
    return this.db.isCommitProcessed(commitHash, projectPath);
  }

  /**
   * Filter out already processed commits
   *
   * `projectPath` is accepted for call-site compatibility and ignored: dedup is
   * keyed on the commit hash alone. See DatabaseService.isCommitProcessed.
   */
  filterUnprocessedCommits(commits: GitCommit[], projectPath?: string): GitCommit[] {
    return commits.filter((commit) => !this.isCommitProcessed(commit.hash, projectPath));
  }

  /**
   * Mark commits as processed
   */
  markCommitsAsProcessed(
    commits: GitCommit[],
    projectPath: string,
    taskMapping?: Map<string, { id: string; name: string }>
  ): void {
    commits.forEach((commit) => {
      const task = taskMapping?.get(commit.hash);
      const processedCommit: ProcessedCommitRecord = {
        hash: commit.hash,
        date: commit.date,
        author: commit.author,
        message: commit.message,
        processedAt: new Date().toISOString(),
        projectPath,
        taskId: task?.id,
        taskName: task?.name,
      };
      this.db.markCommitAsProcessed(processedCommit);
    });
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(limit: number = 50): AnalysisHistory[] {
    return this.db.getAnalysisHistory(limit);
  }

  /**
   * Add analysis to history
   */
  addAnalysisHistory(analysis: Omit<AnalysisHistory, 'id' | 'timestamp'>): string {
    const newEntry: AnalysisRecord = {
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...analysis,
    };

    this.db.saveAnalysis(newEntry);
    return newEntry.id;
  }

  /**
   * Save work item to database
   */
  saveWorkItem(
    analysisId: string,
    workItemName: string,
    workItemType: string,
    description: string,
    estimatedHours: number,
    complexity: string,
    filesCount: number,
    commitsCount: number
  ): string {
    const workItemId = `work-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map complexity string to number (1=low, 2=medium, 3=high)
    const complexityNumber = complexity === 'high' ? 3 : complexity === 'medium' ? 2 : 1;

    this.db.saveWorkItem({
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
  getStatistics() {
    const dbStats = this.db.getStatistics();
    const processedCommits = this.db.getProcessedCommits(undefined, 10000);

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
