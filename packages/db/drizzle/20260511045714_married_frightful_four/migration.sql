CREATE TABLE "prompt_query_crawl" (
	"id" text PRIMARY KEY UNIQUE,
	"prompt_query_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"trigger_run_id" text,
	"query" text NOT NULL,
	"url" text,
	"title" text,
	"content" text,
	"load_time_ms" integer,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD CONSTRAINT "prompt_query_crawl_prompt_query_id_prompt_query_id_fkey" FOREIGN KEY ("prompt_query_id") REFERENCES "prompt_query"("id") ON DELETE CASCADE;