import { beforeEach, describe, expect, it } from "bun:test";
import type { SentimentJudgeResult } from "@opencited/score-actions";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { computeVisibilityScoreInternal } from "../src/aiVisibility/computeVisibilityScoreAction";

interface CallRecord {
	type: "select" | "insert" | "update";
	table?: unknown;
	values?: unknown;
	set?: unknown;
	where?: unknown;
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
	mentions: Array<Record<string, unknown>>;
	sources: Array<Record<string, unknown>>;
}) {
	const calls: CallRecord[] = [];
	const scoreRows = new Map<string, ScoreRow>();

	const from = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		const where = (cond: unknown) => {
			calls.push({ type: "select", table: tableName, where: cond });
			const defaultResult = (() => {
				switch (tableName) {
					case "prompt_query_crawl":
						return seed.crawl ? [seed.crawl] : [];
					case "domain_project":
						return seed.project ? [seed.project] : [];
					case "crawl_brand_mention":
						return seed.mentions;
					case "crawl_source":
						return seed.sources;
					case "crawl_visibility_score": {
						const id = (cond as { crawlId?: string } | undefined)?.crawlId;
						if (id && scoreRows.has(id)) {
							return [{ crawlId: id }];
						}
						return [];
					}
					default:
						return [];
				}
			})();
			const limit = (n: number) => Promise.resolve(defaultResult.slice(0, n));
			const orderBy = () => Promise.resolve(defaultResult);
			// The action either awaits `where(...)` directly (no limit) or
			// calls `.limit(n)` then awaits. The returned object must be
			// thenable for the first case and have `.limit`/`.orderBy` for
			// the second. A real Promise already has `.then`; we attach the
			// builder methods to it.
			return Object.assign(Promise.resolve(defaultResult), {
				limit,
				orderBy,
			});
		};
		return { where };
	};

	const select = () => {
		calls.push({ type: "select" });
		return { from };
	};

	const insert = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		calls.push({ type: "insert", table: tableName });
		return {
			values: (values: unknown) => {
				calls.push({ type: "insert", table: tableName, values });
				const v = values as ScoreRow;
				scoreRows.set(v.crawlId, v);
				return Promise.resolve();
			},
		};
	};

	const update = (table: unknown) => {
		const tableName = getDrizzleTableName(table);
		calls.push({ type: "update", table: tableName });
		return {
			set: (data: unknown) => ({
				where: (cond: unknown) => {
					calls.push({
						type: "update",
						table: tableName,
						set: data,
						where: cond,
					});
					const id = (cond as { crawlId?: string } | undefined)?.crawlId;
					if (id && scoreRows.has(id)) {
						const existing = scoreRows.get(id);
						if (existing) {
							scoreRows.set(id, { ...existing, ...(data as object) });
						}
					}
					return Promise.resolve();
				},
			}),
		};
	};

	return { db: { select, insert, update }, calls, scoreRows };
}

const baseCtx = {
	userId: null,
	isAuthenticated: false,
};

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
const MODEL_NEUTRAL = makeModel("neutral");
const MODEL_THROWS = makeThrowingModel(new Error("upstream LLM unavailable"));

const FIXED_NOW = new Date("2026-06-25T12:00:00.000Z");

describe("computeVisibilityScoreInternal — full pipeline", () => {
	let mockDb: ReturnType<typeof makeMockDb>;
	let freshCache: Map<string, SentimentJudgeResult>;

	beforeEach(() => {
		mockDb = makeMockDb({
			crawl: {
				id: "crawl-1",
				promptQueryId: "pq-1",
				domainProjectId: "dp-1",
				content:
					"MyBrand is the leading AEO platform. Acme and Beta are alternatives.",
				provider: "perplexity",
				sourceCount: 0,
				brandMentionCount: 0,
				status: "completed",
				query: "best AEO platform",
			},
			project: {
				id: "dp-1",
				domain: "mybrand.com",
				name: "MyBrand",
				aliases: ["MyBrand Inc"],
				active: true,
			},
			mentions: [
				{
					id: "m-1",
					crawlId: "crawl-1",
					brandName: "MyBrand",
					brandUrl: "https://mybrand.com",
					mentionType: "target",
					position: 1,
				},
				{
					id: "m-2",
					crawlId: "crawl-1",
					brandName: "Acme",
					brandUrl: "https://acme.com",
					mentionType: "competitor",
					position: 2,
				},
				{
					id: "m-3",
					crawlId: "crawl-1",
					brandName: "Beta",
					brandUrl: "https://beta.com",
					mentionType: "competitor",
					position: 3,
				},
				{
					id: "m-4",
					crawlId: "crawl-1",
					brandName: "SomeTool",
					brandUrl: "https://sometool.com",
					mentionType: "other",
					position: 4,
				},
			],
			sources: [
				{
					id: "s-1",
					crawlId: "crawl-1",
					domain: "acme.com",
					url: "https://acme.com/article",
					position: 1,
					isOwnDomain: false,
				},
			],
		});
		// Each test gets a fresh sentiment cache so the model is
		// actually invoked (the module-level cache would otherwise leak
		// between tests and pin the first test's result).
		freshCache = new Map();
	});

	it("writes a crawl_visibility_score row with all 5 sub-scores in [0, 100] and the right formula version", async () => {
		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_POSITIVE,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});

		expect(result.row.crawlId).toBe("crawl-1");
		expect(result.row.formulaVersion).toBe("v1.0.0");
		expect(result.row.computedAt).toEqual(FIXED_NOW);
		for (const v of [
			result.row.mentionScore,
			result.row.positionScore,
			result.row.citationScore,
			result.row.sentimentScore,
			result.row.coMentionScore,
			result.row.visibilityScore,
		]) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(100);
		}

		const stored = mockDb.scoreRows.get("crawl-1");
		expect(stored).toBeDefined();
		expect(stored?.formulaVersion).toBe("v1.0.0");
	});

	it("produces the spec's hand-calculated composite (Crawl 1: rank 1, not cited, positive, 1 of 4)", async () => {
		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_POSITIVE,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});

		expect(result.row.mentionScore).toBe(100);
		expect(result.row.positionScore).toBe(100);
		expect(result.row.citationScore).toBe(0);
		expect(result.row.sentimentScore).toBe(100);
		expect(result.row.coMentionScore).toBe(25);
		expect(result.row.visibilityScore).toBe(73);
	});

	it("maps neutral sentiment to 50", async () => {
		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_NEUTRAL,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});
		expect(result.row.sentimentScore).toBe(50);
	});

	it("maps negative sentiment to 0", async () => {
		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_NEGATIVE,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});
		expect(result.row.sentimentScore).toBe(0);
	});

	it("falls back to neutral when the LLM throws and signals sentimentRetryNeeded=true", async () => {
		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_THROWS,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});

		expect(result.row.sentimentScore).toBe(50);
		expect(result.sentimentRetryNeeded).toBe(true);
		expect(result.sentimentRetryCount).toBe(1);

		const stored = mockDb.scoreRows.get("crawl-1");
		expect(stored?.sentimentIsFallback).toBe(true);
	});

	it("does not re-call the LLM on a second run for the same crawl (cache hit)", async () => {
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

		await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: countingModel,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});
		expect(calls).toBe(1);

		await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: countingModel,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});
		expect(calls).toBe(1);
	});

	it("throws when the crawl does not exist", async () => {
		const emptyDb = makeMockDb({
			crawl: null,
			project: null,
			mentions: [],
			sources: [],
		});
		await expect(
			computeVisibilityScoreInternal({
				input: { crawlId: "missing" },
				ctx: { ...baseCtx, db: emptyDb.db },
				model: MODEL_POSITIVE,
				sentimentCache: freshCache,
				now: () => FIXED_NOW,
			}),
		).rejects.toThrow(/Crawl not found/);
	});

	it("recognises the target by alias when mentionType is unset", async () => {
		const aliasDb = makeMockDb({
			crawl: {
				id: "crawl-2",
				promptQueryId: "pq-2",
				domainProjectId: "dp-1",
				content: "Some other answer about MyBrand Inc.",
				provider: "perplexity",
				sourceCount: 0,
				brandMentionCount: 0,
				status: "completed",
				query: "x",
			},
			project: {
				id: "dp-1",
				domain: "mybrand.com",
				name: "MyBrand",
				aliases: ["MyBrand Inc"],
				active: true,
			},
			mentions: [
				{
					id: "m-a",
					crawlId: "crawl-2",
					brandName: "MyBrand Inc",
					mentionType: "other",
					position: 1,
				},
			],
			sources: [],
		});

		const result = await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-2" },
			ctx: { ...baseCtx, db: aliasDb.db },
			model: MODEL_POSITIVE,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});
		expect(result.row.mentionScore).toBe(100);
	});

	it("upserts when the row already exists (re-score path)", async () => {
		await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_POSITIVE,
			sentimentCache: freshCache,
			now: () => FIXED_NOW,
		});

		const before = mockDb.scoreRows.get("crawl-1");

		const laterCache = new Map();
		const later = new Date("2026-06-26T00:00:00.000Z");
		await computeVisibilityScoreInternal({
			input: { crawlId: "crawl-1" },
			ctx: { ...baseCtx, db: mockDb.db },
			model: MODEL_NEUTRAL,
			sentimentCache: laterCache,
			now: () => later,
		});

		const after = mockDb.scoreRows.get("crawl-1");
		expect(after).toBeDefined();
		expect(after?.computedAt).toEqual(later);
		expect(after?.sentimentScore).toBe(50);
		expect(before?.sentimentScore).toBe(100);
	});
});
