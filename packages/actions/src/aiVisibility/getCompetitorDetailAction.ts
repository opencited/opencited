import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	competitorTable,
	crawlBrandMentionTable,
	crawlSourceTable,
	promptQueryCrawlTable,
	promptQueryTable,
} from "@opencited/db";

export const getCompetitorDetailInputSchema = z.object({
	competitorId: z.string(),
	domainProjectId: z.string(),
});

export const getCompetitorDetailOutputSchema = z.object({
	competitor: z.object({
		id: z.string(),
		name: z.string(),
		domain: z.string(),
	}),
	mentions: z.array(
		z.object({
			query: z.string(),
			queryId: z.string(),
			crawlId: z.string(),
			context: z.string(),
			mentionType: z.string(),
			relativePosition: z.string().nullable(),
			isRecommendation: z.boolean(),
			objection: z.string().nullable(),
			crawlDate: z.date(),
			ownPosition: z.number().nullable(),
			competitorPosition: z.number().nullable(),
		}),
	),
});

export const getCompetitorDetailContextSchema = baseActionContextSchema;

export const getCompetitorDetailAction = async (params: {
	input: z.infer<typeof getCompetitorDetailInputSchema>;
	ctx: z.infer<typeof getCompetitorDetailContextSchema>;
}) => {
	const { input, ctx } = params;

	const competitor = await ctx.db
		.select()
		.from(competitorTable)
		.where(eq(competitorTable.id, input.competitorId))
		.limit(1);

	if (competitor.length === 0) {
		throw new Error("Competitor not found");
	}

	const mentions = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(eq(crawlBrandMentionTable.competitorId, input.competitorId))
		.orderBy(desc(crawlBrandMentionTable.createdAt));

	const mentionResults: z.infer<
		typeof getCompetitorDetailOutputSchema
	>["mentions"] = [];

	for (const mention of mentions) {
		const crawl = await ctx.db
			.select({
				promptQueryId: promptQueryCrawlTable.promptQueryId,
				createdAt: promptQueryCrawlTable.createdAt,
			})
			.from(promptQueryCrawlTable)
			.where(eq(promptQueryCrawlTable.id, mention.crawlId))
			.limit(1);

		if (crawl.length === 0) continue;

		const promptQuery = await ctx.db
			.select()
			.from(promptQueryTable)
			.where(eq(promptQueryTable.id, crawl[0].promptQueryId))
			.limit(1);

		if (promptQuery.length === 0) continue;

		const sources = await ctx.db
			.select()
			.from(crawlSourceTable)
			.where(eq(crawlSourceTable.crawlId, mention.crawlId));

		const ownDomainSource = sources.find(
			(s: typeof crawlSourceTable.$inferSelect) => s.isOwnDomain === "true",
		);
		const competitorSource = sources.find(
			(s: typeof crawlSourceTable.$inferSelect) =>
				s.domain === competitor[0].domain,
		);

		mentionResults.push({
			query: promptQuery[0].query,
			queryId: promptQuery[0].id,
			crawlId: mention.crawlId,
			context: mention.context,
			mentionType: mention.mentionType,
			relativePosition: mention.relativePosition,
			isRecommendation: mention.isRecommendation === "true",
			objection: mention.objection,
			crawlDate: crawl[0].createdAt,
			ownPosition: ownDomainSource?.position ?? null,
			competitorPosition: competitorSource?.position ?? null,
		});
	}

	return {
		competitor: {
			id: competitor[0].id,
			name: competitor[0].name,
			domain: competitor[0].domain,
		},
		mentions: mentionResults,
	};
};

export const getCompetitorDetailHandler = async (params: {
	input: z.infer<typeof getCompetitorDetailInputSchema>;
	ctx: z.infer<typeof getCompetitorDetailContextSchema>;
}) => {
	return getCompetitorDetailAction(params);
};
