/**
 * Database Service using SQLite
 * Replaces JSON file-based storage with a proper database
 *
 * Implements IDatabaseService interface for easy migration to other databases
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  IDatabaseService,
  AnalysisRecord,
  WorkItemRecord,
  ProcessedCommitRecord,
  DatabaseStatistics,
} from './IDatabaseService.js';

// Re-export types for backwards compatibility
export type { AnalysisRecord, WorkItemRecord, ProcessedCommitRecord };

export class DatabaseService implements IDatabaseService {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Create .database directory if it doesn't exist
    const dbDir = path.join(process.cwd(), '.database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = dbPath || path.join(dbDir, 'auto-work-analyzer.db');
    this.db = new Database(this.dbPath);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    // Analysis history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        project_path TEXT NOT NULL,
        date TEXT NOT NULL,
        end_date TEXT,
        author TEXT,
        branch TEXT,
        total_commits INTEGER NOT NULL,
        total_work_items INTEGER NOT NULL,
        tasks_created INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Work items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        estimated_hours REAL NOT NULL DEFAULT 0,
        complexity INTEGER NOT NULL DEFAULT 0,
        files_count INTEGER NOT NULL DEFAULT 0,
        commits_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (analysis_id) REFERENCES analysis_history(id) ON DELETE CASCADE
      )
    `);

    // Processed commits table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_commits (
        hash TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        author TEXT NOT NULL,
        message TEXT NOT NULL,
        project_path TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        task_id TEXT,
        task_name TEXT
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_timestamp ON analysis_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_history(project_path);
      CREATE INDEX IF NOT EXISTS idx_work_items_analysis ON work_items(analysis_id);
      CREATE INDEX IF NOT EXISTS idx_processed_commits_project ON processed_commits(project_path);
      CREATE INDEX IF NOT EXISTS idx_processed_commits_date ON processed_commits(date);
    `);
  }

  // ==================== Analysis History Methods ====================

  /**
   * Save analysis history
   */
  saveAnalysis(analysis: AnalysisRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO analysis_history (
        id, timestamp, project_path, date, end_date, author, branch,
        total_commits, total_work_items, tasks_created, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      analysis.id,
      analysis.timestamp,
      analysis.projectPath,
      analysis.date,
      analysis.endDate || null,
      analysis.author || null,
      analysis.branch || null,
      analysis.totalCommits,
      analysis.totalWorkItems,
      analysis.tasksCreated,
      analysis.summary
    );
  }

  /**
   * Get analysis history with pagination
   */
  getAnalysisHistory(limit: number = 50, offset: number = 0): AnalysisRecord[] {
    const stmt = this.db.prepare(`
      SELECT
        id, timestamp, project_path as projectPath, date, end_date as endDate,
        author, branch, total_commits as totalCommits,
        total_work_items as totalWorkItems, tasks_created as tasksCreated, summary
      FROM analysis_history
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(limit, offset) as AnalysisRecord[];
  }

  /**
   * Get analysis by ID
   */
  getAnalysisById(id: string): AnalysisRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT
        id, timestamp, project_path as projectPath, date, end_date as endDate,
        author, branch, total_commits as totalCommits,
        total_work_items as totalWorkItems, tasks_created as tasksCreated, summary
      FROM analysis_history
      WHERE id = ?
    `);

    return stmt.get(id) as AnalysisRecord | undefined;
  }

  /**
   * Get analysis statistics
   */
  getStatistics(): DatabaseStatistics {
    const result = this.db.prepare(`
      SELECT
        COUNT(*) as totalAnalyses,
        SUM(total_commits) as totalCommitsProcessed,
        SUM(tasks_created) as totalTasksCreated,
        SUM(total_work_items) as totalWorkItems,
        COUNT(DISTINCT project_path) as projectsAnalyzed
      FROM analysis_history
    `).get() as any;

    return {
      totalAnalyses: result.totalAnalyses || 0,
      totalCommitsProcessed: result.totalCommitsProcessed || 0,
      totalTasksCreated: result.totalTasksCreated || 0,
      totalWorkItems: result.totalWorkItems || 0,
      projectsAnalyzed: result.projectsAnalyzed || 0,
    };
  }

  // ==================== Work Items Methods ====================

  /**
   * Save work item
   */
  saveWorkItem(workItem: WorkItemRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO work_items (
        id, analysis_id, name, type, description,
        estimated_hours, complexity, files_count, commits_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      workItem.id,
      workItem.analysisId,
      workItem.name,
      workItem.type,
      workItem.description || null,
      workItem.estimatedHours,
      workItem.complexity,
      workItem.filesCount,
      workItem.commitsCount
    );
  }

  /**
   * Get work items for an analysis
   */
  getWorkItemsByAnalysis(analysisId: string): WorkItemRecord[] {
    const stmt = this.db.prepare(`
      SELECT
        id, analysis_id as analysisId, name, type, description,
        estimated_hours as estimatedHours, complexity,
        files_count as filesCount, commits_count as commitsCount, created_at as createdAt
      FROM work_items
      WHERE analysis_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(analysisId) as WorkItemRecord[];
  }

  // ==================== Processed Commits Methods ====================

  /**
   * Mark commit as processed
   */
  markCommitAsProcessed(commit: ProcessedCommitRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO processed_commits (
        hash, date, author, message, project_path, processed_at, task_id, task_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      commit.hash,
      commit.date,
      commit.author,
      commit.message,
      commit.projectPath,
      commit.processedAt,
      commit.taskId || null,
      commit.taskName || null
    );
  }

  /**
   * Check if commit is processed
   */
  isCommitProcessed(hash: string, projectPath: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM processed_commits
      WHERE hash = ? AND project_path = ?
    `);

    return stmt.get(hash, projectPath) !== undefined;
  }

  /**
   * Get processed commits
   */
  getProcessedCommits(projectPath?: string, limit: number = 100): ProcessedCommitRecord[] {
    let query = `
      SELECT
        hash, date, author, message, project_path as projectPath,
        processed_at as processedAt, task_id as taskId, task_name as taskName
      FROM processed_commits
    `;

    if (projectPath) {
      query += ` WHERE project_path = ?`;
    }

    query += ` ORDER BY processed_at DESC LIMIT ?`;

    const stmt = this.db.prepare(query);
    const params = projectPath ? [projectPath, limit] : [limit];

    return stmt.all(...params) as ProcessedCommitRecord[];
  }

  // ==================== Utility Methods ====================

  /**
   * Clear all data (use with caution!)
   */
  clearAllData(): void {
    this.db.exec(`
      DELETE FROM work_items;
      DELETE FROM processed_commits;
      DELETE FROM analysis_history;
    `);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database path
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Export data to JSON (for backup)
   */
  exportToJSON(): {
    analyses: AnalysisRecord[];
    processedCommits: ProcessedCommitRecord[];
  } {
    const analyses = this.getAnalysisHistory(10000); // Get all
    const processedCommits = this.getProcessedCommits(undefined, 10000); // Get all

    return {
      analyses,
      processedCommits,
    };
  }
}
