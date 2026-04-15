import { pgTable, text } from "drizzle-orm/pg-core";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./fields";
import type { z } from "zod";

export const projects = pgTable("projects", {
	id,
	organizationId: text("organization_id").notNull(),
	name: text("name").notNull(),
	createdBy: text("created_by").notNull(),
	createdAt,
	updatedAt,
});

export const projectSelectSchema = createSelectSchema(projects);
export const projectInsertSchema = createInsertSchema(projects);
export const projectUpdateSchema = createUpdateSchema(projects);

export type Project = z.infer<typeof projectSelectSchema>;
