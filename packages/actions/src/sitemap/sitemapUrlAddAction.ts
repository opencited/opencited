import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { sitemapUrlSelectSchema, sitemapUrlTable } from "@opencited/db";

const sitemapUrlPayloadSchema = z.object({
	url: z.url(),
	lastmod: z.string().nullable().optional(),
	changefreq: z.string().nullable().optional(),
	priority: z.string().nullable().optional(),
});

export const sitemapUrlAddInputSchema = z.object({
	sitemapId: z.string(),
	urls: z.array(sitemapUrlPayloadSchema).min(1),
});
export const sitemapUrlAddOutputSchema = sitemapUrlSelectSchema.array();
export const sitemapUrlAddContextSchema = baseActionContextSchema;

export const sitemapUrlAddAction = async (params: {
	input: z.infer<typeof sitemapUrlAddInputSchema>;
	ctx: z.infer<typeof sitemapUrlAddContextSchema>;
}) => {
	const { input, ctx } = params;

	const values = input.urls.map((url) => ({
		sitemapId: input.sitemapId,
		url: url.url,
		lastmod: url.lastmod ?? null,
		changefreq: url.changefreq ?? null,
		priority: url.priority ?? null,
	}));

	const result = await ctx.db
		.insert(sitemapUrlTable)
		.values(values)
		.returning();

	if (!result.length) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to add sitemap URLs",
		});
	}

	return result;
};

export const sitemapUrlAddHandler = async (params: {
	input: z.infer<typeof sitemapUrlAddInputSchema>;
	ctx: z.infer<typeof sitemapUrlAddContextSchema>;
}) => {
	return sitemapUrlAddAction(params);
};
