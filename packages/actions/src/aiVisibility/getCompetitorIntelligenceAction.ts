import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	competitorTable,
	crawlBrandMentionTable,
	crawlSourceTable,
	promptQueryCrawlTable,
} from "@opencited/db";

export const getCompetitorIntelligenceInputSchema = z.object({
	domainProjectId: z.string(),
});

export const getCompetitorIntelligenceOutputSchema = z.array(
	z.object({
		competitorId: z.string(),
		competitorName: z.string(),
		competitorDomain: z.string(),
		mentionedInCount: z.number(),
		avgPosition: z.number().nullable(),
		appearsBeforeYouCount: z.number(),
		appearsAfterYouCount: z.number(),
	}),
);

export const getCompetitorIntelligenceContextSchema = baseActionContextSchema;

export const getCompetitorIntelligenceAction = async (params: {
	input: z.infer<typeof getCompetitorIntelligenceInputSchema>;
	ctx: z.infer<typeof getCompetitorIntelligenceContextSchema>;
}) => {
	const { input, ctx } = params;

	const competitors = await ctx.db
		.select()
		.from(competitorTable)
		.where(
			and(
				eq(competitorTable.domainProjectId, input.domainProjectId),
				eq(competitorTable.active, "true"),
			),
		);

	const results: z.infer<typeof getCompetitorIntelligenceOutputSchema> = [];

	for (const competitor of competitors) {
		const mentions = await ctx.db
			.select({
				id: crawlBrandMentionTable.id,
				crawlId: crawlBrandMentionTable.crawlId,
				position: crawlBrandMentionTable.position,
			})
			.from(crawlBrandMentionTable)
			.where(eq(crawlBrandMentionTable.competitorId, competitor.id));

		const mentionedInCount = mentions.length;

		if (mentionedInCount === 0) {
			results.push({
				competitorId: competitor.id,
				competitorName: competitor.name,
				competitorDomain: competitor.domain,
				mentionedInCount: 0,
				avgPosition: null,
				appearsBeforeYouCount: 0,
				appearsAfterYouCount: 0,
			});
			continue;
		}

		const positions = mentions
			.map((m: { position: number | null }) => m.position)
			.filter((p: number | null): p is number => p !== null);
		const avgPosition =
			positions.length > 0
				? positions.reduce((sum: number, p: number) => sum + p, 0) /
					positions.length
				: null;

		let appearsBeforeYouCount = 0;
		let appearsAfterYouCount = 0;

		for (const mention of mentions) {
			const crawl = await ctx.db
				.select()
				.from(promptQueryCrawlTable)
				.where(eq(promptQueryCrawlTable.id, mention.crawlId))
				.limit(1);

			if (crawl.length === 0) continue;

			const sources = await ctx.db
				.select()
				.from(crawlSourceTable)
				.where(eq(crawlSourceTable.crawlId, mention.crawlId));

			const ownDomainSource = sources.find(
				(s: typeof crawlSourceTable.$inferSelect) => s.isOwnDomain === "true",
			);
			const competitorSource = sources.find(
				(s: typeof crawlSourceTable.$inferSelect) =>
					s.domain === competitor.domain,
			);

			if (ownDomainSource && competitorSource) {
				const ownPosition = ownDomainSource.position ?? Infinity;
				const compPosition = competitorSource.position ?? Infinity;

				if (compPosition < ownPosition) {
					appearsBeforeYouCount++;
				} else if (compPosition > ownPosition) {
					appearsAfterYouCount++;
				}
			}
		}

		results.push({
			competitorId: competitor.id,
			competitorName: competitor.name,
			competitorDomain: competitor.domain,
			mentionedInCount,
			avgPosition: avgPosition ? Math.round(avgPosition * 100) / 100 : null,
			appearsBeforeYouCount,
			appearsAfterYouCount,
		});
	}

	return results;
};

export const getCompetitorIntelligenceHandler = async (params: {
	input: z.infer<typeof getCompetitorIntelligenceInputSchema>;
	ctx: z.infer<typeof getCompetitorIntelligenceContextSchema>;
}) => {
	return getCompetitorIntelligenceAction(params);
};
