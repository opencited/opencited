import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { getSitemapUrls } from "@opencited/crawler";

export const previewSitemapInputSchema = z.object({
	sitemapUrl: z.string().url(),
});
export const previewSitemapOutputSchema = z.object({
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
export const previewSitemapContextSchema = baseActionContextSchema;

export const previewSitemapAction = async (params: {
	input: z.infer<typeof previewSitemapInputSchema>;
	ctx: z.infer<typeof previewSitemapContextSchema>;
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

export const previewSitemapHandler = async (params: {
	input: z.infer<typeof previewSitemapInputSchema>;
	ctx: z.infer<typeof previewSitemapContextSchema>;
}) => {
	return previewSitemapAction(params);
};
