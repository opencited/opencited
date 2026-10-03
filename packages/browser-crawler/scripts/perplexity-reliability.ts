#!/usr/bin/env bun
/**
 * Runs N full Perplexity crawls (same path as the mention-probe worker).
 * Usage: dotenv -e ../../.env.local -- bun run scripts/perplexity-reliability.ts
 */
import { Crawler, createProvider } from "../src/index";
import { createLogger } from "@opencited/logger";
import { env } from "../src/env";

const SAMPLE_QUERY =
	process.env.PERPLEXITY_RELIABILITY_QUERY ??
	"How can I automate customer support with voice AI?";
const RUNS = Number.parseInt(process.env.PERPLEXITY_RELIABILITY_RUNS ?? "10", 10);
const MIN_CONTENT_CHARS = 80;

async function runOnce(runIndex: number): Promise<void> {
	const logger = createLogger(env.LOGGER_LEVEL);
	const provider = createProvider("perplexity", logger);
	const crawler = new Crawler({ logger });

	const started = Date.now();
	const result = await crawler.crawl({
		query: SAMPLE_QUERY,
		provider,
		browserOptions: {
			headless: env.HEADLESS,
			persist: false,
		},
	});

	const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
	const url = result.metadata.url;
	if (!/\/search\//.test(url)) {
		throw new Error(`Run ${runIndex}: expected /search/ URL, got ${url}`);
	}
	if (result.content.length < MIN_CONTENT_CHARS) {
		throw new Error(
			`Run ${runIndex}: content too short (${result.content.length} chars)`,
		);
	}

	console.log(
		`✅ Run ${runIndex}/${RUNS} passed in ${elapsedSec}s — ${result.content.length} chars — ${url}`,
	);
}

async function main() {
	console.log(
		`Perplexity reliability: ${RUNS} runs, headless=${env.HEADLESS}, query="${SAMPLE_QUERY.slice(0, 60)}..."\n`,
	);

	for (let i = 1; i <= RUNS; i++) {
		try {
			await runOnce(i);
		} catch (error) {
			console.error(`\n❌ Run ${i}/${RUNS} failed:`, error);
			process.exit(1);
		}
	}

	console.log(`\n🎉 All ${RUNS} Perplexity crawls passed.`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
