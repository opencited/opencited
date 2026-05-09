import { openBrowser, closeBrowser } from "./browser";
import type { BrowserSession, BrowserOptions } from "./types";
import type { CrawlerProvider } from "./providers/base";
import type { CrawlResult, AuthCredentials } from "./providers/types";
import type { Logger } from "./logger";
import { defaultLogger } from "./logger";
import {
	CrawlerError,
	AuthenticationError,
	NavigationError,
	ExtractionError,
} from "./errors";

export interface CrawlOptions {
	query: string;
	provider: CrawlerProvider;
	browserOptions?: BrowserOptions & { persist?: boolean };
	authCredentials?: AuthCredentials;
	logger?: Logger;
}

export class Crawler {
	private logger: Logger;

	constructor(options?: { logger?: Logger }) {
		this.logger = options?.logger ?? defaultLogger;
	}

	async crawl(options: CrawlOptions): Promise<CrawlResult> {
		const persist = options.browserOptions?.persist ?? false;
		const userDataDir = persist
			? (options.browserOptions?.userDataDir ?? "./.browser-data")
			: undefined;

		const session = await openBrowser({
			...options.browserOptions,
			userDataDir,
		});

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
		} finally {
			await options.provider.cleanup?.(session);
			await closeBrowser(session, userDataDir);
		}
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
