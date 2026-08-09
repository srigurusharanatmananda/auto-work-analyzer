CREATE TABLE "scan_leases" (
	"user_id" text NOT NULL,
	"scan_date" text NOT NULL,
	"owner" text NOT NULL,
	"expires_at" text NOT NULL,
	"completed_at" text,
	CONSTRAINT "scan_leases_user_id_scan_date_pk" PRIMARY KEY("user_id","scan_date")
);
