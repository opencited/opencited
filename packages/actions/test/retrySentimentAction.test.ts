import { describe, expect, it } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { retrySentimentInternal } from "../src/aiVisibility/computeVisibilityScoreAction";

interface ScoreRow {
	crawlId: string;
	mentionScore: number;
	positionScore: number;
	citationScore: number;
	sentimentScore: number;
	coMentionScore: number;
	visibilityScore: number;
	sentimentLabel: string | null;
	sentimentIsFallback: boolean;
	sentimentCacheHit: boolean;
	sentimentRetryCount: number;
	sentimentLastAttemptAt: Date | null;
	formulaVersion: string;
	computedAt: Date;
}

function getDrizzleTableName(table: unknown): string | null {
	if (!table || typeof table !== "object") return null;
	const sym = Object.getOwnPropertySymbols(table).find(
		(s) => s.description === "drizzle:Name",
	);
	if (!sym) return null;
	return (table as Record<symbol, unknown>)[sym] as string;
}

function makeMockDb(seed: {
	crawl: Record<string, unknown> | null;
	project: Record<string, unknown> | null;
	existingScore: ScoreRow | null;
}) {
	const scoreRows = new Map<string, ScoreRow>();
	if (seed.existingScore) {
		scoreRows.set(seed.existingScore.crawlId, seed.existingScore);
	}

	const from = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		const where = (_cond: unknown) => {
			const defaultResult = (() => {
				switch (tableName) {
					case "prompt_query_crawl":
						return seed.crawl ? [seed.crawl] : [];
					case "domain_project":
						return seed.project ? [seed.project] : [];
					case "crawl_visibility_score": {
						if (seed.existingScore) {
							return [seed.existingScore];
						}
						return [];
					}
					default:
						return [];
				}
			})();
			const limit = (n: number) => Promise.resolve(defaultResult.slice(0, n));
			const orderBy = () => Promise.resolve(defaultResult);
			return Object.assign(Promise.resolve(defaultResult), { limit, orderBy });
		};
		return { where };
	};

	const select = () => ({ from });

	const insert = (_table: unknown) => ({
		values: (_values: unknown) => Promise.resolve(),
	});

	const update = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		return {
			set: (data: unknown) => ({
				where: (_cond: unknown) => {
					if (tableName === "crawl_visibility_score") {
						for (const [id, existing] of scoreRows) {
							scoreRows.set(id, { ...existing, ...(data as object) });
							break;
						}
					}
					return Promise.resolve();
				},
			}),
		};
	};

	return { db: { select, insert, update }, scoreRows };
}

const baseCtx = { userId: null, isAuthenticated: false };

function makeModel(label: string): LanguageModel {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text", text: `{"label":"${label}"}` }],
			finishReason: { unified: "stop", raw: undefined },
			usage: {
				inputTokens: {
					total: 10,
					noCache: 10,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: { total: 20, text: 20, reasoning: undefined },
			},
			warnings: [],
		}),
	});
}

function makeThrowingModel(error: Error): LanguageModel {
	return new MockLanguageModelV3({
		doGenerate: async () => {
			throw error;
		},
	});
}

const MODEL_POSITIVE = makeModel("positive");
const MODEL_NEGATIVE = makeModel("negative");
const MODEL_THROWS = makeThrowingModel(new Error("upstream LLM unavailable"));

const FIXED_NOW = new Date("2026-06-25T12:00:00.000Z");

const FALLBACK_SCORE: ScoreRow = {
	crawlId: "crawl-1",
	mentionScore: 100,
	positionScore: 100,
	citationScore: 0,
	sentimentScore: 50,
	coMentionScore: 25,
	// 0.35*100 + 0.25*100 + 0.20*0 + 0.10*50 + 0.10*25 = 70
	visibilityScore: 70,
	sentimentLabel: null,
	sentimentIsFallback: true,
	sentimentCacheHit: false,
	sentimentRetryCount: 0,
	sentimentLastAttemptAt: new Date("2026-06-25T10:00:00.000Z"),
	formulaVersion: "v1.0.0",
	computedAt: new Date("2026-06-25T10:00:00.000Z"),
};

const SEED_CRAWL = {
	id: "crawl-1",
	promptQueryId: "pq-1",
	domainProjectId: "dp-1",
	content: "MyBrand is the leading AEO platform.",
	provider: "perplexity",
	sourceCount: 0,
	brandMentionCount: 0,
	status: "completed",
	query: "best AEO platform",
};

const SEED_PROJECT = {
	id: "dp-1",
	domain: "mybrand.com",
	name: "MyBrand",
	aliases: ["MyBrand Inc"],
	active: true,
};

describe("retrySentimentInternal — success path", () => {
	it("updates sentimentScore and clears sentimentIsFallback when the LLM succeeds", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: { ...FALLBACK_SCORE },
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_POSITIVE,
			now: () => FIXED_NOW,
		});

		expect(result.recovered).toBe(true);
		expect(result.row.sentimentScore).toBe(100);
		expect(result.row.sentimentIsFallback).toBe(false);
		expect(result.row.sentimentLabel).toBe("positive");
		expect(result.row.sentimentRetryCount).toBe(1);
		// Visibility was 70 with sentiment=50; with sentiment=100 it's:
		// 0.35*100 + 0.25*100 + 0.20*0 + 0.10*100 + 0.10*25 = 72.5 → 73
		expect(result.row.visibilityScore).toBe(73);

		const stored = mockDb.scoreRows.get("crawl-1");
		expect(stored?.sentimentIsFallback).toBe(false);
		expect(stored?.sentimentScore).toBe(100);
		expect(stored?.visibilityScore).toBe(73);
	});

	it("preserves the other 4 sub-scores from the existing row", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: { ...FALLBACK_SCORE },
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_NEGATIVE,
			now: () => FIXED_NOW,
		});

		expect(result.row.mentionScore).toBe(FALLBACK_SCORE.mentionScore);
		expect(result.row.positionScore).toBe(FALLBACK_SCORE.positionScore);
		expect(result.row.citationScore).toBe(FALLBACK_SCORE.citationScore);
		expect(result.row.coMentionScore).toBe(FALLBACK_SCORE.coMentionScore);
		expect(result.row.sentimentScore).toBe(0);
	});

	it("uses a fresh cache (does not reuse a previous fallback entry)", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: { ...FALLBACK_SCORE },
		});

		let calls = 0;
		const countingModel: LanguageModel = new MockLanguageModelV3({
			doGenerate: async () => {
				calls += 1;
				return {
					content: [{ type: "text", text: '{"label":"positive"}' }],
					finishReason: { unified: "stop", raw: undefined },
					usage: {
						inputTokens: {
							total: 10,
							noCache: 10,
							cacheRead: undefined,
							cacheWrite: undefined,
						},
						outputTokens: { total: 20, text: 20, reasoning: undefined },
					},
					warnings: [],
				};
			},
		});

		await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: countingModel,
			now: () => FIXED_NOW,
		});
		expect(calls).toBe(1);

		// A second retry on the same crawl should call the LLM again
		// (we don't carry the cache across retries).
		await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: countingModel,
			now: () => FIXED_NOW,
		});
		expect(calls).toBe(2);
	});

	it("always sets the formulaVersion to v1.0.0 on update (audit trail)", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: {
				...FALLBACK_SCORE,
				formulaVersion: "v0.9.0", // simulate an old version
			},
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_POSITIVE,
			now: () => FIXED_NOW,
		});

		expect(result.row.formulaVersion).toBe("v1.0.0");
	});
});

describe("retrySentimentInternal — failure path", () => {
	it("leaves the row largely unchanged when the LLM still falls back, but bumps retryCount", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: { ...FALLBACK_SCORE },
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_THROWS,
			now: () => FIXED_NOW,
		});

		expect(result.recovered).toBe(false);
		expect(result.row.sentimentIsFallback).toBe(true);
		expect(result.row.sentimentScore).toBe(50);
		expect(result.row.visibilityScore).toBe(FALLBACK_SCORE.visibilityScore);
		expect(result.row.sentimentRetryCount).toBe(1);

		const stored = mockDb.scoreRows.get("crawl-1");
		expect(stored?.sentimentIsFallback).toBe(true);
		expect(stored?.sentimentScore).toBe(50);
	});

	it("caps sentimentRetryCount at 2 (one initial + one retry)", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: { ...FALLBACK_SCORE, sentimentRetryCount: 1 },
		});

		const result = await retrySentimentInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_THROWS,
			now: () => FIXED_NOW,
		});

		expect(result.row.sentimentRetryCount).toBe(2);
	});
});

describe("retrySentimentInternal — error paths", () => {
	it("throws when there is no existing score row for the crawl", async () => {
		const mockDb = makeMockDb({
			crawl: SEED_CRAWL,
			project: SEED_PROJECT,
			existingScore: null,
		});

		await expect(
			retrySentimentInternal({
				input: { crawlId: "crawl-1" },
				ctx: { ...baseCtx, db: mockDb.db },
				model: MODEL_POSITIVE,
				now: () => FIXED_NOW,
			}),
		).rejects.toThrow(/No score row to retry sentiment/);
	});

	it("throws when the crawl does not exist", async () => {
		const mockDb = makeMockDb({
			crawl: null,
			project: null,
			existingScore: { ...FALLBACK_SCORE },
		});

		await expect(
			retrySentimentInternal({
				input: { crawlId: "crawl-1" },
				ctx: { ...baseCtx, db: mockDb.db },
				model: MODEL_POSITIVE,
				now: () => FIXED_NOW,
			}),
		).rejects.toThrow(/Crawl not found/);
	});
});
