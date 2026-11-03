CREATE TABLE "answer_engine" (
	"key" text PRIMARY KEY,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"disabled_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_engine_status_check" CHECK ("status" in ('enabled', 'disabled'))
);
--> statement-breakpoint
INSERT INTO "answer_engine" ("key", "display_name", "status", "disabled_reason", "sort_order") VALUES
	('chatgpt', 'ChatGPT', 'enabled', NULL, 10),
	('perplexity', 'Perplexity', 'disabled', 'Perplexity is temporarily unavailable while we fix an issue with it. ChatGPT is fully working.', 20)
ON CONFLICT ("key") DO NOTHING;
