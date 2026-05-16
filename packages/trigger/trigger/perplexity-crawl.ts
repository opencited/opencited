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
		logger.log("🕷️ Starting Perplexity crawl", {
			query: payload.query,
			promptQueryId: payload.promptQueryId,
			promptQueryCrawlId: payload.promptQueryCrawlId,
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

			logger.log("✅ Crawl completed, saving to database", {
				url: result.metadata.url,
				title: result.metadata.title,
				contentLength: result.content.length,
				loadTimeMs: result.metadata.loadTimeMs,
			});

			// Save successful crawl result to DB
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
				ctx: { db: getDb(), userId: null, isAuthenticated: false },
			});

			// Save structured data if available
			if (result.structured) {
				logger.log("📊 Saving structured crawl data", {
					citations: result.structured.citations.length,
					brandMentions: result.structured.brandMentions.length,
				});

				await saveStructuredCrawlDataAction({
					input: {
						crawlId: payload.promptQueryCrawlId,
						promptQueryId: payload.promptQueryId,
						structured: {
							citations: result.structured.citations,
							brandMentions: result.structured.brandMentions,
							answerFormat: result.structured.answerFormat,
							wordCount: result.content.split(/\s+/).length,
						},
					},
					ctx: { db: getDb(), userId: null, isAuthenticated: false },
				});
			}

			logger.log("💾 Crawl result saved to database", {
				crawlId: payload.promptQueryCrawlId,
			});

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

			logger.error("❌ Crawl failed, saving error to database", {
				error: errorMessage,
				crawlId: payload.promptQueryCrawlId,
			});

			// Save failed crawl to DB
			await failCrawlAction({
				input: {
					crawlId: payload.promptQueryCrawlId,
					error: errorMessage,
					promptQueryId: payload.promptQueryId,
				},
				ctx: { db: getDb(), userId: null, isAuthenticated: false },
			});

			logger.log("💾 Crawl error saved to database", {
				crawlId: payload.promptQueryCrawlId,
			});

			throw error;
		}
	},
});
