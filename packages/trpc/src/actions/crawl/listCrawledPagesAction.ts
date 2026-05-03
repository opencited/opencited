import { eq, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { crawledPageTable, crawledPageSelectSchema } from "@opencited/db";
import { pageAnalysisTable } from "@opencited/db";
import { sitemapUrlTable } from "@opencited/db";

export const listCrawledPagesInputSchema = z.object({
	sitemapId: z.string().uuid(),
	limit: z.number().int().positive().default(50),
	offset: z.number().int().nonnegative().default(0),
});
export const listCrawledPagesOutputSchema = z.object({
	pages: z.array(
		z.object({
			crawledPage: crawledPageSelectSchema,
			analysis: z
				.object({
					id: z.string(),
					crawledPageId: z.string(),
					analyzedAt: z.string().nullable(),
					wordCount: z.number().nullable(),
					textHtmlRatio: z.string().nullable(),
					headingStructure: z.any().nullable(),
					imagesTotal: z.number().nullable(),
					imagesWithAlt: z.number().nullable(),
					internalLinks: z.number().nullable(),
					externalLinks: z.number().nullable(),
					domDepthAvg: z.string().nullable(),
					tone: z.string().nullable(),
					sentiment: z.string().nullable(),
					sentimentScore: z.number().nullable(),
					subjectivity: z.string().nullable(),
					perceivedPageType: z.string().nullable(),
					perceivedIntent: z.string().nullable(),
					perceivedAudience: z.string().nullable(),
					namedEntities: z.array(z.any()).nullable(),
					verbTense: z.string().nullable(),
					extractedText: z.string().nullable(),
				})
				.nullable(),
		}),
	),
	total: z.number(),
});
export const listCrawledPagesContextSchema = baseActionContextSchema;

export const listCrawledPagesAction = async (params: {
	input: z.infer<typeof listCrawledPagesInputSchema>;
	ctx: z.infer<typeof listCrawledPagesContextSchema>;
}) => {
	const { input, ctx } = params;

	const sitemapUrlRows = await ctx.db
		.select({ id: sitemapUrlTable.id })
		.from(sitemapUrlTable)
		.where(eq(sitemapUrlTable.sitemapId, input.sitemapId));

	const sitemapUrlIds = sitemapUrlRows.map((r) => r.id);

	if (sitemapUrlIds.length === 0) {
		return { pages: [], total: 0 };
	}

	const pageRows = await ctx.db
		.select()
		.from(crawledPageTable)
		.where(inArray(crawledPageTable.sitemapUrlId, sitemapUrlIds))
		.limit(input.limit)
		.offset(input.offset);

	if (pageRows.length === 0) {
		return { pages: [], total: 0 };
	}

	const crawledPageIds = pageRows.map((p) => p.id);

	const [totalResult] = await ctx.db
		.select({ count: count() })
		.from(crawledPageTable)
		.where(inArray(crawledPageTable.sitemapUrlId, sitemapUrlIds));

	const analysisRows = await ctx.db
		.select()
		.from(pageAnalysisTable)
		.where(inArray(pageAnalysisTable.crawledPageId, crawledPageIds));

	const pages = pageRows.map((cp) => ({
		crawledPage: cp,
		analysis: analysisRows.find((a) => a.crawledPageId === cp.id) ?? null,
	}));

	return {
		pages,
		total: Number(totalResult?.count ?? 0),
	};
};

export const listCrawledPagesHandler = async (params: {
	input: z.infer<typeof listCrawledPagesInputSchema>;
	ctx: z.infer<typeof listCrawledPagesContextSchema>;
}) => {
	return listCrawledPagesAction(params);
};
