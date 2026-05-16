import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlTable,
	crawlSourceTable,
	crawlBrandMentionTable,
} from "@opencited/db";

export const getCrawlHistoryInputSchema = z.object({
	promptQueryId: z.string(),
	domainProjectId: z.string(),
});

export const getCrawlHistoryOutputSchema = z.array(
	z.object({
		id: z.string(),
		status: z.string(),
		provider: z.string().nullable(),
		createdAt: z.date(),
		completedAt: z.date().nullable(),
		cited: z.boolean(),
		citationPosition: z.number().nullable(),
		brandMentioned: z.boolean(),
		mentionPosition: z.string().nullable(),
	}),
);

export const getCrawlHistoryContextSchema = baseActionContextSchema;

export const getCrawlHistoryAction = async (params: {
	input: z.infer<typeof getCrawlHistoryInputSchema>;
	ctx: z.infer<typeof getCrawlHistoryContextSchema>;
}) => {
	const { input, ctx } = params;

	const crawls = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(
			and(
				eq(promptQueryCrawlTable.promptQueryId, input.promptQueryId),
				eq(promptQueryCrawlTable.domainProjectId, input.domainProjectId),
			),
		)
		.orderBy(desc(promptQueryCrawlTable.createdAt));

	const results: z.infer<typeof getCrawlHistoryOutputSchema> = [];

	for (const crawl of crawls) {
		const sources = await ctx.db
			.select()
			.from(crawlSourceTable)
			.where(eq(crawlSourceTable.crawlId, crawl.id));

		const ownDomainSource = sources.find(
			(s: typeof crawlSourceTable.$inferSelect) => s.isOwnDomain === "true",
		);
		const cited = !!ownDomainSource;
		const citationPosition = ownDomainSource?.position ?? null;

		const brandMentions = await ctx.db
			.select()
			.from(crawlBrandMentionTable)
			.where(eq(crawlBrandMentionTable.crawlId, crawl.id));

		const targetMention = brandMentions.find(
			(m: typeof crawlBrandMentionTable.$inferSelect) =>
				m.mentionType === "target",
		);
		const brandMentioned = !!targetMention;
		const mentionPosition = targetMention?.relativePosition ?? null;

		results.push({
			id: crawl.id,
			status: crawl.status,
			provider: crawl.provider,
			createdAt: crawl.createdAt,
			completedAt: crawl.completedAt,
			cited,
			citationPosition,
			brandMentioned,
			mentionPosition,
		});
	}

	return results;
};

export const getCrawlHistoryHandler = async (params: {
	input: z.infer<typeof getCrawlHistoryInputSchema>;
	ctx: z.infer<typeof getCrawlHistoryContextSchema>;
}) => {
	return getCrawlHistoryAction(params);
};
