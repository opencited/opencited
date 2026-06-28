import { eq, and } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { z } from "zod";
import {
	FORMULA_VERSION,
	PROMPT_VERSION,
	SENTIMENT_SCORE_MAP,
	SUB_SCORE_WEIGHTS,
	callSentimentJudge,
	computeVisibilityScore,
} from "@opencited/score-actions";
import type {
	BrandMention,
	CrawlCitation,
	SentimentJudgeResult,
	TargetBrand,
	VisibilityScoreResult,
} from "@opencited/score-actions";
import { baseActionContextSchema } from "../context";
import {
	crawlBrandMentionTable,
	crawlSourceTable,
	crawlVisibilityScoreTable,
	domainProjectTable,
	promptQueryCrawlTable,
} from "@opencited/db";
import { createProvider } from "../ai/provider";

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
type SourceRow = typeof crawlSourceTable.$inferSelect;

function parseAliases(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string");
	}
	return [];
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

export interface ComputeVisibilityScoreInternalParams {
	input: z.infer<typeof computeVisibilityScoreInputSchema>;
	ctx: z.infer<typeof computeVisibilityScoreContextSchema>;
	model?: LanguageModel;
	providerOptions?: Record<string, Record<string, unknown>>;
	sentimentCache?: Map<string, SentimentJudgeResult>;
	now?: () => Date;
}

export const computeVisibilityScoreInternal = async (
	params: ComputeVisibilityScoreInternalParams,
): Promise<z.infer<typeof computeVisibilityScoreOutputSchema>> => {
	const { input, ctx } = params;
	const model = params.model ?? moduleModel;
	const providerOptions = params.providerOptions ?? moduleProviderOptions;
	const sentimentCache = params.sentimentCache ?? moduleSentimentCache;
	const now = params.now ?? (() => new Date());

	const crawls: CrawlRow[] = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.id, input.crawlId))
		.limit(1);

	if (crawls.length === 0) {
		throw new Error(`Crawl not found: ${input.crawlId}`);
	}
	const crawl = crawls[0];
	if (!crawl) {
		throw new Error(`Crawl not found: ${input.crawlId}`);
	}
	if (!crawl.domainProjectId) {
		throw new Error(`Crawl has no domainProjectId: ${input.crawlId}`);
	}

	const projects: DomainProjectRow[] = await ctx.db
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

	const mentionRows: MentionRow[] = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(eq(crawlBrandMentionTable.crawlId, input.crawlId));

	const brandMentions: BrandMention[] = mentionRows.map((m: MentionRow) => ({
		brandName: m.brandName,
		mentionType: m.mentionType as "target" | "competitor" | "other",
		position: m.position ?? undefined,
		brandUrl: m.brandUrl ?? undefined,
	}));

	const sourceRows: SourceRow[] = await ctx.db
		.select()
		.from(crawlSourceTable)
		.where(eq(crawlSourceTable.crawlId, input.crawlId));

	const crawlCitations: CrawlCitation[] = sourceRows.map((s: SourceRow) => ({
		domain: s.domain,
		url: s.url,
		position: s.position ?? undefined,
		isOwnDomain: s.isOwnDomain ?? undefined,
		isCompetitorDomain: s.isCompetitorDomain ?? undefined,
	}));

	const sentimentResult = await callSentimentJudge(
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
		crawlProvider: crawl.provider ?? "perplexity",
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

	const existing = await ctx.db
		.select({ crawlId: crawlVisibilityScoreTable.crawlId })
		.from(crawlVisibilityScoreTable)
		.where(
			and(
				eq(crawlVisibilityScoreTable.crawlId, input.crawlId),
				eq(crawlVisibilityScoreTable.formulaVersion, computed.formulaVersion),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		await ctx.db
			.update(crawlVisibilityScoreTable)
			.set(rowValues)
			.where(eq(crawlVisibilityScoreTable.crawlId, input.crawlId));
	} else {
		await ctx.db.insert(crawlVisibilityScoreTable).values(rowValues);
	}

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

export const computeVisibilityScoreAction = async (params: {
	input: z.infer<typeof computeVisibilityScoreInputSchema>;
	ctx: z.infer<typeof computeVisibilityScoreContextSchema>;
}) => {
	return computeVisibilityScoreInternal(params);
};

export const computeVisibilityScoreHandler = async (params: {
	input: z.infer<typeof computeVisibilityScoreInputSchema>;
	ctx: z.infer<typeof computeVisibilityScoreContextSchema>;
}) => {
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

export interface RetrySentimentInternalParams {
	input: z.infer<typeof retrySentimentInputSchema>;
	ctx: z.infer<typeof retrySentimentContextSchema>;
	model?: LanguageModel;
	providerOptions?: Record<string, Record<string, unknown>>;
	now?: () => Date;
}

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

export const retrySentimentInternal = async (
	params: RetrySentimentInternalParams,
): Promise<z.infer<typeof retrySentimentOutputSchema>> => {
	const { input, ctx } = params;
	const model = params.model ?? moduleModel;
	const providerOptions = params.providerOptions ?? moduleProviderOptions;
	const now = params.now ?? (() => new Date());

	const existingRows: ScoreRow[] = await ctx.db
		.select()
		.from(crawlVisibilityScoreTable)
		.where(eq(crawlVisibilityScoreTable.crawlId, input.crawlId))
		.limit(1);

	if (existingRows.length === 0) {
		throw new Error(`No score row to retry sentiment for: ${input.crawlId}`);
	}
	const existing = existingRows[0];
	if (!existing) {
		throw new Error(`No score row to retry sentiment for: ${input.crawlId}`);
	}

	const nowDate = now();
	if (existing.sentimentLastAttemptAt) {
		const elapsed =
			nowDate.getTime() - existing.sentimentLastAttemptAt.getTime();
		if (elapsed < 60_000) {
			throw new Error(
				`Rate limited: retry attempted ${Math.round(elapsed / 1000)}s after last attempt (minimum 60s)`,
			);
		}
	}

	const crawls: CrawlRow[] = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.id, input.crawlId))
		.limit(1);

	if (crawls.length === 0) {
		throw new Error(`Crawl not found: ${input.crawlId}`);
	}
	const crawl = crawls[0];
	if (!crawl?.domainProjectId) {
		throw new Error(`Crawl missing domainProjectId: ${input.crawlId}`);
	}

	const projects: DomainProjectRow[] = await ctx.db
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

	const brandName = project.name ?? project.domain;

	// Fresh cache so the previous fallback entry isn't reused.
	const freshCache = new Map<string, SentimentJudgeResult>();

	const sentimentResult = await callSentimentJudge(
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
		await ctx.db
			.update(crawlVisibilityScoreTable)
			.set(updatedFields)
			.where(eq(crawlVisibilityScoreTable.crawlId, input.crawlId));

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

	await ctx.db
		.update(crawlVisibilityScoreTable)
		.set(updatedFields)
		.where(eq(crawlVisibilityScoreTable.crawlId, input.crawlId));

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

export const retrySentimentAction = async (params: {
	input: z.infer<typeof retrySentimentInputSchema>;
	ctx: z.infer<typeof retrySentimentContextSchema>;
}) => {
	return retrySentimentInternal(params);
};

export const retrySentimentHandler = async (params: {
	input: z.infer<typeof retrySentimentInputSchema>;
	ctx: z.infer<typeof retrySentimentContextSchema>;
}) => {
	return retrySentimentAction(params);
};
