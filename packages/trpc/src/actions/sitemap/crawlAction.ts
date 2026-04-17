import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { addSitemapUrlAction } from "./addUrlAction";
import { crawlSitemap } from "@opencited/crawler";

export const crawlSitemapInputSchema = z.object({
	sitemapId: z.string(),
	sitemapUrl: z.string().url(),
});
export const crawlSitemapOutputSchema = z.object({
	urlsAdded: z.number(),
});
export const crawlSitemapContextSchema = baseActionContextSchema;

export const crawlSitemapAction = async (params: {
	input: z.infer<typeof crawlSitemapInputSchema>;
	ctx: z.infer<typeof crawlSitemapContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await crawlSitemap(input.sitemapUrl);

	if (result.urls.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No URLs found in sitemap",
		});
	}

	const persisted = await addSitemapUrlAction({
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

	return { urlsAdded: persisted.length };
};

export const crawlSitemapHandler = async (params: {
	input: z.infer<typeof crawlSitemapInputSchema>;
	ctx: z.infer<typeof crawlSitemapContextSchema>;
}) => {
	return crawlSitemapAction(params);
};
