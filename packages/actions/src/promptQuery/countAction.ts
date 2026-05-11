import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { promptQueryTable } from "@opencited/db";

export const countPromptQueryInputSchema = z.object({
	domainProjectId: z.string(),
});

export const countPromptQueryOutputSchema = z.object({
	count: z.number(),
});

export const countPromptQueryContextSchema = baseActionContextSchema;

export const countPromptQueryAction = async (params: {
	input: z.infer<typeof countPromptQueryInputSchema>;
	ctx: z.infer<typeof countPromptQueryContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select({ count: count() })
		.from(promptQueryTable)
		.where(eq(promptQueryTable.domainProjectId, input.domainProjectId));

	return {
		count: result[0]?.count ?? 0,
	};
};

export const countPromptQueryHandler = async (params: {
	input: z.infer<typeof countPromptQueryInputSchema>;
	ctx: z.infer<typeof countPromptQueryContextSchema>;
}) => {
	return countPromptQueryAction(params);
};
