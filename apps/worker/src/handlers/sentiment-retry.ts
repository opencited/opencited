import { retrySentimentAction } from "@opencited/actions";
import type { Db } from "@opencited/db";
import type { Logger as CrawlerLogger } from "@opencited/logger";
import type { JobPayload } from "@opencited/queue";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { withDb } from "../db";

type SentimentRetryDbRunner = <T>(fn: (db: Db) => Promise<T>) => Promise<T>;

export interface SentimentRetryHandlerDeps {
	retrySentiment?: typeof retrySentimentAction;
	dbRunner?: SentimentRetryDbRunner;
}

export async function handleSentimentRetry(
	job: Job<JobPayload<"sentiment-retry">>,
	logger: CrawlerLogger,
	_redis: Redis,
	deps: SentimentRetryHandlerDeps = {},
): Promise<void> {
	const retrySentiment = deps.retrySentiment ?? retrySentimentAction;
	const dbRunner = deps.dbRunner ?? withDb;
	const { crawlId, promptQueryCrawlId, domainProjectId } = job.data;

	logger.info("Processing sentiment retry", {
		jobId: job.id,
		crawlId,
		promptQueryCrawlId,
		domainProjectId,
	});

	try {
		console.log("[sentiment-retry] starting retry for crawl:", crawlId);
		// The action opens and closes its own database phases through the
		// runner, so no pool is held open across the sentiment LLM call.
		const result = await retrySentiment({
			input: { crawlId },
			ctx: { userId: null, isAuthenticated: false },
			dbRunner,
		});

		if (result.recovered) {
			logger.info("Sentiment retry recovered", {
				crawlId,
				sentimentScore: result.row.sentimentScore,
				sentimentLabel: result.row.sentimentLabel,
				visibilityScore: result.row.visibilityScore,
				sentimentRetryCount: result.row.sentimentRetryCount,
			});
			console.log("[sentiment-retry] recovered:", {
				sentimentLabel: result.row.sentimentLabel,
				sentimentScore: result.row.sentimentScore,
				visibilityScore: result.row.visibilityScore,
			});
		} else {
			logger.warn("Sentiment retry still falling back", {
				crawlId,
				sentimentScore: result.row.sentimentScore,
				sentimentRetryCount: result.row.sentimentRetryCount,
			});
			console.log("[sentiment-retry] still falling back:", {
				sentimentIsFallback: result.row.sentimentIsFallback,
				sentimentRetryCount: result.row.sentimentRetryCount,
			});
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("Sentiment retry failed", { crawlId, error: message });
		console.error("[sentiment-retry] error:", message);
		throw error;
	}
}
