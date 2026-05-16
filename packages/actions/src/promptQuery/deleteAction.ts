import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseActionContextSchema } from "../context";
import { promptQuerySelectSchema, promptQueryTable } from "@opencited/db";

export const deletePromptQueryInputSchema = z.object({
	id: z.string(),
	domainProjectId: z.string(),
});

export const deletePromptQueryOutputSchema = promptQuerySelectSchema.nullable();

export const deletePromptQueryContextSchema = baseActionContextSchema;

export const deletePromptQueryAction = async (params: {
	input: z.infer<typeof deletePromptQueryInputSchema>;
	ctx: z.infer<typeof deletePromptQueryContextSchema>;
}) => {
	const { input, ctx } = params;

	const existing = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(
			and(
				eq(promptQueryTable.id, input.id),
				eq(promptQueryTable.domainProjectId, input.domainProjectId),
			),
		)
		.limit(1);

	if (!existing[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Prompt not found",
		});
	}

	const result = await ctx.db
		.delete(promptQueryTable)
		.where(eq(promptQueryTable.id, input.id))
		.returning();

	return result[0] ?? null;
};

export const deletePromptQueryHandler = async (params: {
	input: z.infer<typeof deletePromptQueryInputSchema>;
	ctx: z.infer<typeof deletePromptQueryContextSchema>;
}) => {
	return deletePromptQueryAction(params);
};
