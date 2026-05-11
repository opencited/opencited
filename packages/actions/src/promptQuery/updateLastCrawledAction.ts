import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { promptQuerySelectSchema, promptQueryTable } from "@opencited/db";

export const updateLastCrawledInputSchema = z.object({
	id: z.string(),
});

export const updateLastCrawledOutputSchema = promptQuerySelectSchema;

export const updateLastCrawledContextSchema = baseActionContextSchema;

export const updateLastCrawledAction = async (params: {
	input: z.infer<typeof updateLastCrawledInputSchema>;
	ctx: z.infer<typeof updateLastCrawledContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.update(promptQueryTable)
		.set({
			lastCrawledAt: new Date(),
		})
		.where(eq(promptQueryTable.id, input.id))
		.returning();

	if (!result[0]) {
		throw new Error("Prompt not found");
	}

	return result[0];
};

export const updateLastCrawledHandler = async (params: {
	input: z.infer<typeof updateLastCrawledInputSchema>;
	ctx: z.infer<typeof updateLastCrawledContextSchema>;
}) => {
	return updateLastCrawledAction(params);
};
