import {
	crawlBrandMentionTable,
	crawlReferenceTable,
	crawlVisibilityScoreTable,
	type Db,
	domainProjectTable,
	promptQueryCrawlTable,
} from "@opencited/db";
import type {
	BrandMention,
	CrawlCitation,
	SentimentJudgeResult,
	TargetBrand,
	VisibilityScoreResult,
} from "@opencited/score-actions";
import {
	callSentimentJudge,
	computeVisibilityScore,
	FORMULA_VERSION,
	PROMPT_VERSION,
	SENTIMENT_SCORE_MAP,
	SUB_SCORE_WEIGHTS,
} from "@opencited/score-actions";
import type { LanguageModel } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createProvider } from "../ai/provider";
import { baseActionContextSchema } from "../context";

type ScoreRow = typeof crawlVisibilityScoreTable.$inferSelect;

export const computeVisibilityScoreInputSchema = z.object({
	crawlId: z.string().min(1),
});

export const computeVisibilityScoreOutputSchema = z.object({
	row: z.object({
		crawlId: z.string(),
		mentionScore: z.number().int().min(0).max(100),
		positionScore: z.number().int().min(0).max(100),
		citationScore: z.number().int().min(0).max(100),
		sentimentScore: z.number().int().min(0).max(100),
		coMentionScore: z.number().int().min(0).max(100),
		visibilityScore: z.number().int().min(0).max(100),
		formulaVersion: z.string(),
		computedAt: z.date(),
	}),
	sentimentRetryNeeded: z.boolean(),
	sentimentRetryCount: z.number().int().min(0).max(2),
});

export const computeVisibilityScoreContextSchema = baseActionContextSchema;

type CrawlRow = typeof promptQueryCrawlTable.$inferSelect;
type DomainProjectRow = typeof domainProjectTable.$inferSelect;
type MentionRow = typeof crawlBrandMentionTable.$inferSelect;
type SourceRow = typeof crawlReferenceTable.$inferSelect;
type VisibilityScoreRowValues = typeof crawlVisibilityScoreTable.$inferInsert;

/**
 * Runs one database phase with a handle that the caller controls. Workers
 * pass a scoped runner so each phase opens and closes its own pool instead of
 * holding an idle connection through the sentiment LLM call in the middle.
 */
export type VisibilityScoreDbRunner = <T>(
	fn: (db: Db) => Promise<T>,
) => Promise<T>;

interface VisibilityScoreInputs {
	crawl: CrawlRow;
	targetBrand: TargetBrand;
	brandMentions: BrandMention[];
	crawlCitations: CrawlCitation[];
}

function parseAliases(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string");
	}
	return [];
}

async function loadVisibilityScoreInputs(
	db: Db,
	crawlId: string,
): Promise<VisibilityScoreInputs> {
	const crawls: CrawlRow[] = await db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.id, crawlId))
		.limit(1);

	if (crawls.length === 0) {
		throw new Error(`Crawl not found: ${crawlId}`);
	}
	const crawl = crawls[0];
	if (!crawl) {
		throw new Error(`Crawl not found: ${crawlId}`);
	}
	if (!crawl.domainProjectId) {
		throw new Error(`Crawl has no domainProjectId: ${crawlId}`);
	}

	const projects: DomainProjectRow[] = await db
		.select()
		.from(domainProjectTable)
		.where(eq(domainProjectTable.id, crawl.domainProjectId))
		.limit(1);

	if (projects.length === 0) {
		throw new Error(`Domain project not found: ${crawl.domainProjectId}`);
	}
	const project = projects[0];
	if (!project) {
		throw new Error(`Domain project not found: ${crawl.domainProjectId}`);
	}

	const targetBrand: TargetBrand = {
		name: project.name ?? project.domain,
		domain: project.domain,
		aliases: parseAliases(project.aliases),
	};

	const mentionRows: MentionRow[] = await db
		.select()
		.from(crawlBrandMentionTable)
		.where(eq(crawlBrandMentionTable.crawlId, crawlId));

	const brandMentions: BrandMention[] = mentionRows.map((m: MentionRow) => ({
		brandName: m.brandName,
		mentionType: m.mentionType as "target" | "competitor" | "other",
		position: m.position ?? undefined,
		brandUrl: m.brandUrl ?? undefined,
	}));

	const sourceRows: SourceRow[] = await db
		.select()
		.from(crawlReferenceTable)
		.where(eq(crawlReferenceTable.crawlId, crawlId));

	const crawlCitations: CrawlCitation[] = sourceRows
		.filter(
			(row, index, self) =>
				self.findIndex((r) => r.domain === row.domain) === index,
		)
		.map((s: SourceRow) => ({
			domain: s.domain,
			url: s.url,
			position: s.position ?? undefined,
			isOwnDomain: s.isOwnDomain ?? undefined,
			isCompetitorDomain: s.isCompetitorDomain ?? undefined,
		}));

	return { crawl, targetBrand, brandMentions, crawlCitations };
}

async function writeVisibilityScoreRow(
	db: Db,
	rowValues: VisibilityScoreRowValues,
): Promise<void> {
	const existing = await db
		.select({ crawlId: crawlVisibilityScoreTable.crawlId })
		.from(crawlVisibilityScoreTable)
		.where(
			and(
				eq(crawlVisibilityScoreTable.crawlId, rowValues.crawlId),
				eq(crawlVisibilityScoreTable.formulaVersion, rowValues.formulaVersion),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(crawlVisibilityScoreTable)
			.set(rowValues)
			.where(eq(crawlVisibilityScoreTable.crawlId, rowValues.crawlId));
	} else {
		await db.insert(crawlVisibilityScoreTable).values(rowValues);
	}
}

const modelName = (() => {
	try {
		return process.env.LLM_MODEL ?? "unknown-model";
	} catch {
		return "unknown-model";
	}
})();

const { model: moduleModel, providerOptions: rawProviderOptions } =
	createProvider();
const moduleProviderOptions = rawProviderOptions as
	| Record<string, Record<string, unknown>>
	| undefined;

const moduleSentimentCache = new Map<string, SentimentJudgeResult>();

type ComputeVisibilityScoreContext = z.infer<
	typeof computeVisibilityScoreContextSchema
>;

type ComputeVisibilityScoreBaseParams = {
	input: z.infer<typeof computeVisibilityScoreInputSchema>;
	model?: LanguageModel;
	providerOptions?: Record<string, Record<string, unknown>>;
	sentimentCache?: Map<string, SentimentJudgeResult>;
	sentimentJudge?: typeof callSentimentJudge;
	now?: () => Date;
};

type ScopedComputeVisibilityScoreParams = {
	ctx: Omit<ComputeVisibilityScoreContext, "db">;
	dbRunner: VisibilityScoreDbRunner;
};

type UnscopedComputeVisibilityScoreParams = {
	ctx: ComputeVisibilityScoreContext;
	dbRunner?: undefined;
};

export type ComputeVisibilityScoreInternalParams =
	ComputeVisibilityScoreBaseParams &
		(ScopedComputeVisibilityScoreParams | UnscopedComputeVisibilityScoreParams);

export type ComputeVisibilityScoreActionParams = {
	input: z.infer<typeof computeVisibilityScoreInputSchema>;
} & (ScopedComputeVisibilityScoreParams | UnscopedComputeVisibilityScoreParams);

export const computeVisibilityScoreInternal = async (
	params: ComputeVisibilityScoreInternalParams,
): Promise<z.infer<typeof computeVisibilityScoreOutputSchema>> => {
	const { input } = params;
	const model = params.model ?? moduleModel;
	const providerOptions = params.providerOptions ?? moduleProviderOptions;
	const sentimentCache = params.sentimentCache ?? moduleSentimentCache;
	const sentimentJudge = params.sentimentJudge ?? callSentimentJudge;
	const now = params.now ?? (() => new Date());

	const runDb: VisibilityScoreDbRunner =
		params.dbRunner ??
		((fn) => fn((params.ctx as ComputeVisibilityScoreContext).db as Db));

	// Load everything the judge needs in one short scope, then close it before
	// waiting on the LLM.
	const { crawl, targetBrand, brandMentions, crawlCitations } = await runDb(
		(db) => loadVisibilityScoreInputs(db, input.crawlId),
	);

	const sentimentResult = await sentimentJudge(
		{
			content: crawl.content ?? "",
			brandName: targetBrand.name,
			promptVersion: PROMPT_VERSION,
			modelName,
		},
		{ model, cache: sentimentCache, providerOptions },
	);

	const computed: VisibilityScoreResult = computeVisibilityScore({
		crawlContent: crawl.content ?? "",
		// Provider is not used to decide availability. Missing values stay
		// engine-neutral so a disabled engine is never assumed.
		crawlProvider: crawl.provider ?? "unknown",
		crawlCitations,
		brandMentions,
		targetBrand,
		sentimentInput: {
			label: sentimentResult.label,
			cacheHit: sentimentResult.cacheHit,
			fallback: sentimentResult.fallback,
			retryCount: sentimentResult.retryCount,
		},
	});

	const computedAt = now();

	const rowValues = {
		crawlId: input.crawlId,
		mentionScore: computed.mentionScore,
		positionScore: computed.positionScore,
		citationScore: computed.citationScore,
		sentimentScore: computed.sentimentScore,
		coMentionScore: computed.coMentionScore,
		visibilityScore: computed.visibilityScore,
		sentimentLabel: sentimentResult.label,
		sentimentIsFallback: sentimentResult.fallback,
		sentimentCacheHit: sentimentResult.cacheHit,
		sentimentRetryCount: sentimentResult.retryCount,
		sentimentLastAttemptAt: computedAt,
		formulaVersion: computed.formulaVersion,
		computedAt,
	};

	// Write the score in a fresh short scope so no pool stays open after the
	// judge call either.
	await runDb((db) => writeVisibilityScoreRow(db, rowValues));

	return {
		row: {
			crawlId: rowValues.crawlId,
			mentionScore: rowValues.mentionScore,
			positionScore: rowValues.positionScore,
			citationScore: rowValues.citationScore,
			sentimentScore: rowValues.sentimentScore,
			coMentionScore: rowValues.coMentionScore,
			visibilityScore: rowValues.visibilityScore,
			formulaVersion: rowValues.formulaVersion,
			computedAt: rowValues.computedAt,
		},
		sentimentRetryNeeded: sentimentResult.fallback,
		sentimentRetryCount: sentimentResult.retryCount,
	};
};

export const computeVisibilityScoreAction = async (
	params: ComputeVisibilityScoreActionParams,
) => {
	return computeVisibilityScoreInternal(params);
};

export const computeVisibilityScoreHandler = async (
	params: ComputeVisibilityScoreActionParams,
) => {
	return computeVisibilityScoreAction(params);
};

// ----------------------------------------------------------------------
// retrySentimentAnalysis — runs the sentiment sub-score again for a crawl
// whose original LLM call fell back to neutral. The handler re-runs ONLY
// the sentiment step (the other 4 sub-scores are kept from the existing
// row) and updates the row in place. The retry uses a fresh cache so a
// previous fallback isn't reused. After this retry, the user is
// responsible for any further attempts via the UI (per the spec, the
// automatic retry budget is 1 — initial + 1 retry).
// ----------------------------------------------------------------------

export const retrySentimentInputSchema = z.object({
	crawlId: z.string().min(1),
});

export const retrySentimentOutputSchema = z.object({
	row: z.object({
		crawlId: z.string(),
		mentionScore: z.number().int().min(0).max(100),
		positionScore: z.number().int().min(0).max(100),
		citationScore: z.number().int().min(0).max(100),
		sentimentScore: z.number().int().min(0).max(100),
		coMentionScore: z.number().int().min(0).max(100),
		visibilityScore: z.number().int().min(0).max(100),
		formulaVersion: z.string(),
		computedAt: z.date(),
		sentimentIsFallback: z.boolean(),
		sentimentRetryCount: z.number().int().min(0).max(2),
		sentimentLabel: z.string().nullable(),
	}),
	recovered: z.boolean(),
});

export const retrySentimentContextSchema = baseActionContextSchema;

type RetrySentimentContext = z.infer<typeof retrySentimentContextSchema>;

type RetrySentimentBaseParams = {
	input: z.infer<typeof retrySentimentInputSchema>;
	model?: LanguageModel;
	providerOptions?: Record<string, Record<string, unknown>>;
	sentimentJudge?: typeof callSentimentJudge;
	now?: () => Date;
};

type ScopedRetrySentimentParams = {
	ctx: Omit<RetrySentimentContext, "db">;
	dbRunner: VisibilityScoreDbRunner;
};

type UnscopedRetrySentimentParams = {
	ctx: RetrySentimentContext;
	dbRunner?: undefined;
};

export type RetrySentimentInternalParams = RetrySentimentBaseParams &
	(ScopedRetrySentimentParams | UnscopedRetrySentimentParams);

export type RetrySentimentActionParams = {
	input: z.infer<typeof retrySentimentInputSchema>;
} & (ScopedRetrySentimentParams | UnscopedRetrySentimentParams);

function recomputeComposite(
	mention: number,
	position: number,
	citation: number,
	sentiment: number,
	coMention: number,
): number {
	return Math.round(
		mention * SUB_SCORE_WEIGHTS.mention +
			position * SUB_SCORE_WEIGHTS.position +
			citation * SUB_SCORE_WEIGHTS.citation +
			sentiment * SUB_SCORE_WEIGHTS.sentiment +
			coMention * SUB_SCORE_WEIGHTS.coMention,
	);
}

interface RetrySentimentInputs {
	existing: ScoreRow;
	crawl: CrawlRow;
	brandName: string;
}

async function loadRetrySentimentInputs(
	db: Db,
	crawlId: string,
	nowDate: Date,
): Promise<RetrySentimentInputs> {
	const existingRows: ScoreRow[] = await db
		.select()
		.from(crawlVisibilityScoreTable)
		.where(eq(crawlVisibilityScoreTable.crawlId, crawlId))
		.limit(1);

	if (existingRows.length === 0) {
		throw new Error(`No score row to retry sentiment for: ${crawlId}`);
	}
	const existing = existingRows[0];
	if (!existing) {
		throw new Error(`No score row to retry sentiment for: ${crawlId}`);
	}

	if (existing.sentimentLastAttemptAt) {
		const elapsed =
			nowDate.getTime() - existing.sentimentLastAttemptAt.getTime();
		if (elapsed < 60_000) {
			throw new Error(
				`Rate limited: retry attempted ${Math.round(elapsed / 1000)}s after last attempt (minimum 60s)`,
			);
		}
	}

	const crawls: CrawlRow[] = await db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.id, crawlId))
		.limit(1);

	if (crawls.length === 0) {
		throw new Error(`Crawl not found: ${crawlId}`);
	}
	const crawl = crawls[0];
	if (!crawl?.domainProjectId) {
		throw new Error(`Crawl missing domainProjectId: ${crawlId}`);
	}

	const projects: DomainProjectRow[] = await db
		.select()
		.from(domainProjectTable)
		.where(eq(domainProjectTable.id, crawl.domainProjectId))
		.limit(1);

	if (projects.length === 0) {
		throw new Error(`Domain project not found: ${crawl.domainProjectId}`);
	}
	const project = projects[0];
	if (!project) {
		throw new Error(`Domain project not found: ${crawl.domainProjectId}`);
	}

	return {
		existing,
		crawl,
		brandName: project.name ?? project.domain,
	};
}

async function updateVisibilityScoreRow(
	db: Db,
	crawlId: string,
	fields: Partial<VisibilityScoreRowValues>,
): Promise<void> {
	await db
		.update(crawlVisibilityScoreTable)
		.set(fields)
		.where(eq(crawlVisibilityScoreTable.crawlId, crawlId));
}

export const retrySentimentInternal = async (
	params: RetrySentimentInternalParams,
): Promise<z.infer<typeof retrySentimentOutputSchema>> => {
	const { input } = params;
	const model = params.model ?? moduleModel;
	const providerOptions = params.providerOptions ?? moduleProviderOptions;
	const sentimentJudge = params.sentimentJudge ?? callSentimentJudge;
	const now = params.now ?? (() => new Date());

	const runDb: VisibilityScoreDbRunner =
		params.dbRunner ??
		((fn) => fn((params.ctx as RetrySentimentContext).db as Db));

	// Load the row, crawl and brand in one short scope, then close it before
	// waiting on the LLM.
	const { existing, crawl, brandName } = await runDb((db) =>
		loadRetrySentimentInputs(db, input.crawlId, now()),
	);

	// Fresh cache so the previous fallback entry isn't reused.
	const freshCache = new Map<string, SentimentJudgeResult>();

	const sentimentResult = await sentimentJudge(
		{
			content: crawl.content ?? "",
			brandName,
			promptVersion: PROMPT_VERSION,
			modelName,
		},
		{ model, cache: freshCache, providerOptions },
	);

	const computedAt = now();
	const newRetryCount = Math.min(existing.sentimentRetryCount + 1, 2);

	if (sentimentResult.fallback) {
		// Retry itself failed. Bump the retry count, leave the rest of the
		// row alone. The user can manually retry from the UI.
		const updatedFields = {
			sentimentIsFallback: true,
			sentimentCacheHit: sentimentResult.cacheHit,
			sentimentRetryCount: newRetryCount,
			sentimentLastAttemptAt: computedAt,
		};
		await runDb((db) =>
			updateVisibilityScoreRow(db, input.crawlId, updatedFields),
		);

		return {
			row: {
				crawlId: existing.crawlId,
				mentionScore: existing.mentionScore,
				positionScore: existing.positionScore,
				citationScore: existing.citationScore,
				sentimentScore: existing.sentimentScore,
				coMentionScore: existing.coMentionScore,
				visibilityScore: existing.visibilityScore,
				formulaVersion: existing.formulaVersion,
				computedAt: existing.computedAt,
				sentimentIsFallback: true,
				sentimentRetryCount: newRetryCount,
				sentimentLabel: existing.sentimentLabel,
			},
			recovered: false,
		};
	}

	// Retry succeeded — recompute the composite with the other 4 sub-scores
	// preserved from the existing row and the new sentimentScore.
	const newSentimentScore =
		sentimentResult.label !== null
			? SENTIMENT_SCORE_MAP[sentimentResult.label]
			: existing.sentimentScore;

	const newVisibilityScore = recomputeComposite(
		existing.mentionScore,
		existing.positionScore,
		existing.citationScore,
		newSentimentScore,
		existing.coMentionScore,
	);

	const updatedFields = {
		sentimentScore: newSentimentScore,
		sentimentLabel: sentimentResult.label,
		sentimentIsFallback: false,
		sentimentCacheHit: sentimentResult.cacheHit,
		sentimentRetryCount: newRetryCount,
		sentimentLastAttemptAt: computedAt,
		visibilityScore: newVisibilityScore,
		computedAt,
		formulaVersion: FORMULA_VERSION,
	};

	await runDb((db) =>
		updateVisibilityScoreRow(db, input.crawlId, updatedFields),
	);

	return {
		row: {
			crawlId: existing.crawlId,
			mentionScore: existing.mentionScore,
			positionScore: existing.positionScore,
			citationScore: existing.citationScore,
			sentimentScore: newSentimentScore,
			coMentionScore: existing.coMentionScore,
			visibilityScore: newVisibilityScore,
			formulaVersion: FORMULA_VERSION,
			computedAt,
			sentimentIsFallback: false,
			sentimentRetryCount: newRetryCount,
			sentimentLabel: sentimentResult.label,
		},
		recovered: true,
	};
};

export const retrySentimentAction = async (
	params: RetrySentimentActionParams,
) => {
	return retrySentimentInternal(params);
};

export const retrySentimentHandler = async (
	params: RetrySentimentActionParams,
) => {
	return retrySentimentAction(params);
};
