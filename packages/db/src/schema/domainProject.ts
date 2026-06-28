import { pgTable, text, boolean, jsonb } from "drizzle-orm/pg-core";
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
	name: text("name"),
	aliases: jsonb("aliases").default("[]"),
	logoUrl: text("logo_url"),
	active: boolean("active").notNull().default(true),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const domainProjectSelectSchema = createSelectSchema(domainProjectTable);
export const domainProjectBaseInsertSchema =
	createInsertSchema(domainProjectTable);
export const domainProjectInsertSchema = domainProjectBaseInsertSchema.extend({
	domain: z.string().min(1),
	name: z.string().optional(),
	aliases: z.array(z.string()).optional(),
	logoUrl: z.string().url().optional(),
	active: z.boolean().optional(),
});
export const domainProjectUpdateSchema = createUpdateSchema(domainProjectTable);
