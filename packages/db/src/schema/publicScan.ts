import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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

export const publicScanHomepageSnapshotSchema = z.object({
	title: z.string().nullable(),
	metaDescription: z.string().nullable(),
	h1: z.string().nullable(),
	brandName: z.string().nullable(),
	textExcerpt: z.string(),
});

export const aiMentionProbeQueryResultSchema = z.object({
	query: z.string(),
	visibility: z.enum(["visible", "not-visible"]),
	excerpt: z.string(),
	citationUrls: z.array(z.string().url()).max(3),
});

export const aiMentionProbeSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("ok"),
		queries: z.array(aiMentionProbeQueryResultSchema),
	}),
	z.object({
		status: z.literal("unavailable"),
	}),
	z.object({
		status: z.literal("pending"),
		queries: z.array(z.string()).max(3).optional(),
	}),
]);

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
	homepageSnapshot:
		jsonb("homepage_snapshot").$type<
			z.infer<typeof publicScanHomepageSnapshotSchema>
		>(),
	aiMentionProbe:
		jsonb("ai_mention_probe").$type<z.infer<typeof aiMentionProbeSchema>>(),
	probeCompletedAt: timestamp("probe_completed_at", { withTimezone: true }),
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
	homepageSnapshot: publicScanHomepageSnapshotSchema.optional(),
	aiMentionProbe: aiMentionProbeSchema.optional(),
	probeCompletedAt: z.date().optional(),
});
export const publicScanUpdateSchema = createUpdateSchema(publicScanTable);
