/**
 * Files action items from finished transcriptions, unattended.
 *
 * The counterpart to DailyScanner, and deliberately built the same way: it
 * ORCHESTRATES and does not format. Extraction goes through
 * `workItemsFromTranscript`, grouping through `groupActionItems`, rendering and
 * status mapping through the same `buildPreview` / `annotateStatusMapping` the
 * HTTP routes use, and creation through `createRenderedTasks`. If this file ever
 * builds a task name, preview/created parity has been broken.
 *
 * Per-job isolation is the rule, as in the scanner: one call whose extraction
 * fails or whose list rejects a task must never stop the rest, and every
 * outcome lands in the summary — an unattended job with invisible failures is
 * worse than no job.
 *
 * **The dedup story is the hard part**, and it is why the job table gained three
 * columns rather than a single boolean:
 *
 *  - Extraction is a model call and is not deterministic. Re-extracting on a
 *    retry produces a different list, so "item 3 is already filed" would refer
 *    to a different item. The first sweep therefore FREEZES the extraction onto
 *    the job, and every later run reuses it — which also means a retry costs no
 *    model spend.
 *  - A sweep can partially fail: three tasks created, two rejected by the list.
 *    Marking the job done loses two; marking nothing duplicates three. So the
 *    indexes that succeeded are recorded, and `sweptAt` is set only when they
 *    all have.
 */

import {
  annotateStatusMapping,
  buildPreview,
  createRenderedTasks,
} from "../routes/tasks.routes.js";
import { workItemsFromTranscript } from "../sources/TranscriptWorkSource.js";
import { TranscriptGrouping, groupActionItems } from "./ActionItemGrouper.js";
import type { AiClient } from "../ai/AiClient.js";
import type { DestinationResolver } from "../destinations/DestinationResolver.js";
import type { TranscriptionJob, TranscriptionJobStore } from "../transcription/TranscriptionJobStore.js";
import type { WorkItem } from "../domain/WorkItem.js";

export interface SweptJobResult {
  jobId: string;
  filename: string;
  callTitle: string | null;
  /** Action items on the job, whether newly extracted or reused. */
  actionItems: number;
  /** Skipped because an earlier run already filed them. */
  alreadyFiled: number;
  tasksCreated: number;
  destination: string | null;
  /** True when the extraction was reused rather than re-run. */
  reusedExtraction: boolean;
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
}

export interface SweepSummary {
  dryRun: boolean;
  jobs: SweptJobResult[];
  totalTasksCreated: number;
}

export interface TranscriptSweeperDeps {
  store: TranscriptionJobStore;
  resolver: DestinationResolver;
  aiClient?: AiClient;
  /** How action items are shaped. Matches the UI's default. */
  grouping?: TranscriptGrouping;
  /** Jobs per run, so a large backlog cannot burn the whole model quota at once. */
  batchSize?: number;
}

export interface SweepOptions {
  /**
   * Extract and render, create nothing, record nothing. The extraction is not
   * frozen either — a dry run that froze it would decide what a later real run
   * files, which is not what "dry" means.
   */
  dryRun?: boolean;
}

export class TranscriptSweeper {
  constructor(private deps: TranscriptSweeperDeps) {}

  async run(userId: string, options: SweepOptions = {}): Promise<SweepSummary> {
    const dryRun = options.dryRun === true;
    const jobs = await this.deps.store.listSweepable(userId, this.deps.batchSize ?? 25);
    const results: SweptJobResult[] = [];

    // Sequential: ClickUp rate-limits, providers rate-limit harder, and it keeps
    // the failure report readable.
    for (const job of jobs) {
      results.push(await this.sweepOne(userId, job, dryRun));
    }

    return {
      dryRun,
      jobs: results,
      totalTasksCreated: results.reduce((sum, entry) => sum + entry.tasksCreated, 0),
    };
  }

  private async sweepOne(
    userId: string,
    job: TranscriptionJob,
    dryRun: boolean
  ): Promise<SweptJobResult> {
    const result: SweptJobResult = {
      jobId: job.id,
      filename: job.originalFilename,
      callTitle: job.callTitle,
      actionItems: 0,
      alreadyFiled: job.createdItemIndexes.length,
      tasksCreated: 0,
      destination: null,
      reusedExtraction: job.actionItems !== null,
    };

    try {
      const items = await this.itemsFor(job, dryRun);
      result.actionItems = items.length;

      if (items.length === 0) {
        // A call that genuinely agreed nothing. Marked done so the next sweep
        // does not pay for the same model call to reach the same answer.
        if (!dryRun) await this.deps.store.markSweptEmpty(job.id);
        return result;
      }

      // The indexes are the dedup key, so they must survive the filtering —
      // rendering a bare array would renumber everything after the first gap.
      const filed = new Set(job.createdItemIndexes);
      const outstanding = items
        .map((item, index) => ({ item, index }))
        .filter((entry) => !filed.has(entry.index));

      if (outstanding.length === 0) return result;

      const resolved = await this.deps.resolver.resolve(userId);
      result.destination = resolved.destination?.name ?? null;

      let preview = buildPreview(
        outstanding.map((entry) => entry.item),
        resolved.template
      );
      if (resolved.listId) {
        try {
          preview = annotateStatusMapping(
            preview,
            await resolved.clickUp.getListStatuses(resolved.listId)
          );
        } catch (error) {
          // Send what was rendered and say so, rather than failing the job for
          // a status lookup — the same degradation the scanner makes.
          result.error = `Could not read list statuses: ${
            error instanceof Error ? error.message : error
          }`;
        }
      }

      if (dryRun) {
        result.wouldCreate = preview.items.map((entry) => ({
          name: entry.task.name,
          description: entry.task.description ?? "",
        }));
        return result;
      }

      const outcome = await createRenderedTasks(preview.items, resolved.clickUp, resolved.listId);
      result.tasksCreated = outcome.created.length;

      // By position, not by name: two action items can render to the same task
      // name, and a mis-mapping here silently marks the wrong item filed — the
      // one bug in this file that would duplicate work on the next run.
      const createdIndexes = outcome.created.map(
        (task) => outstanding[task.index]!.index
      );

      await this.deps.store.recordCreatedItems(job.id, createdIndexes, items.length);

      if (outcome.failed.length > 0) {
        const reasons = outcome.failed.map((failure) => failure.reason).join("; ");
        result.error = `${outcome.failed.length} task(s) rejected: ${reasons}`;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * The job's frozen action items, extracting and freezing them if this is the
   * first time. A dry run extracts but does not freeze.
   */
  private async itemsFor(job: TranscriptionJob, dryRun: boolean): Promise<WorkItem[]> {
    if (job.actionItems !== null) return job.actionItems;

    if (!this.deps.aiClient) {
      throw new Error(
        "Extracting action items needs an AI provider, and none is configured."
      );
    }

    const context = {
      callDate: job.callDate ?? undefined,
      callTitle: job.callTitle ?? job.originalFilename,
    };

    const extracted = await workItemsFromTranscript(
      job.transcript ?? "",
      this.deps.aiClient,
      context
    );
    // A partial extraction must not be frozen: it would be treated as the
    // complete, authoritative list of what the call agreed, forever.
    if (extracted.reason) throw new Error(extracted.reason);

    const grouped = await groupActionItems(
      extracted.items,
      this.deps.grouping ?? "per-item",
      context,
      this.deps.aiClient
    );

    if (!dryRun) await this.deps.store.saveActionItems(job.id, grouped.items);
    return grouped.items;
  }
}
