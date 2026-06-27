import { z } from "zod";
import type { Logger } from "@opencited/logger";
import { baseActionContextSchema } from "../context";
import { saveCrawlResultAction } from "../promptQueryCrawl/triggerCrawlAction";
import { saveStructuredCrawlDataAction } from "../promptQueryCrawl/saveStructuredCrawlDataAction";
import { extractBrandIntelligenceAction } from "../ai/extractBrandIntelligenceAction";
import { saveBrandIntelligenceAction } from "../ai/saveBrandIntelligenceAction";
import { computeVisibilityScoreAction } from "../aiVisibility/computeVisibilityScoreAction";

export const intakeCrawlResultInputSchema = z.object({
	crawlId: z.string().min(1),
	promptQueryId: z.string().min(1),
	domainProjectId: z.string().min(1),
	query: z.string().min(1),
	result: z.object({
		provider: z.string(),
		content: z.string(),
		metadata: z.object({
			url: z.string(),
			title: z.string(),
			timestamp: z.date(),
			loadTimeMs: z.number(),
		}),
		structured: z
			.object({
				citations: z.array(
					z.object({
						domain: z.string(),
						url: z.string(),
						title: z.string().optional(),
						description: z.string().optional(),
						position: z.number(),
						favicon: z.string().optional(),
						sourceName: z.string().optional(),
					}),
				),
				brandMentions: z.array(
					z.object({
						brandName: z.string(),
						context: z.string(),
						brandUrl: z.string().optional(),
					}),
				),
				answerFormat: z.string().optional(),
			})
			.optional(),
	}),
	loadTimeMs: z.number().int().nonnegative(),
	crawlContext: z.object({
		targetBrand: z.string().optional(),
		targetDomain: z.string().optional(),
		targetAliases: z.array(z.string()),
		knownCompetitors: z.array(
			z.object({
				name: z.string(),
				domain: z.string(),
			}),
		),
	}),
	logger: z.custom<Logger>().optional(),
});

export const intakeCrawlResultOutputSchema = z.object({
	success: z.boolean(),
	failedSteps: z.array(z.string()),
	sentimentRetryNeeded: z.boolean(),
});

export const intakeCrawlResultContextSchema = baseActionContextSchema;

export type IntakeCrawlResultInput = z.infer<
	typeof intakeCrawlResultInputSchema
>;
export type IntakeCrawlResultOutput = z.infer<
	typeof intakeCrawlResultOutputSchema
>;

export const intakeCrawlResultAction = async (params: {
	input: IntakeCrawlResultInput;
	ctx: z.infer<typeof intakeCrawlResultContextSchema>;
}): Promise<IntakeCrawlResultOutput> => {
	const { input, ctx } = params;
	const {
		crawlId,
		promptQueryId,
		domainProjectId,
		query,
		result,
		loadTimeMs,
		crawlContext,
		logger,
	} = input;

	const failedSteps: string[] = [];

	await saveCrawlResultAction({
		input: {
			crawlId,
			provider: result.provider,
			content: result.content,
			url: result.metadata.url,
			title: result.metadata.title,
			loadTimeMs,
			timestamp: result.metadata.timestamp.toISOString(),
			promptQueryId,
		},
		ctx,
	});

	if (result.structured) {
		await saveStructuredCrawlDataAction({
			input: {
				crawlId,
				promptQueryId,
				domainProjectId,
				structured: {
					citations: result.structured.citations,
					brandMentions: [],
					answerFormat: result.structured.answerFormat,
					wordCount: result.content.split(/\s+/).length,
				},
			},
			ctx,
		});
	}

	let sentimentRetryNeeded = false;

	try {
		const intelligence = await extractBrandIntelligenceAction({
			content: result.content,
			query,
			targetBrand: crawlContext.targetBrand,
			targetDomain: crawlContext.targetDomain,
			targetAliases: crawlContext.targetAliases,
			knownCompetitors: crawlContext.knownCompetitors,
		});

		logger?.info("LLM extraction completed", {
			crawlId,
			brandMentionsCount: intelligence.brandMentions.length,
			discoveredCompetitorsCount: intelligence.discoveredCompetitors.length,
			answerFormat: intelligence.answerFormat,
		});

		const saveResult = await saveBrandIntelligenceAction({
			input: {
				crawlId,
				domainProjectId,
				intelligence,
			},
			ctx,
		});

		logger?.info("Brand intelligence saved", {
			crawlId,
			mentionsSaved: saveResult.mentionsSaved,
			competitorsCreated: saveResult.competitorsCreated,
			competitorsMatched: saveResult.competitorsMatched,
		});

		try {
			const scoreResult = await computeVisibilityScoreAction({
				input: { crawlId },
				ctx,
			});

			logger?.info("AI Visibility Score computed", {
				crawlId,
				visibilityScore: scoreResult.row.visibilityScore,
				mentionScore: scoreResult.row.mentionScore,
				positionScore: scoreResult.row.positionScore,
				citationScore: scoreResult.row.citationScore,
				sentimentScore: scoreResult.row.sentimentScore,
				coMentionScore: scoreResult.row.coMentionScore,
				formulaVersion: scoreResult.row.formulaVersion,
				sentimentRetryNeeded: scoreResult.sentimentRetryNeeded,
			});

			sentimentRetryNeeded = scoreResult.sentimentRetryNeeded;
		} catch (scoreError) {
			const scoreErrorMessage =
				scoreError instanceof Error ? scoreError.message : String(scoreError);
			logger?.error("AI Visibility Score computation failed", {
				crawlId,
				error: scoreErrorMessage,
			});
			failedSteps.push("visibilityScore");
		}
	} catch (llmError) {
		const llmErrorMessage =
			llmError instanceof Error ? llmError.message : String(llmError);
		logger?.error("LLM extraction failed", {
			crawlId,
			error: llmErrorMessage,
		});
		failedSteps.push("brandIntelligence");
	}

	return {
		success: failedSteps.length === 0,
		failedSteps,
		sentimentRetryNeeded,
	};
};

export const intakeCrawlResultHandler = async (params: {
	input: IntakeCrawlResultInput;
	ctx: z.infer<typeof intakeCrawlResultContextSchema>;
}) => {
	return intakeCrawlResultAction(params);
};
