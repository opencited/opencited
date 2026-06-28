import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger as CrawlerLogger } from "@opencited/logger";
import {
	Crawler,
	createProvider,
	AllProxiesFailedError,
	type LoggerContext,
} from "@opencited/browser-crawler";
import {
	intakeCrawlResultAction,
	failCrawlAction,
	getCrawlContextAction,
} from "@opencited/actions";
import { dispatch, type JobPayload } from "@opencited/queue";
import { withDb } from "../db";
import {
	resolveProxies,
	fetchProxyList,
	clearStickyProxy,
	setStickyProxy,
} from "../lib/proxy-resolution";
import { rateLimit } from "../lib/rate-limit";
import { env } from "../env";

function adaptLogger(
	base: CrawlerLogger,
	context: LoggerContext,
): CrawlerLogger {
	return base.withContext(context);
}

type CrawlJobPayload = JobPayload<"perplexity-crawl"> & {
	provider: "perplexity" | "chatgpt";
};

export async function handleCrawlJob(
	job: Job<CrawlJobPayload>,
	logger: CrawlerLogger,
	redis: Redis,
): Promise<void> {
	const {
		query,
		promptQueryId,
		promptQueryCrawlId,
		domainProjectId,
		provider,
	} = job.data;

	await withDb(async (db) => {
		const crawlContext = await getCrawlContextAction({
			input: { promptQueryId },
			ctx: { db, userId: null, isAuthenticated: false },
		});

		await rateLimit(provider);

		const crawlLogger = adaptLogger(logger, {
			jobId: job.id ?? undefined,
			promptQueryCrawlId,
			promptQueryId,
			provider,
		});

		const crawlerProvider = createProvider(provider, crawlLogger);
		const crawler = new Crawler({ logger: crawlLogger });

		try {
			const startTime = Date.now();

			const { proxies, usedSticky } = await resolveProxies({
				domainProjectId,
				db,
				redis,
				logger,
			});

			const result = await crawler
				.crawl({
					query,
					provider: crawlerProvider,
					browserOptions: {
						headless: env.HEADLESS,
						persist: false,
					},
					proxies,
				})
				.catch(async (err) => {
					if (err instanceof AllProxiesFailedError && usedSticky) {
						logger.warn(
							"Sticky proxy failed — falling back to fresh proxy list",
							{ lastFailureType: err.lastFailureType },
						);
						await clearStickyProxy(redis, domainProjectId);

						const freshProxyList = await fetchProxyList(
							env.THORDATA_PROXY_API_URL!,
						);
						const freshProxies = freshProxyList.map((p) => ({
							server: `http://${p}`,
						}));
						logger.info("Retrying with fresh proxy list", {
							proxyCount: freshProxies.length,
						});

						return crawler.crawl({
							query,
							provider: crawlerProvider,
							browserOptions: { headless: true, persist: false },
							proxies: freshProxies,
						});
					}
					throw err;
				});

			const endTime = Date.now();

			if (result.usedProxy) {
				await setStickyProxy(redis, domainProjectId, result.usedProxy);
				logger.info("Sticky proxy updated after successful crawl", {
					server: result.usedProxy.server,
				});
			}

			logger.info("Browser crawl completed", {
				url: result.metadata.url,
				title: result.metadata.title,
				contentLength: result.content.length,
				loadTimeMs: result.metadata.loadTimeMs,
				citationsCount: result.structured?.citations.length ?? 0,
			});

			const intakeResult = await intakeCrawlResultAction({
				input: {
					crawlId: promptQueryCrawlId,
					promptQueryId,
					domainProjectId: crawlContext.domainProjectId ?? domainProjectId,
					query,
					result,
					loadTimeMs: endTime - startTime,
					crawlContext: {
						targetBrand: crawlContext.targetBrand,
						targetDomain: crawlContext.targetDomain,
						targetAliases: crawlContext.targetAliases,
						knownCompetitors: crawlContext.knownCompetitors,
					},
					logger,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			if (!intakeResult.success) {
				logger.warn("Crawl intake completed with partial failures", {
					crawlId: promptQueryCrawlId,
					failedSteps: intakeResult.failedSteps,
				});
			}

			if (intakeResult.sentimentRetryNeeded) {
				await dispatch("sentiment-retry", {
					crawlId: promptQueryCrawlId,
					promptQueryCrawlId,
					domainProjectId: crawlContext.domainProjectId ?? domainProjectId,
				});
				logger.info("Sentiment retry enqueued", {
					crawlId: promptQueryCrawlId,
				});
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			await clearStickyProxy(redis, domainProjectId);
			logger.info("Sticky proxy cleared after crawl failure");

			logger.error("Crawl task failed", {
				error: errorMessage,
				crawlId: promptQueryCrawlId,
			});

			await failCrawlAction({
				input: {
					crawlId: promptQueryCrawlId,
					error: errorMessage,
					promptQueryId,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			throw error;
		}
	});
}
