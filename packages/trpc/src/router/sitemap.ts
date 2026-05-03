import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	sitemapCreateHandler,
	sitemapGetHandler,
	sitemapListHandler,
	sitemapDeleteHandler,
	sitemapUrlAddHandler,
	sitemapCrawlHandler,
	sitemapPreviewHandler,
	sitemapUrlListHandler,
	sitemapUrlGetCountHandler,
	sitemapCreateInputSchema,
	sitemapCreateOutputSchema,
	sitemapGetInputSchema,
	sitemapGetOutputSchema,
	sitemapListInputSchema,
	sitemapListOutputSchema,
	sitemapDeleteInputSchema,
	sitemapDeleteOutputSchema,
	sitemapUrlAddInputSchema,
	sitemapUrlAddOutputSchema,
	sitemapCrawlInputSchema,
	sitemapCrawlOutputSchema,
	sitemapPreviewInputSchema,
	sitemapPreviewOutputSchema,
	sitemapUrlListInputSchema,
	sitemapUrlListOutputSchema,
	sitemapUrlGetCountOutputSchema,
} from "@opencited/actions";

export const sitemapRouter = createTRPCRouter({
	create: publicProcedure
		.input(sitemapCreateInputSchema)
		.output(sitemapCreateOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapCreateHandler({ input, ctx });
		}),

	get: publicProcedure
		.input(sitemapGetInputSchema)
		.output(sitemapGetOutputSchema)
		.query(async ({ ctx, input }) => {
			return sitemapGetHandler({ input, ctx });
		}),

	list: publicProcedure
		.input(sitemapListInputSchema)
		.output(sitemapListOutputSchema)
		.query(async ({ ctx }) => {
			return sitemapListHandler({ input: {}, ctx });
		}),

	delete: publicProcedure
		.input(sitemapDeleteInputSchema)
		.output(sitemapDeleteOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapDeleteHandler({ input, ctx });
		}),

	addUrl: publicProcedure
		.input(sitemapUrlAddInputSchema)
		.output(sitemapUrlAddOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapUrlAddHandler({ input, ctx });
		}),

	crawl: publicProcedure
		.input(sitemapCrawlInputSchema)
		.output(sitemapCrawlOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapCrawlHandler({ input, ctx });
		}),

	preview: publicProcedure
		.input(sitemapPreviewInputSchema)
		.output(sitemapPreviewOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return sitemapPreviewHandler({ input, ctx });
		}),

	listUrls: publicProcedure
		.input(sitemapUrlListInputSchema)
		.output(sitemapUrlListOutputSchema)
		.query(async ({ ctx, input }) => {
			return sitemapUrlListHandler({ input, ctx });
		}),

	getUrlCount: publicProcedure
		.output(sitemapUrlGetCountOutputSchema)
		.query(async ({ ctx }) => {
			return sitemapUrlGetCountHandler({ ctx });
		}),
});
