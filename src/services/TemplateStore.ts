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

  get(id: string): Template | null {
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
    return this.get(id)!;
  }

  update(id: string, userId: string, input: Partial<TemplateInput>): Template {
    const existing = this.get(id);
    if (existing && existing.isBuiltin) {
      throw new Error("Cannot modify a built-in template. Duplicate it first.");
    }
    if (!existing || existing.userId !== userId) {
      throw new Error("Template not found");
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

    return this.get(id)!;
  }

  remove(id: string, userId: string): void {
    const existing = this.get(id);
    if (existing && existing.isBuiltin) {
      throw new Error("Cannot delete a built-in template");
    }
    if (!existing || existing.userId !== userId) {
      throw new Error("Template not found");
    }
    this.db.prepare(`DELETE FROM task_templates WHERE id = ? AND user_id = ?`).run(id, userId);
  }

  close(): void {
    this.db.close();
  }
}
