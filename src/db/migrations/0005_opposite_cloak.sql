CREATE TABLE "learn_audio_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"voice" text NOT NULL,
	"prosody" text NOT NULL,
	"created_at" text DEFAULT (now() at time zone 'utc')::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"language" text NOT NULL,
	"lesson_id" text NOT NULL,
	"first_seen_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_learn_progress_identity" ON "learn_progress" USING btree ("user_id","language","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_learn_progress_user_language" ON "learn_progress" USING btree ("user_id","language");