CREATE TABLE "analysis_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"timestamp" text NOT NULL,
	"project_path" text NOT NULL,
	"date" text NOT NULL,
	"end_date" text,
	"author" text,
	"branch" text,
	"total_commits" integer NOT NULL,
	"total_work_items" integer NOT NULL,
	"tasks_created" integer NOT NULL,
	"summary" text NOT NULL,
	"created_at" text DEFAULT (now() at time zone 'utc')::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clickup_destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text,
	"space_id" text,
	"space_name" text,
	"folder_id" text,
	"folder_name" text,
	"list_id" text NOT NULL,
	"list_name" text,
	"default_template_id" text,
	"default_assignee" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"success" boolean NOT NULL,
	"attempted_at" text NOT NULL,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "processed_commits" (
	"hash" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"author" text NOT NULL,
	"message" text NOT NULL,
	"project_path" text NOT NULL,
	"processed_at" text NOT NULL,
	"task_id" text,
	"task_name" text
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" text,
	"user_agent" text,
	"ip_address" text,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ran_at" text NOT NULL,
	"summary" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"root" text NOT NULL,
	"owner" text NOT NULL,
	"author_identities" text NOT NULL,
	"scan_time" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_completed_date" text
);
--> statement-breakpoint
CREATE TABLE "scanned_repos" (
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"destination_id" text,
	"template_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_scanned_date" text,
	CONSTRAINT "scanned_repos_user_id_slug_pk" PRIMARY KEY("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"id" text PRIMARY KEY NOT NULL,
	"applied_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"description" text,
	"name_template" text NOT NULL,
	"description_template" text NOT NULL,
	"options" text NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_blacklist" (
	"jti" text PRIMARY KEY NOT NULL,
	"token_type" text NOT NULL,
	"expires_at" text NOT NULL,
	"blacklisted_at" text NOT NULL,
	"reason" text,
	CONSTRAINT "token_blacklist_type_check" CHECK ("token_blacklist"."token_type" IN ('access', 'refresh'))
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_assignee" text,
	"backend_url" text,
	"clickup_api_key" text,
	"clickup_team_id" text,
	"clickup_list_id" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"last_login_at" text,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('admin', 'manager', 'user'))
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"estimated_hours" real DEFAULT 0 NOT NULL,
	"complexity" integer DEFAULT 0 NOT NULL,
	"files_count" integer DEFAULT 0 NOT NULL,
	"commits_count" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (now() at time zone 'utc')::text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_analysis_id_analysis_history_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analysis_user" ON "analysis_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analysis_timestamp" ON "analysis_history" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_analysis_project" ON "analysis_history" USING btree ("project_path");--> statement-breakpoint
CREATE INDEX "idx_destinations_user" ON "clickup_destinations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email" ON "login_attempts" USING btree ("email","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_ip" ON "login_attempts" USING btree ("ip_address","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_processed_commits_project" ON "processed_commits" USING btree ("project_path");--> statement-breakpoint
CREATE INDEX "idx_processed_commits_date" ON "processed_commits" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_templates_user" ON "task_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_blacklist_expires" ON "token_blacklist" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_lower" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_work_items_analysis" ON "work_items" USING btree ("analysis_id");