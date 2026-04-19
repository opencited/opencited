import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { sitemapUrlSelectSchema, sitemapUrlTable } from "@opencited/db";

const sitemapUrlPayloadSchema = z.object({
	url: z.url(),
	lastmod: z.string().nullable().optional(),
	changefreq: z.string().nullable().optional(),
	priority: z.string().nullable().optional(),
});

export const addSitemapUrlInputSchema = z.object({
	sitemapId: z.string(),
	urls: z.array(sitemapUrlPayloadSchema).min(1),
});
export const addSitemapUrlOutputSchema = sitemapUrlSelectSchema.array();
export const addSitemapUrlContextSchema = baseActionContextSchema;

export const addSitemapUrlAction = async (params: {
	input: z.infer<typeof addSitemapUrlInputSchema>;
	ctx: z.infer<typeof addSitemapUrlContextSchema>;
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

export const addSitemapUrlHandler = async (params: {
	input: z.infer<typeof addSitemapUrlInputSchema>;
	ctx: z.infer<typeof addSitemapUrlContextSchema>;
}) => {
	return addSitemapUrlAction(params);
};
