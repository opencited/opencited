#!/usr/bin/env bun
import { Crawler, createLogger, PerplexityProvider } from "../src/index";

async function main() {
	const logger = createLogger("debug");

	const crawler = new Crawler({ logger });
	const provider = new PerplexityProvider();

	try {
		const result = await crawler.crawl({
			query: "top ai contact center",
			provider,
			browserOptions: {
				headless: false,
			},
		});

		logger.info("\n📋 Crawled Content:");
		logger.info("-------------------");
		logger.info(result.content);
		logger.info("-------------------\n");

		logger.info(`✅ Crawl completed in ${result.metadata.loadTimeMs}ms`);
		logger.info(`   URL: ${result.metadata.url}`);
		logger.info(`   Title: ${result.metadata.title}`);
	} catch (error) {
		logger.error("❌ Crawl failed:", error);
		process.exit(1);
	}
}

main();
