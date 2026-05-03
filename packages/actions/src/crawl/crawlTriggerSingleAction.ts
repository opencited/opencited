import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { start } from "workflow/api";
import { baseActionContextSchema } from "../context";
import { sitemapUrlTable, sitemapTable } from "@opencited/db";
import { crawledPageUpsertBatchAction } from "./crawledPageUpsertBatchAction";
import { pageAnalysisUpsertBatchAction } from "./pageAnalysisUpsertBatchAction";
import {
	crawlPageWorkflow,
	type CrawlPageResult,
} from "./workflows/crawl-page";

export const crawlTriggerSingleInputSchema = z.object({
	sitemapUrlId: z.string().uuid(),
	url: z.string().url(),
});
export const crawlTriggerSingleOutputSchema = z.object({
	success: z.boolean(),
	crawlStatus: z.string(),
});
export const crawlTriggerSingleContextSchema = baseActionContextSchema;

export const crawlTriggerSingleAction = async (params: {
	input: z.infer<typeof crawlTriggerSingleInputSchema>;
	ctx: z.infer<typeof crawlTriggerSingleContextSchema>;
}) => {
	const { input, ctx } = params;

	const [urlRow] = await ctx.db
		.select({ activeCrawlRunId: sitemapUrlTable.activeCrawlRunId })
		.from(sitemapUrlTable)
		.where(eq(sitemapUrlTable.id, input.sitemapUrlId))
		.limit(1);

	if (urlRow?.activeCrawlRunId) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A crawl is already running for this URL",
		});
	}

	const [sitemapRow] = await ctx.db
		.select({ activeCrawlRunId: sitemapTable.activeCrawlRunId })
		.from(sitemapTable)
		.innerJoin(sitemapUrlTable, eq(sitemapUrlTable.sitemapId, sitemapTable.id))
		.where(eq(sitemapUrlTable.id, input.sitemapUrlId))
		.limit(1);

	if (sitemapRow?.activeCrawlRunId) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A sitemap crawl is in progress — single page crawl is disabled",
		});
	}

	let runId: string | null = null;
	let result: CrawlPageResult;
	try {
		const run = await start(crawlPageWorkflow, [input.url, input.sitemapUrlId]);
		runId = run.runId;

		await ctx.db
			.update(sitemapUrlTable)
			.set({ activeCrawlRunId: runId })
			.where(eq(sitemapUrlTable.id, input.sitemapUrlId));

		result = await run.returnValue;
	} catch (err) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				err instanceof Error ? err.message : "Failed to run crawl workflow",
		});
	}

	const crawlStatus = result.fetchError
		? "error"
		: result.content
			? "analyzed"
			: "fetched";

	try {
		const { saved } = await crawledPageUpsertBatchAction({
			input: {
				pages: [
					{
						sitemapUrlId: result.sitemapUrlId,
						url: result.url,
						httpStatus: result.httpStatus,
						contentLength: result.contentLength,
						contentHash: result.contentHash,
						fetchError: result.fetchError,
						crawlStatus,
						fetchedAt: new Date().toISOString(),
					},
				],
			},
			ctx,
		});

		const firstSaved = saved[0];
		if (firstSaved && (result.content || result.llmInsights)) {
			await pageAnalysisUpsertBatchAction({
				input: {
					analyses: [
						{
							crawledPageId: firstSaved.id,
							wordCount: result.content?.wordCount ?? null,
							textHtmlRatio: result.content?.textHtmlRatio ?? null,
							headingStructure: result.content?.headingStructure ?? null,
							imagesTotal: result.content?.imagesTotal ?? null,
							imagesWithAlt: result.content?.imagesWithAlt ?? null,
							internalLinks: result.content?.internalLinks ?? null,
							externalLinks: result.content?.externalLinks ?? null,
							domDepthAvg: result.content?.domDepthAvg ?? null,
							tone: result.llmInsights?.tone ?? null,
							sentiment: result.llmInsights?.sentiment ?? null,
							sentimentScore: result.llmInsights?.sentimentScore ?? null,
							subjectivity: result.llmInsights?.subjectivity ?? null,
							perceivedPageType: result.llmInsights?.perceivedPageType ?? null,
							perceivedIntent: result.llmInsights?.perceivedIntent ?? null,
							perceivedAudience: result.llmInsights?.perceivedAudience ?? null,
							namedEntities: result.llmInsights?.namedEntities ?? null,
							verbTense: result.llmInsights?.verbTense ?? null,
							extractedText: result.content?.extractedText ?? null,
						},
					],
				},
				ctx,
			});
		}
	} catch (err) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				err instanceof Error ? err.message : "Failed to store crawl results",
		});
	} finally {
		if (runId) {
			await ctx.db
				.update(sitemapUrlTable)
				.set({ activeCrawlRunId: null })
				.where(eq(sitemapUrlTable.id, input.sitemapUrlId));
		}
	}

	return {
		success: true,
		crawlStatus,
	};
};

export const crawlTriggerSingleHandler = async (params: {
	input: z.infer<typeof crawlTriggerSingleInputSchema>;
	ctx: z.infer<typeof crawlTriggerSingleContextSchema>;
}) => {
	return crawlTriggerSingleAction(params);
};
