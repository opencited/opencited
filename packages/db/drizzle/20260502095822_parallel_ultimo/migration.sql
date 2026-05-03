CREATE TABLE "crawled_page" (
	"id" text PRIMARY KEY UNIQUE,
	"sitemap_url_id" text NOT NULL,
	"url" text NOT NULL,
	"http_status" integer,
	"content_length" integer,
	"fetched_at" text,
	"content_hash" text,
	"crawl_status" text DEFAULT 'pending' NOT NULL,
	"fetch_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_analysis" (
	"id" text PRIMARY KEY UNIQUE,
	"crawled_page_id" text NOT NULL,
	"analyzed_at" text,
	"word_count" integer,
	"text_html_ratio" text,
	"heading_structure" jsonb,
	"images_total" integer,
	"images_with_alt" integer,
	"internal_links" integer,
	"external_links" integer,
	"dom_depth_avg" text,
	"tone" text,
	"sentiment" text,
	"sentiment_score" integer,
	"subjectivity" text,
	"perceived_page_type" text,
	"perceived_intent" text,
	"perceived_audience" text,
	"named_entities" jsonb,
	"verb_tense" text,
	"extracted_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sitemap" ADD COLUMN "active_crawl_run_id" text;--> statement-breakpoint
ALTER TABLE "sitemap_url" ADD COLUMN "active_crawl_run_id" text;--> statement-breakpoint
ALTER TABLE "crawled_page" ADD CONSTRAINT "crawled_page_sitemap_url_id_sitemap_url_id_fkey" FOREIGN KEY ("sitemap_url_id") REFERENCES "sitemap_url"("id");--> statement-breakpoint
ALTER TABLE "page_analysis" ADD CONSTRAINT "page_analysis_crawled_page_id_crawled_page_id_fkey" FOREIGN KEY ("crawled_page_id") REFERENCES "crawled_page"("id");