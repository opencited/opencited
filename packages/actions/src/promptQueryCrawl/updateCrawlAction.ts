import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlSelectSchema,
	promptQueryCrawlTable,
	promptQueryCrawlStatusEnum,
} from "@opencited/db";

export const updateCrawlInputSchema = z.object({
	id: z.string().min(1, "Crawl ID is required"),
	status: promptQueryCrawlStatusEnum.optional(),
	provider: z.string().optional(),
	triggerRunId: z.string().optional(),
	url: z.string().url().optional(),
	title: z.string().optional(),
	content: z.string().optional(),
	loadTimeMs: z.number().int().nonnegative().optional(),
	error: z.string().optional(),
	startedAt: z.date().optional(),
	completedAt: z.date().optional(),
	answerFormat: z.string().optional(),
	wordCount: z.number().int().nonnegative().optional(),
	sourceCount: z.number().int().nonnegative().optional(),
	brandMentionCount: z.number().int().nonnegative().optional(),
	domainProjectId: z.string().optional(),
});

export const updateCrawlOutputSchema = promptQueryCrawlSelectSchema;

export const updateCrawlContextSchema = baseActionContextSchema;

export const updateCrawlAction = async (params: {
	input: z.infer<typeof updateCrawlInputSchema>;
	ctx: z.infer<typeof updateCrawlContextSchema>;
}) => {
	const { input, ctx } = params;

	const { id, ...updateData } = input;

	const result = await ctx.db
		.update(promptQueryCrawlTable)
		.set(updateData)
		.where(eq(promptQueryCrawlTable.id, id))
		.returning();

	if (!result[0]) {
		throw new Error("Crawl not found");
	}

	return result[0];
};

export const updateCrawlHandler = async (params: {
	input: z.infer<typeof updateCrawlInputSchema>;
	ctx: z.infer<typeof updateCrawlContextSchema>;
}) => {
	return updateCrawlAction(params);
};
