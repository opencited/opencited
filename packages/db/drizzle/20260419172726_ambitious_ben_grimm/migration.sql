CREATE TABLE "domain_project" (
	"id" text PRIMARY KEY UNIQUE,
	"clerk_organization_id" text,
	"domain" text NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitemap" (
	"id" text PRIMARY KEY UNIQUE,
	"domain_project_id" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"url_count" integer DEFAULT 0 NOT NULL,
	"last_crawl_error" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitemap_url" (
	"id" text PRIMARY KEY UNIQUE,
	"sitemap_id" text NOT NULL,
	"url" text NOT NULL,
	"lastmod" text,
	"changefreq" text,
	"priority" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sitemap_domain_project_url_unique" ON "sitemap" ("domain_project_id","url");--> statement-breakpoint
ALTER TABLE "sitemap" ADD CONSTRAINT "sitemap_domain_project_id_domain_project_id_fkey" FOREIGN KEY ("domain_project_id") REFERENCES "domain_project"("id");--> statement-breakpoint
ALTER TABLE "sitemap_url" ADD CONSTRAINT "sitemap_url_sitemap_id_sitemap_id_fkey" FOREIGN KEY ("sitemap_id") REFERENCES "sitemap"("id");