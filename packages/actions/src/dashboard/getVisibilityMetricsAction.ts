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
		})
		.from(crawlBrandMentionTable)
		.where(inArray(crawlBrandMentionTable.crawlId, latestCrawlIds));

	const mentionsByCrawlId = new Map<
		string,
		Array<{ crawlId: string; mentionType: string }>
	>();
	for (const mention of allBrandMentions) {
		const existing = mentionsByCrawlId.get(mention.crawlId) ?? [];
		existing.push(mention);
		mentionsByCrawlId.set(mention.crawlId, existing);
	}

	let citedCount = 0;
	let totalCount = 0;

	for (const crawl of latestCrawlByQuery.values()) {
		totalCount++;

		const brandMentions = mentionsByCrawlId.get(crawl.id) ?? [];
		const targetMentions = brandMentions.filter(
			(m) => m.mentionType === "target",
		);

		if (targetMentions.length > 0) {
			citedCount++;
		}
	}

	return {
		citedInRatio: {
			cited: citedCount,
			total: totalCount,
		},
	};
};

export const getDashboardVisibilityMetricsHandler = async (params: {
	input: z.infer<typeof getDashboardVisibilityMetricsInputSchema>;
	ctx: z.infer<typeof getDashboardVisibilityMetricsContextSchema>;
}) => {
	return getDashboardVisibilityMetricsAction(params);
};
