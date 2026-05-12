import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlSelectSchema,
	promptQueryCrawlTable,
	promptQueryTable,
} from "@opencited/db";

export const startCrawlInputSchema = z.object({
	promptQueryId: z.string().min(1, "Prompt query is required"),
});

export const startCrawlOutputSchema = promptQueryCrawlSelectSchema;

export const startCrawlContextSchema = baseActionContextSchema;

export const startCrawlAction = async (params: {
	input: z.infer<typeof startCrawlInputSchema>;
	ctx: z.infer<typeof startCrawlContextSchema>;
}) => {
	const { input, ctx } = params;

	// Check for concurrent runs (prevent multiple crawls for same prompt)
	const existingCrawl = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(
			and(
				eq(promptQueryCrawlTable.promptQueryId, input.promptQueryId),
				eq(promptQueryCrawlTable.status, "running"),
			),
		)
		.limit(1);

	if (existingCrawl.length > 0) {
		throw new Error("A crawl is already running for this prompt");
	}

	// Get the prompt query to snapshot the query text
	const promptQuery = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.id, input.promptQueryId))
		.limit(1);

	if (!promptQuery[0]) {
		throw new Error("Prompt query not found");
	}

	// Create crawl record with status "pending"
	const result = await ctx.db
		.insert(promptQueryCrawlTable)
		.values({
			promptQueryId: input.promptQueryId,
			query: promptQuery[0].query,
			status: "pending",
		})
		.returning();

	if (!result[0]) {
		throw new Error("Failed to create crawl record");
	}

	return result[0];
};

export const startCrawlHandler = async (params: {
	input: z.infer<typeof startCrawlInputSchema>;
	ctx: z.infer<typeof startCrawlContextSchema>;
}) => {
	return startCrawlAction(params);
};
