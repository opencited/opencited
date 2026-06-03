import { eq, and, desc, inArray } from "drizzle-orm";
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

type CrawlRow = typeof promptQueryCrawlTable.$inferSelect;
type SourceRow = typeof crawlSourceTable.$inferSelect;
type MentionRow = typeof crawlBrandMentionTable.$inferSelect;

export const getCrawlHistoryAction = async (params: {
	input: z.infer<typeof getCrawlHistoryInputSchema>;
	ctx: z.infer<typeof getCrawlHistoryContextSchema>;
}) => {
	const { input, ctx } = params;

	const crawls: CrawlRow[] = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(
			and(
				eq(promptQueryCrawlTable.promptQueryId, input.promptQueryId),
				eq(promptQueryCrawlTable.domainProjectId, input.domainProjectId),
			),
		)
		.orderBy(desc(promptQueryCrawlTable.createdAt));

	if (crawls.length === 0) {
		return [];
	}

	const crawlIds = crawls.map((c: CrawlRow) => c.id);

	const sources: SourceRow[] = await ctx.db
		.select()
		.from(crawlSourceTable)
		.where(inArray(crawlSourceTable.crawlId, crawlIds));

	const brandMentions: MentionRow[] = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(inArray(crawlBrandMentionTable.crawlId, crawlIds));

	const sourcesByCrawlId = new Map<string, SourceRow[]>();
	for (const source of sources) {
		const existing = sourcesByCrawlId.get(source.crawlId) ?? [];
		existing.push(source);
		sourcesByCrawlId.set(source.crawlId, existing);
	}

	const mentionsByCrawlId = new Map<string, MentionRow[]>();
	for (const mention of brandMentions) {
		const existing = mentionsByCrawlId.get(mention.crawlId) ?? [];
		existing.push(mention);
		mentionsByCrawlId.set(mention.crawlId, existing);
	}

	const results: z.infer<typeof getCrawlHistoryOutputSchema> = [];

	for (const crawl of crawls) {
		const crawlSources = sourcesByCrawlId.get(crawl.id) ?? [];
		const ownDomainSource = crawlSources.find(
			(s: SourceRow) => s.isOwnDomain === "true",
		);
		const cited = !!ownDomainSource;
		const citationPosition = ownDomainSource?.position ?? null;

		const crawlMentions = mentionsByCrawlId.get(crawl.id) ?? [];
		const targetMention = crawlMentions.find(
			(m: MentionRow) => m.mentionType === "target",
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
