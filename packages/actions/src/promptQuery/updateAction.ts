import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQuerySelectSchema,
	promptQueryTable,
	promptQueryInsertSchema,
} from "@opencited/db";

export const updatePromptQueryInputSchema = z.object({
	id: z.string(),
	domainProjectId: z.string(),
	query: promptQueryInsertSchema.shape.query,
});

export const updatePromptQueryOutputSchema = promptQuerySelectSchema;

export const updatePromptQueryContextSchema = baseActionContextSchema;

export const updatePromptQueryAction = async (params: {
	input: z.infer<typeof updatePromptQueryInputSchema>;
	ctx: z.infer<typeof updatePromptQueryContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.update(promptQueryTable)
		.set({
			query: input.query,
		})
		.where(
			and(
				eq(promptQueryTable.id, input.id),
				eq(promptQueryTable.domainProjectId, input.domainProjectId),
			),
		)
		.returning();

	if (!result[0]) {
		throw new Error("Prompt not found");
	}

	return result[0];
};

export const updatePromptQueryHandler = async (params: {
	input: z.infer<typeof updatePromptQueryInputSchema>;
	ctx: z.infer<typeof updatePromptQueryContextSchema>;
}) => {
	return updatePromptQueryAction(params);
};
