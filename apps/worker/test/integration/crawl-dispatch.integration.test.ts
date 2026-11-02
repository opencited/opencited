import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CrawlResult } from "@opencited/browser-crawler";
import { createProvider } from "@opencited/browser-crawler";
import { getJobNameForProvider } from "@opencited/queue";

const mockCrawlResult: CrawlResult = {
	provider: "chatgpt",
	query: "What is the best CRM for small business?",
	content:
		"HubSpot is widely considered one of the best CRMs for small businesses. It offers a free tier with core features.",
	metadata: {
		url: "https://chatgpt.com/share/test-session",
		title: "ChatGPT Response",
		timestamp: new Date("2026-06-29T12:00:00Z"),
		loadTimeMs: 12000,
	},
	structured: {
		inlineLinks: [
			{
				title: "HubSpot CRM",
				url: "https://www.hubspot.com/products/crm",
				domain: "hubspot.com",
				position: 1,
			},
			{
				title: "Best CRMs for Small Business",
				url: "https://www.forbes.com/best-crm-small-business",
				domain: "forbes.com",
				position: 2,
			},
		],
		sourcePanelLinks: [],
		brandMentions: [],
	},
};

const crawlCrawlMock = mock(async () => mockCrawlResult);
const createProviderMock = mock((name: string) => ({
	name,
	requiresAuth: false,
	classifyError: () => "unknown" as const,
}));
let answerEngines = [
	{
		key: "chatgpt" as const,
		displayName: "ChatGPT",
		enabled: true,
		disabledReason: null as string | null,
		sortOrder: 10,
	},
	{
		key: "perplexity" as const,
		displayName: "Perplexity",
		enabled: true,
		disabledReason: null as string | null,
		sortOrder: 20,
	},
];
const getCrawlContextMock = mock(async () => ({
	domainProjectId: "dp-test-1",
	targetBrand: "HubSpot",
	targetDomain: "hubspot.com",
	targetAliases: ["HubSpot Inc"],
	knownCompetitors: [{ name: "Salesforce", domain: "salesforce.com" }],
}));
const intakeCrawlResultMock = mock(async () => ({
	success: true,
	failedSteps: [],
	sentimentRetryNeeded: false,
}));
const failCrawlActionMock = mock(async () => ({}));
const getAnswerEnginesMock = mock(async () => answerEngines);
const rateLimitMock = mock(async () => {});
const resolveProxiesMock = mock(async () => ({
	proxies: [{ server: "http://mock-proxy:8080" }],
	usedSticky: false,
}));
const clearStickyProxyMock = mock(async () => {});
const setStickyProxyMock = mock(async () => {});

// Mock all dependencies before importing the handler
mock.module("@opencited/browser-crawler", () => ({
	Crawler: class MockCrawler {
		crawl = crawlCrawlMock;
	},
	createProvider: createProviderMock,
}));

mock.module("@opencited/actions", () => ({
	intakeCrawlResultAction: intakeCrawlResultMock,
	failCrawlAction: failCrawlActionMock,
	getCrawlContextAction: getCrawlContextMock,
	getAnswerEnginesAction: getAnswerEnginesMock,
}));

// Relative to test file: apps/worker/test/integration/ -> apps/worker/src/lib/
mock.module("../../src/lib/rate-limit", () => ({
	rateLimit: rateLimitMock,
}));

mock.module("../../src/lib/proxy-resolution", () => ({
	resolveProxies: resolveProxiesMock,
	fetchProxyList: mock(async () => []),
	clearStickyProxy: clearStickyProxyMock,
	setStickyProxy: setStickyProxyMock,
}));

// Relative to test file: apps/worker/test/integration/ -> apps/worker/src/db.ts
mock.module("../../src/db", () => ({
	withDb: async (fn: (db: unknown) => Promise<unknown>) => fn({}),
}));

// Relative to test file: apps/worker/test/integration/ -> apps/worker/src/env.ts
mock.module("../../src/env", () => ({
	env: {
		HEADLESS: true,
		THORDATA_PROXY_API_URL: undefined,
	},
}));

import { handleCrawlJob } from "../../src/handlers/perplexity-crawl";
import {
	readAnswerEngines,
	resetAnswerEngineAvailabilityCache,
} from "../../src/lib/answer-engine-availability";

function makeJob(overrides?: Record<string, unknown>) {
	return {
		id: "job-chatgpt-1",
		data: {
			query: "What is the best CRM for small business?",
			promptQueryId: "pq-1",
			promptQueryCrawlId: "pqc-1",
			domainProjectId: "dp-test-1",
			provider: "chatgpt",
			...overrides,
		},
	} as Parameters<typeof handleCrawlJob>[0];
}

function makeLogger() {
	return {
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		debug: mock(() => {}),
		withContext: mock((_ctx: unknown) => makeLogger()),
		flush: mock(async () => {}),
	} as Parameters<typeof handleCrawlJob>[1];
}

function makeRedis() {
	return {} as Parameters<typeof handleCrawlJob>[2];
}

describe("chatgpt-crawl dispatch integration", () => {
	it("dispatchCrawlJob maps chatgpt to chatgpt-crawl job name", () => {
		expect(getJobNameForProvider("chatgpt")).toBe("chatgpt-crawl");
	});

	it("createProvider returns ChatGPTProvider for 'chatgpt'", () => {
		const provider = createProvider("chatgpt");
		expect(provider.name).toBe("chatgpt");
		expect(provider.requiresAuth).toBe(false);
	});

	it("createProvider returns PerplexityProvider for 'perplexity'", () => {
		const provider = createProvider("perplexity");
		expect(provider.name).toBe("perplexity");
		expect(provider.requiresAuth).toBe(false);
	});

	it("both providers implement classifyError", () => {
		const chatgpt = createProvider("chatgpt");
		const perplexity = createProvider("perplexity");

		const error = new Error("unknown failure");
		expect(chatgpt.classifyError(error)).toBe("unknown");
		expect(perplexity.classifyError(error)).toBe("unknown");
	});
});

describe("handleCrawlJob with chatgpt provider", () => {
	beforeEach(() => {
		crawlCrawlMock.mockClear();
		createProviderMock.mockClear();
		intakeCrawlResultMock.mockClear();
		getCrawlContextMock.mockClear();
		failCrawlActionMock.mockClear();
		getAnswerEnginesMock.mockClear();
		resolveProxiesMock.mockClear();
		rateLimitMock.mockClear();
		resetAnswerEngineAvailabilityCache();
		answerEngines = [
			{
				key: "chatgpt",
				displayName: "ChatGPT",
				enabled: true,
				disabledReason: null,
				sortOrder: 10,
			},
			{
				key: "perplexity",
				displayName: "Perplexity",
				enabled: true,
				disabledReason: null,
				sortOrder: 20,
			},
		];
	});

	it("calls Crawler.crawl with chatgpt provider and correct query", async () => {
		await handleCrawlJob(makeJob(), makeLogger(), makeRedis());

		expect(crawlCrawlMock).toHaveBeenCalledTimes(1);
		const callArgs = crawlCrawlMock.mock.calls[0][0];
		expect(callArgs.query).toBe("What is the best CRM for small business?");
		expect(callArgs.provider.name).toBe("chatgpt");
	});

	it("passes crawl result to intakeCrawlResultAction", async () => {
		await handleCrawlJob(makeJob(), makeLogger(), makeRedis());

		expect(intakeCrawlResultMock).toHaveBeenCalledTimes(1);
		const callArgs = intakeCrawlResultMock.mock.calls[0][0];
		expect(callArgs.input.crawlId).toBe("pqc-1");
		expect(callArgs.input.promptQueryId).toBe("pq-1");
		expect(callArgs.input.domainProjectId).toBe("dp-test-1");
		expect(callArgs.input.result.provider).toBe("chatgpt");
		expect(callArgs.input.result.content).toBe(mockCrawlResult.content);
	});

	it("intakeCrawlResultAction receives correct CrawlResult shape", async () => {
		await handleCrawlJob(makeJob(), makeLogger(), makeRedis());

		const callArgs = intakeCrawlResultMock.mock.calls[0][0];
		const result = callArgs.input.result;

		expect(result).toHaveProperty("provider", "chatgpt");
		expect(result).toHaveProperty("query");
		expect(result).toHaveProperty("content");
		expect(result).toHaveProperty("metadata");
		expect(result.metadata).toHaveProperty("url");
		expect(result.metadata).toHaveProperty("title");
		expect(result.metadata).toHaveProperty("timestamp");
		expect(result.metadata).toHaveProperty("loadTimeMs");
		expect(result.structured).toBeDefined();
		expect(result.structured?.inlineLinks).toHaveLength(2);
		expect(result.structured?.inlineLinks?.[0]).toHaveProperty(
			"url",
			"https://www.hubspot.com/products/crm",
		);
	});

	it("fetches crawl context for the prompt query", async () => {
		await handleCrawlJob(makeJob(), makeLogger(), makeRedis());

		expect(getCrawlContextMock).toHaveBeenCalledTimes(1);
		expect(getCrawlContextMock.mock.calls[0][0].input.promptQueryId).toBe(
			"pq-1",
		);
	});

	it("resolves proxies before crawling", async () => {
		await handleCrawlJob(makeJob(), makeLogger(), makeRedis());

		expect(resolveProxiesMock).toHaveBeenCalledTimes(1);
		expect(resolveProxiesMock.mock.calls[0][0].domainProjectId).toBe(
			"dp-test-1",
		);
	});

	it("applies rate limiting for chatgpt provider", async () => {
		await handleCrawlJob(makeJob(), makeLogger(), makeRedis());

		expect(rateLimitMock).toHaveBeenCalledTimes(1);
		expect(rateLimitMock.mock.calls[0][0]).toBe("chatgpt");
	});

	it("skips a disabled engine without launching a browser or failing the job", async () => {
		answerEngines = [
			{
				key: "chatgpt",
				displayName: "ChatGPT",
				enabled: true,
				disabledReason: null,
				sortOrder: 10,
			},
			{
				key: "perplexity",
				displayName: "Perplexity",
				enabled: false,
				disabledReason:
					"Perplexity is temporarily unavailable while we fix an issue with it. ChatGPT is fully working.",
				sortOrder: 20,
			},
		];
		const logger = makeLogger();

		await handleCrawlJob(
			makeJob({ provider: "perplexity" }),
			logger,
			makeRedis(),
		);

		expect(failCrawlActionMock).toHaveBeenCalledTimes(1);
		const error = failCrawlActionMock.mock.calls[0][0].input.error as string;
		expect(error).toStartWith("Skipped: Perplexity is disabled.");
		expect(error).toContain("temporarily unavailable");
		expect(createProviderMock).not.toHaveBeenCalled();
		expect(crawlCrawlMock).not.toHaveBeenCalled();
		expect(resolveProxiesMock).not.toHaveBeenCalled();
		expect(rateLimitMock).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalled();
	});

	it("rechecks a stale cached disabled entry and runs when the database is enabled", async () => {
		answerEngines = [
			{
				key: "chatgpt",
				displayName: "ChatGPT",
				enabled: true,
				disabledReason: null,
				sortOrder: 10,
			},
			{
				key: "perplexity",
				displayName: "Perplexity",
				enabled: false,
				disabledReason:
					"Perplexity is temporarily unavailable while we fix an issue with it. ChatGPT is fully working.",
				sortOrder: 20,
			},
		];
		await readAnswerEngines({} as never);
		expect(getAnswerEnginesMock).toHaveBeenCalledTimes(1);

		answerEngines = [
			{
				key: "chatgpt",
				displayName: "ChatGPT",
				enabled: true,
				disabledReason: null,
				sortOrder: 10,
			},
			{
				key: "perplexity",
				displayName: "Perplexity",
				enabled: true,
				disabledReason: null,
				sortOrder: 20,
			},
		];

		await handleCrawlJob(
			makeJob({ provider: "perplexity" }),
			makeLogger(),
			makeRedis(),
		);

		expect(getAnswerEnginesMock).toHaveBeenCalledTimes(2);
		expect(failCrawlActionMock).not.toHaveBeenCalled();
		expect(crawlCrawlMock).toHaveBeenCalledTimes(1);
		expect(crawlCrawlMock.mock.calls[0][0].provider.name).toBe("perplexity");
	});
});
