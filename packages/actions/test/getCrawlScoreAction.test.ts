import { describe, expect, it } from "bun:test";
import { getCrawlScoreInternal } from "../src/aiVisibility/getCrawlScoreAction";

function getDrizzleTableName(table: unknown): string | null {
	if (!table || typeof table !== "object") return null;
	const sym = Object.getOwnPropertySymbols(table).find(
		(s) => s.description === "drizzle:Name",
	);
	if (!sym) return null;
	return (table as Record<symbol, unknown>)[sym] as string;
}

function makeMockDb(scoreRow: Record<string, unknown> | null) {
	const from = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		const where = (_cond: unknown) => {
			const defaultResult = (() => {
				switch (tableName) {
					case "crawl_visibility_score":
						return scoreRow ? [scoreRow] : [];
					default:
						return [];
				}
			})();
			const limit = (n: number) => Promise.resolve(defaultResult.slice(0, n));
			return Object.assign(Promise.resolve(defaultResult), { limit });
		};
		return { where };
	};

	const select = () => ({ from });

	return { db: { select } };
}

const baseCtx = { userId: null, isAuthenticated: false };

const SCORE_ROW = {
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
};

describe("getCrawlScoreInternal", () => {
	it("returns the score row when one exists for the crawl", async () => {
		const mockDb = makeMockDb(SCORE_ROW);

		const result = await getCrawlScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).not.toBeNull();
		expect(result?.crawlId).toBe("crawl-1");
		expect(result?.mentionScore).toBe(100);
		expect(result?.positionScore).toBe(80);
		expect(result?.citationScore).toBe(60);
		expect(result?.sentimentScore).toBe(100);
		expect(result?.coMentionScore).toBe(25);
		expect(result?.visibilityScore).toBe(73);
		expect(result?.sentimentLabel).toBe("positive");
		expect(result?.sentimentIsFallback).toBe(false);
		expect(result?.formulaVersion).toBe("v1.0.0");
	});

	it("returns null when no score row exists for the crawl", async () => {
		const mockDb = makeMockDb(null);

		const result = await getCrawlScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
		});

		expect(result).toBeNull();
	});
});
