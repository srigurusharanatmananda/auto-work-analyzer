ALTER TABLE "transcription_jobs" ADD COLUMN "action_items" text;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "created_item_indexes" text;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "swept_at" text;--> statement-breakpoint
CREATE INDEX "idx_transcription_sweep" ON "transcription_jobs" USING btree ("user_id","status","swept_at");