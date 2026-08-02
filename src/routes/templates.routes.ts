import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { TemplateStore, TemplateStoreError } from "../services/TemplateStore.js";
import { DEFAULT_TEMPLATE_OPTIONS, Template, TemplateOptions } from "../formatting/Template.js";
import { validateTemplate } from "../formatting/TemplateEngine.js";
import { WORK_ITEM_SCHEMA } from "../formatting/renderContext.js";
import { WorkItem } from "../domain/WorkItem.js";
import { renderTasks } from "../formatting/ClickUpRenderer.js";
import { renderMarkdown } from "../formatting/MarkdownRenderer.js";

/** Representative item so the editor can render a template with no real data. */
const FIXTURE_WORK_ITEM: WorkItem = {
  title: "Stop app updates from logging users out",
  description: "Installing an update invalidated the Keychain entry and signed every user out.",
  type: "bug-fix",
  priority: "urgent",
  status: "complete",
  estimateHours: 6,
  completedDate: "2026-07-30",
  tags: ["auth", "ios"],
  provenance: {
    source: "git",
    repository: "example-app",
    files: ["src/auth/Keychain.swift", "src/auth/SessionStore.ts"],
    commits: [
      {
        hash: "6338d99aa11bb22cc33",
        author: "dev@example.com",
        date: "2026-07-30",
        message: "fix(auth): stop app updates from logging users out",
        files: ["src/auth/Keychain.swift"],
        insertions: 42,
        deletions: 11,
      },
    ],
  },
};

export function createTemplatesRouter(store: TemplateStore): Router {
  const router = Router();

  const userIdOf = (req: any): string => req.user!.userId;

  // Validates only the fields a template actually renders (nameTemplate,
  // descriptionTemplate). Shared by create/update/preview — `name` is a
  // separate, save-only concern (see validateBody) since preview never
  // reads it.
  const validateRenderedFields = (body: any): string[] => {
    const errors: string[] = [];
    if (typeof body.nameTemplate !== "string" || body.nameTemplate.trim().length === 0) {
      errors.push("nameTemplate is required");
    } else {
      errors.push(...validateTemplate(body.nameTemplate, WORK_ITEM_SCHEMA));
    }
    if (typeof body.descriptionTemplate !== "string") {
      errors.push("descriptionTemplate is required");
    } else {
      errors.push(...validateTemplate(body.descriptionTemplate, WORK_ITEM_SCHEMA));
    }
    return errors;
  };

  // Full validation for persisted templates (create/update) — adds the
  // `name` requirement on top of the rendered-field checks.
  const validateBody = (body: any): string[] => {
    const errors: string[] = [];
    if (!body.name || String(body.name).trim().length === 0) {
      errors.push("name is required");
    }
    errors.push(...validateRenderedFields(body));
    return errors;
  };

  const optionsOf = (body: any): TemplateOptions => ({
    ...DEFAULT_TEMPLATE_OPTIONS,
    ...(body.options ?? {}),
  });

  // Maps a TemplateStore failure to its HTTP status. "not_found" covers both
  // "no such id" and "belongs to another user" — deliberately identical, so
  // the response never confirms whether an id exists for someone else's
  // template (a 403 would be an enumeration oracle). Anything untyped is a
  // genuine 500 rather than a client error.
  const handleStoreError = (res: any, error: unknown, fallbackMessage: string): void => {
    if (error instanceof TemplateStoreError) {
      const status = error.code === "builtin_immutable" ? 409 : 404;
      res.status(status).json({ success: false, error: error.message });
      return;
    }
    console.error(fallbackMessage, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : fallbackMessage,
    });
  };

  router.get("/", authenticate, (req, res) => {
    res.json({ success: true, data: store.list(userIdOf(req)) });
  });

  router.post("/", authenticate, (req, res) => {
    const errors = validateBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, error: "Invalid template", details: errors });
      return;
    }
    const created = store.create(userIdOf(req), {
      name: req.body.name,
      description: req.body.description,
      nameTemplate: req.body.nameTemplate,
      descriptionTemplate: req.body.descriptionTemplate,
      options: optionsOf(req.body),
    });
    res.status(201).json({ success: true, data: created });
  });

  router.put("/:id", authenticate, (req, res) => {
    const errors = validateBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, error: "Invalid template", details: errors });
      return;
    }
    try {
      const updated = store.update(req.params.id!, userIdOf(req), {
        name: req.body.name,
        description: req.body.description,
        nameTemplate: req.body.nameTemplate,
        descriptionTemplate: req.body.descriptionTemplate,
        options: optionsOf(req.body),
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      handleStoreError(res, error, "Update failed");
    }
  });

  router.delete("/:id", authenticate, (req, res) => {
    try {
      store.remove(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      handleStoreError(res, error, "Delete failed");
    }
  });

  // Renders an unsaved template against a fixture (or supplied items) so the
  // editor can show live output before the user commits to saving.
  router.post("/preview", authenticate, (req, res) => {
    // Preview renders an unsaved template — it never reads `name`, so it
    // validates only nameTemplate/descriptionTemplate, not the full
    // save-time validateBody (Task 9's live-preview editor must not force a
    // name to be typed before showing output).
    const errors = validateRenderedFields(req.body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, error: "Invalid template", details: errors });
      return;
    }

    const items: WorkItem[] =
      Array.isArray(req.body.workItems) && req.body.workItems.length > 0
        ? req.body.workItems
        : [FIXTURE_WORK_ITEM];

    const template: Template = {
      id: "preview",
      name: req.body.name || "Preview",
      nameTemplate: req.body.nameTemplate,
      descriptionTemplate: req.body.descriptionTemplate,
      options: optionsOf(req.body),
      isBuiltin: false,
    };

    try {
      res.json({
        success: true,
        data: {
          items: renderTasks(items, template),
          markdown: renderMarkdown(items, template),
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Template render failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
