import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { dispatch } from "@opencited/queue";
import {
	listCrawlsHandler,
	listCrawlsInputSchema,
	listCrawlsOutputSchema,
	getCrawlHandler,
	getCrawlInputSchema,
	getCrawlOutputSchema,
	updateCrawlHandler,
	updateCrawlInputSchema,
	updateCrawlOutputSchema,
	triggerCrawlTaskHandler,
	triggerCrawlTaskOutputSchema,
	saveCrawlResultHandler,
	saveCrawlResultInputSchema,
	saveCrawlResultOutputSchema,
	failCrawlHandler,
	failCrawlInputSchema,
	failCrawlOutputSchema,
	triggerCrawlTaskInputSchema,
} from "@opencited/actions";

export const promptQueryCrawlRouter = createTRPCRouter({
	start: publicProcedure
		.input(triggerCrawlTaskInputSchema)
		.output(triggerCrawlTaskOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}

			// Create crawl record and get query text
			const { crawlId, query, domainProjectId, provider } =
				await triggerCrawlTaskHandler({
					input,
					ctx,
				});

			const { jobId } = await dispatch("perplexity-crawl", {
				query,
				promptQueryId: input.promptQueryId,
				promptQueryCrawlId: crawlId,
				domainProjectId,
				provider,
			});

			await updateCrawlHandler({
				input: {
					id: crawlId,
					triggerRunId: jobId,
					status: "running",
					startedAt: new Date(),
				},
				ctx,
			});

			return {
				crawlId,
				runId: jobId,
				provider,
			};
		}),

	saveResult: publicProcedure
		.input(saveCrawlResultInputSchema)
		.output(saveCrawlResultOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return saveCrawlResultHandler({ ctx, input });
		}),

	failCrawl: publicProcedure
		.input(failCrawlInputSchema)
		.output(failCrawlOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return failCrawlHandler({ ctx, input });
		}),

	list: publicProcedure
		.input(listCrawlsInputSchema)
		.output(listCrawlsOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return [];
			}
			return listCrawlsHandler({ ctx, input });
		}),

	get: publicProcedure
		.input(getCrawlInputSchema)
		.output(getCrawlOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return getCrawlHandler({ ctx, input });
		}),

	update: publicProcedure
		.input(updateCrawlInputSchema)
		.output(updateCrawlOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return updateCrawlHandler({ ctx, input });
		}),
});
