CREATE TABLE "rate_limit_buckets" (
	"action" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limit_buckets_action_key_hash_window_start_pk" PRIMARY KEY("action","key_hash","window_start")
);
--> statement-breakpoint
CREATE INDEX "idx_rate_limit_window" ON "rate_limit_buckets" USING btree ("window_start");