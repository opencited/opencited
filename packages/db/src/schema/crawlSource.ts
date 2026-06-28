import { pgTable, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { promptQueryCrawlTable } from "./promptQueryCrawl";

export const crawlSourceTable = pgTable("crawl_source", {
	id: id,
	crawlId: text("crawl_id")
		.notNull()
		.references(() => promptQueryCrawlTable.id, { onDelete: "cascade" }),

	domain: text("domain").notNull(),
	url: text("url").notNull(),
	title: text("title"),
	description: text("description"),
	position: integer("position"),

	isOwnDomain: boolean("is_own_domain").notNull().default(false),
	isCompetitorDomain: boolean("is_competitor_domain").notNull().default(false),

	metadata: jsonb("metadata"),

	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const crawlSourceSelectSchema = createSelectSchema(crawlSourceTable);
export const crawlSourceBaseInsertSchema = createInsertSchema(crawlSourceTable);
export const crawlSourceInsertSchema = crawlSourceBaseInsertSchema.extend({
	crawlId: z.string().min(1),
	domain: z.string().min(1),
	url: z.string().url(),
	title: z.string().optional(),
	description: z.string().optional(),
	position: z.number().int().optional(),
	isOwnDomain: z.boolean().optional(),
	isCompetitorDomain: z.boolean().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export const crawlSourceUpdateSchema = createUpdateSchema(crawlSourceTable);
