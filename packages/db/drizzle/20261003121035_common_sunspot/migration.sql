ALTER TABLE "public_scan" ADD COLUMN "homepage_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "public_scan" ADD COLUMN "ai_mention_probe" jsonb;--> statement-breakpoint
ALTER TABLE "public_scan" ADD COLUMN "probe_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scan_lead" ADD COLUMN "probe_report_sent_at" timestamp with time zone;