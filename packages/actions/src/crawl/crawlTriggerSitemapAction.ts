import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { start } from "workflow/api";
import { baseActionContextSchema } from "../context";
import { sitemapUrlListAction } from "../sitemap/sitemapUrlListAction";
import {
	crawlSitemapWorkflow,
	type CrawlSitemapResult,
} from "./workflows/crawl-sitemap";
import { sitemapTable } from "@opencited/db";

export const crawlTriggerSitemapInputSchema = z.object({
	sitemapId: z.string().uuid(),
});
export const crawlTriggerSitemapOutputSchema = z.object({
	success: z.boolean(),
	total: z.number(),
	succeeded: z.number(),
	failed: z.number(),
});
export const crawlTriggerSitemapContextSchema = baseActionContextSchema;

export const crawlTriggerSitemapAction = async (params: {
	input: z.infer<typeof crawlTriggerSitemapInputSchema>;
	ctx: z.infer<typeof crawlTriggerSitemapContextSchema>;
}) => {
	const { input, ctx } = params;

	const [sitemap] = await ctx.db
		.select({ activeCrawlRunId: sitemapTable.activeCrawlRunId })
		.from(sitemapTable)
		.where(eq(sitemapTable.id, input.sitemapId))
		.limit(1);

	if (sitemap?.activeCrawlRunId) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A crawl is already running for this sitemap",
		});
	}

	let sitemapUrls: Awaited<ReturnType<typeof sitemapUrlListAction>>;
	try {
		sitemapUrls = await sitemapUrlListAction({
			input: { sitemapId: input.sitemapId },
			ctx,
		});
	} catch (err) {
		if (err instanceof TRPCError && err.code === "NOT_FOUND") {
			throw err;
		}
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				err instanceof Error ? err.message : "Failed to list sitemap URLs",
		});
	}

	if (sitemapUrls.urls.length === 0) {
		return { success: true, total: 0, succeeded: 0, failed: 0 };
	}

	const items = sitemapUrls.urls.map((url: any) => ({
		url: url.url,
		sitemapUrlId: url.id,
	}));

	let runId: string | null = null;
	let workflowResult: CrawlSitemapResult;
	try {
		const run = await start(crawlSitemapWorkflow, [input.sitemapId, items]);
		runId = run.runId;

		await ctx.db
			.update(sitemapTable)
			.set({ activeCrawlRunId: runId })
			.where(eq(sitemapTable.id, input.sitemapId));

		workflowResult = await run.returnValue;
	} catch (err) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				err instanceof Error
					? err.message
					: "Failed to run sitemap crawl workflow",
		});
	} finally {
		if (runId) {
			await ctx.db
				.update(sitemapTable)
				.set({ activeCrawlRunId: null })
				.where(eq(sitemapTable.id, input.sitemapId));
		}
	}

	return {
		success: true,
		total: workflowResult.total,
		succeeded: workflowResult.succeeded,
		failed: workflowResult.failed,
	};
};

export const crawlTriggerSitemapHandler = async (params: {
	input: z.infer<typeof crawlTriggerSitemapInputSchema>;
	ctx: z.infer<typeof crawlTriggerSitemapContextSchema>;
}) => {
	return crawlTriggerSitemapAction(params);
};
