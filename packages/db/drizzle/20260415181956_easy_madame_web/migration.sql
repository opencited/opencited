CREATE TABLE "domain_project" (
	"clerk_organization_id" text PRIMARY KEY,
	"domain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
