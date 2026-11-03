import {
	batchTriggerCrawlTaskHandler,
	batchTriggerCrawlTaskInputSchema,
	batchTriggerCrawlTaskOutputSchema,
	failCrawlHandler,
	failCrawlInputSchema,
	failCrawlOutputSchema,
	getCrawlHandler,
	getCrawlInputSchema,
	getCrawlOutputSchema,
	listCrawlsHandler,
	listCrawlsInputSchema,
	listCrawlsOutputSchema,
	saveCrawlResultHandler,
	saveCrawlResultInputSchema,
	saveCrawlResultOutputSchema,
	triggerCrawlTaskHandler,
	triggerCrawlTaskInputSchema,
	triggerCrawlTaskOutputSchema,
	recordCrawlDispatchHandler,
	updateCrawlHandler,
	updateCrawlInputSchema,
	updateCrawlOutputSchema,
} from "@opencited/actions";
import { dispatchCrawlJob } from "@opencited/queue";
import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
import { rethrowEngineDisabled } from "./answerEngine";

export const promptQueryCrawlRouter = createTRPCRouter({
	start: orgProtectedProcedure
		.input(triggerCrawlTaskInputSchema)
		.output(triggerCrawlTaskOutputSchema)
		.mutation(async ({ ctx, input }) => {
			// Create crawl record and get query text
			const { crawlId, query, domainProjectId, provider } =
				await triggerCrawlTaskHandler({
					input,
					ctx,
				}).catch(rethrowEngineDisabled);

			const { jobId } = await dispatchCrawlJob(provider, {
				query,
				promptQueryId: input.promptQueryId,
				promptQueryCrawlId: crawlId,
				domainProjectId,
				provider,
			});

			await recordCrawlDispatchHandler({
				input: {
					id: crawlId,
					triggerRunId: jobId,
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

	saveResult: orgProtectedProcedure
		.input(saveCrawlResultInputSchema)
		.output(saveCrawlResultOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return saveCrawlResultHandler({ ctx, input });
		}),

	failCrawl: orgProtectedProcedure
		.input(failCrawlInputSchema)
		.output(failCrawlOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return failCrawlHandler({ ctx, input });
		}),

	list: orgProtectedProcedure
		.input(listCrawlsInputSchema)
		.output(listCrawlsOutputSchema)
		.query(async ({ ctx, input }) => {
			return listCrawlsHandler({ ctx, input });
		}),

	get: orgProtectedProcedure
		.input(getCrawlInputSchema)
		.output(getCrawlOutputSchema)
		.query(async ({ ctx, input }) => {
			return getCrawlHandler({ ctx, input });
		}),

	update: orgProtectedProcedure
		.input(updateCrawlInputSchema)
		.output(updateCrawlOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return updateCrawlHandler({ ctx, input });
		}),

	batchStart: orgProtectedProcedure
		.input(batchTriggerCrawlTaskInputSchema)
		.output(batchTriggerCrawlTaskOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { crawlIds, promptQueries } = await batchTriggerCrawlTaskHandler({
				input,
				ctx,
			}).catch(rethrowEngineDisabled);

			// Dispatch all jobs
			const jobResults = await Promise.all(
				crawlIds.map(async (crawlId: string, index: number) => {
					const promptQuery = promptQueries[index];
					if (!promptQuery) {
						throw new Error("Prompt query not found");
					}

					const { jobId } = await dispatchCrawlJob(input.provider, {
						query: promptQuery.query,
						promptQueryId: promptQuery.id,
						promptQueryCrawlId: crawlId,
						domainProjectId: promptQuery.domainProjectId,
						provider: input.provider,
					});

					await recordCrawlDispatchHandler({
						input: {
							id: crawlId,
							triggerRunId: jobId,
							startedAt: new Date(),
						},
						ctx,
					});

					return { crawlId, jobId };
				}),
			);

			return {
				crawlIds: jobResults.map((r) => r.crawlId),
				count: jobResults.length,
			};
		}),
});
