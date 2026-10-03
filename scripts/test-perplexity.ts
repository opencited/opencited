#!/usr/bin/env bun
/**
 * Local Perplexity crawl smoke test (same Crawler + provider path as scan-mention-probe worker).
 *
 * Usage:
 *   bun run test:perplexity
 *   bun run test:perplexity -- "What is the best CRM for small business?"
 *
 * Env (via .env.local): REDIS_URL (worker env bootstrap), HEADLESS,
 * THORDATA_PROXY_API_URL (+ PROXY_USERNAME/PASSWORD), or PROXY_SERVER.
 * Optional PERPLEXITY_TEST_QUERY, PERPLEXITY_TEST_MAX_PROXIES (default 1).
 */
import {
	describePublicScanProxySource,
	resolveProxiesForPublicScan,
} from "../apps/worker/src/lib/resolve-public-scan-proxies";
import { env as crawlerEnv } from "../packages/browser-crawler/src/env";
import { AllProxiesFailedError } from "../packages/browser-crawler/src/errors";
import { Crawler, createProvider } from "../packages/browser-crawler/src/index";
import { env as loggerEnv } from "../packages/logger/src/env";
import { createLogger } from "../packages/logger/src/logger";

const DEFAULT_QUERY = "How can I automate customer support with voice AI?";
const MIN_CONTENT_CHARS = 80;

function limitProxiesForSmokeTest<T>(proxies: T[]): T[] {
	const max = Number.parseInt(
		process.env.PERPLEXITY_TEST_MAX_PROXIES ?? "1",
		10,
	);
	if (!Number.isFinite(max) || max <= 0) {
		return proxies;
	}
	return proxies.slice(0, max);
}

function queryFromArgs(): string {
	const dashQuery = process.argv.indexOf("--");
	if (dashQuery !== -1) {
		const rest = process.argv
			.slice(dashQuery + 1)
			.join(" ")
			.trim();
		if (rest.length > 0) {
			return rest;
		}
	}
	const fromEnv = process.env.PERPLEXITY_TEST_QUERY?.trim();
	return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_QUERY;
}

async function main() {
	const query = queryFromArgs();
	const logger = createLogger({ level: loggerEnv.LOGGER_LEVEL });
	const skipProxy = process.env.PERPLEXITY_TEST_SKIP_PROXY === "true";
	const proxySource = skipProxy ? "none" : describePublicScanProxySource();
	const allProxies = skipProxy ? [] : await resolveProxiesForPublicScan();
	const proxies = limitProxiesForSmokeTest(allProxies);

	console.log("\n🔍 Perplexity crawl test");
	console.log(`   Query: "${query}"`);
	console.log(`   Headless: ${crawlerEnv.HEADLESS}`);
	if (allProxies.length > 0) {
		const usingAuth = Boolean(process.env.PROXY_USERNAME);
		console.log(`   Proxy source: ${proxySource}`);
		console.log(
			`   Proxies: using ${proxies.length} of ${allProxies.length} (PERPLEXITY_TEST_MAX_PROXIES)`,
		);
		console.log(
			`   Proxy auth: ${usingAuth ? "PROXY_USERNAME set" : "IP whitelist (no user/pass)"}`,
		);
		console.log(`   First: ${proxies[0]?.server ?? "n/a"}\n`);
	} else {
		console.log("   Proxies: none (direct connection)\n");
	}

	const provider = createProvider("perplexity", logger);
	const crawler = new Crawler({ logger });

	console.log("Launching browser (see structured logs below)…\n");

	const started = Date.now();
	const result = await crawler.crawl({
		query,
		provider,
		browserOptions: {
			headless: crawlerEnv.HEADLESS,
			persist: false,
		},
		...(proxies.length > 0
			? {
					proxies,
					retryCycles: 1,
					maxAttemptsPerProxy: 1,
				}
			: {}),
	});

	const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

	if (!/\/search\//.test(result.metadata.url)) {
		throw new Error(`Expected /search/ URL, got ${result.metadata.url}`);
	}
	if (result.content.length < MIN_CONTENT_CHARS) {
		throw new Error(
			`Answer too short (${result.content.length} chars, need ≥${MIN_CONTENT_CHARS})`,
		);
	}

	console.log("\n📋 Response preview");
	console.log("-------------------");
	const preview = result.content.slice(0, 600);
	console.log(preview);
	if (result.content.length > 600) {
		console.log("... (truncated)");
	}
	console.log("-------------------\n");
	console.log(`✅ Passed in ${elapsedSec}s`);
	console.log(`   ${result.content.length} chars`);
	console.log(`   ${result.metadata.url}\n`);
}

main().catch((error) => {
	if (
		error instanceof AllProxiesFailedError &&
		error.lastFailureType === "logged_out"
	) {
		console.error(
			"\n⚠️  Perplexity login wall (automation reached /search/ but anonymous access was blocked).",
		);
		console.error(
			"   This is expected on many proxy exit IPs. For a full answer locally, try:",
		);
		console.error(
			"   PERPLEXITY_TEST_SKIP_PROXY=true bun run test:perplexity  (your home IP, headed)",
		);
		console.error(
			"   or use a persistent Camoufox profile signed into Perplexity (not implemented in this script yet).",
		);
	}
	console.error("\n❌ Perplexity test failed:", error);
	process.exit(1);
});
