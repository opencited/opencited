import { pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { domainProjectTable } from "./domainProject";

export const competitorTable = pgTable("competitor", {
	id: id,
	domainProjectId: text("domain_project_id")
		.notNull()
		.references(() => domainProjectTable.id, { onDelete: "cascade" }),

	name: text("name").notNull(),
	domain: text("domain").notNull(),
	active: text("active").notNull().default("true"),

	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const competitorSelectSchema = createSelectSchema(competitorTable);
export const competitorBaseInsertSchema = createInsertSchema(competitorTable);
export const competitorInsertSchema = competitorBaseInsertSchema.extend({
	domainProjectId: z.string().min(1),
	name: z.string().min(1),
	domain: z.string().min(1),
	active: z.string().optional(),
});
export const competitorUpdateSchema = createUpdateSchema(competitorTable);
