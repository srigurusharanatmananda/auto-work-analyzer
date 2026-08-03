/** Adapts git work — a WorkAnalysisResult, or raw commits — onto canonical WorkItems. */

import { toWorkItemType, WorkItem, WorkItemPriority } from "../domain/WorkItem.js";
import { WorkAnalysisResult } from "../types/index.js";
import type { GitCommit } from "../types/index.js";
import type {
  CommitGrouper,
  GroupingContext,
  GroupingResult,
} from "../grouping/CommitGrouper.js";

function priorityFromComplexity(complexity: string): WorkItemPriority {
  if (complexity === "high") return "high";
  if (complexity === "medium") return "normal";
  return "low";
}

/**
 * Groups raw commits into WorkItems using the supplied grouper.
 *
 * The grouper is injected rather than constructed here so tests never touch a
 * provider and callers can force the heuristic path. Returns the whole
 * GroupingResult, not just the items, because which grouper actually ran is
 * information the caller has to be able to show a user — heuristic output
 * mistaken for AI output is the failure this reporting exists to prevent.
 *
 * This is the entry point for input that has NOT been grouped yet.
 * workItemsFromAnalysis below is the one for input that already has been.
 */
export async function workItemsFromCommits(
  commits: GitCommit[],
  context: GroupingContext,
  grouper: CommitGrouper
): Promise<GroupingResult> {
  return grouper.group(commits, context);
}

export function workItemsFromAnalysis(
  analysis: WorkAnalysisResult,
  repository?: string
): WorkItem[] {
  return analysis.detectedWork.map((work) => {
    const loose = work as unknown as { priority?: WorkItemPriority; status?: string };
    const dates = work.commits.map((commit) => commit.date).sort();
    const completedDate = dates.length > 0 ? dates[dates.length - 1] : analysis.date;

    return {
      title: work.name,
      description: work.description,
      type: toWorkItemType(work.type),
      priority: loose.priority ?? priorityFromComplexity(work.complexity),
      // Git-derived work is completed by definition — the commits exist. An
      // explicit status on the detected work still wins.
      status: loose.status ?? "complete",
      estimateHours: work.estimatedHours,
      completedDate,
      // The type / "git-analyzed" / analysis-date trio is provenance the old
      // inline formatter in GitWorkAnalyzer.createTasksFromWork attached to
      // every git-created task. Keep "git-analyzed" even though nothing in this
      // repo reads it — ClickUp saved filters are consumers a grep cannot see.
      tags: Array.from(
        new Set([work.type, "git-analyzed", analysis.date, ...(work.tags ?? [])])
      ),
      provenance: {
        commits: work.commits,
        files: work.files ?? [],
        repository,
        source: "git",
      },
    };
  });
}
