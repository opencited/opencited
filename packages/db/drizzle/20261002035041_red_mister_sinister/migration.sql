CREATE TABLE "public_scan" (
	"id" text PRIMARY KEY UNIQUE,
	"domain" text NOT NULL,
	"final_url" text NOT NULL,
	"score" integer NOT NULL,
	"readiness" text NOT NULL,
	"issues" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"client_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_lead" (
	"id" text PRIMARY KEY UNIQUE,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"public_scan_id" text NOT NULL,
	"consent_to_on_change_updates" boolean DEFAULT false NOT NULL,
	"code_hash" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"report_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_lead_public_scan_email_unique" UNIQUE("public_scan_id","email")
);
--> statement-breakpoint
ALTER TABLE "scan_lead" ADD CONSTRAINT "scan_lead_public_scan_id_public_scan_id_fkey" FOREIGN KEY ("public_scan_id") REFERENCES "public_scan"("id") ON DELETE CASCADE;