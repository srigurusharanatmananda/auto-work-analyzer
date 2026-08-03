import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { CredentialCipher } from "../destinations/CredentialCipher.js";
import { DESTINATIONS_SCHEMA } from "../destinations/DestinationStore.js";
import { Migration } from "./runMigrations.js";

interface SettingsRow {
  user_id: string;
  default_assignee: string | null;
  clickup_api_key: string | null;
  clickup_team_id: string | null;
  clickup_list_id: string | null;
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return row !== undefined;
}

/**
 * Moves plaintext ClickUp credentials out of user_settings and into an
 * encrypted default destination.
 *
 * This is the only copy of those keys, so the order of operations is the whole
 * design:
 *
 *  1. encrypt, then decrypt the result and compare — a cipher that cannot read
 *     back what it wrote must abort the migration, not proceed to erase the
 *     plaintext;
 *  2. insert the destination and null the plaintext in ONE transaction, so
 *     there is no instant where the key exists in neither place;
 *  3. skip (and keep the plaintext of) any user whose team or list id is
 *     missing — an unusable destination is not worth a lost credential.
 *
 * Re-running is a no-op: the SELECT only matches rows that still hold a
 * plaintext key, and a successful run leaves none.
 *
 * user_settings.clickup_api_key is nulled but the column is retained for one
 * release so a rollback is possible; drop it afterwards.
 */
export const migration002: Migration = {
  id: "002-destinations",

  run(db: Database.Database, cipher: CredentialCipher): void {
    db.exec(DESTINATIONS_SCHEMA);

    if (!tableExists(db, "user_settings")) return;

    const rows = db
      .prepare(
        `SELECT user_id, default_assignee, clickup_api_key, clickup_team_id, clickup_list_id
         FROM user_settings
         WHERE clickup_api_key IS NOT NULL AND clickup_api_key != ''`
      )
      .all() as SettingsRow[];

    if (rows.length === 0) return;

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO clickup_destinations
         (id, user_id, name, api_key_encrypted, team_id, team_name, space_id, space_name,
          folder_id, folder_name, list_id, list_name, default_template_id, default_assignee,
          is_default, created_at, updated_at)
       VALUES (?, ?, 'Default (migrated)', ?, ?, NULL, NULL, NULL, NULL, NULL, ?, NULL,
               'builtin-standard', ?, ?, ?, ?)`
    );
    const clear = db.prepare(`UPDATE user_settings SET clickup_api_key = NULL WHERE user_id = ?`);
    const countFor = db.prepare(
      `SELECT COUNT(*) AS n FROM clickup_destinations WHERE user_id = ?`
    );

    const apply = db.transaction(() => {
      for (const row of rows) {
        if (!row.clickup_team_id || !row.clickup_list_id) {
          console.warn(
            `Skipping credential migration for user ${row.user_id}: missing team or list id. ` +
              `Their key is left where it is; re-save the destination from Settings.`
          );
          continue;
        }

        const encrypted = cipher.encrypt(row.clickup_api_key!);
        if (cipher.decrypt(encrypted) !== row.clickup_api_key) {
          // Never include either value in the message.
          throw new Error(
            "Aborting credential migration: the encrypted credential did not round-trip. " +
              "Check CREDENTIAL_ENCRYPTION_KEY. Nothing has been changed."
          );
        }

        // A user who already configured a destination keeps their own default.
        const existing = countFor.get(row.user_id) as { n: number };

        insert.run(
          randomUUID(),
          row.user_id,
          encrypted,
          row.clickup_team_id,
          row.clickup_list_id,
          row.default_assignee,
          existing.n === 0 ? 1 : 0,
          now,
          now
        );
        clear.run(row.user_id);
      }
    });

    apply();
  },
};
