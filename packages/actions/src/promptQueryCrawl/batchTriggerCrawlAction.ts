import {
	crawlProviderEnum,
	promptQueryCrawlTable,
	promptQueryTable,
} from "@opencited/db";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { assertEngineEnabled } from "../answerEngine";
import { baseActionContextSchema } from "../context";

export const batchTriggerCrawlTaskInputSchema = z.object({
	promptQueryIds: z
		.array(z.string().min(1))
		.min(1, "At least one prompt query ID is required"),
	provider: crawlProviderEnum,
});

export const batchTriggerCrawlTaskOutputSchema = z.object({
	crawlIds: z.array(z.string()),
	count: z.number(),
});

export const batchTriggerCrawlTaskContextSchema = baseActionContextSchema;

export const batchTriggerCrawlTaskAction = async (params: {
	input: z.infer<typeof batchTriggerCrawlTaskInputSchema>;
	ctx: z.infer<typeof batchTriggerCrawlTaskContextSchema>;
}) => {
	const { input, ctx } = { ...params };

	await assertEngineEnabled(ctx, input.provider);

	// Fetch all prompt queries
	const promptQueries = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(inArray(promptQueryTable.id, input.promptQueryIds));

	if (promptQueries.length !== input.promptQueryIds.length) {
		throw new Error("Some prompt queries were not found");
	}

	// Latest crawl per prompt for this engine only.
	const existingCrawls = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(
			and(
				inArray(promptQueryCrawlTable.promptQueryId, input.promptQueryIds),
				eq(promptQueryCrawlTable.provider, input.provider),
			),
		)
		.orderBy(desc(promptQueryCrawlTable.createdAt));

	const seenPromptIds = new Set<string>();
	const activePromptIds = new Set<string>();
	for (const crawl of existingCrawls) {
		if (seenPromptIds.has(crawl.promptQueryId)) continue;
		seenPromptIds.add(crawl.promptQueryId);
		if (crawl.status === "running" || crawl.status === "pending") {
			activePromptIds.add(crawl.promptQueryId);
		}
	}

	if (activePromptIds.size > 0) {
		throw new Error(
			`Some prompts already have active crawls: ${Array.from(activePromptIds).join(", ")}`,
		);
	}

	// Create all crawl records
	const crawlRecords = await ctx.db
		.insert(promptQueryCrawlTable)
		.values(
			promptQueries.map((pq: InferSelectModel<typeof promptQueryTable>) => ({
				promptQueryId: pq.id,
				domainProjectId: pq.domainProjectId,
				provider: input.provider,
				query: pq.query,
				status: "pending" as const,
			})),
		)
		.returning();

	return {
		crawlIds: crawlRecords.map(
			(c: InferSelectModel<typeof promptQueryCrawlTable>) => c.id,
		),
		count: crawlRecords.length,
		promptQueries,
	};
};

export const batchTriggerCrawlTaskHandler = async (params: {
	input: z.infer<typeof batchTriggerCrawlTaskInputSchema>;
	ctx: z.infer<typeof batchTriggerCrawlTaskContextSchema>;
}) => {
	return batchTriggerCrawlTaskAction(params);
};
