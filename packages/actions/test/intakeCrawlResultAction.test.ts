import { beforeEach, describe, expect, it, mock } from "bun:test";

const saveCrawlResultMock = mock(async () => ({ id: "crawl-1" }));
const saveStructuredMock = mock(async () => ({
	sourcesSaved: 2,
	mentionsSaved: 0,
}));
const saveInlineLinksMock = mock(async () => ({
	linksSaved: 2,
}));
const extractIntelligenceMock = mock(async () => ({
	brandMentions: [
		{
			brandName: "MyBrand",
			brandUrl: "https://mybrand.com",
			context: "MyBrand is mentioned.",
			mentionType: "target" as const,
			position: 1,
		},
	],
	discoveredCompetitors: [],
	answerFormat: "paragraph" as const,
}));
const saveIntelligenceMock = mock(async () => ({
	mentionsSaved: 1,
	competitorsCreated: 0,
	competitorsMatched: 0,
}));
const computeScoreMock = mock(async () => ({
	row: {
		crawlId: "crawl-1",
		mentionScore: 100,
		positionScore: 100,
		citationScore: 0,
		sentimentScore: 100,
		coMentionScore: 25,
		visibilityScore: 73,
		formulaVersion: "v1.0.0",
		computedAt: new Date(),
	},
	sentimentRetryNeeded: false,
	sentimentRetryCount: 0,
}));

mock.module("../src/promptQueryCrawl/triggerCrawlAction", () => ({
	saveCrawlResultAction: saveCrawlResultMock,
}));

mock.module("../src/promptQueryCrawl/saveStructuredCrawlDataAction", () => ({
	saveStructuredCrawlDataAction: saveStructuredMock,
}));

mock.module("../src/promptQueryCrawl/saveInlineLinksAction", () => ({
	saveInlineLinksAction: saveInlineLinksMock,
}));

mock.module("../src/ai/extractBrandIntelligenceAction", () => ({
	extractBrandIntelligenceAction: extractIntelligenceMock,
}));

mock.module("../src/ai/saveBrandIntelligenceAction", () => ({
	saveBrandIntelligenceAction: saveIntelligenceMock,
}));

mock.module("../src/aiVisibility/computeVisibilityScoreAction", () => ({
	computeVisibilityScoreAction: computeScoreMock,
}));

import { intakeCrawlResultAction } from "../src/crawlIntake/intakeCrawlResultAction";
import type { IntakeCrawlResultInput } from "../src/crawlIntake/intakeCrawlResultAction";
import type { Logger } from "@opencited/logger";

const baseCtx = { userId: null, isAuthenticated: false, db: {} };

function makeMockLogger(): Logger {
	const logger: Logger = {
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		debug: mock(() => {}),
		withContext: mock((_ctx: unknown) => logger),
		flush: mock(async () => {}),
	};
	return logger;
}

function makeInput(
	overrides?: Partial<IntakeCrawlResultInput>,
): IntakeCrawlResultInput {
	return {
		crawlId: "crawl-1",
		promptQueryId: "pq-1",
		domainProjectId: "dp-1",
		query: "best AEO platform",
		result: {
			provider: "perplexity",
			content: "MyBrand is the leading platform.",
			metadata: {
				url: "https://perplexity.ai/search/abc",
				title: "Search Result",
				timestamp: new Date("2026-06-27T12:00:00Z"),
				loadTimeMs: 5000,
			},
			structured: {
				citations: [
					{ domain: "example.com", url: "https://example.com", position: 1 },
					{ domain: "other.com", url: "https://other.com", position: 2 },
				],
				brandMentions: [],
				answerFormat: "paragraph",
			},
		},
		loadTimeMs: 6000,
		crawlContext: {
			targetBrand: "MyBrand",
			targetDomain: "mybrand.com",
			targetAliases: ["MyBrand Inc"],
			knownCompetitors: [{ name: "Acme", domain: "acme.com" }],
		},
		...overrides,
	};
}

describe("intakeCrawlResultAction", () => {
	beforeEach(() => {
		saveCrawlResultMock.mockClear();
		saveStructuredMock.mockClear();
		saveInlineLinksMock.mockClear();
		extractIntelligenceMock.mockClear();
		saveIntelligenceMock.mockClear();
		computeScoreMock.mockClear();
	});

	it("calls all steps in order on happy path", async () => {
		const result = await intakeCrawlResultAction({
			input: makeInput(),
			ctx: baseCtx,
		});

		expect(result.success).toBe(true);
		expect(result.failedSteps).toEqual([]);
		expect(result.sentimentRetryNeeded).toBe(false);

		expect(saveCrawlResultMock).toHaveBeenCalledTimes(1);
		expect(saveStructuredMock).toHaveBeenCalledTimes(1);
		expect(extractIntelligenceMock).toHaveBeenCalledTimes(1);
		expect(saveIntelligenceMock).toHaveBeenCalledTimes(1);
		expect(computeScoreMock).toHaveBeenCalledTimes(1);
	});

	it("propagates error when saveCrawlResultAction throws", async () => {
		saveCrawlResultMock.mockRejectedValueOnce(new Error("DB connection lost"));

		await expect(
			intakeCrawlResultAction({ input: makeInput(), ctx: baseCtx }),
		).rejects.toThrow("DB connection lost");

		expect(saveStructuredMock).not.toHaveBeenCalled();
		expect(extractIntelligenceMock).not.toHaveBeenCalled();
	});

	it("catches brand intelligence failure and returns partial result", async () => {
		extractIntelligenceMock.mockRejectedValueOnce(new Error("LLM unavailable"));

		const result = await intakeCrawlResultAction({
			input: makeInput(),
			ctx: baseCtx,
		});

		expect(result.success).toBe(false);
		expect(result.failedSteps).toEqual(["brandIntelligence"]);
		expect(saveCrawlResultMock).toHaveBeenCalledTimes(1);
		expect(saveStructuredMock).toHaveBeenCalledTimes(1);
		expect(saveIntelligenceMock).not.toHaveBeenCalled();
		expect(computeScoreMock).not.toHaveBeenCalled();
	});

	it("catches visibility score failure and returns partial result", async () => {
		computeScoreMock.mockRejectedValueOnce(
			new Error("Score computation failed"),
		);

		const result = await intakeCrawlResultAction({
			input: makeInput(),
			ctx: baseCtx,
		});

		expect(result.success).toBe(false);
		expect(result.failedSteps).toEqual(["visibilityScore"]);
		expect(saveCrawlResultMock).toHaveBeenCalledTimes(1);
		expect(extractIntelligenceMock).toHaveBeenCalledTimes(1);
		expect(saveIntelligenceMock).toHaveBeenCalledTimes(1);
	});

	it("returns sentimentRetryNeeded when score action indicates retry", async () => {
		computeScoreMock.mockResolvedValueOnce({
			row: {
				crawlId: "crawl-1",
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 50,
				coMentionScore: 25,
				visibilityScore: 68,
				formulaVersion: "v1.0.0",
				computedAt: new Date(),
			},
			sentimentRetryNeeded: true,
			sentimentRetryCount: 0,
		});

		const result = await intakeCrawlResultAction({
			input: makeInput(),
			ctx: baseCtx,
		});

		expect(result.success).toBe(true);
		expect(result.sentimentRetryNeeded).toBe(true);
	});

	it("skips structured data save when result has no structured data", async () => {
		const input = makeInput({
			result: {
				provider: "perplexity",
				content: "Some content",
				metadata: {
					url: "https://perplexity.ai/search/abc",
					title: "Result",
					timestamp: new Date(),
					loadTimeMs: 3000,
				},
			},
		});

		const result = await intakeCrawlResultAction({ input, ctx: baseCtx });

		expect(result.success).toBe(true);
		expect(saveCrawlResultMock).toHaveBeenCalledTimes(1);
		expect(saveStructuredMock).not.toHaveBeenCalled();
		expect(extractIntelligenceMock).toHaveBeenCalledTimes(1);
	});

	it("passes correct parameters to saveCrawlResultAction", async () => {
		await intakeCrawlResultAction({ input: makeInput(), ctx: baseCtx });

		expect(saveCrawlResultMock).toHaveBeenCalledWith({
			input: {
				crawlId: "crawl-1",
				provider: "perplexity",
				content: "MyBrand is the leading platform.",
				url: "https://perplexity.ai/search/abc",
				title: "Search Result",
				loadTimeMs: 6000,
				timestamp: "2026-06-27T12:00:00.000Z",
				promptQueryId: "pq-1",
			},
			ctx: baseCtx,
		});
	});

	it("passes correct parameters to extractBrandIntelligenceAction", async () => {
		await intakeCrawlResultAction({ input: makeInput(), ctx: baseCtx });

		expect(extractIntelligenceMock).toHaveBeenCalledWith({
			content: "MyBrand is the leading platform.",
			query: "best AEO platform",
			targetBrand: "MyBrand",
			targetDomain: "mybrand.com",
			targetAliases: ["MyBrand Inc"],
			knownCompetitors: [{ name: "Acme", domain: "acme.com" }],
		});
	});

	it("logs LLM extraction and score computation on happy path", async () => {
		const logger = makeMockLogger();

		await intakeCrawlResultAction({
			input: makeInput({ logger }),
			ctx: baseCtx,
		});

		expect(logger.info).toHaveBeenCalledTimes(3);
		expect(logger.info).toHaveBeenCalledWith(
			"LLM extraction completed",
			expect.objectContaining({ crawlId: "crawl-1" }),
		);
		expect(logger.info).toHaveBeenCalledWith(
			"Brand intelligence saved",
			expect.objectContaining({ crawlId: "crawl-1" }),
		);
		expect(logger.info).toHaveBeenCalledWith(
			"AI Visibility Score computed",
			expect.objectContaining({ crawlId: "crawl-1" }),
		);
	});

	it("logs error when LLM extraction fails", async () => {
		const logger = makeMockLogger();
		extractIntelligenceMock.mockRejectedValueOnce(new Error("LLM unavailable"));

		await intakeCrawlResultAction({
			input: makeInput({ logger }),
			ctx: baseCtx,
		});

		expect(logger.error).toHaveBeenCalledWith(
			"LLM extraction failed",
			expect.objectContaining({ error: "LLM unavailable" }),
		);
	});

	it("logs error when visibility score computation fails", async () => {
		const logger = makeMockLogger();
		computeScoreMock.mockRejectedValueOnce(new Error("Score failed"));

		await intakeCrawlResultAction({
			input: makeInput({ logger }),
			ctx: baseCtx,
		});

		expect(logger.error).toHaveBeenCalledWith(
			"AI Visibility Score computation failed",
			expect.objectContaining({ error: "Score failed" }),
		);
	});

	it("calls saveInlineLinksAction when inlineLinks are present", async () => {
		const input = makeInput({
			result: {
				provider: "chatgpt",
				content: "MyBrand is great. Here is a link.",
				metadata: {
					url: "https://chatgpt.com/share/abc",
					title: "ChatGPT Response",
					timestamp: new Date("2026-06-27T12:00:00Z"),
					loadTimeMs: 5000,
				},
				structured: {
					citations: [],
					brandMentions: [],
					inlineLinks: [
						{
							title: "Acme Article",
							url: "https://acme.com/article",
							domain: "acme.com",
							position: 1,
						},
						{
							title: "MyBrand Site",
							url: "https://mybrand.com",
							domain: "mybrand.com",
							position: 2,
						},
					],
				},
			},
		});

		const result = await intakeCrawlResultAction({ input, ctx: baseCtx });

		expect(result.success).toBe(true);
		expect(saveInlineLinksMock).toHaveBeenCalledTimes(1);
		expect(saveInlineLinksMock).toHaveBeenCalledWith({
			input: {
				crawlId: "crawl-1",
				promptQueryId: "pq-1",
				domainProjectId: "dp-1",
				inlineLinks: [
					{
						title: "Acme Article",
						url: "https://acme.com/article",
						domain: "acme.com",
						position: 1,
					},
					{
						title: "MyBrand Site",
						url: "https://mybrand.com",
						domain: "mybrand.com",
						position: 2,
					},
				],
			},
			ctx: baseCtx,
		});
	});

	it("does not call saveInlineLinksAction when inlineLinks are absent", async () => {
		const result = await intakeCrawlResultAction({
			input: makeInput(),
			ctx: baseCtx,
		});

		expect(result.success).toBe(true);
		expect(saveInlineLinksMock).not.toHaveBeenCalled();
	});

	it("does not call saveInlineLinksAction when inlineLinks are empty", async () => {
		const input = makeInput({
			result: {
				provider: "chatgpt",
				content: "Some content",
				metadata: {
					url: "https://chatgpt.com/share/abc",
					title: "Response",
					timestamp: new Date(),
					loadTimeMs: 3000,
				},
				structured: {
					citations: [],
					brandMentions: [],
					inlineLinks: [],
				},
			},
		});

		const result = await intakeCrawlResultAction({ input, ctx: baseCtx });

		expect(result.success).toBe(true);
		expect(saveInlineLinksMock).not.toHaveBeenCalled();
	});
});
