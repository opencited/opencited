CREATE TABLE "sitemap" (
	"id" text PRIMARY KEY UNIQUE,
	"domain_project_id" text NOT NULL,
	"url" text NOT NULL,
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
ALTER TABLE "domain_project" ADD COLUMN "id" text;--> statement-breakpoint
ALTER TABLE "domain_project" DROP CONSTRAINT "domain_project_pkey";--> statement-breakpoint
ALTER TABLE "domain_project" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "domain_project" ALTER COLUMN "clerk_organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_project" ADD CONSTRAINT "domain_project_id_key" UNIQUE("id");--> statement-breakpoint
ALTER TABLE "sitemap" ADD CONSTRAINT "sitemap_domain_project_id_domain_project_id_fkey" FOREIGN KEY ("domain_project_id") REFERENCES "domain_project"("id");--> statement-breakpoint
ALTER TABLE "sitemap_url" ADD CONSTRAINT "sitemap_url_sitemap_id_sitemap_id_fkey" FOREIGN KEY ("sitemap_id") REFERENCES "sitemap"("id");