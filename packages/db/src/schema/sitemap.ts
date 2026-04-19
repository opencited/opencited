import { pgTable, text, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { domainProjectTable } from "./domainProject";

export const sitemapStatusEnum = z.enum(["pending", "indexed", "error"]);

export const sitemapTable = pgTable(
	"sitemap",
	{
		id: id,
		domainProjectId: text("domain_project_id")
			.references(() => domainProjectTable.id)
			.notNull(),
		url: text("url").notNull(),
		status: text("status").notNull().default("pending"),
		urlCount: integer("url_count").notNull().default(0),
		lastCrawlError: text("last_crawl_error"),
		createdAt: createdAt,
		updatedAt: updatedAt,
	},
	(table) => [
		uniqueIndex("sitemap_domain_project_url_unique").on(
			table.domainProjectId,
			table.url,
		),
	],
);

export const sitemapSelectSchema = createSelectSchema(sitemapTable);
export const sitemapBaseInsertSchema = createInsertSchema(sitemapTable);
export const sitemapInsertSchema = sitemapBaseInsertSchema.extend({
	url: z.string().url(),
	status: sitemapStatusEnum.optional(),
	urlCount: z.number().int().nonnegative().optional(),
});
export const sitemapUpdateSchema = createUpdateSchema(sitemapTable);
