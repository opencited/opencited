import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryTable,
	promptQueryCrawlTable,
	crawlBrandMentionTable,
} from "@opencited/db";

export const getDashboardVisibilityMetricsInputSchema = z.object({
	domainProjectId: z.string(),
});

export const getDashboardVisibilityMetricsOutputSchema = z.object({
	citedInRatio: z.object({
		cited: z.number(),
		total: z.number(),
	}),
	brandMentionCount: z.number(),
	avgCitationPosition: z.number().nullable(),
	competitorOutrankCount: z.number(),
});

export const getDashboardVisibilityMetricsContextSchema =
	baseActionContextSchema;

export const getDashboardVisibilityMetricsAction = async (params: {
	input: z.infer<typeof getDashboardVisibilityMetricsInputSchema>;
	ctx: z.infer<typeof getDashboardVisibilityMetricsContextSchema>;
}) => {
	const { input, ctx } = params;

	const promptQueries = await ctx.db
		.select({ id: promptQueryTable.id })
		.from(promptQueryTable)
		.where(eq(promptQueryTable.domainProjectId, input.domainProjectId));

	if (promptQueries.length === 0) {
		return {
			citedInRatio: { cited: 0, total: 0 },
			brandMentionCount: 0,
			avgCitationPosition: null,
			competitorOutrankCount: 0,
		};
	}

	const promptQueryIds = promptQueries.map((pq: { id: string }) => pq.id);

	const allCrawls = await ctx.db
		.select({
			id: promptQueryCrawlTable.id,
			promptQueryId: promptQueryCrawlTable.promptQueryId,
			createdAt: promptQueryCrawlTable.createdAt,
		})
		.from(promptQueryCrawlTable)
		.where(inArray(promptQueryCrawlTable.promptQueryId, promptQueryIds));

	if (allCrawls.length === 0) {
		return {
			citedInRatio: { cited: 0, total: 0 },
			brandMentionCount: 0,
			avgCitationPosition: null,
			competitorOutrankCount: 0,
		};
	}

	const latestCrawlByQuery = new Map<string, (typeof allCrawls)[number]>();
	for (const crawl of allCrawls) {
		const existing = latestCrawlByQuery.get(crawl.promptQueryId);
		if (!existing || new Date(crawl.createdAt) > new Date(existing.createdAt)) {
			latestCrawlByQuery.set(crawl.promptQueryId, crawl);
		}
	}

	const latestCrawlIds = Array.from(latestCrawlByQuery.values()).map(
		(c) => c.id,
	);

	const allBrandMentions = await ctx.db
		.select({
			crawlId: crawlBrandMentionTable.crawlId,
			mentionType: crawlBrandMentionTable.mentionType,
			position: crawlBrandMentionTable.position,
		})
		.from(crawlBrandMentionTable)
		.where(inArray(crawlBrandMentionTable.crawlId, latestCrawlIds));

	const mentionsByCrawlId = new Map<
		string,
		Array<{ crawlId: string; mentionType: string; position: number | null }>
	>();
	for (const mention of allBrandMentions) {
		const existing = mentionsByCrawlId.get(mention.crawlId) ?? [];
		existing.push(mention);
		mentionsByCrawlId.set(mention.crawlId, existing);
	}

	let citedCount = 0;
	let totalCount = 0;
	let totalBrandMentions = 0;
	const citationPositions: number[] = [];
	let competitorOutrankCount = 0;

	for (const crawl of latestCrawlByQuery.values()) {
		totalCount++;

		const brandMentions = mentionsByCrawlId.get(crawl.id) ?? [];
		const targetMentions = brandMentions.filter(
			(m) => m.mentionType === "target",
		);
		const competitorMentions = brandMentions.filter(
			(m) => m.mentionType === "competitor",
		);

		if (targetMentions.length > 0) {
			citedCount++;
			for (const tm of targetMentions) {
				if (tm.position !== null && tm.position >= 0) {
					citationPositions.push(tm.position);
				}
			}
		}

		totalBrandMentions += targetMentions.length;

		for (const targetMention of targetMentions) {
			const ownPosition = targetMention.position ?? Infinity;
			for (const compMention of competitorMentions) {
				const compPosition = compMention.position ?? Infinity;
				if (compPosition >= 0 && compPosition < ownPosition) {
					competitorOutrankCount++;
				}
			}
		}
	}

	const avgCitationPosition =
		citationPositions.length > 0
			? Math.round(
					(citationPositions.reduce((sum: number, p: number) => sum + p, 0) /
						citationPositions.length) *
						100,
				) / 100
			: null;

	return {
		citedInRatio: {
			cited: citedCount,
			total: totalCount,
		},
		brandMentionCount: totalBrandMentions,
		avgCitationPosition,
		competitorOutrankCount,
	};
};

export const getDashboardVisibilityMetricsHandler = async (params: {
	input: z.infer<typeof getDashboardVisibilityMetricsInputSchema>;
	ctx: z.infer<typeof getDashboardVisibilityMetricsContextSchema>;
}) => {
	return getDashboardVisibilityMetricsAction(params);
};
