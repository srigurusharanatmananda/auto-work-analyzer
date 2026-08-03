/**
 * Adapts NotesProcessor output onto the canonical WorkItem.
 *
 * NotesProcessor attaches priority/status/completedDate to its DetectedWork
 * results via an `as any` cast (they are not on the DetectedWork interface),
 * so this adapter reads them defensively.
 */

import {
  toWorkItemPriority,
  toWorkItemType,
  WorkItem,
  WorkItemPriority,
} from "../domain/WorkItem.js";
import { NotesProcessor } from "../services/NotesProcessor.js";
import type { GitCommit } from "../types/index.js";

interface LooseDetectedWork {
  type: string;
  name: string;
  description: string;
  files?: string[];
  estimatedHours?: number;
  complexity?: string;
  tags?: string[];
  priority?: string;
  status?: string;
  completedDate?: string;
}

/**
 * NotesProcessor only recognises a bare "Description:" as a label; when a note
 * writes "Description: text" on one line — which the project's own sample
 * format does — the literal prefix ends up inside the parsed description.
 * Strip it here so WorkItem.description holds prose only.
 */
function stripDescriptionLabel(description: string): string {
  return description.replace(/^\s*Description:\s*/i, "").trim();
}

/**
 * Only NotesProcessor's *structured* parser sets `priority`; its free-form and
 * bullet-list paths set `complexity` alone (convertToDetectedWork /
 * extractFromFreeForm), and structured parsing requires BOTH a "---" separator
 * and a "Task N:" heading. So for any plain-bullet notes file `priority` is
 * undefined, and reading it alone silently collapsed every item to "normal" —
 * losing the low/medium/high distinction the source had actually derived, and
 * with it the created task's ClickUp priority.
 *
 * This is the exact inverse of the route's complexityFromPriority. "urgent" is
 * not recoverable — complexity has only three levels — which is correct: it can
 * only ever come from an explicit `Priority:` line, and that path sets
 * `priority` directly and never reaches here.
 */
function priorityFromComplexity(complexity: string | undefined): WorkItemPriority {
  if (complexity === "high") return "high";
  if (complexity === "low") return "low";
  return "normal";
}

export async function workItemsFromNotes(notesText: string): Promise<WorkItem[]> {
  const processed = await new NotesProcessor().processNotes(notesText);

  return processed.tasks.map((task) => {
    const loose = task as unknown as LooseDetectedWork;
    return {
      title: loose.name,
      description: stripDescriptionLabel(loose.description ?? ""),
      type: toWorkItemType(loose.type),
      // An explicit priority always wins; complexity is the fallback, not an
      // override.
      priority: loose.priority
        ? toWorkItemPriority(loose.priority)
        : priorityFromComplexity(loose.complexity),
      status: loose.status,
      estimateHours: loose.estimatedHours ?? 3,
      completedDate: loose.completedDate,
      tags: loose.tags ?? [],
      provenance: {
        commits: [] as GitCommit[],
        files: loose.files ?? [],
        source: "notes",
      },
    };
  });
}
