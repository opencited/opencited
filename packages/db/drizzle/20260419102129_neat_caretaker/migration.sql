ALTER TABLE "sitemap" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "sitemap" ADD COLUMN "url_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sitemap" ADD COLUMN "last_crawl_error" text;