import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Db } from "@opencited/db";
import {
	crawlBrandMentionTable,
	crawlReferenceTable,
	crawlVisibilityScoreTable,
	domainProjectTable,
	promptQueryCrawlTable,
} from "@opencited/db";
import type {
	SentimentJudgeInput,
	SentimentJudgeOptions,
	SentimentJudgeResult,
} from "@opencited/score-actions";

const judgeMock = mock(
	async (
		_input: SentimentJudgeInput,
		_options: SentimentJudgeOptions,
	): Promise<SentimentJudgeResult> => ({
		label: "positive",
		cacheHit: false,
		fallback: false,
		retryCount: 0,
	}),
);

import {
	computeVisibilityScoreInternal,
	retrySentimentInternal,
	type VisibilityScoreDbRunner,
} from "../src/aiVisibility/computeVisibilityScoreAction";

const now = new Date("2026-06-27T12:00:00Z");

const crawl = {
	id: "crawl-1",
	promptQueryId: "pq-1",
	domainProjectId: "dp-1",
	status: "completed",
	provider: "chatgpt",
	triggerRunId: null,
	query: "best AEO platform",
	promptSnapshot: null,
	url: null,
	title: null,
	content: "MyBrand is the leading platform.",
	loadTimeMs: null,
	answerFormat: null,
	wordCount: null,
	sourceCount: 0,
	brandMentionCount: 0,
	error: null,
	startedAt: null,
	completedAt: null,
	createdAt: now,
	updatedAt: now,
};

const project = {
	id: "dp-1",
	clerkOrganizationId: null,
	domain: "mybrand.com",
	name: "MyBrand",
	aliases: ["MyBrand Inc"],
	logoUrl: null,
	active: true,
	createdAt: now,
	updatedAt: now,
};

const scoreRow = {
	crawlId: "crawl-1",
	mentionScore: 100,
	positionScore: 100,
	citationScore: 0,
	sentimentScore: 50,
	coMentionScore: 25,
	visibilityScore: 68,
	sentimentLabel: null,
	sentimentIsFallback: true,
	sentimentCacheHit: false,
	sentimentRetryCount: 0,
	sentimentLastAttemptAt: null,
	formulaVersion: "v1.0.0",
	computedAt: now,
	createdAt: now,
	updatedAt: now,
};

function makeFakeDb(options?: {
	crawlRows?: unknown[];
	projectRows?: unknown[];
	scoreRows?: unknown[];
}) {
	const inserts: Array<{ table: unknown; values: unknown }> = [];
	const updates: Array<{ table: unknown; values: unknown }> = [];

	const rowsFor = (table: unknown) => {
		if (table === promptQueryCrawlTable) return options?.crawlRows ?? [crawl];
		if (table === domainProjectTable) return options?.projectRows ?? [project];
		if (table === crawlBrandMentionTable) return [];
		if (table === crawlReferenceTable) return [];
		if (table === crawlVisibilityScoreTable) return options?.scoreRows ?? [];
		return [];
	};

	const query = (rows: unknown[]) =>
		Object.assign(Promise.resolve(rows), {
			limit: async (_count: number) => rows,
		});

	const db = {
		select: (_fields?: unknown) => ({
			from: (table: unknown) => ({
				where: (_condition?: unknown) => query(rowsFor(table)),
			}),
		}),
		insert: (table: unknown) => ({
			values: async (values: unknown) => {
				inserts.push({ table, values });
			},
		}),
		update: (table: unknown) => ({
			set: (values: unknown) => ({
				where: async (_condition?: unknown) => {
					updates.push({ table, values });
				},
			}),
		}),
	};

	return { db: db as unknown as Db, inserts, updates };
}

function makeRunner(fakeDb: Db, order: string[]): VisibilityScoreDbRunner {
	return async (fn) => {
		order.push("db:start");
		try {
			return await fn(fakeDb);
		} finally {
			order.push("db:end");
		}
	};
}

describe("computeVisibilityScoreInternal", () => {
	beforeEach(() => {
		judgeMock.mockClear();
	});

	it("runs the sentiment judge between closed database scopes", async () => {
		const order: string[] = [];
		const fake = makeFakeDb();
		const runner = makeRunner(fake.db, order);

		judgeMock.mockImplementationOnce(async () => {
			order.push("sentiment");
			return {
				label: "positive" as const,
				cacheHit: false,
				fallback: false,
				retryCount: 0,
			};
		});

		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { userId: null, isAuthenticated: false },
			dbRunner: runner,
			sentimentJudge: judgeMock,
		});

		expect(result.row.crawlId).toBe("crawl-1");
		expect(order).toEqual([
			"db:start",
			"db:end",
			"sentiment",
			"db:start",
			"db:end",
		]);
		expect(fake.inserts).toHaveLength(1);
		expect(fake.inserts[0]?.table).toBe(crawlVisibilityScoreTable);
	});

	it("still uses ctx.db when no runner is provided", async () => {
		const fake = makeFakeDb();

		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { userId: null, isAuthenticated: false, db: fake.db },
			sentimentJudge: judgeMock,
		});

		expect(result.row.crawlId).toBe("crawl-1");
		expect(judgeMock).toHaveBeenCalledTimes(1);
		expect(fake.inserts).toHaveLength(1);
	});
});

describe("retrySentimentInternal", () => {
	beforeEach(() => {
		judgeMock.mockClear();
	});

	it("runs the sentiment judge between closed database scopes", async () => {
		const order: string[] = [];
		const fake = makeFakeDb({ scoreRows: [scoreRow] });
		const runner = makeRunner(fake.db, order);

		judgeMock.mockImplementationOnce(async () => {
			order.push("sentiment");
			return {
				label: "positive" as const,
				cacheHit: false,
				fallback: false,
				retryCount: 0,
			};
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { userId: null, isAuthenticated: false },
			dbRunner: runner,
			sentimentJudge: judgeMock,
		});

		expect(result.recovered).toBe(true);
		expect(result.row.sentimentScore).toBe(100);
		expect(order).toEqual([
			"db:start",
			"db:end",
			"sentiment",
			"db:start",
			"db:end",
		]);
		expect(fake.updates).toHaveLength(1);
		expect(fake.updates[0]?.table).toBe(crawlVisibilityScoreTable);
	});

	it("writes the fallback row after the judge in a fresh scope", async () => {
		const order: string[] = [];
		const fake = makeFakeDb({ scoreRows: [scoreRow] });
		const runner = makeRunner(fake.db, order);

		judgeMock.mockImplementationOnce(async () => {
			order.push("sentiment");
			return {
				label: null,
				cacheHit: false,
				fallback: true,
				retryCount: 1,
			};
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { userId: null, isAuthenticated: false },
			dbRunner: runner,
			sentimentJudge: judgeMock,
		});

		expect(result.recovered).toBe(false);
		expect(order).toEqual([
			"db:start",
			"db:end",
			"sentiment",
			"db:start",
			"db:end",
		]);
		expect(fake.updates).toHaveLength(1);
	});
});
