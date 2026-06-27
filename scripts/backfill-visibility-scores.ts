import {
	and,
	eq,
	isNull,
	isNotNull,
	count,
	getFreshDbInstance,
	promptQueryCrawlTable,
	crawlVisibilityScoreTable,
} from "../packages/db/src/index.ts";
import type { Db } from "../packages/db/src/index.ts";
import {
	computeVisibilityScoreInternal,
	createProvider,
} from "../packages/actions/src/index.ts";
import type { SentimentJudgeResult } from "../packages/score-actions/src/index.ts";

export interface BackfillArgs {
	dryRun: boolean;
	force: boolean;
	batchSize: number;
}

export interface BackfillSummary {
	totalConsidered: number;
	totalScored: number;
	llmCalls: number;
	elapsedTimeMs: number;
	errorCount: number;
}

export interface BackfillDeps {
	db: Db;
	computeScore: (crawlId: string) => Promise<{ sentimentCacheHit?: boolean }>;
	log: (message: string) => void;
	now: () => Date;
}

export function parseArgs(argv: string[]): BackfillArgs {
	const dryRun = argv.includes("--dry-run");
	const force = argv.includes("--force");

	let batchSize = 50;
	const envBatch = process.env.BATCH_SIZE;
	if (envBatch) {
		const parsed = Number.parseInt(envBatch, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			batchSize = parsed;
		}
	}

	return { dryRun, force, batchSize };
}

async function countCrawlsToScore(db: Db, force: boolean): Promise<number> {
	const baseWhere = and(
		eq(promptQueryCrawlTable.status, "completed"),
		isNotNull(promptQueryCrawlTable.domainProjectId),
	);

	if (force) {
		const result = await db
			.select({ count: count() })
			.from(promptQueryCrawlTable)
			.where(baseWhere)
			.limit(1);
		return (result[0] as { count: number } | undefined)?.count ?? 0;
	}

	const result = await db
		.select({ count: count() })
		.from(promptQueryCrawlTable)
		.leftJoin(
			crawlVisibilityScoreTable,
			eq(crawlVisibilityScoreTable.crawlId, promptQueryCrawlTable.id),
		)
		.where(
			and(
				eq(promptQueryCrawlTable.status, "completed"),
				isNotNull(promptQueryCrawlTable.domainProjectId),
				isNull(crawlVisibilityScoreTable.crawlId),
			),
		)
		.limit(1);
	return (result[0] as { count: number } | undefined)?.count ?? 0;
}

async function fetchBatchOfCrawlIds(
	db: Db,
	force: boolean,
	batchSize: number,
	offset: number,
): Promise<string[]> {
	const baseWhere = and(
		eq(promptQueryCrawlTable.status, "completed"),
		isNotNull(promptQueryCrawlTable.domainProjectId),
	);

	if (force) {
		const rows = await db
			.select({ id: promptQueryCrawlTable.id })
			.from(promptQueryCrawlTable)
			.where(baseWhere)
			.limit(batchSize)
			.offset(offset);
		return rows.map((r) => r.id);
	}

	const rows = await db
		.select({ id: promptQueryCrawlTable.id })
		.from(promptQueryCrawlTable)
		.leftJoin(
			crawlVisibilityScoreTable,
			eq(crawlVisibilityScoreTable.crawlId, promptQueryCrawlTable.id),
		)
		.where(
			and(
				eq(promptQueryCrawlTable.status, "completed"),
				isNotNull(promptQueryCrawlTable.domainProjectId),
				isNull(crawlVisibilityScoreTable.crawlId),
			),
		)
		.limit(batchSize)
		.offset(offset);
	return rows.map((r) => r.id);
}

export async function runBackfill(
	args: BackfillArgs,
	deps: BackfillDeps,
): Promise<BackfillSummary> {
	const { dryRun, force, batchSize } = args;
	const { db, computeScore, log, now } = deps;

	const startTime = now();
	const totalConsidered = await countCrawlsToScore(db, force);

	if (dryRun) {
		log(`[dry-run] ${totalConsidered} crawls to score. Exiting.`);
		return {
			totalConsidered,
			totalScored: 0,
			llmCalls: 0,
			elapsedTimeMs: now().getTime() - startTime.getTime(),
			errorCount: 0,
		};
	}

	if (totalConsidered === 0) {
		log("0 crawls to score. Nothing to do.");
		return {
			totalConsidered: 0,
			totalScored: 0,
			llmCalls: 0,
			elapsedTimeMs: now().getTime() - startTime.getTime(),
			errorCount: 0,
		};
	}

	let offset = 0;
	let totalScored = 0;
	let llmCalls = 0;
	let errorCount = 0;

	while (offset < totalConsidered) {
		const batch = await fetchBatchOfCrawlIds(db, force, batchSize, offset);
		if (batch.length === 0) break;

		for (const crawlId of batch) {
			try {
				const result = await computeScore(crawlId);
				totalScored++;
				if (!result.sentimentCacheHit) {
					llmCalls++;
				}
				log(
					`[${totalScored}/${totalConsidered}] Scored crawl ${crawlId}${result.sentimentCacheHit ? " (cache hit)" : ""}`,
				);
			} catch (err) {
				errorCount++;
				const message = err instanceof Error ? err.message : String(err);
				log(`[error] crawl ${crawlId}: ${message}`);
			}
		}

		offset += batch.length;
		const elapsed = now().getTime() - startTime.getTime();
		const rate = offset / (elapsed / 1000);
		const remaining = totalConsidered - offset;
		const etaSeconds = rate > 0 ? Math.round(remaining / rate) : 0;
		log(
			`Progress: ${Math.min(offset, totalConsidered)}/${totalConsidered} crawls processed (ETA: ${etaSeconds}s)`,
		);
	}

	const elapsedTimeMs = now().getTime() - startTime.getTime();

	log("");
	log("=== Backfill Summary ===");
	log(`Total crawls considered: ${totalConsidered}`);
	log(`Total scored:            ${totalScored}`);
	log(`Unique LLM calls:        ${llmCalls}`);
	log(`Errors:                  ${errorCount}`);
	log(`Elapsed time:            ${(elapsedTimeMs / 1000).toFixed(1)}s`);

	return {
		totalConsidered,
		totalScored,
		llmCalls,
		elapsedTimeMs,
		errorCount,
	};
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const db = getFreshDbInstance();

	const sentimentCache = new Map<string, SentimentJudgeResult>();
	const { model, providerOptions } = createProvider();

	const computeScore = async (crawlId: string) => {
		const cacheSizeBefore = sentimentCache.size;
		await computeVisibilityScoreInternal({
			input: { crawlId },
			ctx: { db, userId: null, isAuthenticated: false },
			model,
			providerOptions: providerOptions as
				| Record<string, Record<string, unknown>>
				| undefined,
			sentimentCache,
		});
		const cacheHit = sentimentCache.size === cacheSizeBefore;
		return { sentimentCacheHit: cacheHit };
	};

	const summary = await runBackfill(args, {
		db,
		computeScore,
		log: console.log,
		now: () => new Date(),
	});

	if (summary.errorCount > 0) {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Backfill failed:", err);
	process.exit(1);
});
