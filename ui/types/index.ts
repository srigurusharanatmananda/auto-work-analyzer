/** Mirrors `GitCommit` in src/types/index.ts — there is no shared package. */
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
  type: 'feature' | 'bug-fix' | 'improvement' | 'refactor' | 'documentation' | 'test';
  name: string;
  description: string;
  files: string[];
  commits?: GitCommit[];
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
  /**
   * ClickUp only schedules a task on the Timeline/Gantt/Workload views when it
   * has a start date too, so 'none' means the created task stays under
   * "Unscheduled" no matter how good its due date is.
   */
  startDateSource: 'firstCommitDate' | 'matchDueDate' | 'none';
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
  startDateSource: 'firstCommitDate',
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

/** What `GET /api/git-info?path=…` returns. All fields absent for a non-repo. */
export interface GitInfo {
  branches?: string[];
  currentBranch?: string;
  userEmail?: string;
}

/**
 * What `POST /api/ai-enhance` returns. Mirrors `EnhancedDescription` in
 * `src/services/AIDescriptionService.ts`.
 *
 * `improvedTitle` is `''` rather than absent when the model does not supply one
 * — callers must fall back to the existing title, not overwrite it with empty.
 */
export interface EnhancedWorkItem {
  improvedTitle: string;
  description: string;
  suggestedTags: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  businessValue: string;
  technicalSummary: string;
}

/** One analysis run, as listed by `GET /api/history`. */
export interface AnalysisHistoryEntry {
  id: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

export interface ProjectStats {
  path: string;
  commitsProcessed: number;
}

/**
 * Mirrors `DatabaseService.getStatistics`.
 *
 * Shared rather than redeclared per component for a concrete reason: the
 * dashboard used to read `statistics.totalTasks`, which the backend has never
 * sent — the field is `totalTasksCreated` — so that tile silently displayed 0
 * forever. An untyped `data.data.statistics` cannot catch that; this can.
 */
export interface HistoryStatistics {
  totalAnalyses: number;
  totalCommitsProcessed: number;
  totalTasksCreated: number;
  totalWorkItems: number;
  projectStats: ProjectStats[];
  oldestEntry?: string;
  newestEntry?: string;
}

export interface HistoryData {
  history: AnalysisHistoryEntry[];
  statistics: HistoryStatistics;
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
  /**
   * Present only when a transcript's action items were grouped. The leaves are
   * the extracted items and the ones carrying the verified quotes; a parent is
   * a synthesised container and has no quote of its own.
   */
  subitems?: PreviewWorkItem[];
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
  /** The local clone this result came from — see the comment on the server-side type. */
  path: string;
  commits: number;
  workItems: number;
  tasksCreated: number;
  destination: string | null;
  fetchFailed?: string;
  /** Set when analyzeWork() exceeded the server's per-repo timeout — see DailyScanner.ts's ANALYZE_TIMEOUT_MS. */
  analyzeTimedOut?: string;
  error?: string;
  wouldCreate?: Array<{ name: string; description: string }>;
  fetchMs?: number;
  analyzeMs?: number;
}

export interface ScanRunSummary {
  date: string;
  dryRun: boolean;
  repos: RepoScanResult[];
  skipped: SkippedDir[];
  totalTasksCreated: number;
}

export type LearnLanguage = 'sanskrit' | 'tamil';

/** Mirrors `LevelId` in `src/learn/Curriculum.ts`. */
export type LearnLevelId = 1 | 2 | 3 | 4 | 5;

export interface LearnLevelInfo {
  id: LearnLevelId;
  name: string;
  description: string;
}

/**
 * Mirrors `LEVELS` in `src/learn/Curriculum.ts` — same reasoning as
 * `LANGUAGE_LABEL`/`TYPE_LABEL` elsewhere in this app: a small, stable
 * constant map, mirrored rather than fetched, per this codebase's own
 * established convention for exactly this shape of data.
 */
export const LEARN_LEVELS: readonly LearnLevelInfo[] = [
  { id: 1, name: 'The Alphabet', description: 'Every letter, read on sight — no meaning yet, just recognition.' },
  { id: 2, name: 'First Words', description: 'Real vocabulary, built only from letters already taught.' },
  {
    id: 3,
    name: 'Grammar & Sentences',
    description:
      'Sandhi (Sanskrit) or letter-junction rules (Tamil), noun cases, verb forms — sentences that read like real text, not two words placed side by side.',
  },
  { id: 4, name: 'Reading Practice', description: 'Graded reading of real text, dictionary in hand.' },
  { id: 5, name: 'Classical Texts', description: 'Unglossed reading of real scripture/literature, and composition.' },
];

/** Mirrors the lesson shape in `src/routes/learn.routes.ts`. */
export interface LearnLesson {
  id: string;
  stage: string;
  level: LearnLevelId;
  text: string;
  gloss: string;
  composedOf: string[];
  /** Set only for a sandhi/letter-junction example — see `Lesson.sandhiRule` in `Curriculum.ts`. */
  sandhiRule?: string;
}

/** The `data` payload of `GET /learn/next` and `POST /learn/seen`. */
export interface LearnProgress {
  lesson: LearnLesson | null;
  seenCount: number;
  total: number;
}

/** Mirrors the `Resource` shape in `src/learn/content/resources.ts`. */
export interface LearnResource {
  id: string;
  language: LearnLanguage;
  title: string;
  author: string;
  sourceUrl: string;
  type: 'article' | 'book' | 'video' | 'course' | 'dictionary' | 'audio' | 'primer';
  howToRead: string;
  license: string;
  embeddableExcerpt?: string;
  /** Original in-app teaching commentary written for this app. Not a reproduction of the source. */
  inAppNotes?: string;
  /** A confirmed-embeddable YouTube `/embed/...` URL. Only set on `type: 'video'` resources. */
  embedUrl?: string;
  /** A confirmed-embeddable archive.org `/embed/<identifier>` URL for a whole public-domain scan. */
  embeddableBookUrl?: string;
}

/** Mirrors the `ResourceNote` shape in `src/learn/ResourceNotes.ts`. */
export interface LearnResourceNote {
  id: string;
  resourceId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the `ResourceUpload` shape in `src/learn/ResourceUploads.ts`. */
export interface LearnResourceUpload {
  id: string;
  userId: string;
  language: LearnLanguage;
  title: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
}

/** Mirrors `Syllable` in `src/learn/Akshara.ts`. */
export interface ChantSyllable {
  text: string;
  vowel: string;
  weight: 'guru' | 'laghu' | 'anceps';
}

/** Mirrors `ChantWord` in `src/learn/content/chanting.ts`. */
export interface ChantWord {
  devanagari: string;
  iast: string;
  gloss: string;
}

/** Mirrors `ChantPada` in `src/learn/content/chanting.ts`, plus the syllable breakdown `chanting.routes.ts` computes server-side. */
export interface ChantPada {
  text: string;
  iast: string;
  words: ChantWord[];
  syllables: ChantSyllable[];
}

/** The `data` payload of `GET /chanting/verses` — a verse without its own padas/citation, just enough for a picker. */
interface ChantVerseIdentity {
  id: string;
  source: string;
  verseNumber: number;
  meaning: string;
}

export interface ChantVerseSummary extends ChantVerseIdentity {
  /** The opening pāda, in Devanagari — what the verse picker searches on. */
  firstLine: string;
}

/**
 * The `data` payload of `GET /chanting/verses/:id`. Deliberately a sibling
 * of `ChantVerseSummary` rather than an extension of it: the detail
 * response carries `padas` in full, so it has no reason to also send the
 * summary's `firstLine` (which exists only to spare the list endpoint from
 * sending every pāda), and inheriting would have claimed a field the route
 * does not actually return.
 */
export interface ChantVerse extends ChantVerseIdentity {
  speakerTag: string | null;
  padas: ChantPada[];
  citation: string;
}

/** Mirrors `ChantBook` in `src/learn/ChantBooks.ts`. */
export interface ChantBook {
  id: string;
  userId: string;
  language: LearnLanguage;
  title: string;
  originalFilename: string;
  storedFilename: string;
  sizeBytes: number;
  createdAt: string;
}

/** The `data` payload of `POST /chant-books`. */
export interface ChantBookCreated extends ChantBook {
  verseCount: number;
}

/** One entry of `GET /chant-books/:id/verses` — enough for a picker, without the (possibly uncomputed) breakdown. */
export interface ChantBookVerseSummary {
  verseNumber: number;
  rawText: string;
  hasBreakdown: boolean;
}

/** The `data` payload of `GET /chant-books/:id/verses/:verseNumber` — same pāda/word/syllable shape as the built-in `ChantVerse`, computed lazily and cached server-side. */
export interface ChantBookVerseDetail {
  bookId: string;
  verseNumber: number;
  rawText: string;
  padas: ChantPada[];
  meaning: string;
  citation: string;
}

/** Mirrors `TranslateLanguage` in `src/routes/translate.routes.ts`. */
export type TranslateLanguage = 'english' | LearnLanguage;

/** The `data` payload of `POST /translate`. */
export interface TranslateResult {
  translation: string;
  /** A short English explanation of what the text means/refers to — present only when an AI call was made (from !== to). */
  meaning?: string;
  translationTransliteration?: string;
  sourceTransliteration?: string;
}

/** The `data` payload of `POST /translate/ocr`. */
export interface OcrResult {
  text: string;
  /** `null` when the model couldn't confidently pick one. */
  detectedLanguage: TranslateLanguage | null;
}

/**
 * The `data` payload of `POST /translate/document`.
 *
 * `detectedLanguage` is `null` in the same case `OcrResult`'s is: no
 * confident signal. Here that means zero Devanagari/Tamil codepoints —
 * which is NOT proof of English, since a legacy pre-Unicode Tamil/Sanskrit
 * font extracts as unrecognizable text too. See `detectScriptLanguage` in
 * `src/routes/translate.routes.ts`.
 */
export interface DocumentExtractResult {
  text: string;
  detectedLanguage: TranslateLanguage | null;
}

/**
 * One row of `POST /translate/batch` -> `data.rows` — `Partial<TranslateResult>`
 * plus the row's own source text, not a re-declared copy of `TranslateResult`'s
 * fields (mirrors the backend's own `BatchTranslateRow` in
 * `src/routes/translate.routes.ts` for the same reason: one field added
 * there now follows through here too, instead of three edit sites to keep
 * in sync by hand).
 */
export type BatchTranslateRow = Partial<TranslateResult> & {
  source: string;
  /** Set instead of `translation` when this row's own translation failed — the rest of the batch is unaffected. */
  error?: string;
};

/** The `data` payload of `POST /translate/batch`. */
export interface BatchTranslateResult {
  rows: BatchTranslateRow[];
}
