import type { Job } from "bullmq";
import type { Logger as CrawlerLogger } from "@opencited/logger";
import {
	Crawler,
	createProvider,
	type CrawlResult,
} from "@opencited/browser-crawler";
import {
	citationUrlsFromCrawl,
	createDrizzleScanRepository,
	executeScanMentionProbe,
	sendMentionProbeReportEmails,
} from "@opencited/actions";
import type { JobPayload } from "@opencited/queue";
import { withDb } from "../db";
import { readAnswerEngines } from "../lib/answer-engine-availability";
import { resolveProxiesForPublicScan } from "../lib/resolve-public-scan-proxies";
import { env } from "../env";

type ScanMentionProbeJob = Job<JobPayload<"scan-mention-probe">>;

export type ScanMentionProbeCrawlFn = (
	query: string,
) => Promise<{ answer: string; citationUrls: string[] }>;

function crawlResultToAnswer(result: CrawlResult) {
	return {
		answer: result.content,
		citationUrls: citationUrlsFromCrawl(result.structured),
	};
}

export async function createDefaultScanMentionProbeCrawl(
	logger: CrawlerLogger,
): Promise<ScanMentionProbeCrawlFn> {
	const proxies = await resolveProxiesForPublicScan();
	const provider = createProvider("perplexity", logger);
	const crawler = new Crawler({ logger });

	return async (query: string) => {
		const result = await crawler.crawl({
			query,
			provider,
			browserOptions: {
				headless: env.HEADLESS,
				persist: false,
			},
			proxies,
		});
		return crawlResultToAnswer(result);
	};
}

export async function handleScanMentionProbeJob(
	job: ScanMentionProbeJob,
	logger: CrawlerLogger,
): Promise<void> {
	const { publicScanId } = job.data;
	const now = () => new Date();

	let probe: Awaited<ReturnType<typeof executeScanMentionProbe>> = {
		status: "unavailable",
	};

	const perplexity = await withDb(async (db) => {
		let engines = await readAnswerEngines(db);
		let engine = engines.find((candidate) => candidate.key === "perplexity");
		if (!engine?.enabled) {
			engines = await readAnswerEngines(db, { fresh: true });
			engine = engines.find((candidate) => candidate.key === "perplexity");
		}
		return engine;
	});

	if (!perplexity?.enabled) {
		// Same stored outcome as a probe that fails: status "unavailable", and no browser.
		logger.info("Skipped scan mention probe because Perplexity is disabled", {
			publicScanId,
			reason: perplexity?.disabledReason,
		});
	} else {
		try {
			const crawl = await createDefaultScanMentionProbeCrawl(logger);
			probe = await executeScanMentionProbe(
				job.data,
				crawl,
				now,
				(query, error) => {
					logger.error("Scan mention probe crawl failed", {
						query,
						error: error instanceof Error ? error.message : String(error),
					});
				},
			);
		} catch (error) {
			logger.error("Scan mention probe failed", {
				publicScanId,
				error: error instanceof Error ? error.message : String(error),
			});
			probe = { status: "unavailable" };
		}
	}

	await withDb(async (db) => {
		const repo = createDrizzleScanRepository(db);
		await repo.updatePublicScanProbe(publicScanId, {
			aiMentionProbe: probe,
			probeCompletedAt: now(),
		});

		try {
			const { sent } = await sendMentionProbeReportEmails({
				publicScanId,
				db,
				scanRepo: repo,
			});
			if (sent > 0) {
				logger.info("Sent AI visibility report email update", {
					publicScanId,
					sent,
				});
			}
		} catch (error) {
			logger.error("Failed to send AI visibility report email update", {
				publicScanId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});
}
