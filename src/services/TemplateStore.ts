import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { DEFAULT_TEMPLATE_OPTIONS, Template, TemplateOptions } from "../formatting/Template.js";

export interface TemplateInput {
  name: string;
  description?: string;
  nameTemplate: string;
  descriptionTemplate: string;
  options: TemplateOptions;
}

/**
 * Thrown by `update`/`remove` so callers (the route layer) can distinguish
 * failure reasons without parsing `error.message`. `code` maps 1:1 to an
 * HTTP status at the route: "not_found" -> 404, "builtin_immutable" -> 409.
 *
 * "not_found" is deliberately used for both "no such id" and "belongs to
 * another user" — a 403 would confirm the id exists, turning the endpoint
 * into an enumeration oracle for other users' template ids.
 */
export class TemplateStoreError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "builtin_immutable"
  ) {
    super(message);
    this.name = "TemplateStoreError";
  }
}

interface Row {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  name_template: string;
  description_template: string;
  options: string;
  is_builtin: number;
}

function toTemplate(row: Row): Template {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    nameTemplate: row.name_template,
    descriptionTemplate: row.description_template,
    options: { ...DEFAULT_TEMPLATE_OPTIONS, ...JSON.parse(row.options) },
    isBuiltin: row.is_builtin === 1,
  };
}

/**
 * Persists user-editable task templates in SQLite, seeding the read-only
 * built-ins (from `builtinTemplates.ts`) on every open so a fresh database
 * always has a known-good starting point.
 */
export class TemplateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeSchema();
    this.seedBuiltins();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        name_template TEXT NOT NULL,
        description_template TEXT NOT NULL,
        options TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_templates_user ON task_templates(user_id);
    `);
  }

  private seedBuiltins(): void {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO task_templates
        (id, user_id, name, description, name_template, description_template, options, is_builtin, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        name_template = excluded.name_template,
        description_template = excluded.description_template,
        options = excluded.options,
        updated_at = excluded.updated_at
    `);

    const seed = this.db.transaction(() => {
      for (const template of BUILTIN_TEMPLATES) {
        insert.run(
          template.id,
          template.name,
          template.description ?? null,
          template.nameTemplate,
          template.descriptionTemplate,
          JSON.stringify(template.options),
          now,
          now
        );
      }
    });

    seed();
  }

  list(userId: string): Template[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM task_templates
         WHERE is_builtin = 1 OR user_id = ?
         ORDER BY is_builtin DESC, name ASC`
      )
      .all(userId) as Row[];
    return rows.map(toTemplate);
  }

  /**
   * Scoped to the caller: a built-in, or a template they own. Nothing else.
   *
   * This used to take no `userId`, and `DestinationResolver.resolveTemplate`
   * passed `req.body.templateId` straight through — so any authenticated caller
   * who knew another user's template id could render their own work with that
   * user's templates on /api/preview-tasks, /api/create-tasks and /api/notes,
   * and see its name in the response. `list`, `update` and `remove` were all
   * scoped; only this one was not. The unscoped read exists because built-ins
   * have user_id NULL and must be visible to everyone — that requirement is
   * real, the ownership half was just missing.
   *
   * Returns null rather than throwing for a template belonging to someone else,
   * which is indistinguishable from a genuine miss: no enumeration oracle.
   */
  get(id: string, userId: string): Template | null {
    const row = this.db
      .prepare(`SELECT * FROM task_templates WHERE id = ? AND (is_builtin = 1 OR user_id = ?)`)
      .get(id, userId) as Row | undefined;
    return row ? toTemplate(row) : null;
  }

  /**
   * Unscoped read for this class's own post-write read-backs, where ownership
   * was already established by the calling method. Never exposed.
   */
  private getUnscoped(id: string): Template | null {
    const row = this.db.prepare(`SELECT * FROM task_templates WHERE id = ?`).get(id) as
      | Row
      | undefined;
    return row ? toTemplate(row) : null;
  }

  create(userId: string, input: TemplateInput): Template {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO task_templates
           (id, user_id, name, description, name_template, description_template, options, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        userId,
        input.name,
        input.description ?? null,
        input.nameTemplate,
        input.descriptionTemplate,
        JSON.stringify(input.options),
        now,
        now
      );
    return this.getUnscoped(id)!;
  }

  update(id: string, userId: string, input: Partial<TemplateInput>): Template {
    const existing = this.getUnscoped(id);
    if (existing && existing.isBuiltin) {
      throw new TemplateStoreError(
        "Cannot modify a built-in template. Duplicate it first.",
        "builtin_immutable"
      );
    }
    if (!existing || existing.userId !== userId) {
      throw new TemplateStoreError("Template not found", "not_found");
    }

    const merged = {
      name: input.name ?? existing.name,
      description: input.description ?? existing.description ?? null,
      nameTemplate: input.nameTemplate ?? existing.nameTemplate,
      descriptionTemplate: input.descriptionTemplate ?? existing.descriptionTemplate,
      options: input.options ?? existing.options,
    };

    this.db
      .prepare(
        `UPDATE task_templates
           SET name = ?, description = ?, name_template = ?, description_template = ?, options = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        merged.name,
        merged.description,
        merged.nameTemplate,
        merged.descriptionTemplate,
        JSON.stringify(merged.options),
        new Date().toISOString(),
        id,
        userId
      );

    return this.getUnscoped(id)!;
  }

  remove(id: string, userId: string): void {
    const existing = this.getUnscoped(id);
    if (existing && existing.isBuiltin) {
      throw new TemplateStoreError("Cannot delete a built-in template", "builtin_immutable");
    }
    if (!existing || existing.userId !== userId) {
      throw new TemplateStoreError("Template not found", "not_found");
    }
    this.db.prepare(`DELETE FROM task_templates WHERE id = ? AND user_id = ?`).run(id, userId);
  }

  close(): void {
    this.db.close();
  }
}
