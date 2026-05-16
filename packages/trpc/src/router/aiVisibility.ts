import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	listRunLogsHandler,
	listRunLogsInputSchema,
	listRunLogsOutputSchema,
	listCrawlSourcesHandler,
	listCrawlSourcesInputSchema,
	listCrawlSourcesOutputSchema,
	listBrandMentionsHandler,
	listBrandMentionsInputSchema,
	listBrandMentionsOutputSchema,
} from "@opencited/actions";

export const aiVisibilityRouter = createTRPCRouter({
	listRunLogs: publicProcedure
		.input(listRunLogsInputSchema)
		.output(listRunLogsOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return { runs: [], total: 0 };
			}
			return listRunLogsHandler({ ctx, input });
		}),

	listCrawlSources: publicProcedure
		.input(listCrawlSourcesInputSchema)
		.output(listCrawlSourcesOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return listCrawlSourcesHandler({ ctx, input });
		}),

	listBrandMentions: publicProcedure
		.input(listBrandMentionsInputSchema)
		.output(listBrandMentionsOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return listBrandMentionsHandler({ ctx, input });
		}),
});
