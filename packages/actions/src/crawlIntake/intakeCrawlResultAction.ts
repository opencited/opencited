import type { Db } from "@opencited/db";
import type { Logger } from "@opencited/logger";
import { z } from "zod";
import { extractBrandIntelligenceAction } from "../ai/extractBrandIntelligenceAction";
import { saveBrandIntelligenceAction } from "../ai/saveBrandIntelligenceAction";
import { computeVisibilityScoreAction } from "../aiVisibility/computeVisibilityScoreAction";
import { baseActionContextSchema } from "../context";
import { saveInlineLinksAction } from "../promptQueryCrawl/saveInlineLinksAction";
import { saveCrawlResultAction } from "../promptQueryCrawl/triggerCrawlAction";
import { updateCrawlAction } from "../promptQueryCrawl/updateCrawlAction";

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
				inlineLinks: z.array(
					z.object({
						title: z.string(),
						url: z.string(),
						domain: z.string(),
						position: z.number(),
					}),
				),
				sourcePanelLinks: z.array(
					z.object({
						title: z.string(),
						url: z.string(),
						domain: z.string(),
						position: z.number(),
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
export type IntakeCrawlResultContext = z.infer<
	typeof intakeCrawlResultContextSchema
>;

/**
 * Runs one database phase with a handle that the caller controls. Workers
 * pass a scoped runner so each phase opens and closes its own pool instead of
 * holding an idle connection through the LLM call in the middle.
 */
export type CrawlIntakeDbRunner = <T>(fn: (db: Db) => Promise<T>) => Promise<T>;

export type IntakeCrawlResultParams =
	| {
			input: IntakeCrawlResultInput;
			ctx: IntakeCrawlResultContext;
			dbRunner?: undefined;
	  }
	| {
			input: IntakeCrawlResultInput;
			ctx: Omit<IntakeCrawlResultContext, "db">;
			dbRunner: CrawlIntakeDbRunner;
	  };

export const intakeCrawlResultAction = async (
	params: IntakeCrawlResultParams,
): Promise<IntakeCrawlResultOutput> => {
	const { input } = params;
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

	const runDb: CrawlIntakeDbRunner =
		params.dbRunner ??
		((fn) => fn((params.ctx as IntakeCrawlResultContext).db as Db));

	const withDb = (db: Db) => ({ ...params.ctx, db });

	logger?.info("[intake] action start", {
		crawlId,
		hasStructured: !!result.structured,
		hasInlineLinks: !!result.structured?.inlineLinks?.length,
		hasLogger: !!logger,
		provider: result.provider,
		contentLength: result.content.length,
	});

	const failedSteps: string[] = [];

	await runDb(async (db) => {
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
			ctx: withDb(db),
		});

		if (!result.structured) {
			return;
		}

		const allInlineLinks = [
			...result.structured.inlineLinks,
			...result.structured.sourcePanelLinks,
		];

		if (allInlineLinks.length > 0) {
			await saveInlineLinksAction({
				input: {
					crawlId,
					promptQueryId,
					domainProjectId,
					inlineLinks: result.structured.inlineLinks,
					sourcePanelLinks: result.structured.sourcePanelLinks,
				},
				ctx: withDb(db),
			});
		}

		const wordCount = result.content.split(/\s+/).length;
		if (result.structured.answerFormat || wordCount > 0) {
			await updateCrawlAction({
				input: {
					id: crawlId,
					answerFormat: result.structured.answerFormat,
					wordCount,
					sourceCount: allInlineLinks.length,
					domainProjectId,
				},
				ctx: withDb(db),
			});
		}
	});

	let sentimentRetryNeeded = false;

	logger?.info("[intake] about to call LLM extraction", {
		crawlId,
		contentLength: result.content.length,
		query,
		hasTargetBrand: !!crawlContext.targetBrand,
		hasTargetDomain: !!crawlContext.targetDomain,
	});

	try {
		logger?.info("[intake] LLM call started", { crawlId });
		let intelligence: Awaited<
			ReturnType<typeof extractBrandIntelligenceAction>
		>;
		try {
			intelligence = await extractBrandIntelligenceAction({
				content: result.content,
				query,
				targetBrand: crawlContext.targetBrand,
				targetDomain: crawlContext.targetDomain,
				targetAliases: crawlContext.targetAliases,
				knownCompetitors: crawlContext.knownCompetitors,
			});
		} catch (llmCallError) {
			logger?.error("[intake] ❌ extractBrandIntelligenceAction THREW", {
				crawlId,
				error:
					llmCallError instanceof Error
						? llmCallError.message
						: String(llmCallError),
				stack: llmCallError instanceof Error ? llmCallError.stack : undefined,
			});
			throw llmCallError;
		}

		logger?.info("LLM extraction completed", {
			crawlId,
			brandMentionsCount: intelligence.brandMentions.length,
			discoveredCompetitorsCount: intelligence.discoveredCompetitors.length,
			answerFormat: intelligence.answerFormat,
		});

		const saveResult = await runDb((db) =>
			saveBrandIntelligenceAction({
				input: {
					crawlId,
					domainProjectId,
					intelligence,
				},
				ctx: withDb(db),
			}),
		);

		logger?.info("Brand intelligence saved", {
			crawlId,
			mentionsSaved: saveResult.mentionsSaved,
			competitorsCreated: saveResult.competitorsCreated,
			competitorsMatched: saveResult.competitorsMatched,
		});

		try {
			// The score action runs its own short database phases through the
			// runner, so the pool is closed while it waits on the sentiment
			// judge.
			const scoreResult = await computeVisibilityScoreAction({
				input: { crawlId },
				ctx: {
					userId: params.ctx.userId,
					isAuthenticated: params.ctx.isAuthenticated,
				},
				dbRunner: runDb,
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
