/** Adapts a WorkAnalysisResult onto canonical WorkItems. */

import { toWorkItemType, WorkItem, WorkItemPriority } from "../domain/WorkItem.js";
import { WorkAnalysisResult } from "../types/index.js";

function priorityFromComplexity(complexity: string): WorkItemPriority {
  if (complexity === "high") return "high";
  if (complexity === "medium") return "normal";
  return "low";
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
