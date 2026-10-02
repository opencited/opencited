import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";

export const publicScanReadinessSchema = z.enum([
	"ready",
	"needs-work",
	"not-ready",
]);

export const publicScanIssueSchema = z.object({
	check: z.string(),
	goal: z.string(),
	issue: z.string(),
	howToFix: z.string(),
	weight: z.number(),
});

export const publicScanTable = pgTable("public_scan", {
	id: id,
	domain: text("domain").notNull(),
	finalUrl: text("final_url").notNull(),
	score: integer("score").notNull(),
	readiness: text("readiness").notNull(),
	issues: jsonb("issues")
		.$type<z.infer<typeof publicScanIssueSchema>[]>()
		.notNull(),
	durationMs: integer("duration_ms").notNull(),
	clientIp: text("client_ip"),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const publicScanSelectSchema = createSelectSchema(publicScanTable);
export const publicScanBaseInsertSchema = createInsertSchema(publicScanTable);
export const publicScanInsertSchema = publicScanBaseInsertSchema.extend({
	domain: z.string().min(1),
	finalUrl: z.string().url(),
	score: z.number().int().min(0).max(100),
	readiness: publicScanReadinessSchema,
	issues: z.array(publicScanIssueSchema),
	durationMs: z.number().int().min(0),
	clientIp: z.string().optional(),
});
export const publicScanUpdateSchema = createUpdateSchema(publicScanTable);
