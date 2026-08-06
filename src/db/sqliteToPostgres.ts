/**
 * Copies an existing SQLite database into Postgres.
 *
 * Column names are already snake_case on both sides, so rows are copied by
 * name rather than mapped field by field. That removes the largest class of
 * migration bug — a mapping that transposes two columns of the same type and
 * produces plausible, wrong data with nothing thrown.
 *
 * Four things this has to get right, and each is handled explicitly rather than
 * left to luck:
 *
 *  - **Insert order.** work_items references analysis_history, and
 *    refresh_tokens and user_settings reference users. Parents first, declared
 *    as data below rather than implied by the order someone happened to write
 *    the copy calls in.
 *  - **Booleans.** SQLite stores them as 0/1 integers; the Postgres columns are
 *    real booleans. The columns are listed explicitly, because inferring
 *    "0 and 1 means boolean" would also convert a genuine integer column such
 *    as `complexity` or `total_commits`.
 *  - **Orphans.** A refresh_tokens row whose user no longer exists is legal in
 *    the source (SQLite only enforces foreign keys when the pragma is on) and
 *    illegal in the target. Those rows are found and reported before anything
 *    is written, so the run fails with a list rather than half-way through.
 *  - **Columns the source lacks.** `analysis_history.user_id` exists only after
 *    the self-healing add-column has run. Only columns actually present in the
 *    source are copied; the rest take their Postgres default.
 */
import Database from 'better-sqlite3';
import type { PostgresHandle } from './client.js';

/** Parents before children. FK order, not alphabetical. */
const TABLE_ORDER = [
  'users',
  'user_settings',
  'refresh_tokens',
  'token_blacklist',
  'login_attempts',
  'analysis_history',
  'work_items',
  'processed_commits',
  'task_templates',
  'clickup_destinations',
  'scan_settings',
  'scan_runs',
  'scanned_repos',
  'schema_migrations',
] as const;

/**
 * Columns that are 0/1 in SQLite and boolean in Postgres.
 *
 * Listed rather than detected. `complexity`, `total_commits` and
 * `failed_login_attempts` all legitimately hold 0 and 1.
 */
const BOOLEAN_COLUMNS: Record<string, readonly string[]> = {
  users: ['is_active', 'email_verified'],
  refresh_tokens: ['revoked'],
  login_attempts: ['success'],
  task_templates: ['is_builtin'],
  clickup_destinations: ['is_default'],
  scan_settings: ['enabled'],
  scanned_repos: ['enabled'],
};

/** Child table → the parent column it must resolve against. */
const FOREIGN_KEYS: Array<{
  table: string;
  column: string;
  parentTable: string;
  parentColumn: string;
}> = [
  { table: 'user_settings', column: 'user_id', parentTable: 'users', parentColumn: 'id' },
  { table: 'refresh_tokens', column: 'user_id', parentTable: 'users', parentColumn: 'id' },
  {
    table: 'work_items',
    column: 'analysis_id',
    parentTable: 'analysis_history',
    parentColumn: 'id',
  },
];

export interface TableResult {
  table: string;
  sourceRows: number;
  copiedRows: number;
}

export interface MigrationReport {
  tables: TableResult[];
  /** Rows left behind because their parent row does not exist in the source. */
  orphans: Array<{ table: string; column: string; count: number; examples: string[] }>;
}

export interface MigrateOptions {
  sqlitePath: string;
  postgres: PostgresHandle;
  /**
   * Copy anyway when the target already holds rows. Off by default: running
   * twice into a populated database is far more likely to be a mistake than an
   * intention, and the primary keys would collide loudly at best.
   */
  allowNonEmptyTarget?: boolean;
  /** Drop orphaned child rows instead of refusing to run. */
  dropOrphans?: boolean;
  onProgress?: (message: string) => void;
}

function existingTables(sqlite: Database.Database): Set<string> {
  const rows = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function columnsOf(sqlite: Database.Database, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

/** Finds child rows whose parent is missing, before anything is written. */
function findOrphans(
  sqlite: Database.Database,
  tables: Set<string>
): MigrationReport['orphans'] {
  const orphans: MigrationReport['orphans'] = [];

  for (const fk of FOREIGN_KEYS) {
    if (!tables.has(fk.table) || !tables.has(fk.parentTable)) continue;

    const rows = sqlite
      .prepare(
        `SELECT c.${fk.column} AS value
           FROM ${fk.table} c
           LEFT JOIN ${fk.parentTable} p ON p.${fk.parentColumn} = c.${fk.column}
          WHERE c.${fk.column} IS NOT NULL AND p.${fk.parentColumn} IS NULL`
      )
      .all() as Array<{ value: string }>;

    if (rows.length > 0) {
      orphans.push({
        table: fk.table,
        column: fk.column,
        count: rows.length,
        examples: rows.slice(0, 5).map((r) => String(r.value)),
      });
    }
  }

  return orphans;
}

export async function migrateSqliteToPostgres(
  options: MigrateOptions
): Promise<MigrationReport> {
  const { sqlitePath, postgres: pg } = options;
  const log = options.onProgress ?? (() => {});

  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    const tables = existingTables(sqlite);
    const orphans = findOrphans(sqlite, tables);

    if (orphans.length > 0 && !options.dropOrphans) {
      const detail = orphans
        .map(
          (o) =>
            `  ${o.table}.${o.column}: ${o.count} row(s) with no matching parent ` +
            `(e.g. ${o.examples.join(', ')})`
        )
        .join('\n');

      throw new Error(
        `The source database has rows whose parent is missing. Postgres enforces ` +
          `these foreign keys, so the copy would fail part-way:\n${detail}\n\n` +
          `Re-run with dropOrphans to leave those rows behind, having decided that ` +
          `is acceptable.`
      );
    }

    // One transaction for the whole copy. A partial migration is the worst
    // outcome available: it looks like it worked and the data is incomplete.
    const report: MigrationReport = { tables: [], orphans };

    await pg.sql.begin(async (tx) => {
      if (!options.allowNonEmptyTarget) {
        for (const table of TABLE_ORDER) {
          // The built-in templates are the one exception, and it is not a
          // loophole: the server seeds them from `builtinTemplates.ts` on every
          // start, so any target whose server has ever run holds three rows
          // that are code, not data. Without this, `db:import` becomes
          // impossible the moment someone starts the server once — which is
          // exactly what a first-time operator does before reading the docs.
          // Only `is_builtin = false` rows count as data here, and the seeded
          // ones are replaced below.
          const [{ count }] =
            table === 'task_templates'
              ? await tx`SELECT COUNT(*)::int AS count FROM task_templates WHERE is_builtin = false`
              : await tx`SELECT COUNT(*)::int AS count FROM ${tx(table)}`;

          if (count > 0) {
            throw new Error(
              `Target table "${table}" already holds ${count} row(s). Refusing to ` +
                `copy into a populated database — pass allowNonEmptyTarget if that ` +
                `is genuinely what you want.`
            );
          }
        }

        // Clear the seeded built-ins so the source's own copies insert without
        // colliding on their fixed ids. They are re-seeded at the next start,
        // so nothing is lost either way.
        await tx`DELETE FROM task_templates WHERE is_builtin = true`;
      }

      for (const table of TABLE_ORDER) {
        if (!tables.has(table)) {
          log(`skipping ${table}: not present in the source`);
          report.tables.push({ table, sourceRows: 0, copiedRows: 0 });
          continue;
        }

        const sourceColumns = columnsOf(sqlite, table);
        const booleans = new Set(BOOLEAN_COLUMNS[table] ?? []);
        const orphanFilter = FOREIGN_KEYS.filter((fk) => fk.table === table);

        let rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Array<
          Record<string, unknown>
        >;
        const sourceRows = rows.length;

        if (options.dropOrphans && orphanFilter.length > 0) {
          for (const fk of orphanFilter) {
            const parentIds = new Set(
              (
                sqlite
                  .prepare(`SELECT ${fk.parentColumn} AS id FROM ${fk.parentTable}`)
                  .all() as Array<{ id: string }>
              ).map((r) => r.id)
            );
            rows = rows.filter(
              (row) => row[fk.column] == null || parentIds.has(row[fk.column] as string)
            );
          }
        }

        if (rows.length === 0) {
          log(`${table}: nothing to copy`);
          report.tables.push({ table, sourceRows, copiedRows: 0 });
          continue;
        }

        const converted = rows.map((row) => {
          const out: Record<string, unknown> = {};
          for (const column of sourceColumns) {
            const value = row[column];
            out[column] = booleans.has(column) && value != null ? Boolean(value) : value;
          }
          return out;
        });

        // Batched: a single insert of 827 work items builds one enormous
        // statement, and postgres.js has a parameter ceiling.
        const BATCH = 200;
        for (let i = 0; i < converted.length; i += BATCH) {
          const batch = converted.slice(i, i + BATCH);
          await tx`INSERT INTO ${tx(table)} ${tx(batch, ...sourceColumns)}`;
        }

        log(`${table}: copied ${converted.length} of ${sourceRows}`);
        report.tables.push({ table, sourceRows, copiedRows: converted.length });
      }
    });

    return report;
  } finally {
    sqlite.close();
  }
}

/**
 * Re-reads both databases and compares row counts per table.
 *
 * Separate from the copy on purpose: a migration that reports its own success
 * from the numbers it just used is not evidence of anything.
 */
export async function verifyParity(
  sqlitePath: string,
  pg: PostgresHandle
): Promise<Array<{ table: string; sqlite: number; postgres: number; match: boolean }>> {
  const sqlite = new Database(sqlitePath, { readonly: true });
  try {
    const tables = existingTables(sqlite);
    const results = [];

    for (const table of TABLE_ORDER) {
      const sqliteCount = tables.has(table)
        ? ((sqlite.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c)
        : 0;

      const [{ count }] = await pg.sql`
        SELECT COUNT(*)::int AS count FROM ${pg.sql(table)}
      `;

      results.push({
        table,
        sqlite: sqliteCount,
        postgres: count as number,
        match: sqliteCount === count,
      });
    }

    return results;
  } finally {
    sqlite.close();
  }
}
