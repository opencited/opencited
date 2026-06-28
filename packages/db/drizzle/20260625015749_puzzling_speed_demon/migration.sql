ALTER TABLE "domain_project" ALTER COLUMN "active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "domain_project" ALTER COLUMN "active" SET DATA TYPE boolean USING "active"::boolean;--> statement-breakpoint
ALTER TABLE "domain_project" ALTER COLUMN "active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "competitor" ALTER COLUMN "active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "competitor" ALTER COLUMN "active" SET DATA TYPE boolean USING "active"::boolean;--> statement-breakpoint
ALTER TABLE "competitor" ALTER COLUMN "active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "crawl_source" ALTER COLUMN "is_own_domain" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "crawl_source" ALTER COLUMN "is_own_domain" SET DATA TYPE boolean USING "is_own_domain"::boolean;--> statement-breakpoint
ALTER TABLE "crawl_source" ALTER COLUMN "is_own_domain" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "crawl_source" ALTER COLUMN "is_competitor_domain" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "crawl_source" ALTER COLUMN "is_competitor_domain" SET DATA TYPE boolean USING "is_competitor_domain"::boolean;--> statement-breakpoint
ALTER TABLE "crawl_source" ALTER COLUMN "is_competitor_domain" SET DEFAULT false;