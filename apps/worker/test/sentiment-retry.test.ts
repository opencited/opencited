import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { retrySentimentAction } from "@opencited/actions";
import { withDb } from "../src/db";
import { handleSentimentRetry } from "../src/handlers/sentiment-retry";

const retryResult: Awaited<ReturnType<typeof retrySentimentAction>> = {
	row: {
		crawlId: "crawl-1",
		mentionScore: 100,
		positionScore: 100,
		citationScore: 0,
		sentimentScore: 100,
		coMentionScore: 25,
		visibilityScore: 73,
		formulaVersion: "v1.0.0",
		computedAt: new Date("2026-06-27T12:00:00Z"),
		sentimentIsFallback: false,
		sentimentRetryCount: 0,
		sentimentLabel: "positive",
	},
	recovered: true,
};

const retrySentimentMock = mock(
	async (_params: Parameters<typeof retrySentimentAction>[0]) => retryResult,
);

function makeJob() {
	return {
		id: "job-sentiment-retry-1",
		data: {
			crawlId: "crawl-1",
			promptQueryCrawlId: "crawl-1",
			domainProjectId: "dp-1",
		},
	} as Parameters<typeof handleSentimentRetry>[0];
}

function makeLogger() {
	return {
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		debug: mock(() => {}),
		withContext: mock((_ctx: unknown) => makeLogger()),
		flush: mock(async () => {}),
	} as Parameters<typeof handleSentimentRetry>[1];
}

describe("handleSentimentRetry", () => {
	beforeEach(() => {
		retrySentimentMock.mockClear();
	});

	it("passes withDb as the runner and keeps db out of the action context", async () => {
		await handleSentimentRetry(makeJob(), makeLogger(), {} as never, {
			retrySentiment: retrySentimentMock,
		});

		expect(retrySentimentMock).toHaveBeenCalledTimes(1);
		const call = retrySentimentMock.mock.calls[0]?.[0];
		expect(call?.dbRunner).toBe(withDb);
		expect(call?.ctx).not.toHaveProperty("db");
	});

	it("uses an injected runner when one is provided", async () => {
		const runner = async <T>(fn: (db: never) => Promise<T>) =>
			fn({ scoped: true } as never);

		await handleSentimentRetry(makeJob(), makeLogger(), {} as never, {
			retrySentiment: retrySentimentMock,
			dbRunner: runner,
		});

		const call = retrySentimentMock.mock.calls[0]?.[0];
		expect(call?.dbRunner).toBe(runner);
		expect(call?.ctx).not.toHaveProperty("db");
	});
});
