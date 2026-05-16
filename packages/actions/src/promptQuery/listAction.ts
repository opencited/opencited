import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { promptQuerySelectSchema, promptQueryTable } from "@opencited/db";

export const listPromptQueryInputSchema = z.object({
	domainProjectId: z.string(),
});

export const listPromptQueryOutputSchema = promptQuerySelectSchema.array();

export const listPromptQueryContextSchema = baseActionContextSchema;

export const listPromptQueryAction = async (params: {
	input: z.infer<typeof listPromptQueryInputSchema>;
	ctx: z.infer<typeof listPromptQueryContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.domainProjectId, input.domainProjectId))
		.orderBy(desc(promptQueryTable.createdAt));

	return result;
};

export const listPromptQueryHandler = async (params: {
	input: z.infer<typeof listPromptQueryInputSchema>;
	ctx: z.infer<typeof listPromptQueryContextSchema>;
}) => {
	return listPromptQueryAction(params);
};
