import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryTable,
	promptQueryCrawlTable,
	crawlBrandMentionTable,
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
		citationPosition: z.number().nullable(),
		brandMentioned: z.boolean(),
		mentionPosition: z.string().nullable(),
		competitorCount: z.number(),
		trend: z.enum(["up", "down", "same", "new"]),
		previousCitationPosition: z.number().nullable(),
	}),
);

export const getVisibilityOverviewContextSchema = baseActionContextSchema;

type PromptQueryRow = typeof promptQueryTable.$inferSelect;
type CrawlRow = typeof promptQueryCrawlTable.$inferSelect;
type MentionRow = typeof crawlBrandMentionTable.$inferSelect;

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
				citationPosition: null,
				brandMentioned: false,
				mentionPosition: null,
				competitorCount: 0,
				trend: "new" as const,
				previousCitationPosition: null,
			});
			continue;
		}

		const latestCrawl = crawls[0]!;
		const previousCrawl = crawls.length > 1 ? crawls[1] : null;

		const brandMentions = mentionsByCrawlId.get(latestCrawl.id) ?? [];

		const targetMention = brandMentions.find(
			(m: MentionRow) => m.mentionType === "target",
		);
		const cited = !!targetMention;
		const citationPosition =
			targetMention &&
			targetMention.position !== null &&
			targetMention.position >= 0
				? targetMention.position
				: null;

		const competitorMentions = brandMentions.filter(
			(m: MentionRow) => m.mentionType === "competitor",
		);
		const competitorCount = new Set(
			competitorMentions.map((m: MentionRow) => m.competitorId).filter(Boolean),
		).size;

		const brandMentioned = !!targetMention;
		const mentionPosition = targetMention?.relativePosition ?? null;

		let trend: "up" | "down" | "same" | "new" = "new";
		let previousCitationPosition: number | null = null;

		if (previousCrawl) {
			const previousBrandMentions =
				mentionsByCrawlId.get(previousCrawl.id) ?? [];

			const previousTargetMention = previousBrandMentions.find(
				(m: MentionRow) => m.mentionType === "target",
			);
			previousCitationPosition =
				previousTargetMention &&
				previousTargetMention.position !== null &&
				previousTargetMention.position >= 0
					? previousTargetMention.position
					: null;

			if (citationPosition !== null && previousCitationPosition !== null) {
				if (citationPosition < previousCitationPosition) {
					trend = "up";
				} else if (citationPosition > previousCitationPosition) {
					trend = "down";
				} else {
					trend = "same";
				}
			} else if (
				citationPosition !== null &&
				previousCitationPosition === null
			) {
				trend = "up";
			} else if (
				citationPosition === null &&
				previousCitationPosition !== null
			) {
				trend = "down";
			} else {
				trend = "same";
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
			citationPosition,
			brandMentioned,
			mentionPosition,
			competitorCount,
			trend,
			previousCitationPosition,
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
