import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryTable,
	promptQueryCrawlTable,
	crawlBrandMentionTable,
	crawlVisibilityScoreTable,
} from "@opencited/db";

export const getVisibilityOverviewInputSchema = z.object({
	domainProjectId: z.string(),
});

export const getVisibilityOverviewOutputSchema = z.array(
	z.object({
		queryId: z.string(),
		query: z.string(),
		lastChecked: z.date().nullable(),
		totalCrawls: z.number(),
		latestCrawlId: z.string().nullable(),
		latestCrawlStatus: z.string().nullable(),
		cited: z.boolean(),
		competitorCount: z.number(),
		score: z.number().nullable(),
		scoreBreakdown: z
			.object({
				mentionScore: z.number(),
				positionScore: z.number(),
				citationScore: z.number(),
				sentimentScore: z.number(),
				coMentionScore: z.number(),
			})
			.nullable(),
		formulaVersion: z.string().nullable(),
		sampleSize: z.number(),
		sentimentIsFallback: z.boolean(),
	}),
);

export const getVisibilityOverviewContextSchema = baseActionContextSchema;

type PromptQueryRow = typeof promptQueryTable.$inferSelect;
type CrawlRow = typeof promptQueryCrawlTable.$inferSelect;
type MentionRow = typeof crawlBrandMentionTable.$inferSelect;
type ScoreRow = typeof crawlVisibilityScoreTable.$inferSelect;

export const getVisibilityOverviewAction = async (params: {
	input: z.infer<typeof getVisibilityOverviewInputSchema>;
	ctx: z.infer<typeof getVisibilityOverviewContextSchema>;
}) => {
	const { input, ctx } = params;

	const promptQueries: PromptQueryRow[] = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.domainProjectId, input.domainProjectId));

	if (promptQueries.length === 0) {
		return [];
	}

	const queryIds = promptQueries.map((q: PromptQueryRow) => q.id);

	const allCrawls: CrawlRow[] = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(inArray(promptQueryCrawlTable.promptQueryId, queryIds))
		.orderBy(desc(promptQueryCrawlTable.createdAt));

	const crawlsByQueryId = new Map<string, CrawlRow[]>();
	for (const crawl of allCrawls) {
		const existing = crawlsByQueryId.get(crawl.promptQueryId) ?? [];
		existing.push(crawl);
		crawlsByQueryId.set(crawl.promptQueryId, existing);
	}

	const crawlIds = allCrawls.map((c: CrawlRow) => c.id);

	let allBrandMentions: MentionRow[] = [];
	if (crawlIds.length > 0) {
		allBrandMentions = await ctx.db
			.select()
			.from(crawlBrandMentionTable)
			.where(inArray(crawlBrandMentionTable.crawlId, crawlIds));
	}

	const mentionsByCrawlId = new Map<string, MentionRow[]>();
	for (const mention of allBrandMentions) {
		const existing = mentionsByCrawlId.get(mention.crawlId) ?? [];
		existing.push(mention);
		mentionsByCrawlId.set(mention.crawlId, existing);
	}

	let allScores: ScoreRow[] = [];
	if (crawlIds.length > 0) {
		allScores = await ctx.db
			.select()
			.from(crawlVisibilityScoreTable)
			.where(inArray(crawlVisibilityScoreTable.crawlId, crawlIds));
	}

	const scoresByCrawlId = new Map<string, ScoreRow>();
	for (const score of allScores) {
		scoresByCrawlId.set(score.crawlId, score);
	}

	const results: z.infer<typeof getVisibilityOverviewOutputSchema> = [];

	for (const query of promptQueries) {
		const crawls = crawlsByQueryId.get(query.id) ?? [];
		const totalCrawls = crawls.length;

		if (totalCrawls === 0) {
			results.push({
				queryId: query.id,
				query:
					query.query.length > 120
						? `${query.query.slice(0, 120)}...`
						: query.query,
				lastChecked: null,
				totalCrawls: 0,
				latestCrawlId: null,
				latestCrawlStatus: null,
				cited: false,
				competitorCount: 0,
				score: null,
				scoreBreakdown: null,
				formulaVersion: null,
				sampleSize: 0,
				sentimentIsFallback: false,
			});
			continue;
		}

		const latestCrawl = crawls[0]!;

		const brandMentions = mentionsByCrawlId.get(latestCrawl.id) ?? [];

		const targetMention = brandMentions.find(
			(m: MentionRow) => m.mentionType === "target",
		);
		const cited = !!targetMention;

		const competitorMentions = brandMentions.filter(
			(m: MentionRow) => m.mentionType === "competitor",
		);
		const competitorCount = new Set(
			competitorMentions.map((m: MentionRow) => m.competitorId).filter(Boolean),
		).size;

		const successfulCrawls = crawls.filter((c) => c.status === "completed");
		const recentSuccessfulCrawls = successfulCrawls.slice(0, 5);

		let score: number | null = null;
		let scoreBreakdown: {
			mentionScore: number;
			positionScore: number;
			citationScore: number;
			sentimentScore: number;
			coMentionScore: number;
		} | null = null;
		let formulaVersion: string | null = null;
		let sampleSize = 0;
		let sentimentIsFallback = false;

		if (recentSuccessfulCrawls.length >= 3) {
			const scores = recentSuccessfulCrawls
				.map((c) => scoresByCrawlId.get(c.id))
				.filter((s): s is ScoreRow => s !== undefined);

			if (scores.length >= 3) {
				const totalScore = scores.reduce(
					(sum, s) => sum + s.visibilityScore,
					0,
				);
				score = Math.round(totalScore / scores.length);

				const totalMention = scores.reduce((sum, s) => sum + s.mentionScore, 0);
				const totalPosition = scores.reduce(
					(sum, s) => sum + s.positionScore,
					0,
				);
				const totalCitation = scores.reduce(
					(sum, s) => sum + s.citationScore,
					0,
				);
				const totalSentiment = scores.reduce(
					(sum, s) => sum + s.sentimentScore,
					0,
				);
				const totalCoMention = scores.reduce(
					(sum, s) => sum + s.coMentionScore,
					0,
				);

				scoreBreakdown = {
					mentionScore: Math.round(totalMention / scores.length),
					positionScore: Math.round(totalPosition / scores.length),
					citationScore: Math.round(totalCitation / scores.length),
					sentimentScore: Math.round(totalSentiment / scores.length),
					coMentionScore: Math.round(totalCoMention / scores.length),
				};

				formulaVersion = scores[0]?.formulaVersion ?? null;
				sampleSize = scores.length;
				sentimentIsFallback = scores.some((s) => s.sentimentIsFallback);
			}
		}

		results.push({
			queryId: query.id,
			query:
				query.query.length > 120
					? `${query.query.slice(0, 120)}...`
					: query.query,
			lastChecked: latestCrawl.completedAt ?? latestCrawl.createdAt,
			totalCrawls,
			latestCrawlId: latestCrawl.id,
			latestCrawlStatus: latestCrawl.status,
			cited,
			competitorCount,
			score,
			scoreBreakdown,
			formulaVersion,
			sampleSize,
			sentimentIsFallback,
		});
	}

	return results;
};

export const getVisibilityOverviewHandler = async (params: {
	input: z.infer<typeof getVisibilityOverviewInputSchema>;
	ctx: z.infer<typeof getVisibilityOverviewContextSchema>;
}) => {
	return getVisibilityOverviewAction(params);
};
