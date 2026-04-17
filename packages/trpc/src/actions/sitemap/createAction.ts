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

	const result = await ctx.db
		.insert(sitemapTable)
		.values({
			domainProjectId: input.domainProjectId,
			url: input.url,
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
