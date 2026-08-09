/**
 * Type definitions for Auto Work Analyzer
 */

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
  insertions: number;
  deletions: number;
}

export interface DetectedWork {
  type:
    | "feature"
    | "bug-fix"
    | "improvement"
    | "refactor"
    | "documentation"
    | "test";
  name: string;
  description: string;
  files: string[];
  commits: GitCommit[];
  complexity: "low" | "medium" | "high";
  estimatedHours: number;
  tags: string[];
}

/**
 * How a WorkAnalysisResult's commits were grouped. Optional: absent when the
 * analyzer ran without an injected grouper (the CLI and the exported helpers),
 * so every existing consumer of WorkAnalysisResult is unaffected.
 */
export interface GroupingInfo {
  mode: "ai" | "heuristic";
  fallbackReason?: string;
}

export interface WorkAnalysisResult {
  date: string;
  totalCommits: number;
  totalFilesChanged: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  detectedWork: DetectedWork[];
  summary: string;
  grouping?: GroupingInfo;
}

export interface ClickUpConfig {
  teamId: string;
  apiKey: string;
  defaultListId?: string | undefined;
  defaultSpaceId?: string | undefined;
  defaultAssignee?: string | undefined;
  projectName: string;
  description?: string | undefined;
  tags?: string[] | undefined;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: {
    status: string;
    color: string;
  };
  priority: {
    priority: string;
    color: string;
  };
  assignees: Array<{
    id: string;
    username: string;
    color: string;
    email: string;
    profilePicture: string;
  }>;
  due_date: string | null;
  date_created: string;
  date_updated: string;
  url: string;
  tags: Array<{
    name: string;
    tag_fg: string;
    tag_bg: string;
  }>;
  time_estimate: number | null;
  time_spent: number | null;
  subtasks?: ClickUpTask[];
}

export interface TaskData {
  name: string;
  description?: string;
  priority?: "urgent" | "high" | "normal" | "low";
  status?: string;
  assignees?: string[];
  tags?: string[];
  dueDate?: string;
  /**
   * ClickUp's Timeline, Gantt and Workload views schedule a task only when it
   * has BOTH a start and a due date; a due date alone leaves it under
   * "Unscheduled". So this is not decoration — it is what makes a created task
   * appear in a report at all.
   */
  startDate?: string;
  timeEstimate?: number;
  customFields?: Record<string, any>;
  subtasks?: Omit<TaskData, "subtasks">[];
}

export interface ProjectTemplate {
  name: string;
  description: string;
  tasks: TaskData[];
}

export interface AnalysisOptions {
  date?: string;
  endDate?: string;
  author?: string;
  createTasks?: boolean;
  projectName?: string;
  outputFormat?: "json" | "text" | "summary";
}

export interface WebhookPayload {
  type: "git-push" | "scheduled" | "manual" | "ci-cd";
  project?: string;
  date?: string;
  endDate?: string;
  author?: string;
  branch?: string;
  repository?: string;
  commitHash?: string;
  secret?: string;
}
