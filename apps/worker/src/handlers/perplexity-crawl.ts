import type { Job } from "bullmq";
import type { Logger } from "pino";
import {
	Crawler,
	PerplexityProvider,
	createLogger,
} from "@opencited/browser-crawler";
import {
	saveCrawlResultAction,
	failCrawlAction,
	saveStructuredCrawlDataAction,
	extractBrandIntelligenceAction,
	saveBrandIntelligenceAction,
	getCrawlContextAction,
} from "@opencited/actions";
import type { JobPayload } from "@opencited/queue";
import { withDb } from "../db";

export async function handlePerplexityCrawl(
	job: Job<JobPayload<"perplexity-crawl">>,
	logger: Logger,
): Promise<void> {
	const { query, promptQueryId, promptQueryCrawlId } = job.data;

	await withDb(async (db) => {
		const crawlContext = await getCrawlContextAction({
			input: { promptQueryId },
			ctx: { db, userId: null, isAuthenticated: false },
		});

		const crawler = new Crawler({
			logger: createLogger("info"),
		});
		const provider = new PerplexityProvider();

		try {
			const startTime = Date.now();
			const result = await crawler.crawl({
				query,
				provider,
				browserOptions: {
					headless: true,
					persist: false,
				},
			});
			const endTime = Date.now();

			logger.info(
				{
					url: result.metadata.url,
					title: result.metadata.title,
					contentLength: result.content.length,
					loadTimeMs: result.metadata.loadTimeMs,
					citationsCount: result.structured?.citations.length ?? 0,
				},
				"Browser crawl completed",
			);

			await saveCrawlResultAction({
				input: {
					crawlId: promptQueryCrawlId,
					provider: result.provider,
					content: result.content,
					url: result.metadata.url,
					title: result.metadata.title,
					loadTimeMs: endTime - startTime,
					timestamp: result.metadata.timestamp.toISOString(),
					promptQueryId,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			if (result.structured) {
				await saveStructuredCrawlDataAction({
					input: {
						crawlId: promptQueryCrawlId,
						promptQueryId,
						domainProjectId: crawlContext.domainProjectId,
						structured: {
							citations: result.structured.citations,
							brandMentions: [],
							answerFormat: result.structured.answerFormat,
							wordCount: result.content.split(/\s+/).length,
						},
					},
					ctx: { db, userId: null, isAuthenticated: false },
				});
			}

			try {
				const intelligence = await extractBrandIntelligenceAction({
					content: result.content,
					query,
					targetBrand: crawlContext.targetBrand,
					targetDomain: crawlContext.targetDomain,
					targetAliases: crawlContext.targetAliases,
					knownCompetitors: crawlContext.knownCompetitors,
				});

				logger.info(
					{
						brandMentionsCount: intelligence.brandMentions.length,
						discoveredCompetitorsCount:
							intelligence.discoveredCompetitors.length,
						answerFormat: intelligence.answerFormat,
					},
					"LLM extraction completed",
				);

				const saveResult = await saveBrandIntelligenceAction({
					input: {
						crawlId: promptQueryCrawlId,
						domainProjectId: crawlContext.domainProjectId,
						intelligence,
						content: result.content,
					},
					ctx: { db, userId: null, isAuthenticated: false },
				});

				logger.info(
					{
						mentionsSaved: saveResult.mentionsSaved,
						competitorsCreated: saveResult.competitorsCreated,
						competitorsMatched: saveResult.competitorsMatched,
					},
					"Brand intelligence saved",
				);
			} catch (llmError) {
				const llmErrorMessage =
					llmError instanceof Error ? llmError.message : String(llmError);
				logger.error({ error: llmErrorMessage }, "LLM extraction failed");
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			logger.error(
				{ error: errorMessage, crawlId: promptQueryCrawlId },
				"Crawl task failed",
			);

			await failCrawlAction({
				input: {
					crawlId: promptQueryCrawlId,
					error: errorMessage,
					promptQueryId,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			throw error;
		}
	});
}
