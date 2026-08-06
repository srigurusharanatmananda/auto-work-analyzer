import { randomUUID } from "crypto";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { DEFAULT_TEMPLATE_OPTIONS, Template, TemplateOptions } from "../formatting/Template.js";
import { getPool } from "../db/pool.js";
import type { PostgresHandle } from "../db/client.js";

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
  is_builtin: boolean;
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
    isBuiltin: row.is_builtin,
  };
}

/**
 * Persists user-editable task templates.
 *
 * Two things changed with Postgres, both structural rather than cosmetic:
 *
 *  - The connection is injected. Under SQLite each store opened its own file
 *    handle; here that would mean a pool of sockets per instance.
 *  - The schema is no longer created by the constructor. It comes from the
 *    migrations, so a store can no longer paper over a database that was never
 *    migrated — which is the point: `CREATE TABLE IF NOT EXISTS` in a
 *    constructor is exactly why adding a column used to be a silent no-op.
 *
 * Consequently seeding the built-ins is now an explicit `await seedBuiltins()`
 * rather than something the constructor did invisibly. Callers that only read
 * user templates do not need it; the server calls it once at startup.
 */
export class TemplateStore {
  private readonly pg: PostgresHandle;

  constructor(pg: PostgresHandle = getPool()) {
    this.pg = pg;
  }

  private get sql() {
    return this.pg.sql;
  }

  /**
   * Upserts the read-only built-ins, so a fresh database has a known-good
   * starting point and an edited `builtinTemplates.ts` takes effect on the next
   * start. User-owned templates are untouched.
   */
  async seedBuiltins(): Promise<void> {
    const now = new Date().toISOString();

    await this.sql.begin(async (tx) => {
      for (const template of BUILTIN_TEMPLATES) {
        await tx`
          INSERT INTO task_templates
            (id, user_id, name, description, name_template, description_template,
             options, is_builtin, created_at, updated_at)
          VALUES (
            ${template.id}, NULL, ${template.name}, ${template.description ?? null},
            ${template.nameTemplate}, ${template.descriptionTemplate},
            ${JSON.stringify(template.options)}, true, ${now}, ${now}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            name_template = excluded.name_template,
            description_template = excluded.description_template,
            options = excluded.options,
            updated_at = excluded.updated_at
        `;
      }
    });
  }

  async list(userId: string): Promise<Template[]> {
    const rows = await this.sql<Row[]>`
      SELECT * FROM task_templates
       WHERE is_builtin = true OR user_id = ${userId}
       ORDER BY is_builtin DESC, name ASC
    `;
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
  async get(id: string, userId: string): Promise<Template | null> {
    const [row] = await this.sql<Row[]>`
      SELECT * FROM task_templates
       WHERE id = ${id} AND (is_builtin = true OR user_id = ${userId})
    `;
    return row ? toTemplate(row) : null;
  }

  /**
   * Unscoped read for this class's own post-write read-backs, where ownership
   * was already established by the calling method. Never exposed.
   */
  private async getUnscoped(id: string): Promise<Template | null> {
    const [row] = await this.sql<Row[]>`SELECT * FROM task_templates WHERE id = ${id}`;
    return row ? toTemplate(row) : null;
  }

  async create(userId: string, input: TemplateInput): Promise<Template> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const [row] = await this.sql<Row[]>`
      INSERT INTO task_templates
        (id, user_id, name, description, name_template, description_template,
         options, is_builtin, created_at, updated_at)
      VALUES (
        ${id}, ${userId}, ${input.name}, ${input.description ?? null},
        ${input.nameTemplate}, ${input.descriptionTemplate},
        ${JSON.stringify(input.options)}, false, ${now}, ${now}
      )
      RETURNING *
    `;
    return toTemplate(row!);
  }

  async update(id: string, userId: string, input: Partial<TemplateInput>): Promise<Template> {
    const existing = await this.getUnscoped(id);
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

    const [row] = await this.sql<Row[]>`
      UPDATE task_templates
         SET name = ${merged.name},
             description = ${merged.description},
             name_template = ${merged.nameTemplate},
             description_template = ${merged.descriptionTemplate},
             options = ${JSON.stringify(merged.options)},
             updated_at = ${new Date().toISOString()}
       WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    return toTemplate(row!);
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.getUnscoped(id);
    if (existing && existing.isBuiltin) {
      throw new TemplateStoreError("Cannot delete a built-in template", "builtin_immutable");
    }
    if (!existing || existing.userId !== userId) {
      throw new TemplateStoreError("Template not found", "not_found");
    }
    await this.sql`DELETE FROM task_templates WHERE id = ${id} AND user_id = ${userId}`;
  }

  /**
   * No-op: the pool is owned by `db/pool.ts` and shared, so a store closing it
   * would disconnect the rest of the process. Kept so callers written against
   * the SQLite version still compile.
   */
  close(): void {}
}
