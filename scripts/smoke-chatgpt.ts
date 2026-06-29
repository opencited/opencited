#!/usr/bin/env bun

import {
	Crawler,
	createLogger,
	createProvider,
} from "../packages/browser-crawler/src/index";

const QUERY = "What is the best CRM for small business?";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		console.error(`FAIL: ${message}`);
		process.exit(1);
	}
	console.log(`PASS: ${message}`);
}

async function main() {
	const logger = createLogger({ level: "info" });
	const crawler = new Crawler({ logger });
	const provider = createProvider("chatgpt", logger);

	console.log(`\n🔍 Running ChatGPT smoke test`);
	console.log(`   Query: "${QUERY}"\n`);

	const result = await crawler.crawl({
		query: QUERY,
		provider,
		browserOptions: {
			headless: true,
		},
	});

	console.log("\n📋 Response preview:");
	console.log("-------------------");
	console.log(result.content.slice(0, 500));
	if (result.content.length > 500) console.log("... (truncated)");
	console.log("-------------------\n");

	// Assert response is non-empty
	assert(result.content.length > 0, "Response content is non-empty");

	// Assert response contains expected substrings
	const contentLower = result.content.toLowerCase();
	const hasExpected =
		contentLower.includes("hubspot") || contentLower.includes("crm");
	assert(hasExpected, 'Response contains "HubSpot" or "CRM"');

	// Assert inline links were extracted
	const inlineLinks = result.structured?.inlineLinks ?? [];
	assert(
		inlineLinks.length > 0,
		`At least one inline link extracted (found ${inlineLinks.length})`,
	);

	// Assert inline link URLs are valid
	for (const link of inlineLinks) {
		assert(
			link.url.startsWith("http"),
			`Inline link URL is valid: ${link.url}`,
		);
	}

	// Assert CrawlResult shape
	assert(result.provider === "chatgpt", "Result provider is 'chatgpt'");
	assert(result.query === QUERY, "Result query matches input");
	assert(typeof result.content === "string", "Result content is a string");
	assert(typeof result.metadata.url === "string", "Metadata URL is a string");
	assert(
		typeof result.metadata.title === "string",
		"Metadata title is a string",
	);
	assert(
		result.metadata.timestamp instanceof Date,
		"Metadata timestamp is a Date",
	);
	assert(
		typeof result.metadata.loadTimeMs === "number",
		"Metadata loadTimeMs is a number",
	);

	console.log(`\n✅ All assertions passed`);
	console.log(`   Content length: ${result.content.length} chars`);
	console.log(`   Inline links: ${inlineLinks.length}`);
	console.log(`   Load time: ${result.metadata.loadTimeMs}ms`);
	console.log(`   URL: ${result.metadata.url}`);
}

main().catch((error) => {
	console.error("❌ Smoke test failed:", error);
	process.exit(1);
});
