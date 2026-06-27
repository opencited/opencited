import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
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
	get: orgProtectedProcedure
		.input(crawledPageGetInputSchema)
		.output(crawledPageGetOutputSchema)
		.query(async ({ ctx, input }) => {
			return crawledPageGetHandler({ input, ctx });
		}),

	list: orgProtectedProcedure
		.input(crawledPageListInputSchema)
		.output(crawledPageListOutputSchema)
		.query(async ({ ctx, input }) => {
			return crawledPageListHandler({ input, ctx });
		}),

	reCrawl: orgProtectedProcedure
		.input(crawlRetryPageInputSchema)
		.output(crawlRetryPageOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return crawlRetryPageHandler({ input, ctx });
		}),

	triggerSingleCrawl: orgProtectedProcedure
		.input(crawlTriggerSingleInputSchema)
		.output(crawlTriggerSingleOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return crawlTriggerSingleHandler({ input, ctx });
		}),

	triggerSitemapCrawl: orgProtectedProcedure
		.input(crawlTriggerSitemapInputSchema)
		.output(crawlTriggerSitemapOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return crawlTriggerSitemapHandler({ input, ctx });
		}),
});
