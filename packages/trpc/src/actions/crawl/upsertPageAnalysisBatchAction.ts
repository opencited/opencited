import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { pageAnalysisTable } from "@opencited/db";

const namedEntitySchema = z.object({
	type: z.string(),
	name: z.string(),
});

const headingStructureSchema = z.object({
	h1: z.array(z.string()),
	h2: z.array(z.string()),
	h3: z.array(z.string()),
	h4: z.array(z.string()),
	h5: z.array(z.string()),
	h6: z.array(z.string()),
});

export const upsertPageAnalysisBatchInputSchema = z.object({
	analyses: z.array(
		z.object({
			crawledPageId: z.string().uuid(),
			wordCount: z.number().int().nonnegative().optional().nullable(),
			textHtmlRatio: z.string().optional().nullable(),
			headingStructure: headingStructureSchema.optional().nullable(),
			imagesTotal: z.number().int().nonnegative().optional().nullable(),
			imagesWithAlt: z.number().int().nonnegative().optional().nullable(),
			internalLinks: z.number().int().nonnegative().optional().nullable(),
			externalLinks: z.number().int().nonnegative().optional().nullable(),
			domDepthAvg: z.string().optional().nullable(),
			tone: z.string().optional().nullable(),
			sentiment: z.string().optional().nullable(),
			sentimentScore: z.number().int().min(1).max(100).optional().nullable(),
			subjectivity: z.string().optional().nullable(),
			perceivedPageType: z.string().optional().nullable(),
			perceivedIntent: z.string().optional().nullable(),
			perceivedAudience: z.string().optional().nullable(),
			namedEntities: z.array(namedEntitySchema).optional().nullable(),
			verbTense: z.string().optional().nullable(),
			extractedText: z.string().optional().nullable(),
		}),
	),
});

export const upsertPageAnalysisBatchOutputSchema = z.object({
	upserted: z.number(),
});

export const upsertPageAnalysisBatchContextSchema = baseActionContextSchema;

type AnalysisInsertValue = {
	crawledPageId: string;
	analyzedAt: string;
	wordCount?: number;
	textHtmlRatio?: string;
	headingStructure?: {
		h1: string[];
		h2: string[];
		h3: string[];
		h4: string[];
		h5: string[];
		h6: string[];
	};
	imagesTotal?: number;
	imagesWithAlt?: number;
	internalLinks?: number;
	externalLinks?: number;
	domDepthAvg?: string;
	tone?: string;
	sentiment?: string;
	sentimentScore?: number;
	subjectivity?: string;
	perceivedPageType?: string;
	perceivedIntent?: string;
	perceivedAudience?: string;
	namedEntities?: Array<{ type: string; name: string }>;
	verbTense?: string;
	extractedText?: string;
};

export const upsertPageAnalysisBatchAction = async (params: {
	input: z.infer<typeof upsertPageAnalysisBatchInputSchema>;
	ctx: z.infer<typeof upsertPageAnalysisBatchContextSchema>;
}) => {
	const { input, ctx } = params;
	const { analyses } = input;
	const { db } = ctx;

	let upserted = 0;

	for (const analysis of analyses) {
		await db
			.delete(pageAnalysisTable)
			.where(eq(pageAnalysisTable.crawledPageId, analysis.crawledPageId));

		const values: AnalysisInsertValue = {
			crawledPageId: analysis.crawledPageId,
			analyzedAt: new Date().toISOString(),
		};

		if (analysis.wordCount != null) values.wordCount = analysis.wordCount;
		if (analysis.textHtmlRatio != null)
			values.textHtmlRatio = analysis.textHtmlRatio;
		if (analysis.headingStructure != null)
			values.headingStructure = analysis.headingStructure;
		if (analysis.imagesTotal != null) values.imagesTotal = analysis.imagesTotal;
		if (analysis.imagesWithAlt != null)
			values.imagesWithAlt = analysis.imagesWithAlt;
		if (analysis.internalLinks != null)
			values.internalLinks = analysis.internalLinks;
		if (analysis.externalLinks != null)
			values.externalLinks = analysis.externalLinks;
		if (analysis.domDepthAvg != null) values.domDepthAvg = analysis.domDepthAvg;
		if (analysis.tone != null) values.tone = analysis.tone;
		if (analysis.sentiment != null) values.sentiment = analysis.sentiment;
		if (analysis.sentimentScore != null)
			values.sentimentScore = analysis.sentimentScore;
		if (analysis.subjectivity != null)
			values.subjectivity = analysis.subjectivity;
		if (analysis.perceivedPageType != null)
			values.perceivedPageType = analysis.perceivedPageType;
		if (analysis.perceivedIntent != null)
			values.perceivedIntent = analysis.perceivedIntent;
		if (analysis.perceivedAudience != null)
			values.perceivedAudience = analysis.perceivedAudience;
		if (analysis.namedEntities != null)
			values.namedEntities = analysis.namedEntities;
		if (analysis.verbTense != null) values.verbTense = analysis.verbTense;
		if (analysis.extractedText != null)
			values.extractedText = analysis.extractedText.slice(0, 50_000);

		await db.insert(pageAnalysisTable).values(values as never);

		upserted++;
	}

	return { upserted };
};

export const upsertPageAnalysisBatchHandler = async (params: {
	input: z.infer<typeof upsertPageAnalysisBatchInputSchema>;
	ctx: z.infer<typeof upsertPageAnalysisBatchContextSchema>;
}) => {
	return upsertPageAnalysisBatchAction(params);
};
