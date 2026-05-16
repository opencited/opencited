import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { domainProjectTable } from "./domainProject";

export const promptQueryTable = pgTable("prompt_query", {
	id: id,
	domainProjectId: text("domain_project_id")
		.notNull()
		.references(() => domainProjectTable.id, { onDelete: "cascade" }),
	query: text("query").notNull(),
	lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const promptQuerySelectSchema = createSelectSchema(promptQueryTable);

export const promptQueryBaseInsertSchema = createInsertSchema(promptQueryTable);

export const promptQueryInsertSchema = promptQueryBaseInsertSchema.extend({
	query: z
		.string()
		.min(1, "Query is required")
		.refine(
			(val) => {
				const words = val
					.trim()
					.split(/\s+/)
					.filter((w) => w.length > 0);
				return words.length >= 10;
			},
			{
				message: "Query must be at least 10 words",
			},
		)
		.refine(
			(val) => {
				const words = val
					.trim()
					.split(/\s+/)
					.filter((w) => w.length > 0);
				return words.length <= 500;
			},
			{
				message: "Query must not exceed 500 words",
			},
		),
	domainProjectId: z.string().min(1, "Domain project is required"),
	lastCrawledAt: z.date().nullable().optional(),
});

export const promptQueryUpdateSchema = createUpdateSchema(promptQueryTable);
