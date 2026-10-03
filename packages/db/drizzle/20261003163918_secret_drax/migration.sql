CREATE TABLE "public_scan_event" (
	"id" text PRIMARY KEY UNIQUE,
	"public_scan_id" text,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_scan_event_scan_event_unique" UNIQUE("public_scan_id","event")
);
--> statement-breakpoint
ALTER TABLE "public_scan_event" ADD CONSTRAINT "public_scan_event_public_scan_id_public_scan_id_fkey" FOREIGN KEY ("public_scan_id") REFERENCES "public_scan"("id") ON DELETE CASCADE;