import {
	sitemapCrawlHandler,
	sitemapCrawlInputSchema,
	sitemapCrawlOutputSchema,
	sitemapCreateHandler,
	sitemapCreateInputSchema,
	sitemapCreateOutputSchema,
	sitemapDeleteHandler,
	sitemapDeleteInputSchema,
	sitemapDeleteOutputSchema,
	sitemapGetHandler,
	sitemapGetInputSchema,
	sitemapGetOutputSchema,
	sitemapListHandler,
	sitemapListInputSchema,
	sitemapListOutputSchema,
	sitemapPreviewHandler,
	sitemapPreviewInputSchema,
	sitemapPreviewOutputSchema,
	sitemapUrlAddHandler,
	sitemapUrlAddInputSchema,
	sitemapUrlAddOutputSchema,
	sitemapUrlGetCountHandler,
	sitemapUrlGetCountOutputSchema,
	sitemapUrlListHandler,
	sitemapUrlListInputSchema,
	sitemapUrlListOutputSchema,
} from "@opencited/actions";
import {
	createTRPCRouter,
	orgOnlyProcedure,
	orgProtectedProcedure,
} from "../trpc";

export const sitemapRouter = createTRPCRouter({
	create: orgProtectedProcedure
		.input(sitemapCreateInputSchema)
		.output(sitemapCreateOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapCreateHandler({ input, ctx });
		}),

	get: orgProtectedProcedure
		.input(sitemapGetInputSchema)
		.output(sitemapGetOutputSchema)
		.query(async ({ ctx, input }) => {
			return sitemapGetHandler({ input, ctx });
		}),

	list: orgProtectedProcedure
		.input(sitemapListInputSchema)
		.output(sitemapListOutputSchema)
		.query(async ({ ctx }) => {
			return sitemapListHandler({ input: {}, ctx });
		}),

	delete: orgProtectedProcedure
		.input(sitemapDeleteInputSchema)
		.output(sitemapDeleteOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapDeleteHandler({ input, ctx });
		}),

	addUrl: orgProtectedProcedure
		.input(sitemapUrlAddInputSchema)
		.output(sitemapUrlAddOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapUrlAddHandler({ input, ctx });
		}),

	crawl: orgProtectedProcedure
		.input(sitemapCrawlInputSchema)
		.output(sitemapCrawlOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapCrawlHandler({ input, ctx });
		}),

	preview: orgOnlyProcedure
		.input(sitemapPreviewInputSchema)
		.output(sitemapPreviewOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapPreviewHandler({ input, ctx });
		}),

	listUrls: orgProtectedProcedure
		.input(sitemapUrlListInputSchema)
		.output(sitemapUrlListOutputSchema)
		.query(async ({ ctx, input }) => {
			return sitemapUrlListHandler({ input, ctx });
		}),

	getUrlCount: orgProtectedProcedure
		.output(sitemapUrlGetCountOutputSchema)
		.query(async ({ ctx }) => {
			return sitemapUrlGetCountHandler({ ctx });
		}),
});
