/**
 * Database Service Interface
 *
 * Abstraction layer for database operations to enable easy migration
 * between different database systems (SQLite, PostgreSQL, MySQL, etc.)
 */

/**
 * Who a stored analysis belongs to, and what they may see.
 *
 * `analysis_history` had no owner column at all, so `GET /api/reports` and
 * `GET /api/history` returned every user's rows to any authenticated caller.
 * Reads now take a scope rather than defaulting to "everything", so a caller
 * has to say whose data it wants and cannot omit the question by accident.
 *
 * `includeUnowned` covers rows written before the column existed and rows
 * written by the machine paths that have no user — the webhook, driven by a
 * shared secret rather than a session. Attributing those to an arbitrary
 * account would be a guess; hiding them from everyone would lose them. They
 * are shown to admins.
 */
export interface AnalysisScope {
  userId: string;
  includeUnowned?: boolean;
}

export interface AnalysisRecord {
  id: string;
  /** Undefined for legacy rows and for machine-driven runs with no session. */
  userId?: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  branch?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

export interface WorkItemRecord {
  id: string;
  analysisId: string;
  name: string;
  type: string;
  description: string;
  estimatedHours: number;
  complexity: number;
  filesCount: number;
  commitsCount: number;
  createdAt: string;
}

export interface ProcessedCommitRecord {
  hash: string;
  /**
   * Whose ledger this row belongs to, or `LEGACY_COMMIT_OWNER` for rows written
   * before dedup was scoped. Required on writes: an omitted owner used to mean
   * "everyone", and silently defaulting to that is how a missed call site keeps
   * the old shared behaviour without anyone noticing.
   */
  userId: string;
  date: string;
  author: string;
  message: string;
  projectPath: string;
  processedAt: string;
  taskId?: string;
  taskName?: string;
}

export interface DatabaseStatistics {
  totalAnalyses: number;
  totalCommitsProcessed: number;
  totalTasksCreated: number;
  totalWorkItems: number;
  projectsAnalyzed: number;
}

/**
 * Database Service Interface
 *
 * Implement this interface to create a new database adapter
 */
export interface IDatabaseService {
  // ==================== Analysis History Methods ====================

  /**
   * Save analysis history
   */
  saveAnalysis(analysis: AnalysisRecord): Promise<void>;

  /**
   * Get analysis history with pagination
   */
  getAnalysisHistory(
    scope: AnalysisScope,
    limit?: number,
    offset?: number
  ): Promise<AnalysisRecord[]>;

  /**
   * Get analysis by ID
   */
  getAnalysisById(id: string, scope: AnalysisScope): Promise<AnalysisRecord | undefined>;

  /**
   * Get analysis statistics
   */
  getStatistics(scope: AnalysisScope): Promise<DatabaseStatistics>;

  // ==================== Work Items Methods ====================

  /**
   * Save work item
   */
  saveWorkItem(workItem: WorkItemRecord): Promise<void>;

  /**
   * Get work items for an analysis
   */
  getWorkItemsByAnalysis(analysisId: string): Promise<WorkItemRecord[]>;

  // ==================== Processed Commits Methods ====================

  /**
   * Mark commit as processed
   */
  markCommitAsProcessed(commit: ProcessedCommitRecord): Promise<void>;

  /**
   * Check if commit is processed
   */
  isCommitProcessed(hash: string, userId: string): Promise<boolean>;

  /**
   * Get processed commits
   */
  getProcessedCommits(
    userId: string,
    projectPath?: string,
    limit?: number
  ): Promise<ProcessedCommitRecord[]>;

  /** Every user's rows. Admin export only — see allAnalysesUnscoped. */
  allProcessedCommitsUnscoped(limit?: number): Promise<ProcessedCommitRecord[]>;

  // ==================== Utility Methods ====================

  /**
   * Clear all data (use with caution!)
   */
  clearAllData(): Promise<void>;

  /**
   * Close database connection
   */
  close(): void;

  /**
   * Export data to JSON (for backup)
   */
  exportToJSON(): Promise<{
    analyses: AnalysisRecord[];
    processedCommits: ProcessedCommitRecord[];
  }>;
}
