import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { defaultLogger, flush } from "@opencited/logger";
import { jobs } from "@opencited/queue";
import { Queue, QueueEvents, Worker } from "bullmq";
import { Hono } from "hono";
import IORedis from "ioredis";
import { env } from "./env";
import { handleCrawlHealthCheck } from "./handlers/crawl-health-check";
import { handleCrawlJob } from "./handlers/perplexity-crawl";
import { handleScanMentionProbeJob } from "./handlers/scan-mention-probe";
import { handleSentimentRetry } from "./handlers/sentiment-retry";
import type { CrawlHealthEngine } from "./lib/crawl-health";
import {
	CRAWL_HEALTH_CHECK_SCHEDULER_ID,
	decideCrawlHealthSchedule,
} from "./lib/crawl-health-schedule";

// Use the shared logger instance: `flush()` flushes the transports of
// `defaultLogger`, and a separate `createLogger()` instance would buffer its
// Axiom events in a client that never gets flushed.
const logger = defaultLogger;

const concurrency = env.WORKER_CONCURRENCY;
const shutdownTimeoutMs = 30_000;

const perplexityCrawlQueue = new Queue("perplexity-crawl", {
	connection: createRedisConnection(),
});

const chatgptCrawlQueue = new Queue("chatgpt-crawl", {
	connection: createRedisConnection(),
});

const sentimentRetryQueue = new Queue("sentiment-retry", {
	connection: createRedisConnection(),
});

const scanMentionProbeQueue = new Queue("scan-mention-probe", {
	connection: createRedisConnection(),
});

const crawlHealthCheckQueue = new Queue("crawl-health-check", {
	connection: createRedisConnection(),
});

const queueEvents = new QueueEvents("perplexity-crawl", {
	connection: createRedisConnection(),
});

const chatgptQueueEvents = new QueueEvents("chatgpt-crawl", {
	connection: createRedisConnection(),
});

const sentimentRetryQueueEvents = new QueueEvents("sentiment-retry", {
	connection: createRedisConnection(),
});

queueEvents.on("active", ({ jobId }) => {
	logger.info("Job active", { jobId });
});

queueEvents.on("completed", ({ jobId }) => {
	logger.info("Job completed", { jobId });
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
	logger.error("Job failed", { jobId, failedReason });
});

chatgptQueueEvents.on("active", ({ jobId }) => {
	logger.info("ChatGPT job active", { jobId });
});

chatgptQueueEvents.on("completed", ({ jobId }) => {
	logger.info("ChatGPT job completed", { jobId });
});

chatgptQueueEvents.on("failed", ({ jobId, failedReason }) => {
	logger.error("ChatGPT job failed", { jobId, failedReason });
});

sentimentRetryQueueEvents.on("failed", ({ jobId, failedReason }) => {
	logger.error("Sentiment retry job failed", { jobId, failedReason });
});

function createRedisConnection(): IORedis {
	return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

const sharedRedis = createRedisConnection();

const ACTIVE_CRAWL_POLL_INTERVAL_MS = 15_000;
const ACTIVE_CRAWL_WAIT_TIMEOUT_MS = 20 * 60 * 1000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The canary shares the provider rate budget with user crawls, so it waits for
 * the matching crawl queue to drain before opening its browser. After 20
 * minutes it runs anyway: missing a day is worse than overlapping one crawl.
 */
async function waitForEngineQueueIdle(
	engine: CrawlHealthEngine,
): Promise<void> {
	const queue = engine === "chatgpt" ? chatgptCrawlQueue : perplexityCrawlQueue;
	const deadline = Date.now() + ACTIVE_CRAWL_WAIT_TIMEOUT_MS;
	let loggedActive = false;

	while (Date.now() < deadline) {
		const active = await queue.getActiveCount();
		if (active === 0) return;

		if (!loggedActive) {
			logger.info("Crawl health check waiting for active crawl jobs", {
				engine,
				active,
			});
			loggedActive = true;
		}

		await sleep(
			Math.min(
				ACTIVE_CRAWL_POLL_INTERVAL_MS,
				Math.max(0, deadline - Date.now()),
			),
		);
	}

	logger.warn("Crawl health check proceeding while crawl jobs are active", {
		engine,
	});
}

const worker = new Worker(
	"perplexity-crawl",
	async (job) => {
		logger.info("Processing job", { jobId: job.id, data: job.data });
		await handleCrawlJob(job, logger, sharedRedis);
	},
	{
		connection: createRedisConnection(),
		concurrency,
	},
);

const chatgptWorker = new Worker(
	"chatgpt-crawl",
	async (job) => {
		logger.info("Processing ChatGPT job", { jobId: job.id, data: job.data });
		await handleCrawlJob(job, logger, sharedRedis);
	},
	{
		connection: createRedisConnection(),
		concurrency,
	},
);

const scanMentionProbeWorker = new Worker(
	"scan-mention-probe",
	async (job) => {
		logger.info("Processing scan mention probe", {
			jobId: job.id,
			data: job.data,
		});
		await handleScanMentionProbeJob(job, logger);
	},
	{
		connection: createRedisConnection(),
		concurrency: 1,
	},
);

const sentimentRetryWorker = new Worker(
	"sentiment-retry",
	async (job) => {
		logger.info("Processing sentiment retry", {
			jobId: job.id,
			data: job.data,
		});
		await handleSentimentRetry(job, logger, sharedRedis);
	},
	{
		connection: createRedisConnection(),
		concurrency: 2,
	},
);

const crawlHealthCheckWorker = new Worker(
	"crawl-health-check",
	async (job) => {
		logger.info("Processing crawl health check", {
			jobId: job.id,
			data: job.data,
		});
		await handleCrawlHealthCheck(job, logger, {
			waitForEngineIdle: waitForEngineQueueIdle,
		});
	},
	{
		// One Camoufox at a time for the canary. Engines run sequentially in
		// the handler; this stops a manual run overlapping a scheduled run.
		connection: createRedisConnection(),
		concurrency: 1,
		// Registration runs first so a restart cannot delete an overdue
		// scheduled run before this worker starts processing.
		autorun: false,
	},
);

worker.on("completed", async (job) => {
	logger.info("Worker: job completed", { jobId: job.id });
	await flush();
});

worker.on("failed", async (job, err) => {
	logger.error("Worker: job failed", { jobId: job?.id, error: err.message });
	await flush();
});

worker.on("error", (err) => {
	logger.error("Worker error", { error: err.message });
});

chatgptWorker.on("completed", async (job) => {
	logger.info("ChatGPT worker: job completed", { jobId: job.id });
	await flush();
});

chatgptWorker.on("failed", async (job, err) => {
	logger.error("ChatGPT worker: job failed", {
		jobId: job?.id,
		error: err.message,
	});
	await flush();
});

chatgptWorker.on("error", (err) => {
	logger.error("ChatGPT worker error", { error: err.message });
});

sentimentRetryWorker.on("completed", async (job) => {
	logger.info("Sentiment retry: job completed", { jobId: job.id });
	await flush();
});

sentimentRetryWorker.on("failed", async (job, err) => {
	logger.error("Sentiment retry: job failed", {
		jobId: job?.id,
		error: err.message,
	});
	await flush();
});

sentimentRetryWorker.on("error", (err) => {
	logger.error("Sentiment retry worker error", { error: err.message });
});

scanMentionProbeWorker.on("completed", async (job) => {
	logger.info("Scan mention probe: job completed", { jobId: job.id });
	await flush();
});

scanMentionProbeWorker.on("failed", async (job, err) => {
	logger.error("Scan mention probe: job failed", {
		jobId: job?.id,
		error: err.message,
	});
	await flush();
});

scanMentionProbeWorker.on("error", (err) => {
	logger.error("Scan mention probe worker error", { error: err.message });
});

crawlHealthCheckWorker.on("completed", async (job) => {
	logger.info("Crawl health check: job completed", { jobId: job.id });
	await flush();
});

crawlHealthCheckWorker.on("failed", async (job, err) => {
	logger.error("Crawl health check: job failed", {
		jobId: job?.id,
		error: err.message,
	});
	await flush();
});

crawlHealthCheckWorker.on("error", (err) => {
	logger.error("Crawl health check worker error", { error: err.message });
});

const app = new Hono();

const serverAdapter = new HonoAdapter(serveStatic);
createBullBoard({
	queues: [
		new BullMQAdapter(perplexityCrawlQueue),
		new BullMQAdapter(chatgptCrawlQueue),
		new BullMQAdapter(sentimentRetryQueue),
		new BullMQAdapter(scanMentionProbeQueue),
		new BullMQAdapter(crawlHealthCheckQueue),
	],
	serverAdapter,
});
app.route(
	"/admin/queues",
	serverAdapter.setBasePath("/admin/queues").registerPlugin(),
);

app.get("/", (c) => c.redirect("/admin/queues", 302));

app.get("/health", async (c) => {
	try {
		const client = await perplexityCrawlQueue.client;
		await client.ping();
		return c.json({ status: "ok", redis: "connected" });
	} catch {
		return c.json({ status: "error", redis: "disconnected" }, 503);
	}
});

let shuttingDown = false;

async function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.info("Shutting down gracefully...", { signal });

	const forceKillTimer = setTimeout(() => {
		logger.warn("Forced shutdown after timeout");
		process.exit(1);
	}, shutdownTimeoutMs);
	forceKillTimer.unref();

	try {
		await Promise.all([
			worker.close(),
			chatgptWorker.close(),
			sentimentRetryWorker.close(),
			scanMentionProbeWorker.close(),
			crawlHealthCheckWorker.close(),
			queueEvents.close(),
			chatgptQueueEvents.close(),
			sentimentRetryQueueEvents.close(),
			perplexityCrawlQueue.close(),
			chatgptCrawlQueue.close(),
			sentimentRetryQueue.close(),
			scanMentionProbeQueue.close(),
			crawlHealthCheckQueue.close(),
			sharedRedis.quit(),
			flush(),
		]);
		logger.info("Worker closed cleanly");
	} catch (err) {
		logger.error("Error during shutdown", {
			error: err instanceof Error ? err.message : String(err),
		});
	}

	clearTimeout(forceKillTimer);
	process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const fatalFlushTimeoutMs = 5_000;

async function handleFatalError(label: string, error: unknown): Promise<void> {
	logger.error(label, {
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	});

	// These handlers exit the process. After an uncaught exception or a
	// rejection nobody is awaiting, the worker can no longer be trusted to
	// finish the job it was running, and BullMQ would keep that job locked
	// until it stalls. Flush first so the crash reaches Axiom, then exit
	// non-zero and let the supervisor restart the process. The timeout stops
	// a stuck Axiom request from keeping a dead worker alive.
	try {
		await Promise.race([
			flush(),
			new Promise<void>((resolve) => {
				setTimeout(resolve, fatalFlushTimeoutMs);
			}),
		]);
	} catch (flushError) {
		console.error("[worker] failed to flush logs before exit", flushError);
	}

	process.exit(1);
}

process.once("uncaughtException", (error) => {
	void handleFatalError("Uncaught exception", error);
});

process.once("unhandledRejection", (reason) => {
	void handleFatalError("Unhandled rejection", reason);
});

/**
 * BullMQ 5.56's `upsertJobScheduler` computes the next cron time from now and
 * deletes the previous delayed job. Calling it on every startup therefore
 * drops an overdue 06:00 run when the worker restarts at 06:30. Leave an
 * unchanged scheduler alone so its delayed job survives the restart. Only a
 * missing or changed schedule is rewritten, and a changed schedule with an
 * overdue run gets one deterministic catch-up job.
 */
async function registerCrawlHealthCheckSchedule(): Promise<void> {
	try {
		const existing = await crawlHealthCheckQueue.getJobScheduler(
			CRAWL_HEALTH_CHECK_SCHEDULER_ID,
		);
		// The scheduler can survive while its delayed job is deleted (Bull
		// Board). Re-upsert in that case so the next run actually exists.
		const nextJobExists =
			typeof existing?.next === "number"
				? Boolean(
						await crawlHealthCheckQueue.getJob(
							`repeat:${CRAWL_HEALTH_CHECK_SCHEDULER_ID}:${existing.next}`,
						),
					)
				: false;
		const decision = decideCrawlHealthSchedule({
			existing,
			pattern: env.CRAWL_HEALTH_CHECK_CRON,
			tz: env.CRAWL_HEALTH_CHECK_TZ,
			now: Date.now(),
			nextJobExists,
		});

		if (decision.action === "upsert") {
			await crawlHealthCheckQueue.upsertJobScheduler(
				CRAWL_HEALTH_CHECK_SCHEDULER_ID,
				{
					pattern: env.CRAWL_HEALTH_CHECK_CRON,
					tz: env.CRAWL_HEALTH_CHECK_TZ,
				},
				{
					name: "crawl-health-check",
					data: { trigger: "schedule" },
					opts: jobs["crawl-health-check"].options,
				},
			);
			logger.info("Crawl health check schedule updated", {
				cron: env.CRAWL_HEALTH_CHECK_CRON,
				tz: env.CRAWL_HEALTH_CHECK_TZ,
			});
		} else {
			logger.info("Crawl health check schedule unchanged", {
				cron: env.CRAWL_HEALTH_CHECK_CRON,
				tz: env.CRAWL_HEALTH_CHECK_TZ,
				next: existing?.next ?? null,
			});
		}

		if (decision.catchUpJobId) {
			await crawlHealthCheckQueue.add(
				"crawl-health-check",
				{ trigger: "schedule" },
				{
					...jobs["crawl-health-check"].options,
					jobId: decision.catchUpJobId,
				},
			);
			logger.warn("Enqueued crawl health check catch-up run", {
				jobId: decision.catchUpJobId,
				previousNext: existing?.next ?? null,
			});
		}
	} catch (error) {
		logger.error("Failed to schedule crawl health check", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

void registerCrawlHealthCheckSchedule().finally(() => {
	void crawlHealthCheckWorker.run().catch((error) => {
		logger.error("Crawl health check worker failed to start", {
			error: error instanceof Error ? error.message : String(error),
		});
	});
});

serve({ fetch: app.fetch, port: env.WORKER_PORT }, (info) => {
	logger.info("Worker dashboard listening", { port: info.port });
});

logger.info("Worker started", { concurrency });
