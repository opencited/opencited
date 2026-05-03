import { createTRPCRouter, publicProcedure } from "../trpc";
import { authProtectedProcedure } from "../procedures/authProtectedProcedure";
import {
	crawledPageGetHandler,
	crawledPageGetInputSchema,
	crawledPageGetOutputSchema,
	crawledPageListHandler,
	crawledPageListInputSchema,
	crawledPageListOutputSchema,
	crawlRetryPageHandler,
	crawlRetryPageInputSchema,
	crawlRetryPageOutputSchema,
	crawlTriggerSingleHandler,
	crawlTriggerSingleInputSchema,
	crawlTriggerSingleOutputSchema,
	crawlTriggerSitemapHandler,
	crawlTriggerSitemapInputSchema,
	crawlTriggerSitemapOutputSchema,
} from "@opencited/actions";

export const crawlRouter = createTRPCRouter({
	get: publicProcedure
		.input(crawledPageGetInputSchema)
		.output(crawledPageGetOutputSchema)
		.query(async ({ ctx, input }) => {
			return crawledPageGetHandler({ input, ctx });
		}),

	list: publicProcedure
		.input(crawledPageListInputSchema)
		.output(crawledPageListOutputSchema)
		.query(async ({ ctx, input }) => {
			return crawledPageListHandler({ input, ctx });
		}),

	reCrawl: publicProcedure
		.input(crawlRetryPageInputSchema)
		.output(crawlRetryPageOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return crawlRetryPageHandler({ input, ctx });
		}),

	triggerSingleCrawl: publicProcedure
		.input(crawlTriggerSingleInputSchema)
		.output(crawlTriggerSingleOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return crawlTriggerSingleHandler({ input, ctx });
		}),

	triggerSitemapCrawl: authProtectedProcedure
		.input(crawlTriggerSitemapInputSchema)
		.output(crawlTriggerSitemapOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return crawlTriggerSitemapHandler({ input, ctx });
		}),
});
