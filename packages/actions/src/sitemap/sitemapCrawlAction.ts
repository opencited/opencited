import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { sitemapUrlAddAction } from "./sitemapUrlAddAction";
import { crawlSitemap } from "@opencited/crawler";
import { sitemapTable } from "@opencited/db";

export const sitemapCrawlInputSchema = z.object({
	sitemapId: z.string(),
	sitemapUrl: z.string().url(),
});
export const sitemapCrawlOutputSchema = z.object({
	urlsAdded: z.number(),
	skipped: z.boolean().default(false),
	reason: z.string().optional(),
});
export const sitemapCrawlContextSchema = baseActionContextSchema;

export const sitemapCrawlAction = async (params: {
	input: z.infer<typeof sitemapCrawlInputSchema>;
	ctx: z.infer<typeof sitemapCrawlContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await crawlSitemap(input.sitemapUrl);

	if (result.urls.length === 0) {
		await ctx.db
			.delete(sitemapTable)
			.where(eq(sitemapTable.id, input.sitemapId));

		return { urlsAdded: 0, skipped: true, reason: "empty_or_index" };
	}

	const persisted = await sitemapUrlAddAction({
		input: {
			sitemapId: input.sitemapId,
			urls: result.urls.map((url) => ({
				url: url.url,
				lastmod: url.lastmod,
				changefreq: url.changefreq,
				priority: url.priority,
			})),
		},
		ctx,
	});

	await ctx.db
		.update(sitemapTable)
		.set({
			status: "indexed",
			urlCount: persisted.length,
			lastCrawlError: null,
		})
		.where(eq(sitemapTable.id, input.sitemapId));

	return { urlsAdded: persisted.length, skipped: false };
};

export const sitemapCrawlHandler = async (params: {
	input: z.infer<typeof sitemapCrawlInputSchema>;
	ctx: z.infer<typeof sitemapCrawlContextSchema>;
}) => {
	return sitemapCrawlAction(params);
};
