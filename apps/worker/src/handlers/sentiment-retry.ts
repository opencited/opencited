import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger as CrawlerLogger } from "@opencited/logger";
import { retrySentimentAction } from "@opencited/actions";
import type { JobPayload } from "@opencited/queue";
import { withDb } from "../db";

export async function handleSentimentRetry(
	job: Job<JobPayload<"sentiment-retry">>,
	logger: CrawlerLogger,
	_redis: Redis,
): Promise<void> {
	const { crawlId, promptQueryCrawlId, domainProjectId } = job.data;

	logger.info("Processing sentiment retry", {
		jobId: job.id,
		crawlId,
		promptQueryCrawlId,
		domainProjectId,
	});

	await withDb(async (db) => {
		try {
			console.log("[sentiment-retry] starting retry for crawl:", crawlId);
			const result = await retrySentimentAction({
				input: { crawlId },
				ctx: { db, userId: null, isAuthenticated: false },
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
	});
}
