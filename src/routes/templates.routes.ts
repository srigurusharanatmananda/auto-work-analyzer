import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { TemplateStore } from "../services/TemplateStore.js";
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

  const validateBody = (body: any): string[] => {
    const errors: string[] = [];
    if (!body.name || String(body.name).trim().length === 0) {
      errors.push("name is required");
    }
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

  const optionsOf = (body: any): TemplateOptions => ({
    ...DEFAULT_TEMPLATE_OPTIONS,
    ...(body.options ?? {}),
  });

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
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Update failed",
      });
    }
  });

  router.delete("/:id", authenticate, (req, res) => {
    try {
      store.remove(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      });
    }
  });

  // Renders an unsaved template against a fixture (or supplied items) so the
  // editor can show live output before the user commits to saving.
  router.post("/preview", authenticate, (req, res) => {
    const errors = validateBody(req.body);
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
      name: req.body.name,
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
