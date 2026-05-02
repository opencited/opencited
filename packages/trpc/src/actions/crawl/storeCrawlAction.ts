import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { crawledPageTable } from "@opencited/db";
import { pageAnalysisTable } from "@opencited/db";
import type { CrawlPageResult } from "@opencited/crawler-workflows";

export const storeCrawlInputSchema = z.object({
	results: z.array(z.custom<CrawlPageResult>()),
});
export const storeCrawlOutputSchema = z.object({
	stored: z.number(),
	skipped: z.number(),
});
export const storeCrawlContextSchema = baseActionContextSchema;

export const storeCrawlAction = async (params: {
	input: z.infer<typeof storeCrawlInputSchema>;
	ctx: z.infer<typeof storeCrawlContextSchema>;
}) => {
	const { input, ctx } = params;
	const { results } = input;

	let stored = 0;
	const skipped = 0;

	for (const result of results) {
		const existing = await ctx.db
			.select({ id: crawledPageTable.id })
			.from(crawledPageTable)
			.where(eq(crawledPageTable.sitemapUrlId, result.sitemapUrlId))
			.limit(1);

		if (existing.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: TypeScript narrows `existing[0]` after the length check above
			const existingId: string = existing[0]!.id;
			await ctx.db
				.update(crawledPageTable)
				.set({
					httpStatus: result.httpStatus,
					contentLength: result.contentLength,
					contentHash: result.contentHash,
					fetchedAt: new Date().toISOString(),
					crawlStatus: result.fetchError
						? "error"
						: result.content
							? "analyzed"
							: "fetched",
					fetchError: result.fetchError,
					updatedAt: new Date(),
				})
				.where(eq(crawledPageTable.id, existingId));

			await ctx.db
				.delete(pageAnalysisTable)
				.where(eq(pageAnalysisTable.crawledPageId, existingId));

			stored++;
		} else {
			const [_page] = await ctx.db
				.insert(crawledPageTable)
				.values({
					sitemapUrlId: result.sitemapUrlId,
					url: result.url,
					httpStatus: result.httpStatus,
					contentLength: result.contentLength,
					contentHash: result.contentHash,
					fetchedAt: new Date().toISOString(),
					crawlStatus: result.fetchError
						? "error"
						: result.content
							? "analyzed"
							: "fetched",
					fetchError: result.fetchError,
				})
				.returning();

			stored++;
		}

		if (result.content || result.llmInsights) {
			const analyzedPage = await ctx.db
				.select({ id: crawledPageTable.id })
				.from(crawledPageTable)
				.where(eq(crawledPageTable.sitemapUrlId, result.sitemapUrlId))
				.limit(1)
				.then((r) => r[0]);

			if (analyzedPage) {
				await ctx.db.insert(pageAnalysisTable).values({
					crawledPageId: analyzedPage.id,
					analyzedAt: new Date().toISOString(),
					wordCount: result?.content?.wordCount,
					textHtmlRatio: result?.content?.textHtmlRatio,
					headingStructure: result?.content?.headingStructure,
					imagesTotal: result?.content?.imagesTotal,
					imagesWithAlt: result?.content?.imagesWithAlt,
					internalLinks: result?.content?.internalLinks,
					externalLinks: result?.content?.externalLinks,
					domDepthAvg: result?.content?.domDepthAvg,
					tone: result?.llmInsights?.tone,
					sentiment: result?.llmInsights?.sentiment,
					sentimentScore: result?.llmInsights?.sentimentScore,
					subjectivity: result?.llmInsights?.subjectivity,
					perceivedPageType: result?.llmInsights?.perceivedPageType,
					perceivedIntent: result?.llmInsights?.perceivedIntent,
					perceivedAudience: result?.llmInsights?.perceivedAudience,
					namedEntities: result?.llmInsights?.namedEntities,
					verbTense: result?.llmInsights?.verbTense,
					extractedText: result?.content?.extractedText.slice(0, 50_000),
				});
			}
		}
	}

	return { stored, skipped };
};

export const storeCrawlHandler = async (params: {
	input: z.infer<typeof storeCrawlInputSchema>;
	ctx: z.infer<typeof storeCrawlContextSchema>;
}) => {
	return storeCrawlAction(params);
};
