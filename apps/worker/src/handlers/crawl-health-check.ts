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
): Promise<void> {
	if (graceMs <= 0) return;

	let timer: ReturnType<typeof setTimeout> | undefined;

	const grace = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, graceMs);
	});

	try {
		await Promise.race([
			promise.then(
				() => {},
				() => {},
			),
			grace,
		]);
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
	query: string;
	proxies: ProxyOptions[];
	timeoutMs: number;
	abortGraceMs: number;
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
			await waitForSettlement(crawlPromise, args.abortGraceMs);
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
}): Promise<EngineOutcome> {
	const startedAt = Date.now();
	const base = {
		engine: args.engine,
		trigger: args.trigger,
		proxySource: args.proxySource,
		proxyUsed: false,
		proxyServer: null,
		zeroSourceRetry: false,
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
		zeroSourceRetry: boolean,
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
		zeroSourceRetry,
	});

	const successOutcome = (
		result: CrawlResult,
		classification: ReturnType<typeof classifyCrawlResult>,
		zeroSourceRetry: boolean,
	): EngineOutcome => ({
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
		zeroSourceRetry,
	});

	const firstAttempt = await runCrawlAttempt({
		runner,
		query: args.query,
		proxies,
		timeoutMs: args.perEngineTimeoutMs,
		abortGraceMs: args.abortGraceMs,
	});

	if (firstAttempt.kind === "error") {
		return failureOutcome(firstAttempt, false);
	}

	let result = firstAttempt.result;
	let classification = classifyCrawlResult(result);

	// About one in eight ChatGPT answers legitimately cites no sources. A
	// single zero-source run is not enough to page someone, so retry once
	// inside the same per-engine time budget. Only two zero-source runs are
	// reported as degraded.
	if (classification.status === "degraded") {
		let rateLimited = false;
		try {
			await args.rateLimit(args.engine);
			rateLimited = true;
		} catch (error) {
			engineLogger.warn(
				"Crawl health check zero-source retry rate limit failed",
				{
					error: toErrorMessage(error),
				},
			);
		}

		const remainingMs = args.perEngineTimeoutMs - (Date.now() - startedAt);

		if (rateLimited && remainingMs > 0) {
			const retryAttempt = await runCrawlAttempt({
				runner,
				query: args.query,
				proxies,
				timeoutMs: remainingMs,
				abortGraceMs: args.abortGraceMs,
			});

			if (retryAttempt.kind === "error") {
				return failureOutcome(retryAttempt, true);
			}

			result = retryAttempt.result;
			classification = classifyCrawlResult(result);
			return successOutcome(result, classification, true);
		}
	}

	return successOutcome(result, classification, false);
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
