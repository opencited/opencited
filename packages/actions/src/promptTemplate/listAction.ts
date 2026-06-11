import { desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { promptTemplateSelectSchema, promptTemplateTable } from "@opencited/db";

export const listPromptTemplateInputSchema = z.object({}).optional();

export const listPromptTemplateOutputSchema =
	promptTemplateSelectSchema.array();

export const listPromptTemplateContextSchema = baseActionContextSchema;

export const listPromptTemplateAction = async (params: {
	input?: z.infer<typeof listPromptTemplateInputSchema>;
	ctx: z.infer<typeof listPromptTemplateContextSchema>;
}) => {
	const { ctx } = params;

	const result = await ctx.db
		.select()
		.from(promptTemplateTable)
		.orderBy(desc(promptTemplateTable.createdAt));

	return result;
};

export const listPromptTemplateHandler = async (params: {
	input?: z.infer<typeof listPromptTemplateInputSchema>;
	ctx: z.infer<typeof listPromptTemplateContextSchema>;
}) => {
	return listPromptTemplateAction(params);
};
