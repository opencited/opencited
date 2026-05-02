import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { start } from "workflow/api";
import { baseActionContextSchema } from "../../trpc";
import { storeCrawlAction } from "./storeCrawlAction";
import { crawlPageWorkflow } from "@opencited/crawler-workflows";
import type { CrawlPageResult } from "@opencited/crawler-workflows";
import { sitemapUrlTable, sitemapTable } from "@opencited/db";

export const triggerSingleCrawlInputSchema = z.object({
	sitemapUrlId: z.string().uuid(),
	url: z.string().url(),
});
export const triggerSingleCrawlOutputSchema = z.object({
	success: z.boolean(),
	crawlStatus: z.string(),
});
export const triggerSingleCrawlContextSchema = baseActionContextSchema;

export const triggerSingleCrawlAction = async (params: {
	input: z.infer<typeof triggerSingleCrawlInputSchema>;
	ctx: z.infer<typeof triggerSingleCrawlContextSchema>;
}) => {
	const { input, ctx } = params;

	const [urlRow] = await ctx.db
		.select({ activeCrawlRunId: sitemapUrlTable.activeCrawlRunId })
		.from(sitemapUrlTable)
		.where(eq(sitemapUrlTable.id, input.sitemapUrlId))
		.limit(1);

	if (urlRow?.activeCrawlRunId) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A crawl is already running for this URL",
		});
	}

	const [sitemapRow] = await ctx.db
		.select({ activeCrawlRunId: sitemapTable.activeCrawlRunId })
		.from(sitemapTable)
		.innerJoin(sitemapUrlTable, eq(sitemapUrlTable.sitemapId, sitemapTable.id))
		.where(eq(sitemapUrlTable.id, input.sitemapUrlId))
		.limit(1);

	if (sitemapRow?.activeCrawlRunId) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A sitemap crawl is in progress — single page crawl is disabled",
		});
	}

	let runId: string | null = null;
	let result: CrawlPageResult;
	try {
		const run = await start(crawlPageWorkflow, [input.url, input.sitemapUrlId]);
		runId = run.runId;

		await ctx.db
			.update(sitemapUrlTable)
			.set({ activeCrawlRunId: runId })
			.where(eq(sitemapUrlTable.id, input.sitemapUrlId));

		result = await run.returnValue;
	} catch (err) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				err instanceof Error ? err.message : "Failed to run crawl workflow",
		});
	}

	try {
		await storeCrawlAction({ input: { results: [result] }, ctx });
	} catch (err) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				err instanceof Error ? err.message : "Failed to store crawl results",
		});
	} finally {
		if (runId) {
			await ctx.db
				.update(sitemapUrlTable)
				.set({ activeCrawlRunId: null })
				.where(eq(sitemapUrlTable.id, input.sitemapUrlId));
		}
	}

	return {
		success: true,
		crawlStatus: result.fetchError
			? "error"
			: result.content
				? "analyzed"
				: "fetched",
	};
};

export const triggerSingleCrawlHandler = async (params: {
	input: z.infer<typeof triggerSingleCrawlInputSchema>;
	ctx: z.infer<typeof triggerSingleCrawlContextSchema>;
}) => {
	return triggerSingleCrawlAction(params);
};
