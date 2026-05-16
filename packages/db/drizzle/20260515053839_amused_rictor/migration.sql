CREATE TABLE "competitor" (
	"id" text PRIMARY KEY UNIQUE,
	"domain_project_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_source" (
	"id" text PRIMARY KEY UNIQUE,
	"crawl_id" text NOT NULL,
	"domain" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"position" integer,
	"is_own_domain" text DEFAULT 'false' NOT NULL,
	"is_competitor_domain" text DEFAULT 'false' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_brand_mention" (
	"id" text PRIMARY KEY UNIQUE,
	"crawl_id" text NOT NULL,
	"competitor_id" text,
	"brand_name" text NOT NULL,
	"brand_url" text,
	"context" text NOT NULL,
	"position" integer,
	"mention_type" text NOT NULL,
	"relative_position" text,
	"is_recommendation" text DEFAULT 'false',
	"objection" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_project" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "domain_project" ADD COLUMN "aliases" jsonb DEFAULT '"[]"';--> statement-breakpoint
ALTER TABLE "domain_project" ADD COLUMN "active" text DEFAULT 'true' NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD COLUMN "domain_project_id" text;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD COLUMN "prompt_snapshot" text;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD COLUMN "answer_format" text;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD COLUMN "word_count" integer;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD COLUMN "source_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD COLUMN "brand_mention_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "prompt_query_crawl" ADD CONSTRAINT "prompt_query_crawl_domain_project_id_domain_project_id_fkey" FOREIGN KEY ("domain_project_id") REFERENCES "domain_project"("id");--> statement-breakpoint
ALTER TABLE "competitor" ADD CONSTRAINT "competitor_domain_project_id_domain_project_id_fkey" FOREIGN KEY ("domain_project_id") REFERENCES "domain_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crawl_source" ADD CONSTRAINT "crawl_source_crawl_id_prompt_query_crawl_id_fkey" FOREIGN KEY ("crawl_id") REFERENCES "prompt_query_crawl"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crawl_brand_mention" ADD CONSTRAINT "crawl_brand_mention_crawl_id_prompt_query_crawl_id_fkey" FOREIGN KEY ("crawl_id") REFERENCES "prompt_query_crawl"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crawl_brand_mention" ADD CONSTRAINT "crawl_brand_mention_competitor_id_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "competitor"("id") ON DELETE SET NULL;