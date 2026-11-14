#!/usr/bin/env bun
/**
 * Manual trigger for the worker's daily crawl health check.
 *
 * Default: enqueue `crawl-health-check` on Redis so the production worker
 * runs the canary with its proxies, Camoufox, and Axiom transport.
 *
 * Usage:
 *   bun run crawl-health-check
 *   bun run crawl-health-check -- --engines=chatgpt
 *   bun run crawl-health-check -- --engines=chatgpt,perplexity --local
 *
 * The root `crawl-health-check` script loads `.env.local` with dotenv-cli.
 * `bun run scripts/crawl-health-check.ts` works too when the worker env is
 * already exported (for example inside the EC2 worker container).
 *
 * `--local` runs the same handler in this process instead of dispatching it.
 * It needs DATABASE_URL, proxy env, and a Camoufox install, so it is meant for
 * development only.
 */
import {
	CRAWL_HEALTH_ENGINES,
	type CrawlHealthEngine,
} from "../apps/worker/src/lib/crawl-health";

const args = process.argv.slice(2).filter((arg) => arg !== "--");

function isCrawlHealthEngine(value: string): value is CrawlHealthEngine {
	return (CRAWL_HEALTH_ENGINES as readonly string[]).includes(value);
}

function parseEngines(): CrawlHealthEngine[] | undefined {
	const raw = args.find((arg) => arg.startsWith("--engines="));
	if (!raw) return undefined;

	const value = raw.slice("--engines=".length).trim();
	if (value.length === 0) {
		throw new Error("--engines= requires a comma-separated engine list");
	}

	const engines = value.split(",").map((engine) => engine.trim());
	for (const engine of engines) {
		if (!isCrawlHealthEngine(engine)) {
			throw new Error(
				`Unknown engine "${engine}". Expected: ${CRAWL_HEALTH_ENGINES.join(", ")}`,
			);
		}
	}

	return engines as CrawlHealthEngine[];
}

async function runLocal(engines?: CrawlHealthEngine[]): Promise<void> {
	const [{ handleCrawlHealthCheck }, { defaultLogger, flush }] =
		await Promise.all([
			import("../apps/worker/src/handlers/crawl-health-check"),
			import("../packages/logger/src/index"),
		]);

	const job = {
		id: `crawl-health-check-local-${Date.now()}`,
		data: {
			trigger: "manual" as const,
			...(engines ? { engines } : {}),
		},
	} as Parameters<typeof handleCrawlHealthCheck>[0];

	console.log("Running crawl health check in this process (--local)\n");
	await handleCrawlHealthCheck(job, defaultLogger);
	await flush();
}

async function dispatchToWorker(engines?: CrawlHealthEngine[]): Promise<void> {
	if (!process.env.REDIS_URL) {
		throw new Error(
			"REDIS_URL is not set. Run `bun run crawl-health-check` (loads .env.local) or export the worker env first.",
		);
	}

	const { dispatchCrawlHealthCheck, closeQueues } = await import(
		"../packages/queue/src/index"
	);

	try {
		const { jobId } = await dispatchCrawlHealthCheck({
			trigger: "manual",
			...(engines ? { engines } : {}),
		});
		console.log(`Enqueued crawl-health-check job ${jobId}`);
		console.log(
			"Follow it in Bull Board: /admin/queues (queue: crawl-health-check)",
		);
	} finally {
		await closeQueues();
	}
}

async function main(): Promise<void> {
	const local = args.includes("--local");
	const engines = parseEngines();

	if (local) {
		await runLocal(engines);
		return;
	}

	await dispatchToWorker(engines);
}

main().catch((error) => {
	console.error(
		"\n❌ Crawl health check failed:",
		error instanceof Error ? error.message : error,
	);
	process.exit(1);
});
