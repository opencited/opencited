import { pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";

export const domainProjectTable = pgTable("domain_project", {
	id: id,
	clerkOrganizationId: text("clerk_organization_id"),
	domain: text("domain").notNull(),
	logoUrl: text("logo_url"),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const domainProjectSelectSchema = createSelectSchema(domainProjectTable);
export const domainProjectBaseInsertSchema =
	createInsertSchema(domainProjectTable);
export const domainProjectInsertSchema = domainProjectBaseInsertSchema.extend({
	domain: z.string().min(1),
	logoUrl: z.string().url().optional(),
});
export const domainProjectUpdateSchema = createUpdateSchema(domainProjectTable);
