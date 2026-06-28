import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { promptQueryTable } from "./promptQuery";
import { domainProjectTable } from "./domainProject";

export const promptQueryCrawlStatusEnum = z.enum([
	"pending",
	"running",
	"completed",
	"failed",
]);
export type PromptQueryCrawlStatus = z.infer<typeof promptQueryCrawlStatusEnum>;

export const crawlProviderEnum = z.enum(["perplexity", "chatgpt"]);
export type CrawlProvider = z.infer<typeof crawlProviderEnum>;

export const promptQueryCrawlTable = pgTable("prompt_query_crawl", {
	id: id,
	promptQueryId: text("prompt_query_id")
		.notNull()
		.references(() => promptQueryTable.id, { onDelete: "cascade" }),
	domainProjectId: text("domain_project_id").references(
		() => domainProjectTable.id,
	),

	status: text("status").notNull().default("pending"),
	provider: text("provider"),
	triggerRunId: text("trigger_run_id"),

	// Input snapshot
	query: text("query").notNull(),
	promptSnapshot: text("prompt_snapshot"),

	// Output fields
	url: text("url"),
	title: text("title"),
	content: text("content"),
	loadTimeMs: integer("load_time_ms"),
	answerFormat: text("answer_format"),
	wordCount: integer("word_count"),
	sourceCount: integer("source_count").default(0),
	brandMentionCount: integer("brand_mention_count").default(0),

	// Error tracking
	error: text("error"),

	// Timing
	startedAt: timestamp("started_at", { withTimezone: true }),
	completedAt: timestamp("completed_at", { withTimezone: true }),

	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const promptQueryCrawlSelectSchema = createSelectSchema(
	promptQueryCrawlTable,
);
export const promptQueryCrawlBaseInsertSchema = createInsertSchema(
	promptQueryCrawlTable,
);
export const promptQueryCrawlInsertSchema =
	promptQueryCrawlBaseInsertSchema.extend({
		promptQueryId: z.string().min(1, "Prompt query is required"),
		domainProjectId: z.string().optional(),
		status: promptQueryCrawlStatusEnum.optional(),
		provider: crawlProviderEnum.optional(),
		triggerRunId: z.string().optional(),
		query: z.string().min(1, "Query is required"),
		promptSnapshot: z.string().optional(),
		url: z.string().url().optional(),
		title: z.string().optional(),
		content: z.string().optional(),
		loadTimeMs: z.number().int().nonnegative().optional(),
		answerFormat: z.string().optional(),
		wordCount: z.number().int().nonnegative().optional(),
		sourceCount: z.number().int().nonnegative().optional(),
		brandMentionCount: z.number().int().nonnegative().optional(),
		error: z.string().optional(),
		startedAt: z.date().optional(),
		completedAt: z.date().optional(),
	});
export const promptQueryCrawlUpdateSchema = createUpdateSchema(
	promptQueryCrawlTable,
);
