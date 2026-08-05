/**
 * The single path from work items to created ClickUp tasks.
 *
 * Before this router, three call sites formatted tasks independently
 * (`/api/notes` inline, `/api/create-tasks` via GitWorkAnalyzer, and the CLI),
 * so the same work produced differently-shaped tasks depending on how it was
 * submitted. Everything here goes source -> WorkItem[] -> Template -> TaskData,
 * which means preview output and created output can no longer disagree: the
 * preview literally renders the objects that get sent.
 *
 * `/api/notes` and `/api/create-tasks` keep their pre-existing request and
 * response shapes — they are public endpoints with existing callers, so the
 * envelopes below are a compatibility contract, not a design choice.
 */

import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware.js";
import { anyRole } from "../middleware/policy.js";
import { WorkItem, WorkItemPriority } from "../domain/WorkItem.js";
import { RenderedTask, renderTasks } from "../formatting/ClickUpRenderer.js";
import { renderMarkdown } from "../formatting/MarkdownRenderer.js";
import { Template, UnknownTemplateError } from "../formatting/Template.js";
import { TemplateError } from "../formatting/TemplateEngine.js";
import { workItemsFromNotes } from "../sources/NotesWorkSource.js";
import { workItemsFromAnalysis, workItemsFromCommits } from "../sources/GitWorkSource.js";
import type { CommitGrouper } from "../grouping/CommitGrouper.js";
import { ClickUpService } from "../services/ClickUpService.js";
import { GitWorkAnalyzer } from "../services/GitWorkAnalyzer.js";
import { mapStatus, StatusMapping } from "../formatting/StatusMapper.js";
import {
  DestinationResolver,
  ResolvedDestination,
  UnknownDestinationError,
} from "../destinations/DestinationResolver.js";

/**
 * Re-exported for callers that imported it from here before it moved to
 * `formatting/Template.ts` (the resolver needs to throw it too).
 */
export { UnknownTemplateError };

/** ClickUp rate-limits aggressively, so creates go out five at a time. */
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 100;

export interface PreviewResponse {
  items: RenderedTask[];
  markdown: string;
  template: { id: string; name: string };
  /** Null when the request resolved to the .env configuration. */
  destination?: { id: string; name: string; listName?: string; teamName?: string } | null;
  statusMapping: StatusMapping[];
  warnings: string[];
  /**
   * Only present when this request supplied raw `commits` and therefore had to be
   * grouped. `workItems` and `workAnalysis` bodies arrive pre-grouped, so they
   * report nothing rather than claiming a mode they did not exercise.
   */
  grouping?: { mode: "ai" | "heuristic"; fallbackReason?: string };
}

/** Pure: renders items for preview. Performs no I/O. */
export function buildPreview(items: WorkItem[], template: Template): PreviewResponse {
  const rendered = renderTasks(items, template);
  const warnings: string[] = [];
  if (items.length === 0) {
    warnings.push("No work items were produced — nothing would be created.");
  }
  return {
    items: rendered,
    markdown: renderMarkdown(items, template),
    template: { id: template.id, name: template.name },
    statusMapping: [],
    warnings,
  };
}

/**
 * Rewrites each rendered task's status to the target list's real status,
 * dropping any that cannot be matched so ClickUp applies the list default.
 *
 * Dropping rather than passing through is the whole point: ClickUp statuses are
 * per-list, and sending one the list does not define makes it reject the create
 * outright. The drop is reported in `statusMapping` and `warnings` so it shows
 * up in the preview instead of being discovered afterwards.
 *
 * Pure, and does not mutate the preview it is given.
 */
export function annotateStatusMapping(
  preview: PreviewResponse,
  availableStatuses: string[]
): PreviewResponse {
  const mappings: StatusMapping[] = [];
  const warnings = [...preview.warnings];

  const items = preview.items.map((entry) => {
    const desired = entry.task.status;
    const mapping = mapStatus(desired, availableStatuses);
    if (!mapping) return entry;

    const alreadyReported = mappings.some(
      (existing) => existing.from.toLowerCase() === mapping.from.toLowerCase()
    );
    if (!alreadyReported) {
      mappings.push(mapping);
    }

    const task = { ...entry.task };
    if (mapping.to) {
      task.status = mapping.to;
    } else {
      delete task.status;
      if (!alreadyReported) {
        warnings.push(
          `Status "${mapping.from}" does not exist in the target list — it will be left at the list default.`
        );
      }
    }

    return { ...entry, task };
  });

  return { ...preview, items, statusMapping: mappings, warnings };
}

export interface CreateOutcome {
  created: Array<{ id: string; name: string; url: string }>;
  failed: Array<{ name: string; reason: string }>;
}

/**
 * Creates rendered tasks in batches, isolating per-task failures so one
 * rejected task cannot discard the rest of a submission. `created` preserves
 * input order across batch boundaries.
 */
export async function createRenderedTasks(
  rendered: RenderedTask[],
  clickUp: ClickUpService,
  listId?: string
): Promise<CreateOutcome> {
  const created: CreateOutcome["created"] = [];
  const failed: CreateOutcome["failed"] = [];

  for (let index = 0; index < rendered.length; index += BATCH_SIZE) {
    const batch = rendered.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const task = await clickUp.createTask(entry.task, listId);
          return { ok: true as const, task };
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          console.error(`Failed to create task: ${entry.task.name}`, reason);
          return { ok: false as const, name: entry.task.name, reason };
        }
      })
    );

    for (const result of results) {
      if (result.ok) {
        created.push({ id: result.task.id, name: result.task.name, url: result.task.url });
      } else {
        failed.push({ name: result.name, reason: result.reason });
      }
    }

    if (index + BATCH_SIZE < rendered.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
  }

  return { created, failed };
}

/**
 * Reconstructs the `complexity` field that `/api/notes` has always returned.
 * WorkItem carries `priority` instead, and the notes/git sources map
 * complexity -> priority on the way in, so this inverts that mapping to keep
 * the response envelope unchanged for existing callers.
 */
function complexityFromPriority(priority: WorkItemPriority): "high" | "medium" | "low" {
  if (priority === "urgent" || priority === "high") return "high";
  if (priority === "normal") return "medium";
  return "low";
}

/**
 * `workItems` arrives as untrusted JSON on three public endpoints and used to be
 * cast straight to `WorkItem[]`, so a malformed item threw inside
 * `buildRenderContext` and came back as a 500 — the server taking the blame for
 * a bad request body.
 *
 * Scope is deliberate: only the fields the render path actually *dereferences*,
 * because those are the ones that throw. `provenance.commits`/`provenance.files`
 * (renderContext.buildRenderContext), `commit.hash` (`.slice(0, 7)`), `tags`
 * (spread by ClickUpRenderer.resolveTags) and `subitems` (recursed into by
 * renderOne). Everything else — a missing `title`, a bogus `type`, a
 * non-numeric `estimateHours` — renders to "" or NaN without throwing, so it is
 * not validated here; rejecting it would be a schema clone, and a task ClickUp
 * refuses already comes back in `failedTasks` with a reason.
 *
 * Returns a message naming the offending path, or null when every item is
 * renderable.
 */
export function validateWorkItems(items: unknown[]): string | null {
  for (let index = 0; index < items.length; index += 1) {
    const problem = validateWorkItem(items[index], `workItems[${index}]`);
    if (problem) return problem;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWorkItem(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;

  if (!isPlainObject(value.provenance)) {
    return `${path}.provenance must be an object with commits[] and files[]`;
  }
  const { commits, files } = value.provenance;
  if (!Array.isArray(commits)) return `${path}.provenance.commits must be an array`;
  if (!Array.isArray(files)) return `${path}.provenance.files must be an array`;
  if (!Array.isArray(value.tags)) return `${path}.tags must be an array`;

  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    if (!isPlainObject(commit) || typeof commit.hash !== "string") {
      return `${path}.provenance.commits[${index}].hash must be a string`;
    }
  }

  if (value.subitems !== undefined) {
    if (!Array.isArray(value.subitems)) return `${path}.subitems must be an array`;
    for (let index = 0; index < value.subitems.length; index += 1) {
      const problem = validateWorkItem(value.subitems[index], `${path}.subitems[${index}]`);
      if (problem) return problem;
    }
  }

  return null;
}

/**
 * `workItems` only counts as the caller's chosen input shape when it actually
 * carries something. A client that initialises the field to `[]` and posts it
 * alongside another shape has not asked for the canonical pipeline, and on
 * /api/create-tasks letting `[]` win would silently skip the legacy branch's
 * side effects (see the comment on that route).
 */
function suppliedWorkItems(body: any): unknown[] | null {
  return Array.isArray(body.workItems) && body.workItems.length > 0 ? body.workItems : null;
}

/**
 * Multipart form fields arrive as strings, so `createTasks=false` would be a
 * truthy string under a plain truthiness check — the bug the old inline
 * handler had. Only an explicit true/"true" opts in.
 */
function wantsCreation(value: unknown): boolean {
  return value === true || value === "true";
}

export interface TasksRouterDeps {
  /**
   * Turns an optional `destinationId` + `templateId` into the ClickUp service,
   * list and template to use. Replaces the old `templateStore` +
   * `clickUpConfig` pair: both are now reached through the resolver, which is
   * also where the "no destination named -> the user's default -> .env" fallback
   * lives.
   */
  resolver: DestinationResolver;
  /**
   * Fallback repo path for the legacy `{ workAnalysis }` branch of
   * /api/create-tasks, used when the request omits `projectPath`. Only that
   * branch needs it — GitWorkAnalyzer keys its history and commit-dedup records
   * by project path.
   */
  defaultProjectPath: string;
  /**
   * Seam for the legacy branch, so a test can prove that a `{ workAnalysis }`
   * body still reaches `createTasksFromWork` — and therefore still writes
   * history and marks commits processed. Production leaves this unset and gets
   * the real GitWorkAnalyzer.
   */
  analyzerFactory?: (projectPath: string) => LegacyAnalyzer;
  /**
   * Groups raw `commits` into work items. Required, not optional, so the
   * compiler finds every construction site rather than letting one silently
   * default to the heuristic path.
   */
  grouper: CommitGrouper;
}

/** The one method the legacy /api/create-tasks branch calls. */
export type LegacyAnalyzer = Pick<GitWorkAnalyzer, "createTasksFromWork">;

/**
 * What a request body resolved to. `grouping` is carried separately from the
 * items because only the raw-`commits` shape has a mode to report, and
 * /api/export-markdown discards it.
 */
interface ResolvedItems {
  items: WorkItem[];
  grouping?: PreviewResponse["grouping"];
}

/**
 * The target list's statuses, or null when they cannot be read.
 *
 * Null means "do not map", which is the pre-slice-2 behaviour — degrading to it
 * is better than refusing to create anything because a status lookup failed.
 */
async function listStatusesOrNull(resolved: ResolvedDestination): Promise<string[] | null> {
  if (!resolved.listId) return null;
  try {
    return await resolved.clickUp.getListStatuses(resolved.listId);
  } catch (error) {
    console.warn(
      "Could not read the target list's statuses:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export function createTasksRouter(deps: TasksRouterDeps): Router {
  const router = Router();
  const makeAnalyzer =
    deps.analyzerFactory ?? ((projectPath: string) => new GitWorkAnalyzer(projectPath));

  // Mirrors the limits the inline /api/notes handler enforced: 5MB, and text
  // files only. Dropping either would widen what an authenticated caller can
  // push into memory.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
      if (
        file.mimetype === "text/plain" ||
        file.originalname.endsWith(".txt") ||
        file.originalname.endsWith(".md")
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only text files (.txt, .md) are allowed"));
      }
    },
  });

  /**
   * Multer signals a rejected upload — over the 5 MB limit, or a non-text
   * mimetype — by calling back with an Error. Left alone that reaches Express's
   * global handler and answers 500 "Internal server error", blaming the server
   * for a bad request. This turns both into a 400 naming the cause.
   */
  const uploadNotes = (req: any, res: any, next: any): void => {
    upload.single("notes")(req, res, (error: any) => {
      if (!error) return next();
      const tooLarge = error?.code === "LIMIT_FILE_SIZE";
      res.status(400).json({
        success: false,
        error: tooLarge
          ? "That file is larger than the 5 MB limit."
          : error instanceof Error
            ? error.message
            : "Upload rejected",
      });
    });
  };

  /**
   * Where the destination is chosen, on every path that renders or creates.
   * `destinationId` and `templateId` are both optional: omitting them resolves
   * to the user's default destination and then to the .env configuration, which
   * is what keeps every pre-destinations caller working untouched.
   */
  const resolveFor = (req: any): ResolvedDestination =>
    deps.resolver.resolve(req.user!.userId, req.body.destinationId, req.body.templateId);

  /**
   * Maps our statuses onto the target list's real ones, which needs a round trip
   * to ClickUp — so it is skipped entirely when no item carries a status.
   *
   * A failure here is deliberately non-fatal. An unreadable status list is a
   * reason to warn and send the statuses unmapped, not a reason to refuse to
   * create anything: the worst case is the pre-slice-2 behaviour.
   */
  const withStatusMapping = async (
    preview: PreviewResponse,
    resolved: ResolvedDestination
  ): Promise<PreviewResponse> => {
    if (!preview.items.some((entry) => entry.task.status)) return preview;
    if (!resolved.listId) return preview;

    try {
      const statuses = await resolved.clickUp.getListStatuses(resolved.listId);
      return annotateStatusMapping(preview, statuses);
    } catch (error) {
      console.warn(
        "Could not read the target list's statuses:",
        error instanceof Error ? error.message : error
      );
      return {
        ...preview,
        warnings: [
          ...preview.warnings,
          "Could not read the target list's statuses; statuses will be sent unmapped.",
        ],
      };
    }
  };

  /** Makes the chosen target visible in the response, so it can be shown before confirming. */
  const withDestination = (
    preview: PreviewResponse,
    resolved: ResolvedDestination
  ): PreviewResponse => ({
    ...preview,
    destination: resolved.destination
      ? {
          id: resolved.destination.id,
          name: resolved.destination.name,
          listName: resolved.destination.listName,
          teamName: resolved.destination.teamName,
        }
      : null,
  });

  /**
   * A bad template, a bad template id or a bad destination id is the caller's
   * fault (400); anything else — a ClickUp outage, a programming error — is ours
   * (500), and keeps the error text the endpoint returned before this refactor.
   * Collapsing both into 400 would report infrastructure failures as client
   * errors.
   */
  const handleError = (res: any, error: unknown, fallbackMessage: string): void => {
    if (error instanceof TemplateError || error instanceof UnknownTemplateError) {
      res.status(400).json({
        success: false,
        error: "Template render failed",
        details: error.message,
      });
      return;
    }
    if (error instanceof UnknownDestinationError) {
      res.status(400).json({
        success: false,
        error: "Unknown destination",
        details: error.message,
      });
      return;
    }
    console.error(`${fallbackMessage}:`, error);
    res.status(500).json({
      success: false,
      error: fallbackMessage,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  };

  /** 400s a `workItems` array that would throw inside the renderer. */
  const rejectInvalidWorkItems = (res: any, items: unknown[]): boolean => {
    const problem = validateWorkItems(items);
    if (!problem) return false;
    res.status(400).json({
      success: false,
      error: "Invalid workItems",
      details: problem,
    });
    return true;
  };

  /**
   * 400s a body that names two input shapes at once. Refusing is the point:
   * either precedence rule silently discards half of what was asked for, and on
   * /api/create-tasks picking `workItems` also skips the legacy side effects.
   */
  const rejectConflictingShapes = (req: any, res: any): boolean => {
    const suppliedCommits = Array.isArray(req.body.commits) && req.body.commits.length > 0;
    const pregrouped = Boolean(suppliedWorkItems(req.body)) || suppliedCommits;
    if (!pregrouped || !req.body.workAnalysis) return false;
    res.status(400).json({
      success: false,
      error:
        "Send either workItems, commits, or workAnalysis — not more than one. They describe the same work different ways.",
    });
    return true;
  };

  /**
   * The three accepted input shapes, in precedence order: already-canonical
   * `workItems`, raw `notes` text, or a legacy `workAnalysis` result. An empty
   * `workItems` yields to the other two so that a preview shows what
   * /api/create-tasks would actually do with the same body. Returns null once it
   * has sent a 400, so callers just return.
   */
  const itemsFromBody = async (req: any, res: any): Promise<ResolvedItems | null> => {
    const { notes, workAnalysis, workItems, commits } = req.body;
    if (rejectConflictingShapes(req, res)) return null;

    const supplied = suppliedWorkItems(req.body);
    if (supplied) {
      if (rejectInvalidWorkItems(res, supplied)) return null;
      return { items: supplied as WorkItem[] };
    }
    // Raw commits are the only shape that still needs grouping, so it is the
    // only one that reports a grouping mode.
    if (Array.isArray(commits) && commits.length > 0) {
      const result = await workItemsFromCommits(
        commits,
        {
          analysisDate: req.body.analysisDate ?? new Date().toISOString().split("T")[0],
          repository: req.body.repository,
        },
        deps.grouper
      );
      return {
        items: result.items,
        grouping: { mode: result.mode, fallbackReason: result.fallbackReason },
      };
    }
    if (typeof notes === "string") return { items: await workItemsFromNotes(notes) };
    if (workAnalysis) {
      return { items: workItemsFromAnalysis(workAnalysis, req.body.repository) };
    }
    if (Array.isArray(workItems) || Array.isArray(commits)) return { items: [] };

    res.status(400).json({
      success: false,
      error: "Provide one of: workItems, commits, notes, or workAnalysis",
    });
    return null;
  };

  // Render only. Writes nothing — this is what the editor calls to show a user
  // exactly what would be created before they commit to creating it.
  router.post("/preview-tasks", authenticate, anyRole, async (req, res) => {
    try {
      const resolvedItems = await itemsFromBody(req, res);
      if (resolvedItems === null) return;
      const resolved = resolveFor(req);
      const preview = await withStatusMapping(
        buildPreview(resolvedItems.items, resolved.template),
        resolved
      );
      // Spread the grouping on rather than threading it through buildPreview,
      // which is pure and whose existing tests should stay untouched. Suppressed
      // when nothing was produced: AiCommitGrouper returns early on an empty
      // commit list and reports "heuristic" without calling the model, so a
      // badge here would claim a mode that was never exercised.
      const grouping = resolvedItems.items.length > 0 ? resolvedItems.grouping : undefined;
      res.json({ success: true, data: { ...withDestination(preview, resolved), grouping } });
    } catch (error) {
      handleError(res, error, "Failed to build preview");
    }
  });

  router.post("/export-markdown", authenticate, anyRole, async (req, res) => {
    try {
      const resolvedItems = await itemsFromBody(req, res);
      if (resolvedItems === null) return;
      const items = resolvedItems.items;
      const { title, period } = req.body;
      // Markdown export writes nothing to ClickUp, so it needs the resolved
      // template but never the list or the credentials.
      const markdown = renderMarkdown(items, resolveFor(req).template, { title, period });
      res.json({ success: true, data: { markdown } });
    } catch (error) {
      handleError(res, error, "Failed to export markdown");
    }
  });

  // Backward compatible with the inline handler this replaces: same request
  // shape (JSON `notes` or an uploaded file), same response envelope, plus an
  // optional `templateId` and the additive `failedTasks`/`markdown` fields.
  //
  // NOTE: `upload.single` MUST run before `authenticate`. Multer is what parses
  // a multipart body, and without it `req.body` is empty for file uploads.
  router.post("/notes", uploadNotes, authenticate, anyRole, async (req, res) => {
    try {
      // The guard is on *supplying* notes, not on the text being non-empty —
      // deliberately, because that is what the inline handler this replaced did
      // (`if (req.file) … else if (req.body.notes) … else 400`). An uploaded but
      // empty .txt therefore still processes to zero tasks and returns 200:
      // "your file had nothing in it" is a different answer from "you sent no
      // notes", and callers that read 200/0-tasks as success predate this
      // refactor. An empty JSON `notes` string keeps falling through to the 400,
      // exactly as before.
      if (!req.file && !req.body.notes) {
        res.status(400).json({
          success: false,
          error: "No notes provided. Send 'notes' in body or upload a text file.",
        });
        return;
      }

      const notesText = req.file ? req.file.buffer.toString("utf-8") : req.body.notes;
      const items = await workItemsFromNotes(notesText);
      const resolved = resolveFor(req);
      const preview = await withStatusMapping(buildPreview(items, resolved.template), resolved);

      const createTasks = wantsCreation(req.body.createTasks);
      let outcome: CreateOutcome = { created: [], failed: [] };

      if (createTasks && preview.items.length > 0) {
        outcome = await createRenderedTasks(preview.items, resolved.clickUp, resolved.listId);
      }

      res.json({
        success: true,
        data: {
          processedNotes: {
            totalTasks: items.length,
            tasks: items.map((item) => ({
              name: item.title,
              type: item.type,
              complexity: complexityFromPriority(item.priority),
              estimatedHours: item.estimateHours,
              tags: item.tags,
            })),
          },
          createdTasks: outcome.created,
          failedTasks: outcome.failed,
          markdown: preview.markdown,
          summary: {
            tasksExtracted: items.length,
            tasksCreated: outcome.created.length,
            tasksFailed: outcome.failed.length,
          },
        },
        message: `Processed ${items.length} tasks from notes${
          createTasks ? `, created ${outcome.created.length} ClickUp tasks` : ""
        }${outcome.failed.length > 0 ? ` (${outcome.failed.length} failed)` : ""}`,
      });
    } catch (error) {
      handleError(res, error, "Failed to process notes");
    }
  });

  /**
   * Two deliberately different branches.
   *
   * `{ workItems }` (new) renders through the canonical pipeline.
   *
   * `{ workAnalysis }` (legacy) still delegates to
   * GitWorkAnalyzer.createTasksFromWork, which does far more than format tasks:
   * besides creating a parent "Daily Work Summary" rollup, it writes
   * addAnalysisHistory (the data /api/reports serves), saveWorkItem per item,
   * and — critically — markCommitsAsProcessed. That last call is how the
   * analyzer knows which commits it has already turned into tasks. Routing this
   * branch through the renderer would drop it, and the analyzer would silently
   * re-detect the same commits on every later run, generating duplicate tasks
   * with no error and no failing test.
   *
   * Relocating those side effects is its own task. Until then this branch is
   * intentionally left on the old path.
   *
   * Known limitation: the `{ workItems }` branch does NOT write history or mark
   * commits processed. Acceptable only because the branch is new — nothing that
   * used to happen has stopped happening.
   */
  router.post("/create-tasks", authenticate, anyRole, async (req, res) => {
    try {
      const { workAnalysis, workItems, projectPath } = req.body;

      // Order matters, and not cosmetically. `workItems` must not shadow
      // `workAnalysis`: a client that always sends `workItems` (an editor that
      // initialises it to []) would otherwise take the new pipeline, get back a
      // cheerful "Created 0 tasks in ClickUp", and never reach
      // createTasksFromWork — the only caller of markCommitsAsProcessed. Those
      // commits stay unprocessed and get re-reported forever, and nothing
      // throws. So: an ambiguous body is refused outright, a workAnalysis wins
      // over an empty workItems, and only a genuinely populated workItems takes
      // the canonical path.
      if (rejectConflictingShapes(req, res)) return;

      const resolved = resolveFor(req);

      if (!workAnalysis && Array.isArray(workItems)) {
        const items = workItems as WorkItem[];
        if (rejectInvalidWorkItems(res, items)) return;
        const preview = await withStatusMapping(
          buildPreview(items, resolved.template),
          resolved
        );
        const outcome = await createRenderedTasks(
          preview.items,
          resolved.clickUp,
          resolved.listId
        );

        res.json({
          success: true,
          data: {
            tasksCreated: outcome.created.length,
            tasks: outcome.created,
            failedTasks: outcome.failed,
          },
          message: `Created ${outcome.created.length} tasks in ClickUp${
            outcome.failed.length > 0 ? ` (${outcome.failed.length} failed)` : ""
          }`,
        });
        return;
      }

      if (!workAnalysis) {
        res.status(400).json({
          success: false,
          error: "workItems or workAnalysis is required",
        });
        return;
      }

      // Legacy path — byte-identical to the handler this replaced, including
      // the absence of `failedTasks` (createTasksFromWork nulls out failures
      // internally and cannot report which ones).
      // `resolved.config` — not the .env config — is what routes this branch to
      // the destination the user picked: createTasksFromWork builds its own
      // ClickUpService from it, and its `defaultListId` is the destination's
      // list. It also renders internally, so the target list's statuses have to
      // be handed in rather than mapped out here.
      const analyzer = makeAnalyzer(projectPath || deps.defaultProjectPath);
      const createdTasks = await analyzer.createTasksFromWork(
        workAnalysis,
        resolved.config,
        undefined,
        {
          template: resolved.template,
          repository: req.body.repository,
          availableStatuses: await listStatusesOrNull(resolved),
          // This path writes an analysis_history row (see the comment above),
          // and a row with no owner is visible only to admins. The caller is
          // authenticated here, so it has one.
          userId: req.user!.userId,
        }
      );
      const created = createdTasks.filter((task) => task !== null);

      res.json({
        success: true,
        data: {
          tasksCreated: created.length,
          tasks: created,
        },
        message: `Created ${created.length} tasks in ClickUp`,
      });
    } catch (error) {
      handleError(res, error, "Failed to create tasks");
    }
  });

  return router;
}
