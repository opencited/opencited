import { describe, expect, it, mock } from "bun:test";
import type { Logger } from "@opencited/logger";
import { type CrawlDependencies, Crawler } from "../src/crawler";
import { CrawlAbortedError } from "../src/errors";
import type { CrawlerProvider } from "../src/providers/base";
import type { CrawlResult } from "../src/providers/types";
import type { BrowserSession } from "../src/types";

function makeLogger(): Logger {
	const logger: Logger = {
		info: () => {},
		warn: () => {},
		error: () => {},
		debug: () => {},
		withContext: () => logger,
		flush: async () => {},
	};
	return logger;
}

function crawlResult(): CrawlResult {
	return {
		provider: "test",
		query: "test query",
		content: "A long enough answer for the crawler test.",
		metadata: {
			url: "https://example.com/answer",
			title: "Answer",
			timestamp: new Date("2026-11-14T06:00:00Z"),
			loadTimeMs: 100,
		},
		structured: {
			inlineLinks: [],
			sourcePanelLinks: [],
			brandMentions: [],
		},
	};
}

async function waitFor(
	predicate: () => boolean,
	timeoutMs = 1_000,
): Promise<void> {
	const startedAt = Date.now();
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error("Timed out waiting for test condition");
		}
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
}

describe("Crawler abort signal", () => {
	it("closes the open session and stops further proxy attempts when aborted", async () => {
		const session = { context: {}, page: {} } as unknown as BrowserSession;
		const openBrowserMock = mock(async () => session);
		let rejectNavigate: ((error: Error) => void) | undefined;
		const cleanupMock = mock(async () => {});
		const closeBrowserMock = mock(async () => {
			rejectNavigate?.(new Error("Target closed"));
		});

		const provider: CrawlerProvider = {
			name: "test",
			requiresAuth: false,
			navigate: () =>
				new Promise<void>((_resolve, reject) => {
					rejectNavigate = reject;
				}),
			submitQuery: async () => {},
			waitForResponse: async () => {},
			extractResult: async () => crawlResult(),
			cleanup: cleanupMock,
			classifyError: () => "unknown",
		};

		const crawler = new Crawler({
			logger: makeLogger(),
			dependencies: {
				openBrowser: openBrowserMock as unknown as NonNullable<
					CrawlDependencies["openBrowser"]
				>,
				closeBrowser: closeBrowserMock as unknown as NonNullable<
					CrawlDependencies["closeBrowser"]
				>,
			},
		});
		const controller = new AbortController();

		const crawlPromise = crawler.crawl({
			query: "test query",
			provider,
			proxies: [
				{ server: "http://proxy-one.local:8000" },
				{ server: "http://proxy-two.local:8000" },
			],
			retryCycles: 2,
			maxAttemptsPerProxy: 2,
			signal: controller.signal,
		});

		await waitFor(() => rejectNavigate !== undefined);
		controller.abort();

		const error = await crawlPromise.then(
			() => undefined,
			(crawlError: unknown) => crawlError,
		);

		expect(error).toBeInstanceOf(CrawlAbortedError);
		expect((error as CrawlAbortedError).attemptsMade).toBe(1);
		expect(openBrowserMock).toHaveBeenCalledTimes(1);
		expect(cleanupMock).toHaveBeenCalledTimes(1);
		expect(closeBrowserMock).toHaveBeenCalledTimes(1);
	});

	it("does not open a browser when the signal is already aborted", async () => {
		const openBrowserMock = mock(
			async () => ({ context: {}, page: {} }) as unknown as BrowserSession,
		);
		const provider: CrawlerProvider = {
			name: "test",
			requiresAuth: false,
			navigate: async () => {},
			submitQuery: async () => {},
			waitForResponse: async () => {},
			extractResult: async () => crawlResult(),
			classifyError: () => "unknown",
		};
		const crawler = new Crawler({
			logger: makeLogger(),
			dependencies: {
				openBrowser: openBrowserMock as unknown as NonNullable<
					CrawlDependencies["openBrowser"]
				>,
			},
		});
		const controller = new AbortController();
		controller.abort();

		const error = await crawler
			.crawl({
				query: "test query",
				provider,
				proxies: [{ server: "http://proxy-one.local:8000" }],
				signal: controller.signal,
			})
			.then(
				() => undefined,
				(crawlError: unknown) => crawlError,
			);

		expect(error).toBeInstanceOf(CrawlAbortedError);
		expect((error as CrawlAbortedError).attemptsMade).toBe(0);
		expect(openBrowserMock).not.toHaveBeenCalled();
	});

	it("keeps the existing behaviour when no signal is provided", async () => {
		const session = { context: {}, page: {} } as unknown as BrowserSession;
		const openBrowserMock = mock(async () => session);
		const closeBrowserMock = mock(async () => {});
		const provider: CrawlerProvider = {
			name: "test",
			requiresAuth: false,
			navigate: async () => {},
			submitQuery: async () => {},
			waitForResponse: async () => {},
			extractResult: async () => crawlResult(),
			classifyError: () => "unknown",
		};
		const crawler = new Crawler({
			logger: makeLogger(),
			dependencies: {
				openBrowser: openBrowserMock as unknown as NonNullable<
					CrawlDependencies["openBrowser"]
				>,
				closeBrowser: closeBrowserMock as unknown as NonNullable<
					CrawlDependencies["closeBrowser"]
				>,
			},
		});

		const result = await crawler.crawl({
			query: "test query",
			provider,
			proxies: [{ server: "http://proxy-one.local:8000" }],
		});

		expect(result.attemptCount).toBe(1);
		expect(result.usedProxy).toEqual({
			server: "http://proxy-one.local:8000",
		});
		expect(closeBrowserMock).toHaveBeenCalledTimes(1);
	});
});
