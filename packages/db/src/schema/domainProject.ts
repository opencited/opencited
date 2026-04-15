import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";

export const domainProjectTable = pgTable("domain_project", {
	clerkOrganizationId: text("clerk_organization_id").primaryKey(),
	domain: text("domain").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const domainProjectSelectSchema = createSelectSchema(domainProjectTable);
export const domainProjectInsertSchema = createInsertSchema(domainProjectTable);
export const domainProjectUpdateSchema = createUpdateSchema(domainProjectTable);

export const domainProjectCreateSchema = z.object({
	domain: z.string().min(1),
});
