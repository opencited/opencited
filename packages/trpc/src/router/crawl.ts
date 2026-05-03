import { createTRPCRouter, publicProcedure } from "../trpc";
import { authProtectedProcedure } from "../procedures/authProtectedProcedure";
import {
	getCrawledPageHandler,
	getCrawledPageInputSchema,
	listCrawledPagesHandler,
	listCrawledPagesInputSchema,
	reCrawlPageHandler,
	reCrawlPageInputSchema,
	triggerSingleCrawlHandler,
	triggerSingleCrawlInputSchema,
	triggerSitemapCrawlHandler,
	triggerSitemapCrawlInputSchema,
} from "../actions/crawl";

export const crawlRouter = createTRPCRouter({
	get: publicProcedure
		.input(getCrawledPageInputSchema)
		.query(async ({ ctx, input }) => {
			return getCrawledPageHandler({ input, ctx });
		}),

	list: publicProcedure
		.input(listCrawledPagesInputSchema)
		.query(async ({ ctx, input }) => {
			return listCrawledPagesHandler({ input, ctx });
		}),

	reCrawl: publicProcedure
		.input(reCrawlPageInputSchema)
		.mutation(async ({ ctx, input }) => {
			return reCrawlPageHandler({ input, ctx });
		}),

	triggerSingleCrawl: publicProcedure
		.input(triggerSingleCrawlInputSchema)
		.mutation(async ({ ctx, input }) => {
			return triggerSingleCrawlHandler({ input, ctx });
		}),

	triggerSitemapCrawl: authProtectedProcedure
		.input(triggerSitemapCrawlInputSchema)
		.mutation(async ({ ctx, input }) => {
			return triggerSitemapCrawlHandler({ input, ctx });
		}),
});
