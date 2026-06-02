import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger as CrawlerLogger } from "@opencited/logger";
import {
	Crawler,
	PerplexityProvider,
	AllProxiesFailedError,
	type ProxyOptions,
	type LoggerContext,
} from "@opencited/browser-crawler";
import {
	saveCrawlResultAction,
	failCrawlAction,
	saveStructuredCrawlDataAction,
	extractBrandIntelligenceAction,
	saveBrandIntelligenceAction,
	getCrawlContextAction,
} from "@opencited/actions";
import type { JobPayload } from "@opencited/queue";
import { withDb } from "../db";
import {
	fetchProxyList,
	buildProxyOptions,
	setStickyProxy,
	clearStickyProxy,
	getStickyProxy,
} from "../lib/proxy-resolver";
import { env } from "../env";

function adaptLogger(
	base: CrawlerLogger,
	context: LoggerContext,
): CrawlerLogger {
	return base.withContext(context);
}

async function resolveProxies(
	proxyApiUrl: string,
	redis: Redis,
	logger: CrawlerLogger,
	stickyProxyEnabled: boolean,
): Promise<{ proxies: ProxyOptions[]; usedSticky: boolean }> {
	if (stickyProxyEnabled) {
		const stickyProxy = await getStickyProxy(redis);
		if (stickyProxy) {
			logger.info("Using sticky proxy from last successful crawl", {
				server: stickyProxy.server,
			});
			return { proxies: [stickyProxy], usedSticky: true };
		}
	}

	const proxyList = await fetchProxyList(proxyApiUrl);
	const proxies = buildProxyOptions(proxyList);
	logger.info("Proxy list fetched from ThorData", {
		proxyCount: proxies.length,
	});
	return { proxies, usedSticky: false };
}

export async function handlePerplexityCrawl(
	job: Job<JobPayload<"perplexity-crawl">>,
	logger: CrawlerLogger,
	redis: Redis,
): Promise<void> {
	const { query, promptQueryId, promptQueryCrawlId } = job.data;

	await withDb(async (db) => {
		const crawlContext = await getCrawlContextAction({
			input: { promptQueryId },
			ctx: { db, userId: null, isAuthenticated: false },
		});

		const crawlLogger = adaptLogger(logger, {
			jobId: job.id ?? undefined,
			promptQueryCrawlId,
			promptQueryId,
			provider: "perplexity",
		});

		const provider = new PerplexityProvider(crawlLogger);
		const crawler = new Crawler({ logger: crawlLogger });

		const proxyApiUrl = env.THORDATA_PROXY_API_URL;

		try {
			const startTime = Date.now();

			let proxies: ProxyOptions[] | undefined;
			let singleProxy: ProxyOptions | undefined;
			let usedSticky = false;

			if (proxyApiUrl) {
				({ proxies, usedSticky } = await resolveProxies(
					proxyApiUrl,
					redis,
					logger,
					env.STICKY_PROXY_ENABLED,
				));
			} else if (env.PROXY_SERVER) {
				singleProxy = {
					server: env.PROXY_SERVER,
					username: env.PROXY_USERNAME,
					password: env.PROXY_PASSWORD,
				};
			}

			const result = await crawler
				.crawl({
					query,
					provider,
					browserOptions: {
						headless: env.HEADLESS,
						persist: false,
						proxy: singleProxy,
					},
					proxies,
				})
				.catch(async (err) => {
					if (
						err instanceof AllProxiesFailedError &&
						usedSticky &&
						proxyApiUrl
					) {
						logger.warn(
							"Sticky proxy failed — falling back to fresh ThorData list",
							{ lastFailureType: err.lastFailureType },
						);
						await clearStickyProxy(redis);

						const proxyList = await fetchProxyList(proxyApiUrl);
						const freshProxies = buildProxyOptions(proxyList);
						logger.info("Retrying with fresh proxy list", {
							proxyCount: freshProxies.length,
						});

						return crawler.crawl({
							query,
							provider,
							browserOptions: { headless: true, persist: false },
							proxies: freshProxies,
						});
					}
					throw err;
				});

			const endTime = Date.now();

			if (result.usedProxy && env.STICKY_PROXY_ENABLED) {
				await setStickyProxy(redis, result.usedProxy);
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

			await saveCrawlResultAction({
				input: {
					crawlId: promptQueryCrawlId,
					provider: result.provider,
					content: result.content,
					url: result.metadata.url,
					title: result.metadata.title,
					loadTimeMs: endTime - startTime,
					timestamp: result.metadata.timestamp.toISOString(),
					promptQueryId,
				},
				ctx: { db, userId: null, isAuthenticated: false },
			});

			if (result.structured) {
				await saveStructuredCrawlDataAction({
					input: {
						crawlId: promptQueryCrawlId,
						promptQueryId,
						domainProjectId: crawlContext.domainProjectId,
						structured: {
							citations: result.structured.citations,
							brandMentions: [],
							answerFormat: result.structured.answerFormat,
							wordCount: result.content.split(/\s+/).length,
						},
					},
					ctx: { db, userId: null, isAuthenticated: false },
				});
			}

			try {
				const intelligence = await extractBrandIntelligenceAction({
					content: result.content,
					query,
					targetBrand: crawlContext.targetBrand,
					targetDomain: crawlContext.targetDomain,
					targetAliases: crawlContext.targetAliases,
					knownCompetitors: crawlContext.knownCompetitors,
				});

				logger.info("LLM extraction completed", {
					brandMentionsCount: intelligence.brandMentions.length,
					discoveredCompetitorsCount: intelligence.discoveredCompetitors.length,
					answerFormat: intelligence.answerFormat,
				});

				const saveResult = await saveBrandIntelligenceAction({
					input: {
						crawlId: promptQueryCrawlId,
						domainProjectId: crawlContext.domainProjectId,
						intelligence,
						content: result.content,
					},
					ctx: { db, userId: null, isAuthenticated: false },
				});

				logger.info("Brand intelligence saved", {
					mentionsSaved: saveResult.mentionsSaved,
					competitorsCreated: saveResult.competitorsCreated,
					competitorsMatched: saveResult.competitorsMatched,
				});
			} catch (llmError) {
				const llmErrorMessage =
					llmError instanceof Error ? llmError.message : String(llmError);
				logger.error("LLM extraction failed", { error: llmErrorMessage });
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			if (env.STICKY_PROXY_ENABLED) {
				await clearStickyProxy(redis);
				logger.info("Sticky proxy cleared after crawl failure");
			}

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
