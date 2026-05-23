import { Worker, Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import pino from "pino";
import { handlePerplexityCrawl } from "./handlers/perplexity-crawl";

const logger = pino(
	process.env.NODE_ENV === "production"
		? {}
		: { transport: { target: "pino-pretty" } },
);

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
	throw new Error("REDIS_URL environment variable is not set");
}

function createRedisConnection(): IORedis {
	return new IORedis(redisUrl!, { maxRetriesPerRequest: null });
}

const concurrency = Number.parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10);
const shutdownTimeoutMs = 30_000;

const perplexityCrawlQueue = new Queue("perplexity-crawl", {
	connection: createRedisConnection(),
});

const queueEvents = new QueueEvents("perplexity-crawl", {
	connection: createRedisConnection(),
});

queueEvents.on("active", ({ jobId }) => {
	logger.info({ jobId }, "Job active");
});

queueEvents.on("completed", ({ jobId }) => {
	logger.info({ jobId }, "Job completed");
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
	logger.error({ jobId, failedReason }, "Job failed");
});

const worker = new Worker(
	"perplexity-crawl",
	async (job) => {
		logger.info({ jobId: job.id, data: job.data }, "Processing job");
		await handlePerplexityCrawl(job, logger);
	},
	{
		connection: createRedisConnection(),
		concurrency,
	},
);

worker.on("completed", (job) => {
	logger.info({ jobId: job.id }, "Worker: job completed");
});

worker.on("failed", (job, err) => {
	logger.error({ jobId: job?.id, error: err.message }, "Worker: job failed");
});

worker.on("error", (err) => {
	logger.error({ error: err.message }, "Worker error");
});

const app = new Hono();

const serverAdapter = new HonoAdapter(serveStatic);
createBullBoard({
	queues: [new BullMQAdapter(perplexityCrawlQueue)],
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

	logger.info({ signal }, "Shutting down gracefully...");

	const forceKillTimer = setTimeout(() => {
		logger.warn("Forced shutdown after timeout");
		process.exit(1);
	}, shutdownTimeoutMs);
	forceKillTimer.unref();

	try {
		await worker.close();
		await queueEvents.close();
		await perplexityCrawlQueue.close();
		logger.info("Worker closed cleanly");
	} catch (err) {
		logger.error(
			{ error: err instanceof Error ? err.message : String(err) },
			"Error during shutdown",
		);
	}

	clearTimeout(forceKillTimer);
	process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const port = Number.parseInt(process.env.PORT ?? "3001", 10);

serve({ fetch: app.fetch, port }, (info) => {
	logger.info({ port: info.port }, "Worker dashboard listening");
});

logger.info({ concurrency }, "Worker started");
