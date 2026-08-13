CREATE TABLE "chant_book_verses" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"verse_number" integer NOT NULL,
	"raw_text" text NOT NULL,
	"processed_data" text,
	"processed_at" text
);
--> statement-breakpoint
CREATE TABLE "chant_books" (
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
ALTER TABLE "chant_book_verses" ADD CONSTRAINT "chant_book_verses_book_id_chant_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."chant_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chant_book_verses_identity" ON "chant_book_verses" USING btree ("book_id","verse_number");--> statement-breakpoint
CREATE INDEX "idx_chant_books_user_language" ON "chant_books" USING btree ("user_id","language");