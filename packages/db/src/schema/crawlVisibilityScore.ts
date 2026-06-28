import {
	pgTable,
	text,
	integer,
	boolean,
	timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { createdAt, updatedAt } from "./common-fields";
import { promptQueryCrawlTable } from "./promptQueryCrawl";

export const sentimentLabelEnum = z.enum(["positive", "neutral", "negative"]);
export type SentimentLabel = z.infer<typeof sentimentLabelEnum>;

export const crawlVisibilityScoreTable = pgTable("crawl_visibility_score", {
	crawlId: text("crawl_id")
		.primaryKey()
		.references(() => promptQueryCrawlTable.id, { onDelete: "cascade" }),

	// Sub-scores (all 0–100, see docs/agents/visibility-score.md)
	mentionScore: integer("mention_score").notNull(),
	positionScore: integer("position_score").notNull(),
	citationScore: integer("citation_score").notNull(),
	sentimentScore: integer("sentiment_score").notNull(),
	coMentionScore: integer("co_mention_score").notNull(),

	// Composite (0–100)
	visibilityScore: integer("visibility_score").notNull(),

	// Sentiment provenance
	sentimentLabel: text("sentiment_label"),
	sentimentIsFallback: boolean("sentiment_is_fallback")
		.notNull()
		.default(false),
	sentimentCacheHit: boolean("sentiment_cache_hit").notNull().default(false),
	sentimentRetryCount: integer("sentiment_retry_count").notNull().default(0),
	sentimentLastAttemptAt: timestamp("sentiment_last_attempt_at", {
		withTimezone: true,
	}),

	// Audit
	formulaVersion: text("formula_version").notNull(),

	// Timing
	computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),

	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const crawlVisibilityScoreSelectSchema = createSelectSchema(
	crawlVisibilityScoreTable,
);
export const crawlVisibilityScoreBaseInsertSchema = createInsertSchema(
	crawlVisibilityScoreTable,
);
export const crawlVisibilityScoreInsertSchema =
	crawlVisibilityScoreBaseInsertSchema.extend({
		crawlId: z.string().min(1),
		mentionScore: z.number().int().min(0).max(100),
		positionScore: z.number().int().min(0).max(100),
		citationScore: z.number().int().min(0).max(100),
		sentimentScore: z.number().int().min(0).max(100),
		coMentionScore: z.number().int().min(0).max(100),
		visibilityScore: z.number().int().min(0).max(100),
		sentimentLabel: sentimentLabelEnum.optional(),
		sentimentIsFallback: z.boolean().optional(),
		sentimentCacheHit: z.boolean().optional(),
		sentimentRetryCount: z.number().int().min(0).max(2).optional(),
		sentimentLastAttemptAt: z.date().optional(),
		formulaVersion: z.string().min(1),
		computedAt: z.date(),
	});
export const crawlVisibilityScoreUpdateSchema = createUpdateSchema(
	crawlVisibilityScoreTable,
);
