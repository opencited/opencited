import { describe, expect, it } from "bun:test";
import { aggregateVisibilityScores } from "../src/aggregateVisibilityScores";
import type { ScoredCrawl } from "../src";

const TARGET_BRAND_ID = "target";
const COMPETITOR_A_ID = "competitor-a";
const COMPETITOR_B_ID = "competitor-b";

function makeCrawl(
	overrides: Partial<ScoredCrawl> &
		Pick<ScoredCrawl, "brandId" | "completedAt">,
): ScoredCrawl {
	return {
		engine: "perplexity",
		crawlId: `crawl-${Math.random().toString(36).slice(2)}`,
		mentionScore: 0,
		positionScore: 0,
		citationScore: 0,
		sentimentScore: 50,
		coMentionScore: 0,
		...overrides,
	};
}

function makeDate(daysAgo: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	d.setHours(12, 0, 0, 0);
	return d;
}

describe("aggregateVisibilityScores — cold start", () => {
	it("returns null crossEngineScore when target has fewer than 3 crawls on an engine", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 50,
				citationScore: 100,
				sentimentScore: 50,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 80,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 33,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		expect(result.crossEngineScore).toBeNull();
		expect(result.perBrandPerEngineScores).toEqual([]);
	});

	it("returns null crossEngineScore when peer set is empty (no competitors)", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 50,
				citationScore: 100,
				sentimentScore: 50,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		expect(result.crossEngineScore).toBeNull();
		expect(result.perBrandPerEngineScores).toEqual([]);
	});
});

describe("aggregateVisibilityScores — per-brand-per-engine normalisation", () => {
	it("normalises sub-scores against the peer set using min-max", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 67,
				positionScore: 80,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 33,
			}),
			makeCrawl({
				brandId: COMPETITOR_B_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 60,
				citationScore: 100,
				sentimentScore: 50,
				coMentionScore: 33,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		expect(result.perBrandPerEngineScores).toHaveLength(1);
		const perplexityScore = result.perBrandPerEngineScores[0];
		expect(perplexityScore).toBeDefined();
		expect(perplexityScore?.engine).toBe("perplexity");

		expect(perplexityScore?.mentionScoreNorm).toBe(100);
		expect(perplexityScore?.positionScoreNorm).toBe(100);
		expect(perplexityScore?.citationScoreNorm).toBe(0);
		expect(perplexityScore?.sentimentScoreNorm).toBe(100);

		expect(perplexityScore?.score).toBeGreaterThanOrEqual(0);
		expect(perplexityScore?.score).toBeLessThanOrEqual(100);
	});

	it("returns 50 for degenerate case when all peers have identical sub-scores", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 100,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 100,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 100,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 100,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		const perplexityScore = result.perBrandPerEngineScores[0];
		expect(perplexityScore).toBeDefined();
		expect(perplexityScore?.mentionScoreNorm).toBe(50);
		expect(perplexityScore?.positionScoreNorm).toBe(50);
		expect(perplexityScore?.citationScoreNorm).toBe(50);
		expect(perplexityScore?.sentimentScoreNorm).toBe(50);
		expect(perplexityScore?.coMentionScoreNorm).toBe(50);
	});
});

describe("aggregateVisibilityScores — winsorisation", () => {
	it("winsorises min/max at 5th/95th percentile", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 0,
				positionScore: 0,
				citationScore: 0,
				sentimentScore: 0,
				coMentionScore: 0,
			}),
			makeCrawl({
				brandId: COMPETITOR_B_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		const perplexityScore = result.perBrandPerEngineScores[0];
		expect(perplexityScore).toBeDefined();
		expect(perplexityScore?.score).toBeGreaterThanOrEqual(0);
		expect(perplexityScore?.score).toBeLessThanOrEqual(100);
	});
});

describe("aggregateVisibilityScores — cross-engine", () => {
	it("computes equal-weight mean across engines with data", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "chatgpt",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "chatgpt",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "chatgpt",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "chatgpt",
				completedAt: makeDate(1),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		expect(result.perBrandPerEngineScores).toHaveLength(2);
		expect(result.crossEngineScore).not.toBeNull();
		expect(result.crossEngineScore).toBeGreaterThanOrEqual(0);
		expect(result.crossEngineScore).toBeLessThanOrEqual(100);
	});

	it("excludes engines with fewer than minCrawls from cross-engine mean", () => {
		const crawls: ScoredCrawl[] = [
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "perplexity",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 0,
				sentimentScore: 100,
				coMentionScore: 25,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "perplexity",
				completedAt: makeDate(1),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "chatgpt",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "chatgpt",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "chatgpt",
				completedAt: makeDate(3),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "chatgpt",
				completedAt: makeDate(1),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "gemini",
				completedAt: makeDate(1),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: TARGET_BRAND_ID,
				engine: "gemini",
				completedAt: makeDate(2),
				mentionScore: 100,
				positionScore: 100,
				citationScore: 100,
				sentimentScore: 100,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "gemini",
				completedAt: makeDate(1),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
			makeCrawl({
				brandId: COMPETITOR_A_ID,
				engine: "gemini",
				completedAt: makeDate(2),
				mentionScore: 50,
				positionScore: 50,
				citationScore: 50,
				sentimentScore: 50,
				coMentionScore: 50,
			}),
		];

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID, {
			minCrawlsPerEngine: 3,
		});

		expect(result.perBrandPerEngineScores).toHaveLength(2);
		const engines = result.perBrandPerEngineScores.map((s) => s.engine).sort();
		expect(engines).toEqual(["chatgpt", "perplexity"]);
	});
});

describe("aggregateVisibilityScores — trend", () => {
	it("returns 30-day trend with daily cross-engine scores", () => {
		const crawls: ScoredCrawl[] = [];

		for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
			crawls.push(
				makeCrawl({
					brandId: TARGET_BRAND_ID,
					engine: "perplexity",
					completedAt: makeDate(daysAgo),
					mentionScore: 100,
					positionScore: 100,
					citationScore: 0,
					sentimentScore: 100,
					coMentionScore: 25,
				}),
				makeCrawl({
					brandId: COMPETITOR_A_ID,
					engine: "perplexity",
					completedAt: makeDate(daysAgo),
					mentionScore: 50,
					positionScore: 50,
					citationScore: 50,
					sentimentScore: 50,
					coMentionScore: 50,
				}),
			);
		}

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		expect(result.trend).toHaveLength(30);
		for (const point of result.trend) {
			expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			if (point.score !== null) {
				expect(point.score).toBeGreaterThanOrEqual(0);
				expect(point.score).toBeLessThanOrEqual(100);
			}
		}
	});

	it("returns null for days with no crawl data", () => {
		const crawls: ScoredCrawl[] = [];

		for (let i = 0; i < 3; i++) {
			crawls.push(
				makeCrawl({
					brandId: TARGET_BRAND_ID,
					engine: "perplexity",
					completedAt: makeDate(0),
					mentionScore: 100,
					positionScore: 100,
					citationScore: 0,
					sentimentScore: 100,
					coMentionScore: 25,
				}),
				makeCrawl({
					brandId: COMPETITOR_A_ID,
					engine: "perplexity",
					completedAt: makeDate(0),
					mentionScore: 50,
					positionScore: 50,
					citationScore: 50,
					sentimentScore: 50,
					coMentionScore: 50,
				}),
			);
		}

		const result = aggregateVisibilityScores(crawls, TARGET_BRAND_ID);

		expect(result.trend).toHaveLength(30);
		const nonNullDays = result.trend.filter((p) => p.score !== null);
		expect(nonNullDays.length).toBeGreaterThan(0);
		expect(nonNullDays.length).toBeLessThan(30);
	});
});
