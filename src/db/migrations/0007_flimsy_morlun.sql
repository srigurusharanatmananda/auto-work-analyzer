CREATE TABLE "rate_limit_hits" (
	"limiter" text NOT NULL,
	"client_key" text NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"reset_at" text NOT NULL,
	CONSTRAINT "rate_limit_hits_limiter_client_key_pk" PRIMARY KEY("limiter","client_key")
);
