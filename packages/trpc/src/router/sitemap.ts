import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	createSitemapHandler,
	getSitemapHandler,
	listSitemapHandler,
	deleteSitemapHandler,
	addSitemapUrlHandler,
} from "../actions/sitemap";
import { createSitemapInputSchema } from "../actions/sitemap/createAction";
import { getSitemapInputSchema } from "../actions/sitemap/getAction";
import { listSitemapInputSchema } from "../actions/sitemap/listAction";
import { deleteSitemapInputSchema } from "../actions/sitemap/deleteAction";
import { addSitemapUrlInputSchema } from "../actions/sitemap/addUrlAction";

export const sitemapRouter = createTRPCRouter({
	create: publicProcedure
		.input(createSitemapInputSchema)
		.mutation(async ({ ctx, input }) => {
			return createSitemapHandler({ input, ctx });
		}),

	get: publicProcedure
		.input(getSitemapInputSchema)
		.query(async ({ ctx, input }) => {
			return getSitemapHandler({ input, ctx });
		}),

	list: publicProcedure.input(listSitemapInputSchema).query(async ({ ctx }) => {
		return listSitemapHandler({ input: {}, ctx });
	}),

	delete: publicProcedure
		.input(deleteSitemapInputSchema)
		.mutation(async ({ ctx, input }) => {
			return deleteSitemapHandler({ input, ctx });
		}),

	addUrl: publicProcedure
		.input(addSitemapUrlInputSchema)
		.mutation(async ({ ctx, input }) => {
			return addSitemapUrlHandler({ input, ctx });
		}),
});
