import { describe, expect, it } from "bun:test";
import { getVisibilityOverviewAction } from "../src/aiVisibility/getVisibilityOverviewAction";

function getDrizzleTableName(table: unknown): string | null {
	if (!table || typeof table !== "object") return null;
	const sym = Object.getOwnPropertySymbols(table).find(
		(s) => s.description === "drizzle:Name",
	);
	if (!sym) return null;
	return (table as Record<symbol, unknown>)[sym] as string;
}

interface ScoreRow {
	crawlId: string;
	mentionScore: number;
	positionScore: number;
	citationScore: number;
	sentimentScore: number;
	coMentionScore: number;
	visibilityScore: number;
	formulaVersion: string;
	computedAt: Date;
	sentimentIsFallback: boolean;
	sentimentCacheHit: boolean;
	sentimentRetryCount: number;
	sentimentLastAttemptAt: Date | null;
	sentimentLabel: string | null;
}

interface CrawlRow {
	id: string;
	promptQueryId: string;
	status: string;
	createdAt: Date;
	completedAt: Date | null;
}

interface PromptQueryRow {
	id: string;
	domainProjectId: string;
	query: string;
	createdAt: Date;
}

function makeMockDb(seed: {
	queries: PromptQueryRow[];
	crawls: CrawlRow[];
	scores: Map<string, ScoreRow>;
}) {
	const from = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		const where = (_cond: unknown) => {
			const defaultResult = (() => {
				switch (tableName) {
					case "prompt_query":
						return seed.queries;
					case "prompt_query_crawl":
						return seed.crawls;
					case "crawl_visibility_score": {
						const crawlIds = seed.crawls.map((c) => c.id);
						return crawlIds
							.map((id) => seed.scores.get(id))
							.filter((s): s is ScoreRow => s !== undefined);
					}
					case "crawl_brand_mention":
						return [];
					default:
						return [];
				}
			})();
			const orderBy = () => {
				return Object.assign(Promise.resolve(defaultResult), {
					limit: (n: number) => Promise.resolve(defaultResult.slice(0, n)),
				});
			};
			return Object.assign(Promise.resolve(defaultResult), {
				orderBy,
				limit: (n: number) => Promise.resolve(defaultResult.slice(0, n)),
			});
		};
		return { where };
	};

	const select = () => ({ from });

	return { db: { select } };
}

const baseCtx = { userId: null, isAuthenticated: false };

describe("getVisibilityOverviewAction", () => {
	it("returns score: null when prompt has fewer than 3 successful crawls", async () => {
		const queryId = "query-1";
		const queries: PromptQueryRow[] = [
			{
				id: queryId,
				domainProjectId: "project-1",
				query: "What is the best AI tool?",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
			},
		];

		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
		];

		const scores = new Map<string, ScoreRow>();
		scores.set("crawl-1", {
			crawlId: "crawl-1",
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 25,
			visibilityScore: 73,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-25T10:00:00.000Z"),
		});
		scores.set("crawl-2", {
			crawlId: "crawl-2",
			mentionScore: 80,
			positionScore: 60,
			citationScore: 40,
			sentimentScore: 80,
			coMentionScore: 20,
			visibilityScore: 56,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-24T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-24T10:00:00.000Z"),
		});

		const mockDb = makeMockDb({ queries, crawls, scores });

		const result = await getVisibilityOverviewAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.queryId).toBe(queryId);
		expect(result[0]?.score).toBeNull();
	});

	it("returns mean score when prompt has 3 or more successful crawls", async () => {
		const queryId = "query-1";
		const queries: PromptQueryRow[] = [
			{
				id: queryId,
				domainProjectId: "project-1",
				query: "What is the best AI tool?",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
			},
		];

		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
			{
				id: "crawl-3",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
		];

		const scores = new Map<string, ScoreRow>();
		scores.set("crawl-1", {
			crawlId: "crawl-1",
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 25,
			visibilityScore: 73,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-25T10:00:00.000Z"),
		});
		scores.set("crawl-2", {
			crawlId: "crawl-2",
			mentionScore: 80,
			positionScore: 60,
			citationScore: 40,
			sentimentScore: 80,
			coMentionScore: 20,
			visibilityScore: 56,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-24T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-24T10:00:00.000Z"),
		});
		scores.set("crawl-3", {
			crawlId: "crawl-3",
			mentionScore: 60,
			positionScore: 40,
			citationScore: 20,
			sentimentScore: 60,
			coMentionScore: 15,
			visibilityScore: 39,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-23T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-23T10:00:00.000Z"),
		});

		const mockDb = makeMockDb({ queries, crawls, scores });

		const result = await getVisibilityOverviewAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.queryId).toBe(queryId);
		expect(result[0]?.score).toBe(56);
	});

	it("only considers successful (completed) crawls for score calculation", async () => {
		const queryId = "query-1";
		const queries: PromptQueryRow[] = [
			{
				id: queryId,
				domainProjectId: "project-1",
				query: "What is the best AI tool?",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
			},
		];

		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				promptQueryId: queryId,
				status: "failed",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: null,
			},
			{
				id: "crawl-3",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
		];

		const scores = new Map<string, ScoreRow>();
		scores.set("crawl-1", {
			crawlId: "crawl-1",
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 25,
			visibilityScore: 73,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-25T10:00:00.000Z"),
		});
		scores.set("crawl-2", {
			crawlId: "crawl-2",
			mentionScore: 80,
			positionScore: 60,
			citationScore: 40,
			sentimentScore: 80,
			coMentionScore: 20,
			visibilityScore: 56,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-24T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-24T10:00:00.000Z"),
		});
		scores.set("crawl-3", {
			crawlId: "crawl-3",
			mentionScore: 60,
			positionScore: 40,
			citationScore: 20,
			sentimentScore: 60,
			coMentionScore: 15,
			visibilityScore: 39,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-23T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-23T10:00:00.000Z"),
		});

		const mockDb = makeMockDb({ queries, crawls, scores });

		const result = await getVisibilityOverviewAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.queryId).toBe(queryId);
		expect(result[0]?.score).toBeNull();
	});

	it("uses only the last 5 successful crawls for score calculation", async () => {
		const queryId = "query-1";
		const queries: PromptQueryRow[] = [
			{
				id: queryId,
				domainProjectId: "project-1",
				query: "What is the best AI tool?",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
			},
		];

		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
			{
				id: "crawl-3",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
			{
				id: "crawl-4",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-22T10:00:00.000Z"),
				completedAt: new Date("2026-06-22T10:05:00.000Z"),
			},
			{
				id: "crawl-5",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-21T10:00:00.000Z"),
				completedAt: new Date("2026-06-21T10:05:00.000Z"),
			},
			{
				id: "crawl-6",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-20T10:00:00.000Z"),
				completedAt: new Date("2026-06-20T10:05:00.000Z"),
			},
		];

		const scores = new Map<string, ScoreRow>();
		scores.set("crawl-1", {
			crawlId: "crawl-1",
			mentionScore: 100,
			positionScore: 100,
			citationScore: 100,
			sentimentScore: 100,
			coMentionScore: 100,
			visibilityScore: 100,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-25T10:00:00.000Z"),
		});
		scores.set("crawl-2", {
			crawlId: "crawl-2",
			mentionScore: 80,
			positionScore: 80,
			citationScore: 80,
			sentimentScore: 80,
			coMentionScore: 80,
			visibilityScore: 80,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-24T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-24T10:00:00.000Z"),
		});
		scores.set("crawl-3", {
			crawlId: "crawl-3",
			mentionScore: 60,
			positionScore: 60,
			citationScore: 60,
			sentimentScore: 60,
			coMentionScore: 60,
			visibilityScore: 60,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-23T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-23T10:00:00.000Z"),
		});
		scores.set("crawl-4", {
			crawlId: "crawl-4",
			mentionScore: 40,
			positionScore: 40,
			citationScore: 40,
			sentimentScore: 40,
			coMentionScore: 40,
			visibilityScore: 40,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-22T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-22T10:00:00.000Z"),
		});
		scores.set("crawl-5", {
			crawlId: "crawl-5",
			mentionScore: 20,
			positionScore: 20,
			citationScore: 20,
			sentimentScore: 20,
			coMentionScore: 20,
			visibilityScore: 20,
			sentimentLabel: "negative",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-21T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-21T10:00:00.000Z"),
		});
		scores.set("crawl-6", {
			crawlId: "crawl-6",
			mentionScore: 0,
			positionScore: 0,
			citationScore: 0,
			sentimentScore: 0,
			coMentionScore: 0,
			visibilityScore: 0,
			sentimentLabel: "negative",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-20T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-20T10:00:00.000Z"),
		});

		const mockDb = makeMockDb({ queries, crawls, scores });

		const result = await getVisibilityOverviewAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.queryId).toBe(queryId);
		expect(result[0]?.score).toBe(60);
	});

	it("returns sub-score breakdown and formula version", async () => {
		const queryId = "query-1";
		const queries: PromptQueryRow[] = [
			{
				id: queryId,
				domainProjectId: "project-1",
				query: "What is the best AI tool?",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
			},
		];

		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
			{
				id: "crawl-3",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
		];

		const scores = new Map<string, ScoreRow>();
		scores.set("crawl-1", {
			crawlId: "crawl-1",
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 25,
			visibilityScore: 73,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-25T10:00:00.000Z"),
		});
		scores.set("crawl-2", {
			crawlId: "crawl-2",
			mentionScore: 80,
			positionScore: 60,
			citationScore: 40,
			sentimentScore: 80,
			coMentionScore: 20,
			visibilityScore: 56,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-24T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-24T10:00:00.000Z"),
		});
		scores.set("crawl-3", {
			crawlId: "crawl-3",
			mentionScore: 60,
			positionScore: 40,
			citationScore: 20,
			sentimentScore: 60,
			coMentionScore: 15,
			visibilityScore: 39,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-23T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-23T10:00:00.000Z"),
		});

		const mockDb = makeMockDb({ queries, crawls, scores });

		const result = await getVisibilityOverviewAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.scoreBreakdown).toEqual({
			mentionScore: 80,
			positionScore: 60,
			citationScore: 40,
			sentimentScore: 80,
			coMentionScore: 20,
		});
		expect(result[0]?.formulaVersion).toBe("v1.0.0");
		expect(result[0]?.sampleSize).toBe(3);
	});

	it("returns sentimentIsFallback flag when any recent crawl has fallback", async () => {
		const queryId = "query-1";
		const queries: PromptQueryRow[] = [
			{
				id: queryId,
				domainProjectId: "project-1",
				query: "What is the best AI tool?",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
			},
		];

		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
			{
				id: "crawl-3",
				promptQueryId: queryId,
				status: "completed",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
		];

		const scores = new Map<string, ScoreRow>();
		scores.set("crawl-1", {
			crawlId: "crawl-1",
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 25,
			visibilityScore: 73,
			sentimentLabel: "positive",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-25T10:00:00.000Z"),
		});
		scores.set("crawl-2", {
			crawlId: "crawl-2",
			mentionScore: 80,
			positionScore: 60,
			citationScore: 40,
			sentimentScore: 80,
			coMentionScore: 20,
			visibilityScore: 56,
			sentimentLabel: "neutral",
			sentimentIsFallback: true,
			sentimentCacheHit: false,
			sentimentRetryCount: 1,
			sentimentLastAttemptAt: new Date("2026-06-24T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-24T10:00:00.000Z"),
		});
		scores.set("crawl-3", {
			crawlId: "crawl-3",
			mentionScore: 60,
			positionScore: 40,
			citationScore: 20,
			sentimentScore: 60,
			coMentionScore: 15,
			visibilityScore: 39,
			sentimentLabel: "neutral",
			sentimentIsFallback: false,
			sentimentCacheHit: false,
			sentimentRetryCount: 0,
			sentimentLastAttemptAt: new Date("2026-06-23T10:00:00.000Z"),
			formulaVersion: "v1.0.0",
			computedAt: new Date("2026-06-23T10:00:00.000Z"),
		});

		const mockDb = makeMockDb({ queries, crawls, scores });

		const result = await getVisibilityOverviewAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.sentimentIsFallback).toBe(true);
	});
});
