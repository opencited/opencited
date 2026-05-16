CREATE TABLE "prompt_query" (
	"id" text PRIMARY KEY UNIQUE,
	"domain_project_id" text NOT NULL,
	"query" text NOT NULL,
	"last_crawled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_query" ADD CONSTRAINT "prompt_query_domain_project_id_domain_project_id_fkey" FOREIGN KEY ("domain_project_id") REFERENCES "domain_project"("id") ON DELETE CASCADE;