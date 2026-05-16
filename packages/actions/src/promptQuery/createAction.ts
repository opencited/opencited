import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryInsertSchema,
	promptQuerySelectSchema,
	promptQueryTable,
} from "@opencited/db";

export const createPromptQueryInputSchema = promptQueryInsertSchema;
export const createPromptQueryOutputSchema = promptQuerySelectSchema;
export const createPromptQueryContextSchema = baseActionContextSchema;

export const createPromptQueryAction = async (params: {
	input: z.infer<typeof createPromptQueryInputSchema>;
	ctx: z.infer<typeof createPromptQueryContextSchema>;
}) => {
	const { input, ctx } = params;

	const words = input.query
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0);
	if (words.length < 10) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Prompt must be at least 50 words",
		});
	}
	if (words.length > 500) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Prompt must not exceed 500 words",
		});
	}

	const result = await ctx.db
		.insert(promptQueryTable)
		.values({
			domainProjectId: input.domainProjectId,
			query: input.query,
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create prompt",
		});
	}

	return result[0];
};

export const createPromptQueryHandler = async (params: {
	input: z.infer<typeof createPromptQueryInputSchema>;
	ctx: z.infer<typeof createPromptQueryContextSchema>;
}) => {
	return createPromptQueryAction(params);
};
