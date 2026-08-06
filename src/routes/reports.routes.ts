/**
 * Saved analyses: history, reports, and the endpoint that writes them.
 *
 * Lifted out of the inline handlers in webhook-server.ts, which self-starts a
 * server on import and so could not be tested at all. The behaviour is
 * unchanged except for the thing this move exists to fix: every read is now
 * scoped to the calling user.
 *
 * `analysis_history` had no owner column, so GET /api/reports, GET
 * /api/reports/:id and GET /api/history returned every user's rows to any
 * authenticated caller — a leak that no amount of role checking could close,
 * because the question is not "what may you do" but "whose data is this".
 *
 * Rows written before the column existed, and rows written by the
 * secret-authenticated webhook (which has no session), have a null owner.
 * Attributing them to an arbitrary account would be a guess and hiding them
 * from everyone would lose them, so they are shown to admins and to nobody
 * else.
 */
import { Router, Request, Response } from 'express';
import { DatabaseService, AnalysisScope } from '../services/DatabaseService.js';
import { HistoryService } from '../services/HistoryService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';

export interface ReportsRouterDeps {
  /** Overridden in tests; each call gets a fresh connection, as before. */
  databaseFactory?: () => DatabaseService;
  historyFactory?: () => HistoryService;
}

/** Reports belong to the caller. Admins additionally see unowned legacy rows. */
function scopeFor(req: Request): AnalysisScope {
  return {
    userId: req.user!.userId,
    includeUnowned: req.user!.role === 'admin',
  };
}

export function createReportsRouter(deps: ReportsRouterDeps = {}): Router {
  const router = Router();
  const newDatabase = deps.databaseFactory ?? (() => new DatabaseService());
  const newHistory = deps.historyFactory ?? (() => new HistoryService());

  router.get('/history', authenticate, anyRole, async (req: Request, res: Response) => {
    const historyService = newHistory();
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const scope = scopeFor(req);

      // Awaited into locals before the response is assembled. res.json takes
      // `any`, so an un-awaited Promise here serialises as {} — a 200 with an
      // empty body and nothing thrown.
      const [history, statistics] = await Promise.all([
        historyService.getAnalysisHistory(scope, limit),
        historyService.getStatistics(scope),
      ]);

      res.json({ success: true, data: { history, statistics } });
    } catch (error) {
      console.error('Failed to get history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve history',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      historyService.close();
    }
  });

  router.post('/save-report', authenticate, anyRole, async (req: Request, res: Response) => {
    const { projectPath, date, endDate, author, workItems, summary } = req.body;

    if (!projectPath || !date || !workItems || !Array.isArray(workItems)) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: projectPath, date, and workItems array are required',
      });
      return;
    }

    const historyService = newHistory();
    try {
      const analysisId = await historyService.addAnalysisHistory(req.user!.userId, {
        projectPath,
        date,
        endDate,
        author,
        totalCommits: summary?.totalCommits || 0,
        totalWorkItems: workItems.length,
        tasksCreated: 0, // Reports don't create tasks
        summary: summary?.summary || `Report generated for ${date}`,
      });

      let savedCount = 0;
      for (const item of workItems) {
        if (item.name && item.type) {
          await historyService.saveWorkItem(
            analysisId,
            item.name,
            item.type,
            item.description || '',
            item.estimatedHours || 0,
            item.complexity || 'medium',
            item.filesCount || 0,
            item.commitsCount || 0
          );
          savedCount++;
        }
      }

      res.json({
        success: true,
        data: { analysisId, savedWorkItems: savedCount },
        message: `Report saved successfully with ${savedCount} work items`,
      });
    } catch (error) {
      console.error('Failed to save report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save report',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      historyService.close();
    }
  });

  router.get('/reports', authenticate, anyRole, async (req: Request, res: Response) => {
    const db = newDatabase();
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const scope = scopeFor(req);

      // Both reads are independent, so one round trip's latency instead of two.
      const [reports, stats] = await Promise.all([
        db.getPaginatedReports(scope, limit, offset),
        db.getStatistics(scope),
      ]);

      res.json({
        success: true,
        data: {
          reports,
          // A full page might mean there is more; it is a hint, not a count.
          hasMore: reports.length === limit,
          total: stats.totalAnalyses,
        },
      });
    } catch (error) {
      console.error('Failed to get reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve reports',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      db.close();
    }
  });

  router.get('/reports/:id', authenticate, anyRole, async (req: Request, res: Response) => {
    const db = newDatabase();
    try {
      // Scoped in the query, so another user's report is indistinguishable from
      // one that does not exist. A 403 would confirm the id is real.
      const report = await db.getCompleteReport(req.params.id, scopeFor(req));

      if (!report) {
        res.status(404).json({ success: false, error: 'Report not found' });
        return;
      }

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Failed to get report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve report',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      db.close();
    }
  });

  return router;
}

export default createReportsRouter;
