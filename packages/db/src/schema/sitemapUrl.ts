import { pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { sitemapTable } from "./sitemap";

export const sitemapUrlTable = pgTable("sitemap_url", {
	id: id,
	sitemapId: text("sitemap_id")
		.references(() => sitemapTable.id)
		.notNull(),
	url: text("url").notNull(),
	lastmod: text("lastmod"),
	changefreq: text("changefreq"),
	priority: text("priority"),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const sitemapUrlSelectSchema = createSelectSchema(sitemapUrlTable);
export const sitemapUrlBaseInsertSchema = createInsertSchema(sitemapUrlTable);
export const sitemapUrlInsertSchema = sitemapUrlBaseInsertSchema.extend({
	url: z.string().url({ message: "Invalid URL format" }),
});
export const sitemapUrlUpdateSchema = createUpdateSchema(sitemapUrlTable);
