import { describe, expect, it, mock, spyOn } from "bun:test";
import type { AnswerEngineAvailability } from "@opencited/actions";
import * as actions from "@opencited/actions";
import {
	AllProxiesFailedError,
	type CrawlResult,
	type FailureType,
	type Logger,
} from "@opencited/browser-crawler";
import { handleCrawlHealthCheck } from "../src/handlers/crawl-health-check";
import {
	CRAWL_HEALTH_DAILY_EVENT,
	CRAWL_HEALTH_EVENT,
	classifyCrawlResult,
	proxyServerLabel,
	worstCrawlHealthStatus,
} from "../src/lib/crawl-health";

type RecordedLog = {
	level: "debug" | "info" | "warn" | "error";
	message: string;
	context: Record<string, unknown>;
};

function makeLogger() {
	const logs: RecordedLog[] = [];

	const logger: Logger = {
		info: (message, ...args) => {
			logs.push({ level: "info", message, context: mergeContext(args) });
		},
		warn: (message, ...args) => {
			logs.push({ level: "warn", message, context: mergeContext(args) });
		},
		error: (message, ...args) => {
			logs.push({ level: "error", message, context: mergeContext(args) });
		},
		debug: (message, ...args) => {
			logs.push({ level: "debug", message, context: mergeContext(args) });
		},
		withContext: () => logger,
		flush: async () => {},
	};

	return { logger, logs };
}

function mergeContext(args: unknown[]): Record<string, unknown> {
	return Object.assign({}, ...args.filter((arg) => typeof arg === "object"));
}

function engineAvailability(
	key: "chatgpt" | "perplexity",
	enabled: boolean,
): AnswerEngineAvailability {
	return {
		key,
		displayName: key === "chatgpt" ? "ChatGPT" : "Perplexity",
		enabled,
		disabledReason: enabled ? null : "Temporarily paused for maintenance.",
		sortOrder: 10,
	};
}

function crawlResult(
	provider: "chatgpt" | "perplexity",
	options: {
		contentLength?: number;
		inlineLinks?: number;
		sourcePanelLinks?: number;
		usedProxy?: { server: string; username?: string; password?: string };
		attemptCount?: number;
	} = {},
): CrawlResult {
	const contentLength = options.contentLength ?? 3009;
	const inlineLinks = options.inlineLinks ?? 2;
	const sourcePanelLinks = options.sourcePanelLinks ?? 1;

	return {
		provider,
		query: "What is the best CRM for small business?",
		content: "x".repeat(contentLength),
		metadata: {
			url: `https://${provider}.example/search/1`,
			title: `${provider} answer`,
			timestamp: new Date("2026-11-09T06:10:00Z"),
			loadTimeMs: 12_000,
		},
		structured: {
			inlineLinks: Array.from({ length: inlineLinks }, (_, index) => ({
				title: `Inline ${index + 1}`,
				url: `https://source-${index + 1}.example/article`,
				domain: `source-${index + 1}.example`,
				position: index + 1,
			})),
			sourcePanelLinks: Array.from(
				{ length: sourcePanelLinks },
				(_, index) => ({
					title: `Panel ${index + 1}`,
					url: `https://panel-${index + 1}.example/article`,
					domain: `panel-${index + 1}.example`,
					position: index + 1,
				}),
			),
			brandMentions: [],
		},
		usedProxy: options.usedProxy,
		attemptCount: options.attemptCount,
	};
}

function makeJob(
	data: {
		trigger: "schedule" | "manual";
		engines?: ("chatgpt" | "perplexity")[];
	} = { trigger: "schedule" },
) {
	return {
		id: "crawl-health-check-job-1",
		data,
	} as Parameters<typeof handleCrawlHealthCheck>[0];
}

function defaultDeps(overrides: Record<string, unknown> = {}) {
	return {
		readEngines: async () => [
			engineAvailability("chatgpt", true),
			engineAvailability("perplexity", true),
		],
		resolveProxies: async () => [{ server: "http://proxy.local:8000" }],
		describeProxySource: () => "proxy_server" as const,
		waitForEngineIdle: async () => {},
		rateLimit: async () => {},
		flush: async () => {},
		perEngineTimeoutMs: 5_000,
		...overrides,
	} as Parameters<typeof handleCrawlHealthCheck>[2];
}

function engineEvents(logs: RecordedLog[]) {
	return logs
		.filter((log) => log.message === CRAWL_HEALTH_EVENT)
		.map((log) => log.context);
}

function dailyEvents(logs: RecordedLog[]) {
	return logs
		.filter((log) => log.message === CRAWL_HEALTH_DAILY_EVENT)
		.map((log) => log);
}

describe("classifyCrawlResult", () => {
	it("returns ok when content is long enough and at least one source exists", () => {
		const result = crawlResult("chatgpt", {
			contentLength: 3_009,
			inlineLinks: 2,
			sourcePanelLinks: 1,
		});

		const classification = classifyCrawlResult(result);

		expect(classification.status).toBe("ok");
		expect(classification.contentLength).toBe(3_009);
		expect(classification.inlineLinksCount).toBe(2);
		expect(classification.sourcePanelLinksCount).toBe(1);
		expect(classification.sourcesCount).toBe(3);
		expect(classification.error).toBeNull();
	});

	it("flags the 9 Nov production case: long content but zero sources is degraded", () => {
		const result = crawlResult("chatgpt", {
			contentLength: 3_009,
			inlineLinks: 0,
			sourcePanelLinks: 0,
		});

		const classification = classifyCrawlResult(result);

		expect(classification.status).toBe("degraded");
		expect(classification.contentLength).toBe(3_009);
		expect(classification.sourcesCount).toBe(0);
		expect(classification.error).toBeNull();
	});

	it("fails when extraction is shorter than 80 characters", () => {
		const result = crawlResult("chatgpt", {
			contentLength: 79,
			inlineLinks: 1,
			sourcePanelLinks: 1,
		});

		const classification = classifyCrawlResult(result);

		expect(classification.status).toBe("failed");
		expect(classification.error).toContain("content_too_short");
	});

	it("ignores surrounding whitespace for the content floor", () => {
		const result = crawlResult("chatgpt", {
			contentLength: 80,
			inlineLinks: 1,
			sourcePanelLinks: 0,
		});
		result.content = `   ${result.content}   `;

		const classification = classifyCrawlResult(result);

		expect(classification.status).toBe("ok");
		expect(classification.contentLength).toBe(80);
	});
});

describe("worstCrawlHealthStatus", () => {
	it("returns skipped when every engine was skipped", () => {
		expect(worstCrawlHealthStatus(["skipped", "skipped"])).toBe("skipped");
	});

	it("returns the worst status among the engines that ran", () => {
		expect(worstCrawlHealthStatus(["ok", "skipped"])).toBe("ok");
		expect(worstCrawlHealthStatus(["ok", "degraded"])).toBe("degraded");
		expect(worstCrawlHealthStatus(["degraded", "failed"])).toBe("failed");
	});
});

describe("proxyServerLabel", () => {
	it("keeps host:port and strips schemes, credentials, and paths", () => {
		expect(proxyServerLabel("http://user:secret@proxy.local:8000/path")).toBe(
			"proxy.local:8000",
		);
		expect(proxyServerLabel("https://proxy.local:8443")).toBe(
			"proxy.local:8443",
		);
		expect(proxyServerLabel(undefined)).toBeNull();
	});
});

describe("handleCrawlHealthCheck", () => {
	it("logs one event per enabled engine plus a daily summary", async () => {
		const { logger, logs } = makeLogger();
		const flushMock = mock(async () => {});
		const crawled: string[] = [];

		await handleCrawlHealthCheck(
			makeJob(),
			logger,
			defaultDeps({
				readEngines: async () => [
					engineAvailability("chatgpt", true),
					engineAvailability("perplexity", false),
				],
				flush: flushMock,
				createRunner: (engine: "chatgpt" | "perplexity") => ({
					crawl: async () => {
						crawled.push(engine);
						return crawlResult(engine, {
							inlineLinks: 1,
							sourcePanelLinks: 1,
							usedProxy: {
								server: "http://proxy.local:8000",
								username: "proxy-user",
								password: "proxy-secret",
							},
							attemptCount: 2,
						});
					},
					classifyError: () => "unknown" as FailureType,
				}),
			}),
		);

		expect(crawled).toEqual(["chatgpt"]);

		const events = engineEvents(logs);
		expect(events).toHaveLength(2);

		const chatgpt = events.find((event) => event.engine === "chatgpt");
		expect(chatgpt).toMatchObject({
			event: CRAWL_HEALTH_EVENT,
			engine: "chatgpt",
			status: "ok",
			contentLength: 3_009,
			sourcesCount: 2,
			inlineLinksCount: 1,
			sourcePanelLinksCount: 1,
			error: null,
			failureType: null,
			proxyUsed: true,
			proxySource: "proxy_server",
			proxyServer: "proxy.local:8000",
			attemptCount: 2,
			trigger: "schedule",
			skippedReason: null,
		});
		expect(typeof chatgpt?.durationMs).toBe("number");

		const perplexity = events.find((event) => event.engine === "perplexity");
		expect(perplexity).toMatchObject({
			status: "skipped",
			contentLength: null,
			sourcesCount: null,
			proxyUsed: false,
			attemptCount: 0,
			skippedReason: "Temporarily paused for maintenance.",
		});

		// Proxy credentials must never reach Axiom.
		expect(JSON.stringify(logs)).not.toContain("proxy-user");
		expect(JSON.stringify(logs)).not.toContain("proxy-secret");

		// Flush after each engine and once for the summary.
		expect(flushMock).toHaveBeenCalledTimes(3);

		const summaries = dailyEvents(logs);
		expect(summaries).toHaveLength(1);
		expect(summaries[0]?.level).toBe("info");
		expect(summaries[0]?.context).toMatchObject({
			event: CRAWL_HEALTH_DAILY_EVENT,
			overallStatus: "ok",
			chatgptStatus: "ok",
			perplexityStatus: "skipped",
			enginesRun: 1,
			enginesSkipped: 1,
			trigger: "schedule",
		});
	});

	it("does not touch crawl intake, failures, brand extraction, or scoring", async () => {
		const { logger } = makeLogger();
		const intakeSpy = spyOn(actions, "intakeCrawlResultAction");
		const failSpy = spyOn(actions, "failCrawlAction");
		const brandSpy = spyOn(actions, "extractBrandIntelligenceAction");
		const scoreSpy = spyOn(actions, "computeVisibilityScoreAction");

		try {
			await handleCrawlHealthCheck(
				makeJob(),
				logger,
				defaultDeps({
					readEngines: async () => [engineAvailability("chatgpt", true)],
					createRunner: () => ({
						crawl: async () => crawlResult("chatgpt"),
						classifyError: () => "unknown" as FailureType,
					}),
				}),
			);

			expect(intakeSpy).not.toHaveBeenCalled();
			expect(failSpy).not.toHaveBeenCalled();
			expect(brandSpy).not.toHaveBeenCalled();
			expect(scoreSpy).not.toHaveBeenCalled();
		} finally {
			intakeSpy.mockRestore();
			failSpy.mockRestore();
			brandSpy.mockRestore();
			scoreSpy.mockRestore();
		}
	});

	it("only crawls the engines requested by a manual run", async () => {
		const { logger, logs } = makeLogger();
		const crawled: string[] = [];

		await handleCrawlHealthCheck(
			makeJob({ trigger: "manual", engines: ["perplexity"] }),
			logger,
			defaultDeps({
				createRunner: (engine: "chatgpt" | "perplexity") => ({
					crawl: async () => {
						crawled.push(engine);
						return crawlResult(engine);
					},
					classifyError: () => "unknown" as FailureType,
				}),
			}),
		);

		expect(crawled).toEqual(["perplexity"]);
		expect(engineEvents(logs)).toHaveLength(1);
		expect(dailyEvents(logs)[0]?.context).toMatchObject({
			trigger: "manual",
			chatgptStatus: "skipped",
			perplexityStatus: "ok",
			enginesRun: 1,
			enginesSkipped: 1,
		});
	});

	it("logs degraded when the crawl returns long content with no sources", async () => {
		const { logger, logs } = makeLogger();

		await handleCrawlHealthCheck(
			makeJob({ trigger: "manual", engines: ["chatgpt"] }),
			logger,
			defaultDeps({
				readEngines: async () => [engineAvailability("chatgpt", true)],
				createRunner: () => ({
					crawl: async () =>
						crawlResult("chatgpt", {
							contentLength: 9_812,
							inlineLinks: 0,
							sourcePanelLinks: 0,
						}),
					classifyError: () => "unknown" as FailureType,
				}),
			}),
		);

		const events = engineEvents(logs);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			status: "degraded",
			contentLength: 9_812,
			sourcesCount: 0,
		});
		expect(logs.find((log) => log.message === CRAWL_HEALTH_EVENT)?.level).toBe(
			"warn",
		);
		expect(dailyEvents(logs)[0]?.level).toBe("warn");
		expect(dailyEvents(logs)[0]?.context).toMatchObject({
			overallStatus: "degraded",
		});
	});

	it("logs failed with the provider failure type when the crawl throws", async () => {
		const { logger, logs } = makeLogger();

		await handleCrawlHealthCheck(
			makeJob({ trigger: "manual", engines: ["chatgpt"] }),
			logger,
			defaultDeps({
				readEngines: async () => [engineAvailability("chatgpt", true)],
				createRunner: () => ({
					crawl: async () => {
						throw new Error("bot detection challenge");
					},
					classifyError: () => "bot_detection" as FailureType,
				}),
			}),
		);

		const events = engineEvents(logs);
		expect(events[0]).toMatchObject({
			status: "failed",
			contentLength: null,
			sourcesCount: null,
			error: "bot detection challenge",
			failureType: "bot_detection",
		});
		expect(logs.find((log) => log.message === CRAWL_HEALTH_EVENT)?.level).toBe(
			"error",
		);
		expect(dailyEvents(logs)[0]?.context).toMatchObject({
			overallStatus: "failed",
			enginesRun: 1,
		});
	});

	it("reports a timeout even when the crawl never settles", async () => {
		const { logger, logs } = makeLogger();

		await handleCrawlHealthCheck(
			makeJob({ trigger: "manual", engines: ["chatgpt"] }),
			logger,
			defaultDeps({
				readEngines: async () => [engineAvailability("chatgpt", true)],
				perEngineTimeoutMs: 10,
				createRunner: () => ({
					crawl: () => new Promise<CrawlResult>(() => {}),
					classifyError: () => "unknown" as FailureType,
				}),
			}),
		);

		const events = engineEvents(logs);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			status: "failed",
			error: "timeout",
			failureType: "timeout",
		});
		expect(dailyEvents(logs)).toHaveLength(1);
	});

	it("uses the proxy rotation attempt count from AllProxiesFailedError", async () => {
		const { logger, logs } = makeLogger();
		const proxyError = new AllProxiesFailedError(
			4,
			"proxy connect failed",
			"connection_error",
		);

		await handleCrawlHealthCheck(
			makeJob({ trigger: "manual", engines: ["chatgpt"] }),
			logger,
			defaultDeps({
				readEngines: async () => [engineAvailability("chatgpt", true)],
				resolveProxies: async () => [{ server: "http://proxy.local:8000" }],
				createRunner: () => ({
					crawl: async () => {
						throw proxyError;
					},
					classifyError: () => "connection_error" as FailureType,
				}),
			}),
		);

		expect(engineEvents(logs)[0]).toMatchObject({
			status: "failed",
			proxyUsed: true,
			attemptCount: 4,
			failureType: "connection_error",
		});
	});

	it("fails every requested engine when the engine registry cannot be read", async () => {
		const { logger, logs } = makeLogger();

		await handleCrawlHealthCheck(
			makeJob(),
			logger,
			defaultDeps({
				readEngines: async () => {
					throw new Error("database unavailable");
				},
			}),
		);

		const events = engineEvents(logs);
		expect(events).toHaveLength(2);
		for (const event of events) {
			expect(event).toMatchObject({
				status: "failed",
				error: "engine_registry_unavailable: database unavailable",
				attemptCount: 0,
			});
		}
		expect(dailyEvents(logs)[0]?.context).toMatchObject({
			overallStatus: "failed",
		});
	});
});
