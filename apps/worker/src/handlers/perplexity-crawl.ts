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
	computeVisibilityScoreAction,
} from "@opencited/actions";
import { dispatch, type JobPayload } from "@opencited/queue";
import { withDb } from "../db";
import {
	fetchProxyList,
	buildProxyOptions,
	setStickyProxy,
	clearStickyProxy,
	getStickyProxy,
} from "../lib/proxy-resolver";
import { env } from "../env";
import { proxyConfigTable, eq } from "@opencited/db";

function adaptLogger(
	base: CrawlerLogger,
	context: LoggerContext,
): CrawlerLogger {
	return base.withContext(context);
}

function parseBatchProxyList(raw: string): string[] {
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && line.includes(":"));
}

async function resolveProxies(
	proxyApiUrl: string,
	domainProjectId: string,
	redis: Redis,
	logger: CrawlerLogger,
	stickyProxyEnabled: boolean,
): Promise<{ proxies: ProxyOptions[]; usedSticky: boolean }> {
	if (stickyProxyEnabled) {
		const stickyProxy = await getStickyProxy(redis, domainProjectId);
		if (stickyProxy) {
			logger.info("Using sticky proxy from last successful crawl", {
				server: stickyProxy.server,
			});
			return { proxies: [stickyProxy], usedSticky: true };
		}
	}

	const proxyList = await fetchProxyList(proxyApiUrl);
	const proxies = buildProxyOptions(proxyList);
	logger.info("Proxy list fetched", {
		proxyCount: proxies.length,
	});
	return { proxies, usedSticky: false };
}

export async function handlePerplexityCrawl(
	job: Job<JobPayload<"perplexity-crawl">>,
	logger: CrawlerLogger,
	redis: Redis,
): Promise<void> {
	const { query, promptQueryId, promptQueryCrawlId, domainProjectId } =
		job.data;

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

		// Check for custom proxy config
		const proxyConfigs = await db
			.select()
			.from(proxyConfigTable)
			.where(eq(proxyConfigTable.domainProjectId, domainProjectId));

		const customProxyConfig = proxyConfigs[0];
		const isCustomProxyEnabled = customProxyConfig?.enabled === true;
		const isStickyProxyEnabled = customProxyConfig?.stickyProxyEnabled === true;

		try {
			const startTime = Date.now();

			let proxies: ProxyOptions[] | undefined;
			let singleProxy: ProxyOptions | undefined;
			let usedSticky = false;
			let customProxySource: string | undefined;

			if (isCustomProxyEnabled && customProxyConfig) {
				if (customProxyConfig.sourceType === "api") {
					({ proxies, usedSticky } = await resolveProxies(
						customProxyConfig.sourceValue,
						domainProjectId,
						redis,
						logger,
						isStickyProxyEnabled,
					));
					customProxySource = customProxyConfig.sourceValue;
				} else {
					// batch
					if (isStickyProxyEnabled) {
						const stickyProxy = await getStickyProxy(redis, domainProjectId);
						if (stickyProxy) {
							logger.info("Using sticky proxy from last successful crawl", {
								server: stickyProxy.server,
							});
							proxies = [stickyProxy];
							usedSticky = true;
						}
					}

					if (!usedSticky) {
						const proxyList = parseBatchProxyList(
							customProxyConfig.sourceValue,
						);
						if (proxyList.length > 0) {
							proxies = buildProxyOptions(proxyList);
							logger.info("Using custom batch proxy list", {
								proxyCount: proxies.length,
							});
						}
					}
				}
			} else if (env.THORDATA_PROXY_API_URL) {
				({ proxies, usedSticky } = await resolveProxies(
					env.THORDATA_PROXY_API_URL,
					domainProjectId,
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
						customProxySource
					) {
						logger.warn(
							"Sticky proxy failed — falling back to fresh proxy list",
							{ lastFailureType: err.lastFailureType },
						);
						await clearStickyProxy(redis, domainProjectId);

						const proxyList = await fetchProxyList(customProxySource);
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

			if (result.usedProxy && isCustomProxyEnabled) {
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
					},
					ctx: { db, userId: null, isAuthenticated: false },
				});

				logger.info("Brand intelligence saved", {
					mentionsSaved: saveResult.mentionsSaved,
					competitorsCreated: saveResult.competitorsCreated,
					competitorsMatched: saveResult.competitorsMatched,
				});

				// Compute and persist the AI Visibility Score. A failure here
				// never fails the crawl — the score is best-effort and the
				// `sentimentIsFallback` flag handles a flaked sentiment LLM
				// (we still write a row, with sentimentScore=50 and a single
				// retry enqueued). Spec: docs/agents/visibility-score.md v1.0.0.
				// ADR: docs/adr/0002-visibility-score.md.
				try {
					const scoreResult = await computeVisibilityScoreAction({
						input: { crawlId: promptQueryCrawlId },
						ctx: { db, userId: null, isAuthenticated: false },
					});

					logger.info("AI Visibility Score computed", {
						crawlId: promptQueryCrawlId,
						visibilityScore: scoreResult.row.visibilityScore,
						mentionScore: scoreResult.row.mentionScore,
						positionScore: scoreResult.row.positionScore,
						citationScore: scoreResult.row.citationScore,
						sentimentScore: scoreResult.row.sentimentScore,
						coMentionScore: scoreResult.row.coMentionScore,
						formulaVersion: scoreResult.row.formulaVersion,
						sentimentRetryNeeded: scoreResult.sentimentRetryNeeded,
					});

					if (scoreResult.sentimentRetryNeeded) {
						await dispatch("sentiment-retry", {
							crawlId: promptQueryCrawlId,
							promptQueryCrawlId,
							domainProjectId: crawlContext.domainProjectId,
						});
						logger.info("Sentiment retry enqueued", {
							crawlId: promptQueryCrawlId,
						});
					}
				} catch (scoreError) {
					const scoreErrorMessage =
						scoreError instanceof Error
							? scoreError.message
							: String(scoreError);
					logger.error("AI Visibility Score computation failed", {
						crawlId: promptQueryCrawlId,
						error: scoreErrorMessage,
					});
				}
			} catch (llmError) {
				const llmErrorMessage =
					llmError instanceof Error ? llmError.message : String(llmError);
				logger.error("LLM extraction failed", { error: llmErrorMessage });
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			if (isCustomProxyEnabled) {
				await clearStickyProxy(redis, domainProjectId);
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
