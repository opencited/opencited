import { describe, it, expect, afterEach } from "bun:test";
import { parseArgs, runBackfill } from "./backfill-visibility-scores";
import type { BackfillDeps } from "./backfill-visibility-scores";

describe("parseArgs", () => {
	const originalEnv = process.env.BATCH_SIZE;

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.BATCH_SIZE = originalEnv;
		} else {
			delete process.env.BATCH_SIZE;
		}
	});

	it("returns defaults with no flags", () => {
		delete process.env.BATCH_SIZE;
		const args = parseArgs([]);
		expect(args.dryRun).toBe(false);
		expect(args.force).toBe(false);
		expect(args.batchSize).toBe(50);
	});

	it("parses --dry-run", () => {
		const args = parseArgs(["--dry-run"]);
		expect(args.dryRun).toBe(true);
		expect(args.force).toBe(false);
	});

	it("parses --force", () => {
		const args = parseArgs(["--force"]);
		expect(args.force).toBe(true);
		expect(args.dryRun).toBe(false);
	});

	it("parses both --dry-run and --force", () => {
		const args = parseArgs(["--dry-run", "--force"]);
		expect(args.dryRun).toBe(true);
		expect(args.force).toBe(true);
	});

	it("reads BATCH_SIZE from env", () => {
		process.env.BATCH_SIZE = "100";
		const args = parseArgs([]);
		expect(args.batchSize).toBe(100);
	});

	it("ignores non-numeric BATCH_SIZE", () => {
		process.env.BATCH_SIZE = "not-a-number";
		const args = parseArgs([]);
		expect(args.batchSize).toBe(50);
	});
});

function makeMockDb(crawlIds: string[]) {
	const makeThenable = <T>(data: T, extra: Record<string, unknown> = {}) => {
		const promise = Promise.resolve(data);
		return Object.assign(promise, extra);
	};

	const from = (_table?: unknown) => {
		const leftJoin = (_joinTable: unknown, _onCond: unknown) => {
			const where = (_cond: unknown) => {
				const limitFn = (n: number) => {
					const offsetFn = (m: number) => {
						const batch = crawlIds.slice(m, m + n);
						return Promise.resolve(batch.map((id) => ({ id })));
					};
					return makeThenable([{ count: crawlIds.length }], {
						offset: offsetFn,
					});
				};
				return makeThenable([{ count: crawlIds.length }], {
					limit: limitFn,
				});
			};
			return { where };
		};
		const where = (_cond: unknown) => {
			const limitFn = (n: number) => {
				const offsetFn = (m: number) => {
					const batch = crawlIds.slice(m, m + n);
					return Promise.resolve(batch.map((id) => ({ id })));
				};
				return makeThenable([{ count: crawlIds.length }], {
					offset: offsetFn,
				});
			};
			return makeThenable([{ count: crawlIds.length }], {
				limit: limitFn,
				leftJoin,
			});
		};
		return { where, leftJoin };
	};

	const select = (_columns?: unknown) => {
		return { from };
	};

	return { db: { select } };
}

function makeMockDeps(
	crawlIds: string[],
	overrides?: Partial<BackfillDeps>,
): BackfillDeps & { scoredIds: string[]; logs: string[] } {
	const mockDb = makeMockDb(crawlIds);
	const scoredIds: string[] = [];
	const logs: string[] = [];

	return {
		db: mockDb.db as unknown as BackfillDeps["db"],
		computeScore: async (crawlId: string) => {
			scoredIds.push(crawlId);
			return { sentimentCacheHit: false };
		},
		log: (msg: string) => {
			logs.push(msg);
		},
		now: () => new Date("2026-06-27T12:00:00.000Z"),
		scoredIds,
		logs,
		...overrides,
	};
}

describe("runBackfill", () => {
	describe("dry-run", () => {
		it("counts rows and exits without scoring", async () => {
			const deps = makeMockDeps(["c1", "c2", "c3"]);
			const summary = await runBackfill(
				{ dryRun: true, force: false, batchSize: 50 },
				deps,
			);

			expect(summary.totalScored).toBe(0);
			expect(deps.scoredIds).toEqual([]);
			expect(deps.logs.some((l) => l.includes("3"))).toBe(true);
		});
	});

	describe("no rows to score", () => {
		it("reports 0 and exits with success", async () => {
			const deps = makeMockDeps([]);
			const summary = await runBackfill(
				{ dryRun: false, force: false, batchSize: 50 },
				deps,
			);

			expect(summary.totalConsidered).toBe(0);
			expect(summary.totalScored).toBe(0);
			expect(deps.scoredIds).toEqual([]);
		});
	});

	describe("batch processing", () => {
		it("calls computeScore for each crawl in a single batch", async () => {
			const deps = makeMockDeps(["c1", "c2", "c3"]);
			const summary = await runBackfill(
				{ dryRun: false, force: false, batchSize: 50 },
				deps,
			);

			expect(summary.totalScored).toBe(3);
			expect(deps.scoredIds).toEqual(["c1", "c2", "c3"]);
		});

		it("processes multiple batches", async () => {
			const deps = makeMockDeps(["c1", "c2", "c3", "c4", "c5"]);
			const summary = await runBackfill(
				{ dryRun: false, force: false, batchSize: 2 },
				deps,
			);

			expect(summary.totalScored).toBe(5);
			expect(deps.scoredIds).toEqual(["c1", "c2", "c3", "c4", "c5"]);
		});
	});

	describe("error handling", () => {
		it("continues on error and tracks error count", async () => {
			const scoredIds: string[] = [];
			const deps = makeMockDeps(["c1", "c2", "c3"], {
				computeScore: async (crawlId: string) => {
					if (crawlId === "c2") {
						throw new Error("LLM timeout");
					}
					scoredIds.push(crawlId);
					return { sentimentCacheHit: false };
				},
			});

			const summary = await runBackfill(
				{ dryRun: false, force: false, batchSize: 50 },
				deps,
			);

			expect(summary.totalScored).toBe(2);
			expect(summary.errorCount).toBe(1);
			expect(scoredIds).toEqual(["c1", "c3"]);
		});
	});

	describe("summary", () => {
		it("includes all stats in the summary", async () => {
			const deps = makeMockDeps(["c1", "c2"]);
			const summary = await runBackfill(
				{ dryRun: false, force: false, batchSize: 50 },
				deps,
			);

			expect(summary.totalConsidered).toBe(2);
			expect(summary.totalScored).toBe(2);
			expect(summary.errorCount).toBe(0);
			expect(summary.elapsedTimeMs).toBeGreaterThanOrEqual(0);
		});

		it("tracks LLM calls (cache misses)", async () => {
			let callCount = 0;
			const deps = makeMockDeps(["c1", "c2", "c3"], {
				computeScore: async () => {
					callCount++;
					return { sentimentCacheHit: callCount > 1 };
				},
			});

			const summary = await runBackfill(
				{ dryRun: false, force: false, batchSize: 50 },
				deps,
			);

			expect(summary.llmCalls).toBe(1);
		});
	});
});
