import { openBrowser, closeBrowser } from "./browser";
import { captureDebugInfo } from "./debug";
import type { BrowserSession, BrowserOptions, ProxyOptions } from "./types";
import type { CrawlerProvider } from "./providers/base";
import type { CrawlResult, AuthCredentials } from "./providers/types";
import type { Logger } from "@opencited/logger";
import { defaultLogger } from "@opencited/logger";
import {
	CrawlerError,
	AuthenticationError,
	NavigationError,
	ExtractionError,
	AllProxiesFailedError,
	shouldRotateProxy,
	type FailureType,
} from "./errors";

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;
const BACKOFF_JITTER = 0.3;

function computeBackoff(cycle: number): number {
	const base = Math.min(BACKOFF_BASE_MS * 2 ** cycle, BACKOFF_MAX_MS);
	const jitter = base * BACKOFF_JITTER * (Math.random() * 2 - 1);
	return Math.round(base + jitter);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CrawlOptions {
	query: string;
	provider: CrawlerProvider;
	browserOptions?: BrowserOptions & { persist?: boolean };
	authCredentials?: AuthCredentials;
	logger?: Logger;
	proxies?: ProxyOptions[];
	/**
	 * Number of full proxy-rotation cycles to attempt before giving up.
	 * Default: 2
	 */
	retryCycles?: number;
	/**
	 * Max retries on the same proxy for local/UI failures before rotating.
	 * Default: 2
	 */
	maxAttemptsPerProxy?: number;
}

export class Crawler {
	private logger: Logger;

	constructor(options?: { logger?: Logger }) {
		this.logger = options?.logger ?? defaultLogger;
	}

	async crawl(options: CrawlOptions): Promise<CrawlResult> {
		if (options.proxies && options.proxies.length > 0) {
			return this.crawlWithProxyRotation(
				options as CrawlOptions & { proxies: ProxyOptions[] },
			);
		}
		return this.crawlSingle(options);
	}

	private async crawlSingle(options: CrawlOptions): Promise<CrawlResult> {
		const persist = options.browserOptions?.persist ?? false;
		const userDataDir = persist
			? (options.browserOptions?.userDataDir ?? "./.browser-data")
			: undefined;

		const session = await openBrowser(
			{
				...options.browserOptions,
				userDataDir,
			},
			this.logger,
		);

		try {
			this.logger.info(
				`🚀 Starting crawl with provider: ${options.provider.name}`,
			);

			await this.safeNavigate(options.provider, session);

			if (options.provider.requiresAuth) {
				await this.safeAuthenticate(
					options.provider,
					session,
					options.authCredentials,
				);
			}

			await this.safeSubmitQuery(options.provider, session, options.query);

			await this.safeWaitForResponse(options.provider, session);

			const result = await this.safeExtractResult(options.provider, session);

			result.query = options.query;

			this.logger.info(`✅ Crawl completed successfully`);

			return result;
		} catch (error) {
			const failureType =
				error instanceof Error
					? options.provider.classifyError(error)
					: "unknown";
			const step = error instanceof CrawlerError ? error.step : "unknown";
			await captureDebugInfo(
				session,
				error,
				options.provider.name,
				step,
				failureType,
				undefined,
				this.logger,
			);
			throw error;
		} finally {
			await options.provider.cleanup?.(session);
			await closeBrowser(session, userDataDir, this.logger);
		}
	}

	private async crawlWithProxyRotation(
		options: CrawlOptions & { proxies: ProxyOptions[] },
	): Promise<CrawlResult> {
		const { proxies } = options;
		const retryCycles = options.retryCycles ?? 2;
		const maxAttemptsPerProxy = options.maxAttemptsPerProxy ?? 2;
		const persist = options.browserOptions?.persist ?? false;
		const userDataDir = persist
			? (options.browserOptions?.userDataDir ?? "./.browser-data")
			: undefined;

		this.logger.info(
			`🔄 Starting crawl with ${proxies.length} proxies, ${retryCycles} cycles (provider: ${options.provider.name})`,
		);

		let lastError = "";
		let lastFailureType: FailureType = "unknown";
		let totalAttempts = 0;

		for (let cycle = 0; cycle < retryCycles; cycle++) {
			if (cycle > 0) {
				const backoffMs = computeBackoff(cycle - 1);
				this.logger.info(
					`⏳ Cycle ${cycle + 1}/${retryCycles}: waiting ${backoffMs}ms before retry`,
				);
				await sleep(backoffMs);
			}

			this.logger.info(`🔁 Cycle ${cycle + 1}/${retryCycles}`);

			for (let i = 0; i < proxies.length; i++) {
				const proxy = proxies[i];
				if (!proxy) continue;

				const isCanary = i === 0 && cycle === 0;
				// For canary: only 1 attempt on network failures, maxAttemptsPerProxy on UI failures
				// For non-canary: maxAttemptsPerProxy on UI failures, 1 attempt on network failures
				let attemptsForThisProxy = 1;

				// We do a first attempt to classify before deciding on retry count
				let session: BrowserSession | undefined;
				let _attemptError: unknown;
				let failureType: FailureType = "unknown";
				let succeeded = false;
				let result: CrawlResult | undefined;

				for (
					let attempt = 0;
					attempt < Math.max(attemptsForThisProxy, maxAttemptsPerProxy);
					attempt++
				) {
					// After first attempt, check if we should keep retrying this proxy
					if (attempt > 0 && shouldRotateProxy(failureType)) {
						this.logger.info(
							`🔴 Proxy ${i + 1} failure type "${failureType}" — rotating immediately`,
						);
						break;
					}
					if (attempt > 0 && attempt >= attemptsForThisProxy) {
						break;
					}

					totalAttempts++;
					this.logger.info(
						`🌐 Proxy ${i + 1}/${proxies.length} attempt ${attempt + 1}: ${proxy.server}${isCanary && attempt === 0 ? " [canary]" : ""}`,
					);

					try {
						session = await openBrowser(
							{
								...options.browserOptions,
								userDataDir,
								proxy,
							},
							this.logger,
						);

						await this.safeNavigate(options.provider, session);

						if (options.provider.requiresAuth) {
							await this.safeAuthenticate(
								options.provider,
								session,
								options.authCredentials,
							);
						}

						await this.safeSubmitQuery(
							options.provider,
							session,
							options.query,
						);
						await this.safeWaitForResponse(options.provider, session);

						result = await this.safeExtractResult(options.provider, session);
						result.query = options.query;
						result.usedProxy = proxy;

						this.logger.info(
							`✅ Crawl succeeded on proxy ${i + 1}/${proxies.length} (cycle ${cycle + 1}, attempt ${attempt + 1})`,
						);

						succeeded = true;
						break;
					} catch (error) {
						_attemptError = error;
						failureType =
							error instanceof Error
								? options.provider.classifyError(error)
								: "unknown";
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						const errorCause =
							error instanceof Error && error.cause
								? error.cause instanceof Error
									? error.cause.message
									: String(error.cause)
								: null;
						const errorStep =
							error instanceof CrawlerError ? error.step : "unknown";
						const errorProvider =
							error instanceof CrawlerError ? error.provider : "unknown";
						lastError = errorMessage;
						lastFailureType = failureType;

						this.logger.warn(
							`❌ Proxy ${i + 1}/${proxies.length} attempt ${attempt + 1} failed [${failureType}]: ${lastError}`,
						);
						if (errorCause) {
							this.logger.warn(`   ↳ Root cause: ${errorCause}`);
						}
						this.logger.warn(
							`   ↳ Step: ${errorStep} (provider: ${errorProvider})`,
						);

						if (session) {
							await captureDebugInfo(
								session,
								error,
								options.provider.name,
								errorStep,
								failureType,
								proxy.server,
								this.logger,
							);
						}

						// After classifying first attempt, set retry count for this proxy
						if (attempt === 0) {
							if (shouldRotateProxy(failureType)) {
								// Network/bot failures: no local retries, rotate immediately
								attemptsForThisProxy = 1;
							} else {
								// UI/local failures: allow retries on same proxy
								attemptsForThisProxy = isCanary ? 1 : maxAttemptsPerProxy;
							}
						}
					} finally {
						if (session) {
							await options.provider.cleanup?.(session);
							await closeBrowser(session, userDataDir, this.logger);
							session = undefined;
						}
					}
				}

				if (succeeded && result) {
					return result;
				}
			}
		}

		throw new AllProxiesFailedError(totalAttempts, lastError, lastFailureType);
	}

	private async safeNavigate(
		provider: CrawlerProvider,
		session: BrowserSession,
	) {
		try {
			await provider.navigate(session);
		} catch (error) {
			throw new NavigationError(provider.name, "URL", error);
		}
	}

	private async safeAuthenticate(
		provider: CrawlerProvider,
		session: BrowserSession,
		credentials?: AuthCredentials,
	) {
		if (!provider.authenticate) {
			throw new AuthenticationError(
				provider.name,
				new Error("Provider requires auth but has no authenticate method"),
			);
		}

		try {
			await provider.authenticate(session, credentials);
		} catch (error) {
			throw new AuthenticationError(provider.name, error);
		}
	}

	private async safeSubmitQuery(
		provider: CrawlerProvider,
		session: BrowserSession,
		query: string,
	) {
		try {
			await provider.submitQuery(session, query);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new CrawlerError(message, provider.name, "submitQuery", error);
		}
	}

	private async safeWaitForResponse(
		provider: CrawlerProvider,
		session: BrowserSession,
	) {
		try {
			await provider.waitForResponse(session);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new CrawlerError(message, provider.name, "waitForResponse", error);
		}
	}

	private async safeExtractResult(
		provider: CrawlerProvider,
		session: BrowserSession,
	): Promise<CrawlResult> {
		try {
			return await provider.extractResult(session);
		} catch (error) {
			throw new ExtractionError(provider.name, error);
		}
	}
}
