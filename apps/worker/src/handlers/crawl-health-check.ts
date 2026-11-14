import type { AnswerEngineAvailability } from "@opencited/actions";
import {
	AllProxiesFailedError,
	Crawler,
	type CrawlResult,
	createProvider,
	type FailureType,
	type ProxyOptions,
} from "@opencited/browser-crawler";
import type { Logger } from "@opencited/logger";
import { flush as flushDefaultLogger } from "@opencited/logger";
import type { JobPayload } from "@opencited/queue";
import type { Job } from "bullmq";
import { withDb } from "../db";
import { env } from "../env";
import { readAnswerEngines } from "../lib/answer-engine-availability";
import {
	CRAWL_HEALTH_DAILY_EVENT,
	CRAWL_HEALTH_ENGINES,
	CRAWL_HEALTH_EVENT,
	type CrawlHealthEngine,
	type CrawlHealthStatus,
	type CrawlHealthTrigger,
	classifyCrawlResult,
	proxyServerLabel,
	worstCrawlHealthStatus,
} from "../lib/crawl-health";
import { rateLimit as defaultRateLimit } from "../lib/rate-limit";
import {
	describePublicScanProxySource,
	type PublicScanProxySource,
	resolveProxiesForPublicScan,
} from "../lib/resolve-public-scan-proxies";

/**
 * A single engine gets eight minutes of wall clock. The daily slot has ~90
 * minutes before the 07:30 IST AEO digest, so two timed-out engines still
 * emit their events in time for the monitors.
 */
export const CRAWL_HEALTH_CHECK_ENGINE_TIMEOUT_MS = 8 * 60 * 1000;

export type CrawlHealthCheckJob = Job<JobPayload<"crawl-health-check">>;

export interface CrawlHealthCheckEngineRunner {
	crawl(args: {
		query: string;
		logger: Logger;
		proxies: ProxyOptions[];
	}): Promise<CrawlResult>;
	classifyError(error: Error): FailureType;
}

export type CrawlHealthCheckRunnerFactory = (
	engine: CrawlHealthEngine,
	logger: Logger,
) => CrawlHealthCheckEngineRunner;

export interface CrawlHealthCheckDeps {
	readEngines?: () => Promise<AnswerEngineAvailability[]>;
	resolveProxies?: () => Promise<ProxyOptions[]>;
	describeProxySource?: () => PublicScanProxySource;
	/** Waits for this engine's user-crawl queue to go idle (index.ts polls). */
	waitForEngineIdle?: (engine: CrawlHealthEngine) => Promise<void>;
	rateLimit?: (engine: CrawlHealthEngine) => Promise<void>;
	createRunner?: CrawlHealthCheckRunnerFactory;
	flush?: () => Promise<void>;
	perEngineTimeoutMs?: number;
}

interface EngineOutcome {
	engine: CrawlHealthEngine;
	status: CrawlHealthStatus;
	durationMs: number;
	contentLength: number | null;
	sourcesCount: number | null;
	inlineLinksCount: number | null;
	sourcePanelLinksCount: number | null;
	error: string | null;
	failureType: string | null;
	proxyUsed: boolean;
	proxySource: PublicScanProxySource;
	proxyServer: string | null;
	attemptCount: number;
	trigger: CrawlHealthTrigger;
	skippedReason: string | null;
}

class CrawlHealthCheckTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`timeout after ${timeoutMs}ms`);
		this.name = "CrawlHealthCheckTimeoutError";
	}
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function runWithTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	// The timeout wins the race but the crawl keeps running in the browser
	// until its own provider timeout fires. Swallow that late rejection so it
	// does not become an unhandled rejection in the worker.
	promise.catch(() => {});

	const timeout = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(
			() => reject(new CrawlHealthCheckTimeoutError(timeoutMs)),
			timeoutMs,
		);
	});

	try {
		return await Promise.race([promise, timeout]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

function defaultRunnerFactory(
	engine: CrawlHealthEngine,
	logger: Logger,
): CrawlHealthCheckEngineRunner {
	const provider = createProvider(engine, logger);
	const crawler = new Crawler({ logger });

	return {
		crawl: ({ query, proxies }) =>
			crawler.crawl({
				query,
				provider,
				browserOptions: {
					headless: env.HEADLESS,
					persist: false,
				},
				proxies,
			}),
		classifyError: (error) =>
			error instanceof AllProxiesFailedError
				? error.lastFailureType
				: provider.classifyError(error),
	};
}

function nullCounts() {
	return {
		contentLength: null,
		sourcesCount: null,
		inlineLinksCount: null,
		sourcePanelLinksCount: null,
	};
}

function levelForStatus(status: CrawlHealthStatus): "info" | "warn" | "error" {
	if (status === "failed") return "error";
	if (status === "degraded") return "warn";
	return "info";
}

async function safeFlush(
	flush: () => Promise<void>,
	logger: Logger,
): Promise<void> {
	try {
		await flush();
	} catch (error) {
		logger.error("Crawl health check log flush failed", {
			error: toErrorMessage(error),
		});
	}
}

async function checkEngine(args: {
	engine: CrawlHealthEngine;
	trigger: CrawlHealthTrigger;
	query: string;
	engines: AnswerEngineAvailability[];
	registryError: string | null;
	proxySource: PublicScanProxySource;
	logger: Logger;
	resolveProxies: () => Promise<ProxyOptions[]>;
	waitForEngineIdle: (engine: CrawlHealthEngine) => Promise<void>;
	rateLimit: (engine: CrawlHealthEngine) => Promise<void>;
	createRunner: CrawlHealthCheckRunnerFactory;
	perEngineTimeoutMs: number;
}): Promise<EngineOutcome> {
	const startedAt = Date.now();
	const base = {
		engine: args.engine,
		trigger: args.trigger,
		proxySource: args.proxySource,
		proxyUsed: false,
		proxyServer: null,
		skippedReason: null,
	};

	if (args.registryError) {
		return {
			...base,
			...nullCounts(),
			status: "failed",
			durationMs: Date.now() - startedAt,
			error: `engine_registry_unavailable: ${args.registryError}`,
			failureType: "unknown",
			attemptCount: 0,
		};
	}

	const engineConfig = args.engines.find(
		(candidate) => candidate.key === args.engine,
	);

	if (!engineConfig?.enabled) {
		return {
			...base,
			...nullCounts(),
			status: "skipped",
			durationMs: Date.now() - startedAt,
			error: null,
			failureType: null,
			attemptCount: 0,
			skippedReason: engineConfig?.disabledReason ?? "Engine is disabled",
		};
	}

	let proxies: ProxyOptions[];
	try {
		await args.waitForEngineIdle(args.engine);
		await args.rateLimit(args.engine);
		proxies = await args.resolveProxies();
	} catch (error) {
		return {
			...base,
			...nullCounts(),
			status: "failed",
			durationMs: Date.now() - startedAt,
			error: toErrorMessage(error),
			failureType: "unknown",
			attemptCount: 0,
		};
	}

	const proxyUsed = proxies.length > 0;
	const engineLogger = args.logger.withContext({
		engine: args.engine,
		trigger: args.trigger,
	});
	const runner = args.createRunner(args.engine, engineLogger);

	try {
		const result = await runWithTimeout(
			runner.crawl({
				query: args.query,
				logger: engineLogger,
				proxies,
			}),
			args.perEngineTimeoutMs,
		);
		const classification = classifyCrawlResult(result);

		return {
			...base,
			status: classification.status,
			durationMs: Date.now() - startedAt,
			contentLength: classification.contentLength,
			sourcesCount: classification.sourcesCount,
			inlineLinksCount: classification.inlineLinksCount,
			sourcePanelLinksCount: classification.sourcePanelLinksCount,
			error: classification.error,
			failureType:
				classification.status === "failed" ? "extraction_failed" : null,
			proxyUsed,
			proxyServer: proxyServerLabel(result.usedProxy?.server),
			attemptCount: result.attemptCount ?? 1,
		};
	} catch (error) {
		const isTimeout = error instanceof CrawlHealthCheckTimeoutError;
		const failureType = isTimeout
			? "timeout"
			: runner.classifyError(
					error instanceof Error ? error : new Error(toErrorMessage(error)),
				);

		return {
			...base,
			...nullCounts(),
			status: "failed",
			durationMs: Date.now() - startedAt,
			error: isTimeout ? "timeout" : toErrorMessage(error),
			failureType,
			proxyUsed,
			attemptCount:
				error instanceof AllProxiesFailedError ? error.proxiesAttempted : 1,
		};
	}
}

/**
 * Daily canary for the production browser crawl path. It stops after the raw
 * `CrawlResult`: no `intakeCrawlResultAction`, no LLM extraction, no scoring,
 * and no writes to prompt-query crawl rows. Axiom is the source of truth.
 */
export async function handleCrawlHealthCheck(
	job: CrawlHealthCheckJob,
	logger: Logger,
	deps: CrawlHealthCheckDeps = {},
): Promise<void> {
	const startedAt = Date.now();
	const trigger = job.data.trigger;
	const query = env.CRAWL_HEALTH_CHECK_QUERY;
	const requestedEngines = job.data.engines ?? [...CRAWL_HEALTH_ENGINES];

	const readEngines =
		deps.readEngines ??
		(() => withDb((db) => readAnswerEngines(db, { fresh: true })));
	const resolveProxies = deps.resolveProxies ?? resolveProxiesForPublicScan;
	const describeProxySource =
		deps.describeProxySource ?? describePublicScanProxySource;
	const waitForEngineIdle = deps.waitForEngineIdle ?? (async () => {});
	const rateLimit = deps.rateLimit ?? defaultRateLimit;
	const createRunner = deps.createRunner ?? defaultRunnerFactory;
	const flush = deps.flush ?? flushDefaultLogger;
	const perEngineTimeoutMs =
		deps.perEngineTimeoutMs ?? CRAWL_HEALTH_CHECK_ENGINE_TIMEOUT_MS;

	const proxySource = describeProxySource();
	const statuses = new Map<CrawlHealthEngine, CrawlHealthStatus>(
		CRAWL_HEALTH_ENGINES.map((engine) => [engine, "skipped"]),
	);

	let engines: AnswerEngineAvailability[] = [];
	let registryError: string | null = null;
	try {
		engines = await readEngines();
	} catch (error) {
		registryError = toErrorMessage(error);
		logger.error("Crawl health check could not read answer engines", {
			event: CRAWL_HEALTH_EVENT,
			error: registryError,
			trigger,
		});
	}

	for (const engine of requestedEngines) {
		const outcome = await checkEngine({
			engine,
			trigger,
			query,
			engines,
			registryError,
			proxySource,
			logger,
			resolveProxies,
			waitForEngineIdle,
			rateLimit,
			createRunner,
			perEngineTimeoutMs,
		});

		statuses.set(engine, outcome.status);

		const event = {
			event: CRAWL_HEALTH_EVENT,
			...outcome,
		};
		logger[levelForStatus(outcome.status)](CRAWL_HEALTH_EVENT, event);

		// Flush after every engine so a hung or crashing run still has its
		// per-engine event in Axiom before the next browser opens.
		await safeFlush(flush, logger);
	}

	const chatgptStatus = statuses.get("chatgpt") ?? "skipped";
	const perplexityStatus = statuses.get("perplexity") ?? "skipped";
	const statusValues = [...statuses.values()];
	const overallStatus = worstCrawlHealthStatus(statusValues);
	const enginesRun = statusValues.filter(
		(status) => status !== "skipped",
	).length;
	const enginesSkipped = statusValues.filter(
		(status) => status === "skipped",
	).length;
	const summaryLevel = levelForStatus(overallStatus);

	logger[summaryLevel](CRAWL_HEALTH_DAILY_EVENT, {
		event: CRAWL_HEALTH_DAILY_EVENT,
		chatgptStatus,
		perplexityStatus,
		overallStatus,
		enginesRun,
		enginesSkipped,
		trigger,
		durationMs: Date.now() - startedAt,
	});

	await safeFlush(flush, logger);
}
