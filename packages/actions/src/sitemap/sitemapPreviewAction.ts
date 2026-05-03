import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { getSitemapUrls } from "@opencited/crawler";

export const sitemapPreviewInputSchema = z.object({
	sitemapUrl: z.string().url(),
});
export const sitemapPreviewOutputSchema = z.object({
	type: z.enum(["urlset", "sitemapindex"]),
	urls: z.array(
		z.object({
			url: z.string(),
			lastmod: z.string().nullable(),
			changefreq: z.string().nullable(),
			priority: z.string().nullable(),
		}),
	),
});
export const sitemapPreviewContextSchema = baseActionContextSchema;

export const sitemapPreviewAction = async (params: {
	input: z.infer<typeof sitemapPreviewInputSchema>;
	ctx: z.infer<typeof sitemapPreviewContextSchema>;
}) => {
	const { input } = params;

	const result = await getSitemapUrls(input.sitemapUrl);

	if (result.urls.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No URLs found in sitemap",
		});
	}

	return { type: result.type, urls: result.urls };
};

export const sitemapPreviewHandler = async (params: {
	input: z.infer<typeof sitemapPreviewInputSchema>;
	ctx: z.infer<typeof sitemapPreviewContextSchema>;
}) => {
	return sitemapPreviewAction(params);
};
