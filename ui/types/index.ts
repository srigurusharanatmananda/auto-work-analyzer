export interface DetectedWork {
  type: 'feature' | 'bug-fix' | 'improvement' | 'refactor' | 'documentation' | 'test';
  name: string;
  description: string;
  files: string[];
  commits?: any[];
  complexity: 'low' | 'medium' | 'high';
  estimatedHours: number;
  tags: string[];
}

export interface WorkAnalysisResult {
  date: string;
  totalCommits: number;
  totalFilesChanged: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  detectedWork: DetectedWork[];
  summary: string;
}

export interface AnalysisResponse {
  workAnalysis: WorkAnalysisResult;
  createdTasks: CreatedTask[];
  summary: {
    date: string;
    totalCommits: number;
    totalWorkItems: number;
    totalFilesChanged: number;
    totalLinesChanged: number;
    tasksCreated: number;
  };
}

export interface NotesTask {
  name: string;
  type: string;
  complexity: string;
  estimatedHours: number;
  tags: string[];
}

export interface ProcessedNotes {
  totalTasks: number;
  tasks: NotesTask[];
}

export interface CreatedTask {
  id: string;
  name: string;
  url: string;
}

export interface NotesResponse {
  processedNotes: ProcessedNotes;
  createdTasks: CreatedTask[];
  summary: {
    tasksExtracted: number;
    tasksCreated: number;
    tasksFailed?: number;
  };
}

/**
 * Task templates. These mirror `src/formatting/Template.ts` — the unions below
 * are the exact strings the renderer switches on, so a value the backend does
 * not know silently falls through to its `default` branch. Keep them in step.
 */
export interface TemplateOptions {
  emitSubtasks: boolean;
  applyPriority: boolean;
  applyTimeEstimate: boolean;
  dueDateSource: 'completedDate' | 'lastCommitDate' | 'none';
  statusMode: 'fromWorkItem' | 'destinationDefault' | 'fixed';
  /** Required when statusMode === 'fixed'. */
  fixedStatus?: string;
  tagStrategy: {
    mode: 'fromWorkItem' | 'none' | 'fixed' | 'merge';
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
  dueDateSource: 'completedDate',
  statusMode: 'fromWorkItem',
  tagStrategy: { mode: 'fromWorkItem' },
};

/**
 * The placeholder vocabulary, as served by `GET /api/templates/schema`. Never
 * hardcode this list in a component — the backend owns it (see the route's
 * comment for why a stale copy is worse than a fetch).
 */
export interface PlaceholderSchema {
  scalars: string[];
  sections: Record<string, PlaceholderSchema>;
}

/**
 * Where a work item came from. Mirrors `src/domain/WorkItem.ts`.
 *
 * `quote` is only ever set on transcript-sourced items, and for those the
 * backend guarantees it: `validateActionItems` rejects any extracted item whose
 * quote is not present in the transcript it was extracted from. So a quote shown
 * in the UI has already been checked against the source — the review screen is
 * asking a human whether the request is worth filing, not whether it was real.
 */
export interface WorkItemProvenance {
  source: 'git' | 'notes' | 'manual' | 'transcript';
  commits: unknown[];
  files: string[];
  repository?: string;
  quote?: string;
  speaker?: string;
}

/**
 * The canonical work item, as returned inside a preview entry.
 *
 * Round-tripped UNCHANGED to `POST /api/create-tasks` as `workItems`. That is
 * the point of holding it: extraction from a transcript is a model call, so
 * re-sending the transcript at create time would re-run it and create a
 * different set of tasks from the ones the user just approved. Anything that
 * edits these before sending them back breaks that guarantee.
 */
export interface PreviewWorkItem {
  title: string;
  description: string;
  type: string;
  priority: string;
  status?: string;
  estimateHours: number;
  completedDate?: string;
  tags: string[];
  provenance: WorkItemProvenance;
}

/** One entry of `POST /api/preview-tasks` -> `data.items`. */
export interface RenderedTaskPreview {
  task: {
    name: string;
    description: string;
    tags?: string[];
    priority?: string;
    status?: string;
    dueDate?: string;
    timeEstimate?: number;
  };
  /** The item the task was rendered from. Always sent by the backend. */
  workItem: PreviewWorkItem;
}

/**
 * A saved ClickUp destination. Mirrors `src/destinations/DestinationStore.ts`.
 *
 * There is deliberately no `apiKey` field: the backend never returns one, so a
 * key cannot be rendered by accident. Editing a destination's key means typing
 * a new one.
 */
export interface Destination {
  id: string;
  userId: string;
  name: string;
  teamId: string;
  teamName?: string;
  spaceId?: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  listId: string;
  listName?: string;
  defaultTemplateId?: string;
  defaultAssignee?: string;
  isDefault: boolean;
}

/** One entry of `POST /api/preview-tasks` -> `data.statusMapping`. */
export interface StatusMapping {
  from: string;
  /** Null means the status will be dropped and the list's default applied. */
  to: string | null;
  method: 'exact' | 'synonym' | 'fuzzy' | 'unmatched';
}

/** `{ id, name }` pairs as returned by every `/api/clickup/*` browse endpoint. */
export interface ClickUpNode {
  id: string;
  name: string;
}

/**
 * Present on a preview response only when the request supplied raw `commits`
 * and the server therefore had to group them. `fallbackReason` is raw
 * provider/validator text — render it escaped and expect it to be multi-line.
 */
export interface GroupingInfo {
  mode: 'ai' | 'heuristic';
  fallbackReason?: string;
}

// ---- Org-wide daily scan ----

export interface ScanSettings {
  root: string;
  owner: string;
  authorIdentities: string[];
  /** "HH:MM", local time. */
  scanTime: string;
  enabled: boolean;
  lastCompletedDate?: string;
}

export interface ScannedRepo {
  slug: string;
  path: string;
  enabled: boolean;
  destinationId: string | null;
  templateId: string | null;
  lastScannedDate: string | null;
}

export interface SkippedDir {
  path: string;
  reason: string;
}

export interface RepoScanResult {
  slug: string;
  commits: number;
  workItems: number;
  tasksCreated: number;
  destination: string | null;
  fetchFailed?: string;
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
}

export interface ScanRunSummary {
  date: string;
  dryRun: boolean;
  repos: RepoScanResult[];
  skipped: SkippedDir[];
  totalTasksCreated: number;
}
