#!/usr/bin/env tsx
/**
 * One-shot import of the existing SQLite database into Postgres.
 *
 *   DATABASE_URL=postgres://localhost:5432/auto_work_analyzer \
 *     bun run db:import [--sqlite <path>] [--drop-orphans] [--allow-non-empty]
 *
 * Applies the Drizzle migrations first, so a fresh empty database is a valid
 * starting point, then copies and independently verifies. Read-only on the
 * SQLite side: the source is opened readonly and is never modified, so this can
 * be run against a live install and re-run after checking the result.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from 'dotenv';
import { openPostgres } from '../src/db/client.js';
import { migrateSqliteToPostgres, verifyParity } from '../src/db/sqliteToPostgres.js';

config();

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function value(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function main(): Promise<void> {
  const sqlitePath = path.resolve(
    value('sqlite', path.join(process.cwd(), '.database', 'auto-work-analyzer.db'))
  );

  console.log(`Source: ${sqlitePath}`);

  const pg = openPostgres();
  try {
    console.log('Applying schema migrations...');
    await migrate(pg.db, { migrationsFolder: 'src/db/migrations' });

    console.log('Copying...');
    await migrateSqliteToPostgres({
      sqlitePath,
      postgres: pg,
      dropOrphans: flag('drop-orphans'),
      allowNonEmptyTarget: flag('allow-non-empty'),
      onProgress: (message) => console.log(`  ${message}`),
    });

    console.log('\nVerifying (re-counting both databases independently)...');
    const parity = await verifyParity(sqlitePath, pg);

    for (const row of parity) {
      console.log(
        `  ${row.match ? '✔' : '✖'} ${row.table.padEnd(22)} ` +
          `sqlite=${String(row.sqlite).padStart(5)} postgres=${String(row.postgres).padStart(5)}`
      );
    }

    const mismatches = parity.filter((row) => !row.match);
    if (mismatches.length > 0) {
      console.error(`\n✖ ${mismatches.length} table(s) do not match. The copy is NOT complete.`);
      process.exitCode = 1;
      return;
    }

    const total = parity.reduce((sum, row) => sum + row.postgres, 0);
    console.log(`\n✔ ${total} row(s) copied and verified across ${parity.length} tables.`);
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await pg.close();
  }
}

void main();
