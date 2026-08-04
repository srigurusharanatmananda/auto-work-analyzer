/**
 * Configuration and manual triggering for the org-wide daily scan.
 *
 * GET /repos deliberately merges live discovery with stored bindings rather than
 * serving a cached list: a repo cloned five minutes ago should appear without a
 * restart, and a repo the user expected but which is skipped should say why.
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { ScanRegistry } from "../scanning/ScanRegistry.js";
import { DailyScanner } from "../scanning/DailyScanner.js";
import { discoverRepos } from "../scanning/RepoDiscovery.js";

export interface ScanningRouterDeps {
  registry: ScanRegistry;
  scanner: DailyScanner;
  discover?: typeof discoverRepos;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createScanningRouter(deps: ScanningRouterDeps): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user!.userId;
  const discover = deps.discover ?? discoverRepos;

  const fail = (res: any, error: string, status = 400): void => {
    res.status(status).json({ success: false, error });
  };

  router.get("/settings", authenticate, (req, res) => {
    res.json({ success: true, data: deps.registry.getSettings(userIdOf(req)) });
  });

  router.put("/settings", authenticate, (req, res) => {
    const { root, owner, authorIdentities, scanTime, enabled } = req.body ?? {};

    if (scanTime !== undefined && !TIME_PATTERN.test(String(scanTime))) {
      return fail(res, "scanTime must be HH:MM in 24-hour local time");
    }
    if (authorIdentities !== undefined && !Array.isArray(authorIdentities)) {
      return fail(res, "authorIdentities must be an array of emails or names");
    }

    res.json({
      success: true,
      data: deps.registry.saveSettings(userIdOf(req), {
        root,
        owner,
        authorIdentities,
        scanTime,
        enabled,
      }),
    });
  });

  router.get("/repos", authenticate, async (req, res) => {
    try {
      const userId = userIdOf(req);
      const settings = deps.registry.getSettings(userId);
      const { repos, skipped } = await discover(settings.root, settings.owner);

      res.json({
        success: true,
        data: {
          repos: repos.map((repo) => {
            const binding = deps.registry.getBinding(userId, repo.slug);
            return {
              slug: repo.slug,
              path: repo.path,
              // Unbound means enabled: a newly cloned repo should be scanned
              // without the user having to opt each one in.
              enabled: binding?.enabled ?? true,
              destinationId: binding?.destinationId ?? null,
              templateId: binding?.templateId ?? null,
              lastScannedDate: binding?.lastScannedDate ?? null,
            };
          }),
          skipped,
        },
      });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "Discovery failed", 500);
    }
  });

  // The slug contains a slash, which a single :param will not match.
  router.put("/repos/:owner/:name", authenticate, (req, res) => {
    const slug = `${req.params.owner}/${req.params.name}`;
    const { destinationId, templateId, enabled } = req.body ?? {};
    res.json({
      success: true,
      data: deps.registry.saveBinding(userIdOf(req), slug, {
        destinationId,
        templateId,
        enabled,
      }),
    });
  });

  /**
   * The last run's summary, including a SCHEDULED one. Without this a scheduled
   * run's failures exist only in the server log, and an unattended job whose
   * errors are invisible is worse than no job.
   */
  router.get("/last-run", authenticate, (req, res) => {
    res.json({ success: true, data: deps.registry.getLastRun(userIdOf(req)) });
  });

  router.post("/run", authenticate, async (req, res) => {
    const { date, dryRun } = req.body ?? {};
    if (date !== undefined && !DATE_PATTERN.test(String(date))) {
      return fail(res, "date must be YYYY-MM-DD");
    }

    try {
      const userId = userIdOf(req);
      const summary = await deps.scanner.run(userId, {
        date: date ?? new Date().toISOString().split("T")[0]!,
        dryRun: dryRun === true ? true : undefined,
      });
      // A dry run is not a run: persisting it would overwrite the last real
      // run's summary, hiding the failures the user actually needs to see.
      if (!summary.dryRun) deps.registry.saveRun(userId, summary);
      res.json({ success: true, data: summary });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "Scan failed", 500);
    }
  });

  return router;
}
