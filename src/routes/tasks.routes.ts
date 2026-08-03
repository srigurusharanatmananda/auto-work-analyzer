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
import { WorkItem, WorkItemPriority } from "../domain/WorkItem.js";
import { RenderedTask, renderTasks } from "../formatting/ClickUpRenderer.js";
import { renderMarkdown } from "../formatting/MarkdownRenderer.js";
import { Template } from "../formatting/Template.js";
import { TemplateError } from "../formatting/TemplateEngine.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { workItemsFromNotes } from "../sources/NotesWorkSource.js";
import { workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import { ClickUpService } from "../services/ClickUpService.js";
import { GitWorkAnalyzer } from "../services/GitWorkAnalyzer.js";
import { ClickUpConfig } from "../types/index.js";

/**
 * Used whenever a request omits `templateId`. Slice 2 replaces this with a
 * per-destination default; until then every unqualified request renders the
 * same way the old inline code did.
 */
const DEFAULT_TEMPLATE_ID = "builtin-standard";

/** ClickUp rate-limits aggressively, so creates go out five at a time. */
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 100;

/** Raised when a request names a template that does not exist. */
export class UnknownTemplateError extends Error {
  constructor(templateId: string) {
    super(`Template not found: ${templateId}`);
    this.name = "UnknownTemplateError";
  }
}

export interface PreviewResponse {
  items: RenderedTask[];
  markdown: string;
  template: { id: string; name: string };
  warnings: string[];
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
    warnings,
  };
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
 * Multipart form fields arrive as strings, so `createTasks=false` would be a
 * truthy string under a plain truthiness check — the bug the old inline
 * handler had. Only an explicit true/"true" opts in.
 */
function wantsCreation(value: unknown): boolean {
  return value === true || value === "true";
}

export interface TasksRouterDeps {
  templateStore: TemplateStore;
  clickUpConfig: ClickUpConfig;
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
}

/** The one method the legacy /api/create-tasks branch calls. */
export type LegacyAnalyzer = Pick<GitWorkAnalyzer, "createTasksFromWork">;

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

  const resolveTemplate = (templateId?: string): Template => {
    const id = templateId || DEFAULT_TEMPLATE_ID;
    const template = deps.templateStore.get(id);
    if (!template) throw new UnknownTemplateError(id);
    return template;
  };

  /**
   * A bad template or a bad template id is the caller's fault (400); anything
   * else — a ClickUp outage, a programming error — is ours (500), and keeps the
   * error text the endpoint returned before this refactor. Collapsing both into
   * 400 would report infrastructure failures as client errors.
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
    console.error(`${fallbackMessage}:`, error);
    res.status(500).json({
      success: false,
      error: fallbackMessage,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  };

  /**
   * The three accepted input shapes, in precedence order: already-canonical
   * `workItems`, raw `notes` text, or a legacy `workAnalysis` result. Returns
   * null once it has sent a 400, so callers just return.
   */
  const itemsFromBody = async (req: any, res: any): Promise<WorkItem[] | null> => {
    const { notes, workAnalysis, workItems } = req.body;
    if (Array.isArray(workItems)) return workItems;
    if (typeof notes === "string") return workItemsFromNotes(notes);
    if (workAnalysis) return workItemsFromAnalysis(workAnalysis, req.body.repository);

    res.status(400).json({
      success: false,
      error: "Provide one of: workItems, notes, or workAnalysis",
    });
    return null;
  };

  // Render only. Writes nothing — this is what the editor calls to show a user
  // exactly what would be created before they commit to creating it.
  router.post("/preview-tasks", authenticate, async (req, res) => {
    try {
      const items = await itemsFromBody(req, res);
      if (items === null) return;
      res.json({
        success: true,
        data: buildPreview(items, resolveTemplate(req.body.templateId)),
      });
    } catch (error) {
      handleError(res, error, "Failed to build preview");
    }
  });

  router.post("/export-markdown", authenticate, async (req, res) => {
    try {
      const items = await itemsFromBody(req, res);
      if (items === null) return;
      const { templateId, title, period } = req.body;
      const markdown = renderMarkdown(items, resolveTemplate(templateId), { title, period });
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
  router.post("/notes", upload.single("notes"), authenticate, async (req, res) => {
    try {
      const notesText = req.file ? req.file.buffer.toString("utf-8") : req.body.notes;
      if (!notesText) {
        res.status(400).json({
          success: false,
          error: "No notes provided. Send 'notes' in body or upload a text file.",
        });
        return;
      }

      const items = await workItemsFromNotes(notesText);
      const preview = buildPreview(items, resolveTemplate(req.body.templateId));

      const createTasks = wantsCreation(req.body.createTasks);
      let outcome: CreateOutcome = { created: [], failed: [] };

      if (createTasks && preview.items.length > 0) {
        outcome = await createRenderedTasks(
          preview.items,
          new ClickUpService(deps.clickUpConfig)
        );
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
  router.post("/create-tasks", authenticate, async (req, res) => {
    try {
      const { workAnalysis, workItems, templateId, projectPath } = req.body;

      if (Array.isArray(workItems)) {
        const items = workItems as WorkItem[];
        const preview = buildPreview(items, resolveTemplate(templateId));
        const outcome = await createRenderedTasks(
          preview.items,
          new ClickUpService(deps.clickUpConfig)
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
      const analyzer = makeAnalyzer(projectPath || deps.defaultProjectPath);
      const createdTasks = await analyzer.createTasksFromWork(
        workAnalysis,
        deps.clickUpConfig
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
