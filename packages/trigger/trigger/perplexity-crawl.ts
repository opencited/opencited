import { logger, task } from "@trigger.dev/sdk/v3";
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
import { getDb } from "./db";

export const perplexityCrawlTask = task({
	id: "perplexity-crawl",
	maxDuration: 600,
	run: async (payload: {
		query: string;
		promptQueryId: string;
		promptQueryCrawlId: string;
	}) => {
		const db = getDb();

		const crawlContext = await getCrawlContextAction({
			input: { promptQueryId: payload.promptQueryId },
			ctx: { db, userId: null, isAuthenticated: false },
		});

		const crawler = new Crawler({
			logger: createLogger("info"),
		});
		const provider = new PerplexityProvider();

		try {
			const startTime = Date.now();
			const result = await crawler.crawl({
				query: payload.query,
				provider,
				browserOptions: {
					headless: true,
					persist: false,
				},
			});
			const endTime = Date.now();

			logger.log("Browser crawl completed", {
				url: result.metadata.url,
				title: result.metadata.title,
				contentLength: result.content.length,
				loadTimeMs: result.metadata.loadTimeMs,
				citationsCount: result.structured?.citations.length ?? 0,
			});

			await saveCrawlResultAction({
				input: {
					crawlId: payload.promptQueryCrawlId,
					provider: result.provider,
					content: result.content,
					url: result.metadata.url,
					title: result.metadata.title,
					loadTimeMs: endTime - startTime,
					timestamp: result.metadata.timestamp.toISOString(),
					promptQueryId: payload.promptQueryId,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			if (result.structured) {
				await saveStructuredCrawlDataAction({
					input: {
						crawlId: payload.promptQueryCrawlId,
						promptQueryId: payload.promptQueryId,
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
					query: payload.query,
					targetBrand: crawlContext.targetBrand,
					targetDomain: crawlContext.targetDomain,
					targetAliases: crawlContext.targetAliases,
					knownCompetitors: crawlContext.knownCompetitors,
				});

				logger.log("LLM extraction completed", {
					brandMentionsCount: intelligence.brandMentions.length,
					discoveredCompetitorsCount: intelligence.discoveredCompetitors.length,
					answerFormat: intelligence.answerFormat,
				});

				const saveResult = await saveBrandIntelligenceAction({
					input: {
						crawlId: payload.promptQueryCrawlId,
						domainProjectId: crawlContext.domainProjectId,
						intelligence,
						content: result.content,
					},
					ctx: { db, userId: null, isAuthenticated: false },
				});

				logger.log("Brand intelligence saved", {
					mentionsSaved: saveResult.mentionsSaved,
					competitorsCreated: saveResult.competitorsCreated,
					competitorsMatched: saveResult.competitorsMatched,
				});
			} catch (llmError) {
				const llmErrorMessage =
					llmError instanceof Error ? llmError.message : String(llmError);

				logger.error("LLM brand intelligence extraction failed", {
					error: llmErrorMessage,
				});
			}

			return {
				success: true,
				provider: result.provider,
				content: result.content,
				url: result.metadata.url,
				title: result.metadata.title,
				loadTimeMs: endTime - startTime,
				timestamp: result.metadata.timestamp.toISOString(),
				promptQueryId: payload.promptQueryId,
				promptQueryCrawlId: payload.promptQueryCrawlId,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			logger.error("Crawl task failed", {
				error: errorMessage,
				crawlId: payload.promptQueryCrawlId,
			});

			await failCrawlAction({
				input: {
					crawlId: payload.promptQueryCrawlId,
					error: errorMessage,
					promptQueryId: payload.promptQueryId,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			throw error;
		}
	},
});
