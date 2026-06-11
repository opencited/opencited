CREATE TABLE "prompt_template" (
	"id" text PRIMARY KEY UNIQUE,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"text" text NOT NULL,
	"industry" text NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb DEFAULT '"[]"' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
