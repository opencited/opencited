CREATE TABLE "proxy_config" (
	"id" text PRIMARY KEY UNIQUE,
	"domain_project_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"source_type" text NOT NULL,
	"source_value" text NOT NULL,
	"sticky_proxy_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proxy_config" ADD CONSTRAINT "proxy_config_domain_project_id_domain_project_id_fkey" FOREIGN KEY ("domain_project_id") REFERENCES "domain_project"("id") ON DELETE CASCADE;