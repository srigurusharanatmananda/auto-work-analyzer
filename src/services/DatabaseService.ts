/**
 * Analyses, work items, and the processed-commit ledger, on Postgres.
 *
 * Implements IDatabaseService, whose whole purpose was to make exactly this
 * move possible.
 *
 * Two Postgres details this file has to get right, both of which fail silently
 * rather than loudly if ignored:
 *
 *  - **Column aliases are folded to lower case unless quoted.** `AS userId`
 *    yields a property called `userid`, so every camelCase field would arrive
 *    undefined and every read would look like a row of empty values. Every
 *    alias below is quoted.
 *  - **SUM() returns NULL over zero rows, and numeric as a string.** The
 *    statistics reads coalesce and cast, so a user with no analyses gets 0
 *    rather than null, and callers get numbers rather than "0".
 */

import postgres from 'postgres';
import { getPool } from '../db/pool.js';
import type { PostgresHandle } from '../db/client.js';
import { LEGACY_COMMIT_OWNER } from '../db/schema.js';
import {
  IDatabaseService,
  AnalysisRecord,
  AnalysisScope,
  WorkItemRecord,
  ProcessedCommitRecord,
  DatabaseStatistics,
} from './IDatabaseService.js';

// Re-export types for backwards compatibility
export type { AnalysisRecord, AnalysisScope, WorkItemRecord, ProcessedCommitRecord };

/** The analysis column list, aliased once so the four readers cannot drift. */
const ANALYSIS_COLUMNS = `
  id, user_id as "userId", timestamp, project_path as "projectPath", date,
  end_date as "endDate", author, branch, total_commits as "totalCommits",
  total_work_items as "totalWorkItems", tasks_created as "tasksCreated", summary
`;

interface RawStatistics {
  totalAnalyses: number;
  totalCommitsProcessed: number;
  totalTasksCreated: number;
  totalWorkItems: number;
  projectsAnalyzed: number;
}

export class DatabaseService implements IDatabaseService {
  private readonly injected?: PostgresHandle;

  constructor(pg?: PostgresHandle) {
    this.injected = pg;
  }

  /**
   * Resolved on first query, not in the constructor.
   *
   * Two reasons, both load-bearing: constructing a store must not require a
   * reachable database (several call sites build one and never query it), and
   * a handle captured at construction would ignore a later `setPool` — which is
   * how the tests point the shared pool at an isolated schema.
   */
  private get sql(): postgres.Sql {
    return (this.injected ?? getPool()).sql;
  }

  /**
   * The ownership predicate for a scoped read, as a composable fragment.
   *
   * postgres.js fragments carry their own parameters, so the SQL and its values
   * cannot drift apart — the failure mode of hand-assembling them is a query
   * that silently matches everything.
   */
  private scopeClause(scope: AnalysisScope) {
    return scope.includeUnowned
      ? this.sql`(user_id = ${scope.userId} OR user_id IS NULL)`
      : this.sql`user_id = ${scope.userId}`;
  }

  /**
   * Every analysis, ignoring ownership.
   *
   * Only for the two callers that legitimately have no user: `exportToJSON`
   * (a whole-database dump) and the one-off JSON→SQLite migration script's
   * summary. Named unmistakably so it cannot be reached for by mistake from a
   * request handler — those must go through a scope.
   */
  async allAnalysesUnscoped(limit: number = 10000, offset: number = 0): Promise<AnalysisRecord[]> {
    return (await this.sql`
      SELECT ${this.sql.unsafe(ANALYSIS_COLUMNS)}
        FROM analysis_history
       ORDER BY timestamp DESC
       LIMIT ${limit} OFFSET ${offset}
    `) as unknown as AnalysisRecord[];
  }

  /** Whole-database totals, ignoring ownership. See allAnalysesUnscoped. */
  async globalStatisticsUnscoped(): Promise<DatabaseStatistics> {
    const [result] = await this.sql<RawStatistics[]>`
      SELECT
        COUNT(*)::int                            as "totalAnalyses",
        COALESCE(SUM(total_commits), 0)::int     as "totalCommitsProcessed",
        COALESCE(SUM(tasks_created), 0)::int     as "totalTasksCreated",
        COALESCE(SUM(total_work_items), 0)::int  as "totalWorkItems",
        COUNT(DISTINCT project_path)::int        as "projectsAnalyzed"
      FROM analysis_history
    `;
    return { ...result! };
  }

  // ==================== Analysis History Methods ====================

  /**
   * `userId` becomes null rather than a placeholder when absent: an unowned row
   * is a real state (the secret-authenticated webhook has no user), and null is
   * exactly what the read predicate's `includeUnowned` branch looks for.
   */
  async saveAnalysis(analysis: AnalysisRecord): Promise<void> {
    await this.sql`
      INSERT INTO analysis_history (
        id, user_id, timestamp, project_path, date, end_date, author, branch,
        total_commits, total_work_items, tasks_created, summary
      ) VALUES (
        ${analysis.id},
        ${analysis.userId || null},
        ${analysis.timestamp},
        ${analysis.projectPath},
        ${analysis.date},
        ${analysis.endDate || null},
        ${analysis.author || null},
        ${analysis.branch || null},
        ${analysis.totalCommits},
        ${analysis.totalWorkItems},
        ${analysis.tasksCreated},
        ${analysis.summary}
      )
    `;
  }

  async getAnalysisHistory(
    scope: AnalysisScope,
    limit: number = 50,
    offset: number = 0
  ): Promise<AnalysisRecord[]> {
    return (await this.sql`
      SELECT ${this.sql.unsafe(ANALYSIS_COLUMNS)}
        FROM analysis_history
       WHERE ${this.scopeClause(scope)}
       ORDER BY timestamp DESC
       LIMIT ${limit} OFFSET ${offset}
    `) as unknown as AnalysisRecord[];
  }

  async getAnalysisById(id: string, scope: AnalysisScope): Promise<AnalysisRecord | undefined> {
    // The scope is part of the WHERE clause rather than a check on the result,
    // so someone else's id reads as "no such report" — the same 404 an id that
    // does not exist produces. A 403 here would confirm the id is real.
    const rows = (await this.sql`
      SELECT ${this.sql.unsafe(ANALYSIS_COLUMNS)}
        FROM analysis_history
       WHERE id = ${id} AND ${this.scopeClause(scope)}
    `) as unknown as AnalysisRecord[];

    return rows[0];
  }

  async getStatistics(scope: AnalysisScope): Promise<DatabaseStatistics> {
    const [result] = (await this.sql`
      SELECT
        COUNT(*)::int                            as "totalAnalyses",
        COALESCE(SUM(total_commits), 0)::int     as "totalCommitsProcessed",
        COALESCE(SUM(tasks_created), 0)::int     as "totalTasksCreated",
        COALESCE(SUM(total_work_items), 0)::int  as "totalWorkItems",
        COUNT(DISTINCT project_path)::int        as "projectsAnalyzed"
      FROM analysis_history
      WHERE ${this.scopeClause(scope)}
    `) as unknown as RawStatistics[];

    return { ...result! };
  }

  // ==================== Work Items Methods ====================

  async saveWorkItem(workItem: WorkItemRecord): Promise<void> {
    await this.sql`
      INSERT INTO work_items (
        id, analysis_id, name, type, description,
        estimated_hours, complexity, files_count, commits_count
      ) VALUES (
        ${workItem.id}, ${workItem.analysisId}, ${workItem.name}, ${workItem.type},
        ${workItem.description || null}, ${workItem.estimatedHours}, ${workItem.complexity},
        ${workItem.filesCount}, ${workItem.commitsCount}
      )
    `;
  }

  async getWorkItemsByAnalysis(analysisId: string): Promise<WorkItemRecord[]> {
    // estimated_hours is `real`, which postgres.js returns as a number; the
    // integer counts are cast so a future numeric widening cannot start
    // returning strings to callers that do arithmetic on them.
    return (await this.sql`
      SELECT
        id, analysis_id as "analysisId", name, type, description,
        estimated_hours as "estimatedHours", complexity::int as complexity,
        files_count::int as "filesCount", commits_count::int as "commitsCount",
        created_at as "createdAt"
      FROM work_items
      WHERE analysis_id = ${analysisId}
      ORDER BY created_at DESC
    `) as unknown as WorkItemRecord[];
  }

  async getCompleteReport(
    analysisId: string,
    scope: AnalysisScope
  ): Promise<{ analysis: AnalysisRecord; workItems: WorkItemRecord[] } | null> {
    const analysis = await this.getAnalysisById(analysisId, scope);
    if (!analysis) {
      return null;
    }

    const workItems = await this.getWorkItemsByAnalysis(analysisId);

    return { analysis, workItems };
  }

  async getPaginatedReports(
    scope: AnalysisScope,
    limit: number = 10,
    offset: number = 0
  ): Promise<Array<{ analysis: AnalysisRecord; workItems: WorkItemRecord[] }>> {
    // Work items are reached only through an analysis the scope already
    // admitted, so they need no predicate of their own.
    const analyses = await this.getAnalysisHistory(scope, limit, offset);

    // Concurrent rather than sequential: this renders a page of ten reports,
    // and ten serial round trips is a visible delay where one batch is not.
    return Promise.all(
      analyses.map(async (analysis) => ({
        analysis,
        workItems: await this.getWorkItemsByAnalysis(analysis.id),
      }))
    );
  }

  // ==================== Processed Commits Methods ====================

  async markCommitAsProcessed(commit: ProcessedCommitRecord): Promise<void> {
    // SQLite's INSERT OR REPLACE. The Postgres spelling is an explicit upsert,
    // which is also the more honest one: OR REPLACE deletes and re-inserts,
    // silently dropping any column the new row does not mention.
    await this.sql`
      INSERT INTO processed_commits (
        hash, user_id, date, author, message, project_path, processed_at, task_id, task_name
      ) VALUES (
        ${commit.hash}, ${commit.userId}, ${commit.date}, ${commit.author}, ${commit.message},
        ${commit.projectPath}, ${commit.processedAt},
        ${commit.taskId || null}, ${commit.taskName || null}
      )
      ON CONFLICT (user_id, hash) DO UPDATE SET
        date = excluded.date,
        author = excluded.author,
        message = excluded.message,
        project_path = excluded.project_path,
        processed_at = excluded.processed_at,
        task_id = excluded.task_id,
        task_name = excluded.task_name
    `;
  }

  /**
   * Keyed on (user, hash) — never on the path.
   *
   * Two clones of one repository must still dedup against each other for the
   * same user: this predicate once filtered on project_path while writes used
   * INSERT OR REPLACE, so two clones flip-flopped forever, each run re-creating
   * the other's commits. `project_path` stays on the row as provenance and is
   * simply not part of the identity.
   *
   * The legacy owner matches everyone. Those rows record only that the commit
   * was filed at all, before anyone tracked by whom; excluding them would make
   * the first scan after this change re-file every commit in history.
   */
  async isCommitProcessed(hash: string, userId: string): Promise<boolean> {
    const rows = await this.sql`
      SELECT 1 FROM processed_commits
       WHERE hash = ${hash}
         AND user_id IN (${userId}, ${LEGACY_COMMIT_OWNER})
    `;
    return rows.length > 0;
  }

  async getProcessedCommits(
    userId: string,
    projectPath?: string,
    limit: number = 100
  ): Promise<ProcessedCommitRecord[]> {
    return (await this.sql`
      SELECT
        hash, user_id as "userId", date, author, message,
        project_path as "projectPath", processed_at as "processedAt",
        task_id as "taskId", task_name as "taskName"
      FROM processed_commits
      WHERE user_id IN (${userId}, ${LEGACY_COMMIT_OWNER})
      ${projectPath ? this.sql`AND project_path = ${projectPath}` : this.sql``}
      ORDER BY processed_at DESC
      LIMIT ${limit}
    `) as unknown as ProcessedCommitRecord[];
  }

  /**
   * Every user's rows. For the admin JSON export only — the same exemption
   * `allAnalysesUnscoped` carries, and named the same way so an unscoped read
   * is never something you reach by accident.
   */
  async allProcessedCommitsUnscoped(limit: number = 10000): Promise<ProcessedCommitRecord[]> {
    return (await this.sql`
      SELECT
        hash, user_id as "userId", date, author, message,
        project_path as "projectPath", processed_at as "processedAt",
        task_id as "taskId", task_name as "taskName"
      FROM processed_commits
      ORDER BY processed_at DESC
      LIMIT ${limit}
    `) as unknown as ProcessedCommitRecord[];
  }

  // ==================== Utility Methods ====================

  /** Clear all data (use with caution!) */
  async clearAllData(): Promise<void> {
    // One statement so the foreign key from work_items is never briefly
    // violated, and CASCADE because analysis_history is referenced.
    await this.sql`
      TRUNCATE work_items, processed_commits, analysis_history CASCADE
    `;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared, so a store closing it
   * would disconnect the rest of the process.
   */
  close(): void {}

  async exportToJSON(): Promise<{
    analyses: AnalysisRecord[];
    processedCommits: ProcessedCommitRecord[];
  }> {
    const [analyses, processedCommits] = await Promise.all([
      this.allAnalysesUnscoped(10000),
      this.allProcessedCommitsUnscoped(10000),
    ]);

    return { analyses, processedCommits };
  }
}
