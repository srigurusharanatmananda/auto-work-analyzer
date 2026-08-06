CREATE TABLE "transcription_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"audio_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"transcript" text,
	"segments" text,
	"language" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" text,
	"segments_seen" integer DEFAULT 0 NOT NULL,
	"call_title" text,
	"call_date" text,
	"created_at" text DEFAULT (now() at time zone 'utc')::text NOT NULL,
	"updated_at" text DEFAULT (now() at time zone 'utc')::text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_transcription_user" ON "transcription_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transcription_status_created" ON "transcription_jobs" USING btree ("status","created_at");