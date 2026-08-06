/**
 * The canonical unit of work.
 *
 * Every source produces WorkItem[]; every renderer consumes it. `description`
 * holds prose only — all structural formatting (type labels, emoji, commit
 * lists) belongs to templates, never to this type.
 */

import { GitCommit } from "../types/index.js";

export type WorkItemType =
  | "feature"
  | "bug-fix"
  | "improvement"
  | "refactor"
  | "documentation"
  | "test"
  | "chore"
  | "release";

export type WorkItemPriority = "urgent" | "high" | "normal" | "low";

export interface WorkItemProvenance {
  /** Empty for notes- and transcript-sourced items. */
  commits: GitCommit[];
  files: string[];
  repository?: string;
  source: "git" | "notes" | "manual" | "transcript";
  /**
   * The sentence this item was extracted from, quoted verbatim from the source.
   *
   * Only transcript-sourced items carry it, and for those it is mandatory —
   * `validateActionItems` refuses any item whose quote is not present in the
   * transcript. It is the difference between "someone asked for this" and "a
   * model thought this sounded plausible", and it is what a reviewer checks
   * before agreeing to a task.
   */
  quote?: string;
  /** Who the transcript attributes the request to, when it is identifiable. */
  speaker?: string;
}

export interface WorkItem {
  title: string;
  /** Prose only. No markdown scaffolding. */
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  /** Normalized; mapped to a destination's real status at write time. */
  status?: string;
  estimateHours: number;
  /** ISO yyyy-mm-dd. */
  completedDate?: string;
  tags: string[];
  provenance: WorkItemProvenance;
  subitems?: WorkItem[];
}

export const TYPE_LABELS: Record<WorkItemType, string> = {
  feature: "New Feature",
  "bug-fix": "Bug Fix",
  improvement: "Improvement",
  refactor: "Refactoring",
  documentation: "Documentation",
  test: "Testing",
  chore: "Chore",
  release: "Release",
};

export const TYPE_EMOJI: Record<WorkItemType, string> = {
  feature: "✅",
  "bug-fix": "🐛",
  improvement: "🔧",
  refactor: "♻️",
  documentation: "📝",
  test: "🧪",
  chore: "🧹",
  release: "🚀",
};

/**
 * Uppercase labels used in the structured markdown format. These MUST stay
 * in the vocabulary NotesProcessor.parseStructuredTasks accepts, or the
 * markdown round-trip breaks.
 */
export const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  urgent: "CRITICAL",
  high: "HIGH",
  normal: "MEDIUM",
  low: "LOW",
};

export const ALL_WORK_ITEM_TYPES: WorkItemType[] = Object.keys(TYPE_LABELS) as WorkItemType[];

export const ALL_WORK_ITEM_PRIORITIES: WorkItemPriority[] = [
  "urgent",
  "high",
  "normal",
  "low",
];

/** Narrows an untrusted string to a WorkItemType, falling back to `improvement`. */
export function toWorkItemType(value: string | undefined): WorkItemType {
  return ALL_WORK_ITEM_TYPES.includes(value as WorkItemType)
    ? (value as WorkItemType)
    : "improvement";
}

/** Narrows an untrusted string to a WorkItemPriority, falling back to `normal`. */
export function toWorkItemPriority(value: string | undefined): WorkItemPriority {
  return ALL_WORK_ITEM_PRIORITIES.includes(value as WorkItemPriority)
    ? (value as WorkItemPriority)
    : "normal";
}

/** Test fixture builder. Not used by production code. */
export function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    title: "Example work item",
    description: "An example description.",
    type: "feature",
    priority: "normal",
    estimateHours: 3,
    tags: [],
    provenance: { commits: [], files: [], source: "git" },
    ...overrides,
  };
}
