CREATE TABLE "learn_resource_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_learn_resource_notes_user_resource" ON "learn_resource_notes" USING btree ("user_id","resource_id");