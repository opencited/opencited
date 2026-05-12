import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlSelectSchema,
	promptQueryCrawlTable,
	promptQueryTable,
} from "@opencited/db";

export const triggerCrawlTaskInputSchema = z.object({
	promptQueryId: z.string().min(1, "Prompt query is required"),
});

export const triggerCrawlTaskOutputSchema = z.object({
	crawlId: z.string(),
	runId: z.string(),
});

export const triggerCrawlTaskContextSchema = baseActionContextSchema;

export const triggerCrawlTaskAction = async (params: {
	input: z.infer<typeof triggerCrawlTaskInputSchema>;
	ctx: z.infer<typeof triggerCrawlTaskContextSchema>;
}) => {
	const { input, ctx } = params;

	// Check for concurrent runs
	const existingCrawl = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.promptQueryId, input.promptQueryId))
		.orderBy(desc(promptQueryCrawlTable.createdAt))
		.limit(1);

	if (
		existingCrawl[0]?.status === "running" ||
		existingCrawl[0]?.status === "pending"
	) {
		throw new Error("A crawl is already running for this prompt");
	}

	// Get the prompt query
	const promptQuery = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.id, input.promptQueryId))
		.limit(1);

	if (!promptQuery[0]) {
		throw new Error("Prompt query not found");
	}

	// Create crawl record with status "pending"
	const crawlRecord = await ctx.db
		.insert(promptQueryCrawlTable)
		.values({
			promptQueryId: input.promptQueryId,
			query: promptQuery[0].query,
			status: "pending",
		})
		.returning();

	if (!crawlRecord[0]) {
		throw new Error("Failed to create crawl record");
	}

	return {
		crawlId: crawlRecord[0].id,
		query: promptQuery[0].query,
	};
};

export const triggerCrawlTaskHandler = async (params: {
	input: z.infer<typeof triggerCrawlTaskInputSchema>;
	ctx: z.infer<typeof triggerCrawlTaskContextSchema>;
}) => {
	return triggerCrawlTaskAction(params);
};

export const saveCrawlResultInputSchema = z.object({
	crawlId: z.string().min(1, "Crawl ID is required"),
	provider: z.string(),
	content: z.string(),
	url: z.string().url(),
	title: z.string(),
	loadTimeMs: z.number().int().nonnegative(),
	timestamp: z.string(),
	promptQueryId: z.string(),
});

export const saveCrawlResultOutputSchema = promptQueryCrawlSelectSchema;

export const saveCrawlResultContextSchema = baseActionContextSchema;

export const saveCrawlResultAction = async (params: {
	input: z.infer<typeof saveCrawlResultInputSchema>;
	ctx: z.infer<typeof saveCrawlResultContextSchema>;
}) => {
	const { input, ctx } = params;

	const now = new Date();

	// Update crawl record with results
	const result = await ctx.db
		.update(promptQueryCrawlTable)
		.set({
			status: "completed",
			provider: input.provider,
			content: input.content,
			url: input.url,
			title: input.title,
			loadTimeMs: input.loadTimeMs,
			completedAt: now,
		})
		.where(eq(promptQueryCrawlTable.id, input.crawlId))
		.returning();

	if (!result[0]) {
		throw new Error("Crawl record not found");
	}

	// Update promptQuery.lastCrawledAt
	await ctx.db
		.update(promptQueryTable)
		.set({
			lastCrawledAt: now,
		})
		.where(eq(promptQueryTable.id, input.promptQueryId));

	return result[0];
};

export const saveCrawlResultHandler = async (params: {
	input: z.infer<typeof saveCrawlResultInputSchema>;
	ctx: z.infer<typeof saveCrawlResultContextSchema>;
}) => {
	return saveCrawlResultAction(params);
};

export const failCrawlInputSchema = z.object({
	crawlId: z.string().min(1, "Crawl ID is required"),
	error: z.string(),
	promptQueryId: z.string(),
});

export const failCrawlOutputSchema = promptQueryCrawlSelectSchema;

export const failCrawlContextSchema = baseActionContextSchema;

export const failCrawlAction = async (params: {
	input: z.infer<typeof failCrawlInputSchema>;
	ctx: z.infer<typeof failCrawlContextSchema>;
}) => {
	const { input, ctx } = params;

	const now = new Date();

	// Update crawl record with error
	const result = await ctx.db
		.update(promptQueryCrawlTable)
		.set({
			status: "failed",
			error: input.error,
			completedAt: now,
		})
		.where(eq(promptQueryCrawlTable.id, input.crawlId))
		.returning();

	if (!result[0]) {
		throw new Error("Crawl record not found");
	}

	return result[0];
};

export const failCrawlHandler = async (params: {
	input: z.infer<typeof failCrawlInputSchema>;
	ctx: z.infer<typeof failCrawlContextSchema>;
}) => {
	return failCrawlAction(params);
};
