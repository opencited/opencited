import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	competitorTable,
	competitorSelectSchema,
	competitorUpdateSchema,
} from "@opencited/db";

export const updateCompetitorInputSchema = competitorUpdateSchema.extend({
	id: z.string().min(1),
});

export const updateCompetitorOutputSchema = competitorSelectSchema;

export const updateCompetitorContextSchema = baseActionContextSchema;

export const updateCompetitorAction = async (params: {
	input: z.infer<typeof updateCompetitorInputSchema>;
	ctx: z.infer<typeof updateCompetitorContextSchema>;
}) => {
	const { input, ctx } = params;

	const { id, ...updateData } = input;

	const result = await ctx.db
		.update(competitorTable)
		.set(updateData)
		.where(eq(competitorTable.id, id))
		.returning();

	if (!result[0]) {
		throw new Error("Competitor not found");
	}

	return result[0];
};

export const updateCompetitorHandler = async (params: {
	input: z.infer<typeof updateCompetitorInputSchema>;
	ctx: z.infer<typeof updateCompetitorContextSchema>;
}) => {
	return updateCompetitorAction(params);
};
