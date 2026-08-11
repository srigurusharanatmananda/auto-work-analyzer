CREATE TABLE "learn_resource_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"original_filename" text NOT NULL,
	"stored_filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_learn_resource_uploads_user_language" ON "learn_resource_uploads" USING btree ("user_id","language");