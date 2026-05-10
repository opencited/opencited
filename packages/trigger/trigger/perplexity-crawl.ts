import { logger, task } from "@trigger.dev/sdk/v3";
import {
	Crawler,
	PerplexityProvider,
	createLogger,
} from "@opencited/browser-crawler";

export const perplexityCrawlTask = task({
	id: "perplexity-crawl",
	maxDuration: 600,
	run: async (payload: { query: string }) => {
		logger.log("🕷️ Starting Perplexity crawl", { query: payload.query });

		const crawler = new Crawler({
			logger: createLogger("info"),
		});
		const provider = new PerplexityProvider();

		const result = await crawler.crawl({
			query: payload.query,
			provider,
			browserOptions: {
				headless: true,
				persist: false,
			},
		});

		logger.log("✅ Crawl completed", {
			url: result.metadata.url,
			title: result.metadata.title,
			contentLength: result.content.length,
			loadTimeMs: result.metadata.loadTimeMs,
		});

		return {
			success: true,
			content: result.content,
			url: result.metadata.url,
			title: result.metadata.title,
			timestamp: result.metadata.timestamp.toISOString(),
		};
	},
});
