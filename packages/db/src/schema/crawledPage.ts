import { pgTable, text, integer } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { sitemapUrlTable } from "./sitemapUrl";

export const crawlStatusEnum = z.enum([
	"pending",
	"fetched",
	"analyzed",
	"error",
]);
export type CrawlStatus = z.infer<typeof crawlStatusEnum>;

export const crawledPageTable = pgTable("crawled_page", {
	id: id,
	sitemapUrlId: text("sitemap_url_id")
		.references(() => sitemapUrlTable.id)
		.notNull(),
	url: text("url").notNull(),
	httpStatus: integer("http_status"),
	contentLength: integer("content_length"),
	fetchedAt: text("fetched_at"),
	contentHash: text("content_hash"),
	crawlStatus: text("crawl_status").notNull().default("pending"),
	fetchError: text("fetch_error"),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const crawledPageSelectSchema = createSelectSchema(crawledPageTable);
export const crawledPageBaseInsertSchema = createInsertSchema(crawledPageTable);
export const crawledPageInsertSchema = crawledPageBaseInsertSchema.extend({
	sitemapUrlId: z.string().uuid(),
	url: z.string().url(),
	httpStatus: z.number().int().min(100).max(599).optional(),
	contentLength: z.number().int().nonnegative().optional(),
	contentHash: z.string().optional(),
	crawlStatus: crawlStatusEnum.optional(),
	fetchError: z.string().optional(),
});
export const crawledPageUpdateSchema = createUpdateSchema(crawledPageTable);
