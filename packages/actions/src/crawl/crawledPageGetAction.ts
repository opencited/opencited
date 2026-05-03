import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { crawledPageTable, crawledPageSelectSchema } from "@opencited/db";
import { pageAnalysisTable } from "@opencited/db";

export const crawledPageGetInputSchema = z.object({
	sitemapUrlId: z.string().uuid(),
});
export const crawledPageGetOutputSchema = z.object({
	page: z
		.object({
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
		})
		.nullable(),
});
export const crawledPageGetContextSchema = baseActionContextSchema;

export const crawledPageGetAction = async (params: {
	input: z.infer<typeof crawledPageGetInputSchema>;
	ctx: z.infer<typeof crawledPageGetContextSchema>;
}) => {
	const { input, ctx } = params;

	const row = await ctx.db
		.select()
		.from(crawledPageTable)
		.where(eq(crawledPageTable.sitemapUrlId, input.sitemapUrlId))
		.limit(1)
		.then((r: any[]) => r[0]);

	if (!row) {
		return { page: null };
	}

	const analysisRow = await ctx.db
		.select()
		.from(pageAnalysisTable)
		.where(eq(pageAnalysisTable.crawledPageId, row.id))
		.limit(1)
		.then((r: any[]) => r[0]);

	return {
		page: {
			crawledPage: row,
			analysis: analysisRow ?? null,
		},
	};
};

export const crawledPageGetHandler = async (params: {
	input: z.infer<typeof crawledPageGetInputSchema>;
	ctx: z.infer<typeof crawledPageGetContextSchema>;
}) => {
	return crawledPageGetAction(params);
};
