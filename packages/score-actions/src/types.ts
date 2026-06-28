import { z } from "zod";

export const sentimentLabelSchema = z.enum(["positive", "neutral", "negative"]);
export type SentimentLabel = z.infer<typeof sentimentLabelSchema>;

export const crawlCitationSchema = z.object({
	domain: z.string().min(1),
	url: z.string().min(1),
	position: z.number().int().positive().optional(),
	isOwnDomain: z.boolean().optional(),
	isCompetitorDomain: z.boolean().optional(),
});
export type CrawlCitation = z.infer<typeof crawlCitationSchema>;

export const brandMentionSchema = z.object({
	brandName: z.string().min(1),
	mentionType: z.enum(["target", "competitor", "other"]),
	position: z.number().int().positive().optional(),
	brandUrl: z.string().optional(),
});
export type BrandMention = z.infer<typeof brandMentionSchema>;

export const targetBrandSchema = z.object({
	name: z.string().min(1),
	domain: z.string().min(1),
	aliases: z.array(z.string()).default([]),
});
export type TargetBrand = z.infer<typeof targetBrandSchema>;

export const sentimentInputSchema = z.object({
	label: sentimentLabelSchema.nullable(),
	cacheHit: z.boolean(),
	fallback: z.boolean(),
	retryCount: z.number().int().min(0).max(2),
});
export type SentimentInput = z.infer<typeof sentimentInputSchema>;

export const computeVisibilityScoreInputSchema = z.object({
	crawlContent: z.string(),
	crawlProvider: z.string().min(1),
	crawlCitations: z.array(crawlCitationSchema),
	brandMentions: z.array(brandMentionSchema),
	targetBrand: targetBrandSchema,
	sentimentInput: sentimentInputSchema,
});
export type ComputeVisibilityScoreInput = z.infer<
	typeof computeVisibilityScoreInputSchema
>;

export const visibilityScoreResultSchema = z.object({
	mentionScore: z.number().int().min(0).max(100),
	positionScore: z.number().int().min(0).max(100),
	citationScore: z.number().int().min(0).max(100),
	sentimentScore: z.number().int().min(0).max(100),
	coMentionScore: z.number().int().min(0).max(100),
	visibilityScore: z.number().int().min(0).max(100),
	formulaVersion: z.string().min(1),
	computedAt: z.date(),
});
export type VisibilityScoreResult = z.infer<typeof visibilityScoreResultSchema>;

export const sentimentJudgeInputSchema = z.object({
	content: z.string().min(1),
	brandName: z.string().min(1),
	promptVersion: z.string().min(1),
	modelName: z.string().min(1),
});
export type SentimentJudgeInput = z.infer<typeof sentimentJudgeInputSchema>;

export const sentimentJudgeResultSchema = z.object({
	label: sentimentLabelSchema.nullable(),
	cacheHit: z.boolean(),
	fallback: z.boolean(),
	retryCount: z.number().int().min(0).max(2),
});
export type SentimentJudgeResult = z.infer<typeof sentimentJudgeResultSchema>;

export const scoredCrawlSchema = z.object({
	brandId: z.string().min(1),
	engine: z.string().min(1),
	crawlId: z.string().min(1),
	completedAt: z.date(),
	mentionScore: z.number().int().min(0).max(100),
	positionScore: z.number().int().min(0).max(100),
	citationScore: z.number().int().min(0).max(100),
	sentimentScore: z.number().int().min(0).max(100),
	coMentionScore: z.number().int().min(0).max(100),
});
export type ScoredCrawl = z.infer<typeof scoredCrawlSchema>;

export const aggregateOptionsSchema = z.object({
	minCrawlsPerEngine: z.number().int().min(1).optional(),
	winsorisePercentile: z.number().min(0).max(0.5).optional(),
});
export type AggregateOptions = z.infer<typeof aggregateOptionsSchema>;

export const perBrandPerEngineScoreSchema = z.object({
	engine: z.string(),
	mentionScoreNorm: z.number(),
	positionScoreNorm: z.number(),
	citationScoreNorm: z.number(),
	sentimentScoreNorm: z.number(),
	coMentionScoreNorm: z.number(),
	score: z.number(),
});
export type PerBrandPerEngineScore = z.infer<
	typeof perBrandPerEngineScoreSchema
>;

export const trendPointSchema = z.object({
	date: z.string(),
	score: z.number().nullable(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const aggregateVisibilityScoresResultSchema = z.object({
	perBrandPerEngineScores: z.array(perBrandPerEngineScoreSchema),
	crossEngineScore: z.number().nullable(),
	trend: z.array(trendPointSchema),
});
export type AggregateVisibilityScoresResult = z.infer<
	typeof aggregateVisibilityScoresResultSchema
>;
