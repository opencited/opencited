import { pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { domainProjectTable } from "./domainProject";

export const sitemapTable = pgTable("sitemap", {
	id: id,
	domainProjectId: text("domain_project_id")
		.references(() => domainProjectTable.id)
		.notNull(),
	url: text("url").notNull(),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const sitemapSelectSchema = createSelectSchema(sitemapTable);
export const sitemapBaseInsertSchema = createInsertSchema(sitemapTable);
export const sitemapInsertSchema = sitemapBaseInsertSchema.extend({
	url: z.url(),
});
export const sitemapUpdateSchema = createUpdateSchema(sitemapTable);
