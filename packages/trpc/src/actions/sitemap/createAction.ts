import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import {
	sitemapInsertSchema,
	sitemapSelectSchema,
	sitemapTable,
} from "@opencited/db";

export const createSitemapInputSchema = sitemapInsertSchema;
export const createSitemapOutputSchema = sitemapSelectSchema;
export const createSitemapContextSchema = baseActionContextSchema;

export const createSitemapAction = async (params: {
	input: z.infer<typeof createSitemapInputSchema>;
	ctx: z.infer<typeof createSitemapContextSchema>;
}) => {
	const { input, ctx } = params;

	const existing = await ctx.db
		.select()
		.from(sitemapTable)
		.where(
			and(
				eq(sitemapTable.domainProjectId, input.domainProjectId),
				eq(sitemapTable.url, input.url),
			),
		)
		.limit(1);

	if (existing[0]) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "This sitemap URL already exists in your project.",
		});
	}

	const result = await ctx.db
		.insert(sitemapTable)
		.values({
			domainProjectId: input.domainProjectId,
			url: input.url,
			status: "pending",
			urlCount: 0,
			source: input.source ?? "manual",
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create sitemap",
		});
	}

	return result[0];
};

export const createSitemapHandler = async (params: {
	input: z.infer<typeof createSitemapInputSchema>;
	ctx: z.infer<typeof createSitemapContextSchema>;
}) => {
	return createSitemapAction(params);
};
