/** Decisions a template string cannot express. */
export interface TemplateOptions {
  emitSubtasks: boolean;
  applyPriority: boolean;
  applyTimeEstimate: boolean;
  dueDateSource: "completedDate" | "lastCommitDate" | "none";
  /**
   * ClickUp schedules a task on the Timeline/Gantt/Workload views only when it
   * has a start date as well as a due date, so "no start date" means "invisible
   * to reporting" however good the due date is.
   *
   * - `firstCommitDate` — the earliest commit, giving a bar that spans the work.
   *   Items with no commits (notes, transcripts) fall back to `matchDueDate`,
   *   because a one-day bar reports better than nothing at all.
   * - `matchDueDate` — a single-day bar on the due date. Always available.
   * - `none` — omit it, and accept that the task will be "Unscheduled".
   */
  startDateSource: "firstCommitDate" | "matchDueDate" | "none";
  statusMode: "fromWorkItem" | "destinationDefault" | "fixed";
  /** Required when statusMode === "fixed". */
  fixedStatus?: string;
  tagStrategy: {
    mode: "fromWorkItem" | "none" | "fixed" | "merge";
    fixed?: string[];
  };
}

export interface Template {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  nameTemplate: string;
  descriptionTemplate: string;
  options: TemplateOptions;
  isBuiltin: boolean;
}

/**
 * Raised when a request names a template that does not exist. Lives here rather
 * than in the router because the destination resolver throws it too, and the
 * router's 400 handling keys off `instanceof` — a second class of the same name
 * would be reported as a 500 instead.
 */
export class UnknownTemplateError extends Error {
  constructor(templateId: string) {
    super(`Template not found: ${templateId}`);
    this.name = "UnknownTemplateError";
  }
}

export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  emitSubtasks: false,
  applyPriority: true,
  applyTimeEstimate: true,
  dueDateSource: "completedDate",
  startDateSource: "firstCommitDate",
  statusMode: "fromWorkItem",
  tagStrategy: { mode: "fromWorkItem" },
};
