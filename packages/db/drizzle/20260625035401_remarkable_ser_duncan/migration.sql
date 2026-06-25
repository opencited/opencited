CREATE TABLE "crawl_visibility_score" (
	"crawl_id" text PRIMARY KEY,
	"mention_score" integer NOT NULL,
	"position_score" integer NOT NULL,
	"citation_score" integer NOT NULL,
	"sentiment_score" integer NOT NULL,
	"co_mention_score" integer NOT NULL,
	"visibility_score" integer NOT NULL,
	"sentiment_label" text,
	"sentiment_is_fallback" boolean DEFAULT false NOT NULL,
	"sentiment_cache_hit" boolean DEFAULT false NOT NULL,
	"sentiment_retry_count" integer DEFAULT 0 NOT NULL,
	"sentiment_last_attempt_at" timestamp with time zone,
	"formula_version" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_brand_mention" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "crawl_visibility_score" ADD CONSTRAINT "crawl_visibility_score_crawl_id_prompt_query_crawl_id_fkey" FOREIGN KEY ("crawl_id") REFERENCES "prompt_query_crawl"("id") ON DELETE CASCADE;