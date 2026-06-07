import { pgTable, text, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { domainProjectTable } from "./domainProject";

export const proxyConfigTable = pgTable("proxy_config", {
	id: id,
	domainProjectId: text("domain_project_id")
		.notNull()
		.references(() => domainProjectTable.id, { onDelete: "cascade" }),
	enabled: boolean("enabled").notNull().default(false),
	// "batch" | "api"
	sourceType: text("source_type").notNull(),
	// For batch: array of "host:port:username:password" lines
	// For api: the API URL to fetch from
	sourceValue: text("source_value").notNull(),
	// Whether to use sticky proxy (reuse last known-good proxy)
	stickyProxyEnabled: boolean("sticky_proxy_enabled").notNull().default(true),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const proxyConfigSelectSchema = createSelectSchema(proxyConfigTable);
export const proxyConfigBaseInsertSchema = createInsertSchema(proxyConfigTable);
export const proxyConfigInsertSchema = proxyConfigBaseInsertSchema.extend({
	sourceType: z.enum(["batch", "api"]),
	sourceValue: z.string().min(1),
});

export const proxyConfigUpdateSchema = createUpdateSchema(proxyConfigTable);
