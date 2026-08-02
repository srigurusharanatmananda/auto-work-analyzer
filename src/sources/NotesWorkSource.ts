/**
 * Adapts NotesProcessor output onto the canonical WorkItem.
 *
 * NotesProcessor attaches priority/status/completedDate to its DetectedWork
 * results via an `as any` cast (they are not on the DetectedWork interface),
 * so this adapter reads them defensively.
 */

import { toWorkItemPriority, toWorkItemType, WorkItem } from "../domain/WorkItem.js";
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

export async function workItemsFromNotes(notesText: string): Promise<WorkItem[]> {
  const processed = await new NotesProcessor().processNotes(notesText);

  return processed.tasks.map((task) => {
    const loose = task as unknown as LooseDetectedWork;
    return {
      title: loose.name,
      description: stripDescriptionLabel(loose.description ?? ""),
      type: toWorkItemType(loose.type),
      priority: toWorkItemPriority(loose.priority),
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
