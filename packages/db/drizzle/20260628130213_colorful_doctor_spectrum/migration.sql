CREATE TABLE "crawl_reference" (
	"id" text PRIMARY KEY UNIQUE,
	"crawl_id" text NOT NULL,
	"kind" text NOT NULL,
	"domain" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"position" integer,
	"description" text,
	"favicon" text,
	"source_name" text,
	"is_own_domain" boolean DEFAULT false NOT NULL,
	"is_competitor_domain" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crawl_reference_crawl_id_domain_idx" ON "crawl_reference" ("crawl_id","domain");--> statement-breakpoint
ALTER TABLE "crawl_reference" ADD CONSTRAINT "crawl_reference_crawl_id_prompt_query_crawl_id_fkey" FOREIGN KEY ("crawl_id") REFERENCES "prompt_query_crawl"("id") ON DELETE CASCADE;