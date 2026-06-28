import { describe, expect, it } from "bun:test";
import { getVisibilityAggregateAction } from "../src/aiVisibility/getVisibilityAggregateAction";

function getDrizzleTableName(table: unknown): string | null {
	if (!table || typeof table !== "object") return null;
	const sym = Object.getOwnPropertySymbols(table).find(
		(s) => s.description === "drizzle:Name",
	);
	if (!sym) return null;
	return (table as Record<symbol, unknown>)[sym] as string;
}

interface CrawlRow {
	id: string;
	domainProjectId: string;
	status: string;
	provider: string | null;
	createdAt: Date;
	completedAt: Date | null;
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
}

interface CompetitorRow {
	id: string;
	domainProjectId: string;
	domain: string;
	name: string;
	active: boolean;
}

function makeMockDb(seed: {
	crawls: CrawlRow[];
	scores: ScoreRow[];
	competitors: CompetitorRow[];
}) {
	const from = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		const where = (_cond: unknown) => {
			const defaultResult = (() => {
				switch (tableName) {
					case "prompt_query_crawl":
						return seed.crawls;
					case "crawl_visibility_score":
						return seed.scores;
					case "crawl_brand_mention":
						return [];
					case "crawl_source":
						return [];
					case "competitor":
						return seed.competitors.filter((c) => c.active);
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

describe("getVisibilityAggregateAction — cold-start metadata", () => {
	it("returns totalCompletedCrawls: 0 when no crawls exist", async () => {
		const mockDb = makeMockDb({
			crawls: [],
			scores: [],
			competitors: [],
		});

		const result = await getVisibilityAggregateAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result.crossEngineScore).toBeNull();
		expect(result.totalCompletedCrawls).toBe(0);
		expect(result.activeCompetitorCount).toBe(0);
		expect(result.maxCrawlsPerEngine).toBe(0);
	});

	it("returns activeCompetitorCount: 0 when no competitors are tracked", async () => {
		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				domainProjectId: "project-1",
				status: "completed",
				provider: "perplexity",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				domainProjectId: "project-1",
				status: "completed",
				provider: "perplexity",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
			{
				id: "crawl-3",
				domainProjectId: "project-1",
				status: "completed",
				provider: "perplexity",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
		];

		const scores: ScoreRow[] = crawls.map((c) => ({
			crawlId: c.id,
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 50,
			visibilityScore: 73,
			formulaVersion: "v1.0.0",
			computedAt: new Date(),
			sentimentIsFallback: false,
		}));

		const mockDb = makeMockDb({
			crawls,
			scores,
			competitors: [],
		});

		const result = await getVisibilityAggregateAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result.crossEngineScore).toBeNull();
		expect(result.totalCompletedCrawls).toBe(3);
		expect(result.activeCompetitorCount).toBe(0);
		expect(result.maxCrawlsPerEngine).toBe(3);
	});

	it("returns maxCrawlsPerEngine reflecting the target brand's crawls per engine", async () => {
		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				domainProjectId: "project-1",
				status: "completed",
				provider: "perplexity",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
			{
				id: "crawl-2",
				domainProjectId: "project-1",
				status: "completed",
				provider: "perplexity",
				createdAt: new Date("2026-06-24T10:00:00.000Z"),
				completedAt: new Date("2026-06-24T10:05:00.000Z"),
			},
			{
				id: "crawl-3",
				domainProjectId: "project-1",
				status: "completed",
				provider: "chatgpt",
				createdAt: new Date("2026-06-23T10:00:00.000Z"),
				completedAt: new Date("2026-06-23T10:05:00.000Z"),
			},
		];

		const scores: ScoreRow[] = crawls.map((c) => ({
			crawlId: c.id,
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 50,
			visibilityScore: 73,
			formulaVersion: "v1.0.0",
			computedAt: new Date(),
			sentimentIsFallback: false,
		}));

		const competitors: CompetitorRow[] = [
			{
				id: "comp-1",
				domainProjectId: "project-1",
				domain: "competitor.com",
				name: "Competitor",
				active: true,
			},
		];

		const mockDb = makeMockDb({
			crawls,
			scores,
			competitors,
		});

		const result = await getVisibilityAggregateAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result.totalCompletedCrawls).toBe(3);
		expect(result.activeCompetitorCount).toBe(1);
		expect(result.maxCrawlsPerEngine).toBe(2);
	});

	it("counts only active competitors", async () => {
		const crawls: CrawlRow[] = [
			{
				id: "crawl-1",
				domainProjectId: "project-1",
				status: "completed",
				provider: "perplexity",
				createdAt: new Date("2026-06-25T10:00:00.000Z"),
				completedAt: new Date("2026-06-25T10:05:00.000Z"),
			},
		];

		const scores: ScoreRow[] = crawls.map((c) => ({
			crawlId: c.id,
			mentionScore: 100,
			positionScore: 80,
			citationScore: 60,
			sentimentScore: 100,
			coMentionScore: 50,
			visibilityScore: 73,
			formulaVersion: "v1.0.0",
			computedAt: new Date(),
			sentimentIsFallback: false,
		}));

		const competitors: CompetitorRow[] = [
			{
				id: "comp-1",
				domainProjectId: "project-1",
				domain: "competitor1.com",
				name: "Competitor 1",
				active: true,
			},
			{
				id: "comp-2",
				domainProjectId: "project-1",
				domain: "competitor2.com",
				name: "Competitor 2",
				active: false,
			},
		];

		const mockDb = makeMockDb({
			crawls,
			scores,
			competitors,
		});

		const result = await getVisibilityAggregateAction({
			input: { domainProjectId: "project-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result.activeCompetitorCount).toBe(1);
	});
});
