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

export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  emitSubtasks: false,
  applyPriority: true,
  applyTimeEstimate: true,
  dueDateSource: "completedDate",
  statusMode: "fromWorkItem",
  tagStrategy: { mode: "fromWorkItem" },
};
