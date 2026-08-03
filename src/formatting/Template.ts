/** Decisions a template string cannot express. */
export interface TemplateOptions {
  emitSubtasks: boolean;
  applyPriority: boolean;
  applyTimeEstimate: boolean;
  dueDateSource: "completedDate" | "lastCommitDate" | "none";
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
  statusMode: "fromWorkItem",
  tagStrategy: { mode: "fromWorkItem" },
};
