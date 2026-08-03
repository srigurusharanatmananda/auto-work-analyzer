import Database from "better-sqlite3";
import { CredentialCipher } from "../destinations/CredentialCipher.js";
import { migration002 } from "./002-destinations.js";

export interface Migration {
  id: string;
  run(db: Database.Database, cipher: CredentialCipher): void;
}

const MIGRATIONS: Migration[] = [migration002];

/**
 * Applies pending data migrations exactly once each. Schema creation still
 * happens via CREATE TABLE IF NOT EXISTS in the individual stores; this exists
 * for one-time data moves, which that pattern cannot express.
 *
 * The bookkeeping row is written after the migration body, not with it. That
 * ordering is deliberate and safe in both directions: each migration's data
 * move is itself transactional, so a crash mid-move rolls back and the missing
 * bookkeeping row makes the next boot retry it; and a crash *between* the move
 * and the bookkeeping row also retries, which is why every migration here must
 * be idempotent (002 is — it selects only rows that still hold a plaintext key,
 * and there are none left after a successful run).
 */
export function runMigrations(dbPath: string, cipher: CredentialCipher): void {
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = new Set(
      (db.prepare(`SELECT id FROM schema_migrations`).all() as Array<{ id: string }>).map(
        (row) => row.id
      )
    );

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      migration.run(db, cipher);
      db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`).run(
        migration.id,
        new Date().toISOString()
      );
      console.log(`Applied migration ${migration.id}`);
    }
  } finally {
    db.close();
  }
}
