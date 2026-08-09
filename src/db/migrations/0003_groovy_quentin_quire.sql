-- Scope processed_commits per user.
--
-- Hand-written. drizzle-kit could not resolve the existing primary key's name
-- and emitted the ADD CONSTRAINT *before* the column it references exists, so
-- its generated version cannot run at all.
--
-- Order matters here: the column has to exist and be populated before it can
-- carry a primary key, and the old single-column key has to go first or the two
-- would conflict.
--
-- Existing rows default to '*' (LEGACY_COMMIT_OWNER). They record only that
-- somebody filed the commit, and who is unrecoverable — so they count as
-- processed for everyone. Treating them as unowned would make every user's next
-- scan re-file the entire history as new work.
ALTER TABLE "processed_commits" ADD COLUMN "user_id" text DEFAULT '*' NOT NULL;--> statement-breakpoint
ALTER TABLE "processed_commits" DROP CONSTRAINT "processed_commits_pkey";--> statement-breakpoint
ALTER TABLE "processed_commits" ADD CONSTRAINT "processed_commits_user_id_hash_pk" PRIMARY KEY("user_id","hash");
