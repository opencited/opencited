import { eq, sql, count, avg } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	sitemapTable,
	sitemapUrlTable,
	crawledPageTable,
	pageAnalysisTable,
} from "@opencited/db";

export const getContentHealthMetricsInputSchema = z.object({
	domainProjectId: z.string(),
});

export const getContentHealthMetricsOutputSchema = z.object({
	pagesCrawled: z.number(),
	crawlSuccessRate: z.number().nullable(),
	avgWordCount: z.number().nullable(),
	errorCount: z.number(),
});

export const getContentHealthMetricsContextSchema = baseActionContextSchema;

export const getContentHealthMetricsAction = async (params: {
	input: z.infer<typeof getContentHealthMetricsInputSchema>;
	ctx: z.infer<typeof getContentHealthMetricsContextSchema>;
}) => {
	const { input, ctx } = params;

	const [result] = await ctx.db
		.select({
			totalCount: count(crawledPageTable.id),
			pendingCount: count(
				sql`CASE WHEN ${crawledPageTable.crawlStatus} = 'pending' THEN 1 END`,
			),
			fetchedCount: count(
				sql`CASE WHEN ${crawledPageTable.crawlStatus} = 'fetched' THEN 1 END`,
			),
			analyzedCount: count(
				sql`CASE WHEN ${crawledPageTable.crawlStatus} = 'analyzed' THEN 1 END`,
			),
			errorCount: count(
				sql`CASE WHEN ${crawledPageTable.crawlStatus} = 'error' THEN 1 END`,
			),
			avgWordCount: avg(pageAnalysisTable.wordCount),
		})
		.from(sitemapTable)
		.innerJoin(sitemapUrlTable, eq(sitemapUrlTable.sitemapId, sitemapTable.id))
		.innerJoin(
			crawledPageTable,
			eq(crawledPageTable.sitemapUrlId, sitemapUrlTable.id),
		)
		.leftJoin(
			pageAnalysisTable,
			eq(pageAnalysisTable.crawledPageId, crawledPageTable.id),
		)
		.where(eq(sitemapTable.domainProjectId, input.domainProjectId));

	if (!result || result.totalCount === 0) {
		return {
			pagesCrawled: 0,
			crawlSuccessRate: null,
			avgWordCount: null,
			errorCount: 0,
		};
	}

	const {
		fetchedCount,
		analyzedCount,
		pendingCount,
		errorCount,
		avgWordCount,
	} = result;

	const pagesCrawled = fetchedCount + analyzedCount;
	const attemptedCount = result.totalCount - pendingCount;
	const crawlSuccessRate =
		attemptedCount > 0
			? Math.round(((fetchedCount + analyzedCount) / attemptedCount) * 10000) /
				100
			: null;

	return {
		pagesCrawled,
		crawlSuccessRate,
		avgWordCount: avgWordCount !== null ? Number(avgWordCount) : null,
		errorCount,
	};
};

export const getContentHealthMetricsHandler = async (params: {
	input: z.infer<typeof getContentHealthMetricsInputSchema>;
	ctx: z.infer<typeof getContentHealthMetricsContextSchema>;
}) => {
	return getContentHealthMetricsAction(params);
};
