import { eq, desc, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlTable,
	crawlVisibilityScoreTable,
	crawlBrandMentionTable,
	crawlSourceTable,
	competitorTable,
} from "@opencited/db";
import {
	aggregateVisibilityScores,
	type ScoredCrawl,
} from "@opencited/score-actions";

export const getVisibilityAggregateInputSchema = z.object({
	domainProjectId: z.string(),
});

export const getVisibilityAggregateOutputSchema = z.object({
	perBrandPerEngineScores: z.array(
		z.object({
			engine: z.string(),
			mentionScoreNorm: z.number(),
			positionScoreNorm: z.number(),
			citationScoreNorm: z.number(),
			sentimentScoreNorm: z.number(),
			coMentionScoreNorm: z.number(),
			score: z.number(),
		}),
	),
	crossEngineScore: z.number().nullable(),
	trend: z.array(
		z.object({
			date: z.string(),
			score: z.number().nullable(),
		}),
	),
	totalCompletedCrawls: z.number(),
	activeCompetitorCount: z.number(),
	maxCrawlsPerEngine: z.number(),
});

export const getVisibilityAggregateContextSchema = baseActionContextSchema;

type CrawlRow = typeof promptQueryCrawlTable.$inferSelect;
type ScoreRow = typeof crawlVisibilityScoreTable.$inferSelect;
type MentionRow = typeof crawlBrandMentionTable.$inferSelect;
type SourceRow = typeof crawlSourceTable.$inferSelect;
type CompetitorRow = typeof competitorTable.$inferSelect;

function computeCompetitorSubScores(
	_crawl: CrawlRow,
	competitor: CompetitorRow,
	mentions: MentionRow[],
	sources: SourceRow[],
): Pick<
	ScoredCrawl,
	| "mentionScore"
	| "positionScore"
	| "citationScore"
	| "sentimentScore"
	| "coMentionScore"
> {
	const competitorMentions = mentions.filter(
		(m) => m.competitorId === competitor.id,
	);
	const totalMentions = mentions.length;

	const mentionScore = competitorMentions.length > 0 ? 100 : 0;

	const positions = competitorMentions
		.filter((m) => m.position !== null)
		.map((m) => m.position as number)
		.sort((a, b) => a - b);
	const bestPosition = positions[0];
	const positionScore =
		bestPosition !== undefined
			? Math.round(100 / Math.log2(1 + bestPosition))
			: 0;

	const competitorDomains = competitor.domain
		.split(",")
		.map((d) =>
			d
				.trim()
				.toLowerCase()
				.replace(/^www\./, ""),
		)
		.filter(Boolean);
	const citationScore = sources.some((s) => {
		const sourceDomain = s.domain.toLowerCase().replace(/^www\./, "");
		return competitorDomains.includes(sourceDomain);
	})
		? 100
		: 0;

	const sentimentScore = 50;

	const coMentionScore =
		totalMentions > 0
			? Math.round((100 * competitorMentions.length) / totalMentions)
			: 0;

	return {
		mentionScore,
		positionScore,
		citationScore,
		sentimentScore,
		coMentionScore,
	};
}

export const getVisibilityAggregateAction = async (params: {
	input: z.infer<typeof getVisibilityAggregateInputSchema>;
	ctx: z.infer<typeof getVisibilityAggregateContextSchema>;
}) => {
	const { input, ctx } = params;

	const allCrawls: CrawlRow[] = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(
			and(
				eq(promptQueryCrawlTable.domainProjectId, input.domainProjectId),
				eq(promptQueryCrawlTable.status, "completed"),
			),
		)
		.orderBy(desc(promptQueryCrawlTable.createdAt));

	if (allCrawls.length === 0) {
		return {
			perBrandPerEngineScores: [],
			crossEngineScore: null,
			trend: [],
			totalCompletedCrawls: 0,
			activeCompetitorCount: 0,
			maxCrawlsPerEngine: 0,
		};
	}

	const crawlIds = allCrawls.map((c) => c.id);

	const [allScores, allMentions, allSources, competitors] = await Promise.all([
		ctx.db
			.select()
			.from(crawlVisibilityScoreTable)
			.where(inArray(crawlVisibilityScoreTable.crawlId, crawlIds)),
		ctx.db
			.select()
			.from(crawlBrandMentionTable)
			.where(inArray(crawlBrandMentionTable.crawlId, crawlIds)),
		ctx.db
			.select()
			.from(crawlSourceTable)
			.where(inArray(crawlSourceTable.crawlId, crawlIds)),
		ctx.db
			.select()
			.from(competitorTable)
			.where(
				and(
					eq(competitorTable.domainProjectId, input.domainProjectId),
					eq(competitorTable.active, true),
				),
			),
	]);

	const scoresByCrawlId = new Map<string, ScoreRow>();
	for (const score of allScores) {
		scoresByCrawlId.set(score.crawlId, score);
	}

	const mentionsByCrawlId = new Map<string, MentionRow[]>();
	for (const mention of allMentions) {
		const existing = mentionsByCrawlId.get(mention.crawlId) ?? [];
		existing.push(mention);
		mentionsByCrawlId.set(mention.crawlId, existing);
	}

	const sourcesByCrawlId = new Map<string, SourceRow[]>();
	for (const source of allSources) {
		const existing = sourcesByCrawlId.get(source.crawlId) ?? [];
		existing.push(source);
		sourcesByCrawlId.set(source.crawlId, existing);
	}

	const scoredCrawls: ScoredCrawl[] = [];

	for (const crawl of allCrawls) {
		const score = scoresByCrawlId.get(crawl.id);
		if (!score) continue;

		const mentions = mentionsByCrawlId.get(crawl.id) ?? [];
		const sources = sourcesByCrawlId.get(crawl.id) ?? [];

		scoredCrawls.push({
			brandId: "target",
			engine: crawl.provider ?? "unknown",
			crawlId: crawl.id,
			completedAt: crawl.completedAt ?? crawl.createdAt,
			mentionScore: score.mentionScore,
			positionScore: score.positionScore,
			citationScore: score.citationScore,
			sentimentScore: score.sentimentScore,
			coMentionScore: score.coMentionScore,
		});

		for (const competitor of competitors) {
			const subScores = computeCompetitorSubScores(
				crawl,
				competitor,
				mentions,
				sources,
			);
			scoredCrawls.push({
				brandId: competitor.id,
				engine: crawl.provider ?? "unknown",
				crawlId: crawl.id,
				completedAt: crawl.completedAt ?? crawl.createdAt,
				...subScores,
			});
		}
	}

	const result = aggregateVisibilityScores(scoredCrawls, "target");

	const crawlsPerEngine = new Map<string, number>();
	for (const crawl of allCrawls) {
		const engine = crawl.provider ?? "unknown";
		crawlsPerEngine.set(engine, (crawlsPerEngine.get(engine) ?? 0) + 1);
	}
	const maxCrawlsPerEngine =
		crawlsPerEngine.size > 0 ? Math.max(...crawlsPerEngine.values()) : 0;

	return {
		perBrandPerEngineScores: result.perBrandPerEngineScores,
		crossEngineScore: result.crossEngineScore,
		trend: result.trend,
		totalCompletedCrawls: allCrawls.length,
		activeCompetitorCount: competitors.length,
		maxCrawlsPerEngine,
	};
};

export const getVisibilityAggregateHandler = async (params: {
	input: z.infer<typeof getVisibilityAggregateInputSchema>;
	ctx: z.infer<typeof getVisibilityAggregateContextSchema>;
}) => {
	return getVisibilityAggregateAction(params);
};
