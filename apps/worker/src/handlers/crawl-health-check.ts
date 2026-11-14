import type { AnswerEngineAvailability } from "@opencited/actions";
import {
	AllProxiesFailedError,
	CrawlAbortedError,
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

/**
 * After a timeout aborts the crawl, wait this long for the browser to close
 * and the crawl promise to settle before logging and moving to the next
 * engine.
 */
export const CRAWL_HEALTH_CHECK_ABORT_GRACE_MS = 60 * 1000;

/**
 * A zero-source retry with less than this much budget left is not worth
 * starting: it would time out mid-crawl and turn a healthy first run into a
 * false `failed`. Report the first run as `degraded` instead.
 */
export const CRAWL_HEALTH_CHECK_MIN_RETRY_BUDGET_MS = 3 * 60 * 1000;

export type CrawlHealthZeroSourceRetryOutcome =
	| "ok"
	| "degraded"
	| "skipped_budget"
	| "skipped_rate_limit"
	| "error";

export type CrawlHealthCheckJob = Job<JobPayload<"crawl-health-check">>;

export interface CrawlHealthCheckEngineRunner {
	crawl(args: {
		query: string;
		proxies: ProxyOptions[];
		signal?: AbortSignal;
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
	abortGraceMs?: number;
	minRetryBudgetMs?: number;
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
	zeroSourceRetry: boolean;
	zeroSourceRetryOutcome: CrawlHealthZeroSourceRetryOutcome | null;
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
	onTimeout?: () => void,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	// The timeout wins the race but the crawl keeps running until the abort
	// listener closes its browser. Swallow a late rejection so it does not
	// become an unhandled rejection in the worker.
	promise.catch(() => {});

	const timeout = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			onTimeout?.();
			reject(new CrawlHealthCheckTimeoutError(timeoutMs));
		}, timeoutMs);
	});

	try {
		return await Promise.race([promise, timeout]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

async function waitForSettlement(
	promise: Promise<unknown>,
	graceMs: number,
	logger: Logger,
	engine: CrawlHealthEngine,
): Promise<void> {
	if (graceMs <= 0) return;

	let timer: ReturnType<typeof setTimeout> | undefined;

	const grace = new Promise<false>((resolve) => {
		timer = setTimeout(() => resolve(false), graceMs);
	});

	try {
		const settled = await Promise.race([
			promise.then(
				() => true,
				() => true,
			),
			grace,
		]);

		if (!settled) {
			logger.warn(
				"Crawl health check crawl did not settle within abort grace",
				{
					engine,
					graceMs,
				},
			);
		}
	} finally {
		if (timer) clearTimeout(timer);
	}
}

type CrawlAttemptOutcome =
	| { kind: "success"; result: CrawlResult }
	| {
			kind: "error";
			error: unknown;
			timedOut: boolean;
			attemptsMade: number;
	  };

async function runCrawlAttempt(args: {
	runner: CrawlHealthCheckEngineRunner;
	engine: CrawlHealthEngine;
	query: string;
	proxies: ProxyOptions[];
	timeoutMs: number;
	abortGraceMs: number;
	logger: Logger;
}): Promise<CrawlAttemptOutcome> {
	const controller = new AbortController();
	let timedOut = false;
	let crawlError: unknown;

	const crawlPromise = (async () =>
		args.runner.crawl({
			query: args.query,
			proxies: args.proxies,
			signal: controller.signal,
		}))().catch((error) => {
		crawlError = error;
		throw error;
	});

	try {
		const result = await runWithTimeout(crawlPromise, args.timeoutMs, () => {
			timedOut = true;
			controller.abort();
		});
		return { kind: "success", result };
	} catch (error) {
		const isTimeout = timedOut || error instanceof CrawlHealthCheckTimeoutError;

		if (isTimeout) {
			if (!timedOut) {
				timedOut = true;
				controller.abort();
			}
			await waitForSettlement(
				crawlPromise,
				args.abortGraceMs,
				args.logger,
				args.engine,
			);
		}

		return {
			kind: "error",
			error,
			timedOut,
			attemptsMade:
				crawlError instanceof CrawlAbortedError
					? crawlError.attemptsMade
					: crawlError instanceof AllProxiesFailedError
						? crawlError.proxiesAttempted
						: 1,
		};
	}
}

function defaultRunnerFactory(
	engine: CrawlHealthEngine,
	logger: Logger,
): CrawlHealthCheckEngineRunner {
	const provider = createProvider(engine, logger);
	const crawler = new Crawler({ logger });

	return {
		crawl: ({ query, proxies, signal }) =>
			crawler.crawl({
				query,
				provider,
				browserOptions: {
					headless: env.HEADLESS,
					persist: false,
				},
				proxies,
				signal,
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
	abortGraceMs: number;
	minRetryBudgetMs: number;
}): Promise<EngineOutcome> {
	const startedAt = Date.now();
	const base = {
		engine: args.engine,
		trigger: args.trigger,
		proxySource: args.proxySource,
		proxyUsed: false,
		proxyServer: null,
		zeroSourceRetry: false,
		zeroSourceRetryOutcome: null,
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
	// The Crawler rotates internally and does not report the proxy that failed
	// last, so use the last resolved proxy as the best approximation, falling
	// back to the first one.
	const failedProxyServer = proxyUsed
		? proxyServerLabel((proxies.at(-1) ?? proxies[0])?.server)
		: null;
	const engineLogger = args.logger.withContext({
		engine: args.engine,
		trigger: args.trigger,
	});
	const runner = args.createRunner(args.engine, engineLogger);

	const failureOutcome = (
		attempt: Extract<CrawlAttemptOutcome, { kind: "error" }>,
	): EngineOutcome => ({
		...base,
		...nullCounts(),
		status: "failed",
		durationMs: Date.now() - startedAt,
		error: attempt.timedOut ? "timeout" : toErrorMessage(attempt.error),
		failureType: attempt.timedOut
			? "timeout"
			: runner.classifyError(
					attempt.error instanceof Error
						? attempt.error
						: new Error(toErrorMessage(attempt.error)),
				),
		proxyUsed,
		proxyServer: failedProxyServer,
		attemptCount: attempt.attemptsMade,
	});

	const successOutcome = (outcome: {
		result: CrawlResult;
		classification: ReturnType<typeof classifyCrawlResult>;
		attemptCount: number;
		zeroSourceRetry: boolean;
		zeroSourceRetryOutcome: CrawlHealthZeroSourceRetryOutcome | null;
		error?: string | null;
	}): EngineOutcome => ({
		...base,
		status: outcome.classification.status,
		durationMs: Date.now() - startedAt,
		contentLength: outcome.classification.contentLength,
		sourcesCount: outcome.classification.sourcesCount,
		inlineLinksCount: outcome.classification.inlineLinksCount,
		sourcePanelLinksCount: outcome.classification.sourcePanelLinksCount,
		error: outcome.error ?? outcome.classification.error,
		failureType:
			outcome.classification.status === "failed" ? "extraction_failed" : null,
		proxyUsed,
		proxyServer: proxyServerLabel(outcome.result.usedProxy?.server),
		attemptCount: outcome.attemptCount,
		zeroSourceRetry: outcome.zeroSourceRetry,
		zeroSourceRetryOutcome: outcome.zeroSourceRetryOutcome,
	});

	// The total engine duration includes the wait for user crawls, but the
	// crawl budget starts when the first crawl actually does. Otherwise a slow
	// queue wait can leave the retry with only a few seconds of budget.
	const crawlStartedAt = Date.now();
	const firstAttempt = await runCrawlAttempt({
		runner,
		engine: args.engine,
		query: args.query,
		proxies,
		timeoutMs: args.perEngineTimeoutMs,
		abortGraceMs: args.abortGraceMs,
		logger: engineLogger,
	});

	if (firstAttempt.kind === "error") {
		return failureOutcome(firstAttempt);
	}

	const firstAttemptCount = firstAttempt.result.attemptCount ?? 1;
	const result = firstAttempt.result;
	const classification = classifyCrawlResult(result);

	// About one in eight ChatGPT answers legitimately cites no sources. A
	// single zero-source run is not enough to page someone, so retry once
	// inside the same per-engine crawl budget. Only two zero-source runs are
	// reported as degraded.
	if (classification.status !== "degraded") {
		return successOutcome({
			result,
			classification,
			attemptCount: firstAttemptCount,
			zeroSourceRetry: false,
			zeroSourceRetryOutcome: null,
		});
	}

	const remainingMs = args.perEngineTimeoutMs - (Date.now() - crawlStartedAt);

	if (remainingMs < args.minRetryBudgetMs) {
		return successOutcome({
			result,
			classification,
			attemptCount: firstAttemptCount,
			zeroSourceRetry: false,
			zeroSourceRetryOutcome: "skipped_budget",
			error: "zero_source_retry_skipped: budget",
		});
	}

	try {
		await args.rateLimit(args.engine);
	} catch (error) {
		engineLogger.warn(
			"Crawl health check zero-source retry rate limit failed",
			{
				error: toErrorMessage(error),
			},
		);

		return successOutcome({
			result,
			classification,
			attemptCount: firstAttemptCount,
			zeroSourceRetry: false,
			zeroSourceRetryOutcome: "skipped_rate_limit",
			error: "zero_source_retry_skipped: rate_limit",
		});
	}

	const retryAttempt = await runCrawlAttempt({
		runner,
		engine: args.engine,
		query: args.query,
		proxies,
		timeoutMs: remainingMs,
		abortGraceMs: args.abortGraceMs,
		logger: engineLogger,
	});

	if (retryAttempt.kind === "error") {
		const retryError = retryAttempt.timedOut
			? "timeout"
			: toErrorMessage(retryAttempt.error);

		return successOutcome({
			result,
			classification,
			attemptCount: firstAttemptCount + retryAttempt.attemptsMade,
			zeroSourceRetry: true,
			zeroSourceRetryOutcome: "error",
			error: `zero_source_retry_failed: ${retryError}`,
		});
	}

	const retryClassification = classifyCrawlResult(retryAttempt.result);
	const retryOutcome: CrawlHealthZeroSourceRetryOutcome =
		retryClassification.status === "ok"
			? "ok"
			: retryClassification.status === "degraded"
				? "degraded"
				: "error";

	return successOutcome({
		result: retryAttempt.result,
		classification: retryClassification,
		attemptCount: firstAttemptCount + (retryAttempt.result.attemptCount ?? 1),
		zeroSourceRetry: true,
		zeroSourceRetryOutcome: retryOutcome,
	});
}

/**
 * Daily canary for the production browser crawl path. It stops after the raw
 * `CrawlResult`: no crawl intake, no LLM extraction, no scoring, and no
 * writes to prompt-query crawl rows. Axiom is the source of truth.
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
	const abortGraceMs = deps.abortGraceMs ?? CRAWL_HEALTH_CHECK_ABORT_GRACE_MS;
	const minRetryBudgetMs =
		deps.minRetryBudgetMs ?? CRAWL_HEALTH_CHECK_MIN_RETRY_BUDGET_MS;

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
			event: "crawl_health_check_registry_error",
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
			abortGraceMs,
			minRetryBudgetMs,
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
