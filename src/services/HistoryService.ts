/**
 * History Service for tracking processed commits and created tasks
 */

import fs from 'fs';
import path from 'path';
import { GitCommit, DetectedWork } from '../types/index.js';

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
  private historyDir: string;
  private processedCommitsFile: string;
  private analysisHistoryFile: string;

  constructor() {
    this.historyDir = path.join(process.cwd(), '.history');
    this.processedCommitsFile = path.join(this.historyDir, 'processed-commits.json');
    this.analysisHistoryFile = path.join(this.historyDir, 'analysis-history.json');
    this.ensureHistoryDir();
  }

  private ensureHistoryDir(): void {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }

    if (!fs.existsSync(this.processedCommitsFile)) {
      fs.writeFileSync(this.processedCommitsFile, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(this.analysisHistoryFile)) {
      fs.writeFileSync(this.analysisHistoryFile, JSON.stringify([], null, 2));
    }
  }

  /**
   * Get all processed commits
   */
  getProcessedCommits(): ProcessedCommit[] {
    try {
      const data = fs.readFileSync(this.processedCommitsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading processed commits:', error);
      return [];
    }
  }

  /**
   * Check if a commit has already been processed
   */
  isCommitProcessed(commitHash: string, projectPath: string): boolean {
    const processedCommits = this.getProcessedCommits();
    return processedCommits.some(
      (commit) => commit.hash === commitHash && commit.projectPath === projectPath
    );
  }

  /**
   * Filter out already processed commits
   */
  filterUnprocessedCommits(commits: GitCommit[], projectPath: string): GitCommit[] {
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
    const processedCommits = this.getProcessedCommits();

    const newProcessed: ProcessedCommit[] = commits.map((commit) => {
      const task = taskMapping?.get(commit.hash);
      return {
        hash: commit.hash,
        date: commit.date,
        author: commit.author,
        message: commit.message,
        processedAt: new Date().toISOString(),
        projectPath,
        taskId: task?.id,
        taskName: task?.name,
      };
    });

    processedCommits.push(...newProcessed);

    // Keep only last 10,000 commits (to prevent file from growing too large)
    const trimmed = processedCommits.slice(-10000);

    fs.writeFileSync(this.processedCommitsFile, JSON.stringify(trimmed, null, 2));
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(limit: number = 50): AnalysisHistory[] {
    try {
      const data = fs.readFileSync(this.analysisHistoryFile, 'utf-8');
      const history: AnalysisHistory[] = JSON.parse(data);
      return history.slice(-limit).reverse(); // Return most recent first
    } catch (error) {
      console.error('Error reading analysis history:', error);
      return [];
    }
  }

  /**
   * Add analysis to history
   */
  addAnalysisHistory(analysis: Omit<AnalysisHistory, 'id' | 'timestamp'>): void {
    const history = this.getAnalysisHistory(10000);

    const newEntry: AnalysisHistory = {
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...analysis,
    };

    history.unshift(newEntry); // Add to beginning

    // Keep only last 1000 analyses
    const trimmed = history.slice(0, 1000);

    fs.writeFileSync(this.analysisHistoryFile, JSON.stringify(trimmed, null, 2));
  }

  /**
   * Clear old history (older than specified days)
   */
  clearOldHistory(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();

    // Clear old processed commits
    const processedCommits = this.getProcessedCommits();
    const recentCommits = processedCommits.filter((commit) => {
      const commitDate = new Date(commit.processedAt).getTime();
      return commitDate >= cutoffTime;
    });
    fs.writeFileSync(this.processedCommitsFile, JSON.stringify(recentCommits, null, 2));

    // Clear old analysis history
    const history = this.getAnalysisHistory(10000);
    const recentHistory = history.filter((entry) => {
      const entryDate = new Date(entry.timestamp).getTime();
      return entryDate >= cutoffTime;
    });
    fs.writeFileSync(this.analysisHistoryFile, JSON.stringify(recentHistory, null, 2));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const processedCommits = this.getProcessedCommits();
    const history = this.getAnalysisHistory(10000);

    const totalAnalyses = history.length;
    const totalCommitsProcessed = processedCommits.length;
    const totalTasksCreated = history.reduce((sum, entry) => sum + entry.tasksCreated, 0);

    const projectStats = new Map<string, number>();
    processedCommits.forEach((commit) => {
      const count = projectStats.get(commit.projectPath) || 0;
      projectStats.set(commit.projectPath, count + 1);
    });

    return {
      totalAnalyses,
      totalCommitsProcessed,
      totalTasksCreated,
      projectStats: Array.from(projectStats.entries()).map(([path, count]) => ({
        path,
        commitsProcessed: count,
      })),
      oldestEntry: processedCommits[0]?.processedAt,
      newestEntry: processedCommits[processedCommits.length - 1]?.processedAt,
    };
  }
}
