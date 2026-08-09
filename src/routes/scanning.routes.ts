/**
 * Configuration and manual triggering for the org-wide daily scan.
 *
 * GET /repos deliberately merges live discovery with stored bindings rather than
 * serving a cached list: a repo cloned five minutes ago should appear without a
 * restart, and a repo the user expected but which is skipped should say why.
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { anyRole } from "../middleware/policy.js";
import { ScanRegistry } from "../scanning/ScanRegistry.js";
import { DailyScanner } from "../scanning/DailyScanner.js";
import { discoverRepos } from "../scanning/RepoDiscovery.js";
import { ScanLeaseStore } from "../scanning/ScanLeaseStore.js";
import { localDate } from "../scanning/scanDate.js";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

export interface ScanningRouterDeps {
  registry: ScanRegistry;
  scanner: DailyScanner;
  discover?: typeof discoverRepos;
  /**
   * The same lease the scheduler uses, and it must be the same table.
   *
   * A manual run that did not claim would be a second scan of a day the
   * scheduler is already scanning, duplicating every task — the exact hole the
   * lease closed between two schedulers, reopened between a scheduler and a
   * person. Injected so tests can point it at their schema.
   */
  leases?: ScanLeaseStore;
  /** This process's identity in the lease table. See `ScanScheduler`. */
  owner?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createScanningRouter(deps: ScanningRouterDeps): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user!.userId;
  const discover = deps.discover ?? discoverRepos;
  const leases = deps.leases ?? new ScanLeaseStore();
  const leaseOwner = deps.owner ?? `${hostname()}:manual:${randomUUID()}`;

  const fail = (res: any, error: string, status = 400): void => {
    res.status(status).json({ success: false, error });
  };

  router.get("/settings", authenticate, anyRole, async (req, res) => {
    res.json({ success: true, data: await deps.registry.getSettings(userIdOf(req)) });
  });

  router.put("/settings", authenticate, anyRole, async (req, res) => {
    const { root, owner, authorIdentities, scanTime, enabled } = req.body ?? {};

    if (scanTime !== undefined && !TIME_PATTERN.test(String(scanTime))) {
      return fail(res, "scanTime must be HH:MM in 24-hour local time");
    }
    if (authorIdentities !== undefined && !Array.isArray(authorIdentities)) {
      return fail(res, "authorIdentities must be an array of emails or names");
    }

    res.json({
      success: true,
      data: await deps.registry.saveSettings(userIdOf(req), {
        root,
        owner,
        authorIdentities,
        scanTime,
        enabled,
      }),
    });
  });

  router.get("/repos", authenticate, anyRole, async (req, res) => {
    try {
      const userId = userIdOf(req);
      const settings = await deps.registry.getSettings(userId);
      const { repos, skipped } = await discover(settings.root, settings.owner);

      res.json({
        success: true,
        data: {
          // Promise.all rather than a sequential loop: one round trip per
          // repo, and a developer with 40 clones would otherwise wait for 40
          // sequential queries to render one page.
          repos: await Promise.all(repos.map(async (repo) => {
            const binding = await deps.registry.getBinding(userId, repo.slug);
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
          })),
          skipped,
        },
      });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "Discovery failed", 500);
    }
  });

  // The slug contains a slash, which a single :param will not match.
  router.put("/repos/:owner/:name", authenticate, anyRole, async (req, res) => {
    const slug = `${req.params.owner}/${req.params.name}`;
    const { destinationId, templateId, enabled } = req.body ?? {};
    res.json({
      success: true,
      data: await deps.registry.saveBinding(userIdOf(req), slug, {
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
  router.get("/last-run", authenticate, anyRole, async (req, res) => {
    res.json({ success: true, data: await deps.registry.getLastRun(userIdOf(req)) });
  });

  router.post("/run", authenticate, anyRole, async (req, res) => {
    const { date, dryRun } = req.body ?? {};
    if (date !== undefined && !DATE_PATTERN.test(String(date))) {
      return fail(res, "date must be YYYY-MM-DD");
    }

    try {
      const userId = userIdOf(req);
      // Local, matching the scheduler. `toISOString` gave a UTC date, which for
      // several hours a day named a different day than the one the user was
      // looking at — and than the one the lease was keyed on.
      const scanDate = date ?? localDate(new Date());
      const isDryRun = dryRun === true;

      const runIt = () =>
        deps.scanner.run(userId, { date: scanDate, ...(isDryRun ? { dryRun: true } : {}) });

      // A dry run creates nothing, so it takes no lease. Leasing it would let a
      // preview block the real scan behind it — and, worse, a dry run that
      // "completed" the day would stop the scan that was about to do the work.
      if (isDryRun) {
        return res.json({ success: true, data: await runIt() });
      }

      // Everything else goes through the same lease the scheduler uses.
      // Without this the manual button is a way to run a second scan of a day
      // the scheduler is already scanning, which duplicates every task it
      // creates — the lease closed that hole for two schedulers and would have
      // left it wide open for one scheduler and one impatient person.
      //
      // `redoCompleted` because this is someone asking on purpose, usually
      // straight after fixing the settings that made the first run wrong. What
      // it still cannot do is override a scan that is currently running.
      // `markComplete` only for a day that is over. Scanning today by hand
      // covers the commits that exist right now; marking the day finished would
      // block the evening's scheduled run — which never passes `redoCompleted` —
      // and the rest of the day's work would silently never be filed.
      const outcome = await leases.withLease(userId, scanDate, leaseOwner, runIt, {
        redoCompleted: true,
        markComplete: scanDate < localDate(new Date()),
      });

      if (!outcome.acquired) {
        // 409, not 400: the request is fine, the timing is not, and retrying
        // shortly is exactly the right response.
        return fail(
          res,
          `A scan for ${scanDate} is already running. Wait for it to finish before starting another.`,
          409
        );
      }

      const summary = outcome.result;
      // A dry run is not a run: persisting it would overwrite the last real
      // run's summary, hiding the failures the user actually needs to see.
      if (!summary.dryRun) await deps.registry.saveRun(userId, summary);
      res.json({ success: true, data: summary });
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "Scan failed", 500);
    }
  });

  return router;
}
