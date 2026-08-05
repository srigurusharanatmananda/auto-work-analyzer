/**
 * Turns a WorkItem into the flat context the template engine renders against,
 * and declares which placeholders are legal.
 */

import {
  PRIORITY_LABELS,
  TYPE_EMOJI,
  TYPE_LABELS,
  WorkItem,
} from "../domain/WorkItem.js";
import { AllowedSchema } from "./TemplateEngine.js";

export interface RenderMeta {
  repository?: string;
}

const COMMIT_SCALARS = [
  "hash",
  "shortHash",
  "date",
  "message",
  "author",
  "insertions",
  "deletions",
];

const SUBITEM_SCALARS = [
  "title",
  "description",
  "type",
  "typeLabel",
  "typeEmoji",
  "priority",
  "priorityLabel",
  "estimateHours",
  "status",
  "completedDate",
];

export const WORK_ITEM_SCHEMA: AllowedSchema = {
  scalars: [
    "title",
    "description",
    "type",
    "typeLabel",
    "typeEmoji",
    "priority",
    "priorityLabel",
    "estimateHours",
    "status",
    "completedDate",
    "repository",
    "source",
    "dateRange",
    "commitCount",
    "fileCount",
  ],
  sections: {
    commits: { scalars: COMMIT_SCALARS, sections: {} },
    files: { scalars: ["."], sections: {} },
    tags: { scalars: ["."], sections: {} },
    subitems: { scalars: SUBITEM_SCALARS, sections: {} },
  },
};

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return first === last ? first : `${first} → ${last}`;
}

export function buildRenderContext(
  item: WorkItem,
  meta: RenderMeta = {}
): Record<string, unknown> {
  const commits = item.provenance.commits.map((commit) => ({
    hash: commit.hash,
    shortHash: commit.hash.slice(0, 7),
    date: commit.date,
    message: commit.message,
    author: commit.author,
    insertions: commit.insertions,
    deletions: commit.deletions,
  }));

  return {
    title: item.title,
    description: item.description,
    type: item.type,
    typeLabel: TYPE_LABELS[item.type],
    typeEmoji: TYPE_EMOJI[item.type],
    priority: item.priority,
    priorityLabel: PRIORITY_LABELS[item.priority],
    estimateHours: item.estimateHours,
    status: item.status ?? "",
    completedDate: item.completedDate ?? "",
    repository: item.provenance.repository ?? meta.repository ?? "",
    source: item.provenance.source,
    dateRange: formatDateRange(item.provenance.commits.map((c) => c.date)),
    commitCount: commits.length,
    fileCount: item.provenance.files.length,
    commits,
    files: item.provenance.files,
    tags: item.tags,
    subitems: (item.subitems ?? []).map((sub) => ({
      title: sub.title,
      description: sub.description,
      type: sub.type,
      typeLabel: TYPE_LABELS[sub.type],
      typeEmoji: TYPE_EMOJI[sub.type],
      priority: sub.priority,
      priorityLabel: PRIORITY_LABELS[sub.priority],
      estimateHours: sub.estimateHours,
      status: sub.status ?? "",
      completedDate: sub.completedDate ?? "",
    })),
  };
}
