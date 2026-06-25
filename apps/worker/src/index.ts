import { Worker, Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { createLogger, flush } from "@opencited/logger";
import { handlePerplexityCrawl } from "./handlers/perplexity-crawl";
import { handleSentimentRetry } from "./handlers/sentiment-retry";
import { env } from "./env";

const logger = createLogger();

const concurrency = env.WORKER_CONCURRENCY;
const shutdownTimeoutMs = 30_000;

const perplexityCrawlQueue = new Queue("perplexity-crawl", {
	connection: createRedisConnection(),
});

const sentimentRetryQueue = new Queue("sentiment-retry", {
	connection: createRedisConnection(),
});

const queueEvents = new QueueEvents("perplexity-crawl", {
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

sentimentRetryQueueEvents.on("failed", ({ jobId, failedReason }) => {
	logger.error("Sentiment retry job failed", { jobId, failedReason });
});

function createRedisConnection(): IORedis {
	return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

const sharedRedis = createRedisConnection();

const worker = new Worker(
	"perplexity-crawl",
	async (job) => {
		logger.info("Processing job", { jobId: job.id, data: job.data });
		await handlePerplexityCrawl(job, logger, sharedRedis);
	},
	{
		connection: createRedisConnection(),
		concurrency,
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

const app = new Hono();

const serverAdapter = new HonoAdapter(serveStatic);
createBullBoard({
	queues: [
		new BullMQAdapter(perplexityCrawlQueue),
		new BullMQAdapter(sentimentRetryQueue),
	],
	serverAdapter,
});
app.route(
	"/admin/queues",
	serverAdapter.setBasePath("/admin/queues").registerPlugin(),
);

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
			sentimentRetryWorker.close(),
			queueEvents.close(),
			sentimentRetryQueueEvents.close(),
			perplexityCrawlQueue.close(),
			sentimentRetryQueue.close(),
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

serve({ fetch: app.fetch, port: env.WORKER_PORT }, (info) => {
	logger.info("Worker dashboard listening", { port: info.port });
});

logger.info("Worker started", { concurrency });
