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
      status: loose.status,
      estimateHours: work.estimatedHours,
      completedDate,
      tags: work.tags ?? [],
      provenance: {
        commits: work.commits,
        files: work.files ?? [],
        repository,
        source: "git",
      },
    };
  });
}
