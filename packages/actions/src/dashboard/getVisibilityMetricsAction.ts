import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryTable,
	promptQueryCrawlTable,
	crawlSourceTable,
	crawlBrandMentionTable,
	competitorTable,
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
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.domainProjectId, input.domainProjectId));

	let citedCount = 0;
	let totalCount = 0;
	let totalBrandMentions = 0;
	const citationPositions: number[] = [];
	let competitorOutrankCount = 0;

	for (const query of promptQueries) {
		const crawls = await ctx.db
			.select()
			.from(promptQueryCrawlTable)
			.where(eq(promptQueryCrawlTable.promptQueryId, query.id))
			.orderBy(desc(promptQueryCrawlTable.createdAt))
			.limit(1);

		if (crawls.length === 0) continue;

		const latestCrawl = crawls[0];
		totalCount++;

		const sources = await ctx.db
			.select()
			.from(crawlSourceTable)
			.where(eq(crawlSourceTable.crawlId, latestCrawl.id));

		const ownDomainSource = sources.find(
			(s: typeof crawlSourceTable.$inferSelect) => s.isOwnDomain === "true",
		);
		if (ownDomainSource) {
			citedCount++;
			if (ownDomainSource.position !== null) {
				citationPositions.push(ownDomainSource.position);
			}
		}

		const brandMentions = await ctx.db
			.select()
			.from(crawlBrandMentionTable)
			.where(
				and(
					eq(crawlBrandMentionTable.crawlId, latestCrawl.id),
					eq(crawlBrandMentionTable.mentionType, "target"),
				),
			);

		totalBrandMentions += brandMentions.length;

		const competitors = await ctx.db
			.select()
			.from(competitorTable)
			.where(eq(competitorTable.domainProjectId, input.domainProjectId));

		for (const competitor of competitors) {
			const competitorSource = sources.find(
				(s: typeof crawlSourceTable.$inferSelect) =>
					s.domain === competitor.domain,
			);
			if (competitorSource && ownDomainSource) {
				const compPosition = competitorSource.position ?? Infinity;
				const ownPosition = ownDomainSource.position ?? Infinity;
				if (compPosition < ownPosition) {
					competitorOutrankCount++;
				}
			} else if (competitorSource && !ownDomainSource) {
				competitorOutrankCount++;
			}
		}
	}

	const avgCitationPosition =
		citationPositions.length > 0
			? Math.round(
					(citationPositions.reduce((sum, p) => sum + p, 0) /
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
