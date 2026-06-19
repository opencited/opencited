import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { promptQueryCrawlTable } from "./promptQueryCrawl";
import { competitorTable } from "./competitor";

export const crawlBrandMentionTable = pgTable("crawl_brand_mention", {
	id: id,
	crawlId: text("crawl_id")
		.notNull()
		.references(() => promptQueryCrawlTable.id, { onDelete: "cascade" }),
	competitorId: text("competitor_id").references(() => competitorTable.id, {
		onDelete: "set null",
	}),

	brandName: text("brand_name").notNull(),
	brandUrl: text("brand_url"),

	context: text("context").notNull(),

	mentionType: text("mention_type").notNull(),

	metadata: jsonb("metadata"),

	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const crawlBrandMentionSelectSchema = createSelectSchema(
	crawlBrandMentionTable,
);
export const crawlBrandMentionBaseInsertSchema = createInsertSchema(
	crawlBrandMentionTable,
);
export const crawlBrandMentionInsertSchema =
	crawlBrandMentionBaseInsertSchema.extend({
		crawlId: z.string().min(1),
		competitorId: z.string().optional(),
		brandName: z.string().min(1),
		brandUrl: z.string().optional(),
		context: z.string().min(1),
		mentionType: z.enum(["target", "competitor", "other"]),
		metadata: z.record(z.string(), z.unknown()).optional(),
	});
export const crawlBrandMentionUpdateSchema = createUpdateSchema(
	crawlBrandMentionTable,
);
