import { eq, desc, inArray } from "drizzle-orm";
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
			crawlDate: z.date(),
			ownPosition: z.number().nullable(),
			competitorPosition: z.number().nullable(),
		}),
	),
});

export const getCompetitorDetailContextSchema = baseActionContextSchema;

type MentionRow = typeof crawlBrandMentionTable.$inferSelect;
type CrawlRow = {
	id: string;
	promptQueryId: string;
	createdAt: Date;
};
type PromptQueryRow = {
	id: string;
	query: string;
};
type SourceRow = typeof crawlSourceTable.$inferSelect;

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

	const mentions: MentionRow[] = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(eq(crawlBrandMentionTable.competitorId, input.competitorId))
		.orderBy(desc(crawlBrandMentionTable.createdAt));

	if (mentions.length === 0) {
		return {
			competitor: {
				id: competitor[0].id,
				name: competitor[0].name,
				domain: competitor[0].domain,
			},
			mentions: [],
		};
	}

	const crawlIds: string[] = [
		...new Set(mentions.map((m: MentionRow) => m.crawlId)),
	];

	const crawls: CrawlRow[] = await ctx.db
		.select({
			id: promptQueryCrawlTable.id,
			promptQueryId: promptQueryCrawlTable.promptQueryId,
			createdAt: promptQueryCrawlTable.createdAt,
		})
		.from(promptQueryCrawlTable)
		.where(inArray(promptQueryCrawlTable.id, crawlIds));

	const promptQueryIds: string[] = [
		...new Set(crawls.map((c: CrawlRow) => c.promptQueryId)),
	];

	const promptQueries: PromptQueryRow[] = await ctx.db
		.select({
			id: promptQueryTable.id,
			query: promptQueryTable.query,
		})
		.from(promptQueryTable)
		.where(inArray(promptQueryTable.id, promptQueryIds));

	const sources: SourceRow[] = await ctx.db
		.select()
		.from(crawlSourceTable)
		.where(inArray(crawlSourceTable.crawlId, crawlIds));

	const crawlMap = new Map<
		string,
		Pick<CrawlRow, "promptQueryId" | "createdAt">
	>(
		crawls.map((c: CrawlRow) => [
			c.id,
			{ promptQueryId: c.promptQueryId, createdAt: c.createdAt },
		]),
	);

	const promptQueryMap = new Map<string, string>(
		promptQueries.map((pq: PromptQueryRow) => [pq.id, pq.query]),
	);

	const sourcesByCrawlId = new Map<string, SourceRow[]>();
	for (const source of sources) {
		const existing = sourcesByCrawlId.get(source.crawlId) ?? [];
		existing.push(source);
		sourcesByCrawlId.set(source.crawlId, existing);
	}

	const mentionResults: z.infer<
		typeof getCompetitorDetailOutputSchema
	>["mentions"] = [];

	for (const mention of mentions) {
		const crawl = crawlMap.get(mention.crawlId);
		if (!crawl) continue;

		const query = promptQueryMap.get(crawl.promptQueryId);
		if (!query) continue;

		const crawlSources = sourcesByCrawlId.get(mention.crawlId) ?? [];

		const ownDomainSource = crawlSources.find(
			(s: SourceRow) => s.isOwnDomain === true,
		);
		const competitorSource = crawlSources.find(
			(s: SourceRow) => s.domain === competitor[0].domain,
		);

		mentionResults.push({
			query,
			queryId: crawl.promptQueryId,
			crawlId: mention.crawlId,
			context: mention.context,
			mentionType: mention.mentionType,
			crawlDate: crawl.createdAt,
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
