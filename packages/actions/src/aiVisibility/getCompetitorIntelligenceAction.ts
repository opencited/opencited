import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { competitorTable, crawlBrandMentionTable } from "@opencited/db";

export const getCompetitorIntelligenceInputSchema = z.object({
	domainProjectId: z.string(),
});

export const getCompetitorIntelligenceOutputSchema = z.array(
	z.object({
		competitorId: z.string(),
		competitorName: z.string(),
		competitorDomain: z.string(),
		mentionedInCount: z.number(),
	}),
);

export const getCompetitorIntelligenceContextSchema = baseActionContextSchema;

type Mention = typeof crawlBrandMentionTable.$inferSelect;
type MentionSelect = {
	id: string;
	crawlId: string;
	competitorId: string | null;
	mentionType: string;
};

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

	if (competitors.length === 0) {
		return [];
	}

	const competitorIds = competitors.map(
		(c: typeof competitorTable.$inferSelect) => c.id,
	);

	const allMentions: MentionSelect[] = await ctx.db
		.select({
			id: crawlBrandMentionTable.id,
			crawlId: crawlBrandMentionTable.crawlId,
			competitorId: crawlBrandMentionTable.competitorId,
			mentionType: crawlBrandMentionTable.mentionType,
		})
		.from(crawlBrandMentionTable)
		.where(
			and(
				inArray(crawlBrandMentionTable.competitorId, competitorIds),
				isNotNull(crawlBrandMentionTable.competitorId),
			),
		);

	const crawlIds: string[] = [...new Set(allMentions.map((m) => m.crawlId))];

	if (crawlIds.length === 0) {
		return competitors.map(
			(competitor: typeof competitorTable.$inferSelect) => ({
				competitorId: competitor.id,
				competitorName: competitor.name,
				competitorDomain: competitor.domain,
				mentionedInCount: 0,
			}),
		);
	}

	const allCrawlMentions = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(inArray(crawlBrandMentionTable.crawlId, crawlIds));

	const crawlMentionsByCrawlId = new Map<string, Mention[]>();
	for (const mention of allCrawlMentions) {
		const existing = crawlMentionsByCrawlId.get(mention.crawlId);
		if (existing) {
			existing.push(mention);
		} else {
			crawlMentionsByCrawlId.set(mention.crawlId, [mention]);
		}
	}

	const mentionsByCompetitorId = new Map<string, MentionSelect[]>();
	for (const mention of allMentions) {
		if (!mention.competitorId) continue;
		const existing = mentionsByCompetitorId.get(mention.competitorId);
		if (existing) {
			existing.push(mention);
		} else {
			mentionsByCompetitorId.set(mention.competitorId, [mention]);
		}
	}

	const results: z.infer<typeof getCompetitorIntelligenceOutputSchema> = [];

	for (const competitor of competitors) {
		const mentions = mentionsByCompetitorId.get(competitor.id) ?? [];
		const mentionedInCount = mentions.length;

		results.push({
			competitorId: competitor.id,
			competitorName: competitor.name,
			competitorDomain: competitor.domain,
			mentionedInCount,
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
