import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { competitorTable, competitorSelectSchema } from "@opencited/db";

export const deleteCompetitorInputSchema = z.object({
	id: z.string().min(1),
});

export const deleteCompetitorOutputSchema = competitorSelectSchema;

export const deleteCompetitorContextSchema = baseActionContextSchema;

export const deleteCompetitorAction = async (params: {
	input: z.infer<typeof deleteCompetitorInputSchema>;
	ctx: z.infer<typeof deleteCompetitorContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.delete(competitorTable)
		.where(eq(competitorTable.id, input.id))
		.returning();

	if (!result[0]) {
		throw new Error("Competitor not found");
	}

	return result[0];
};

export const deleteCompetitorHandler = async (params: {
	input: z.infer<typeof deleteCompetitorInputSchema>;
	ctx: z.infer<typeof deleteCompetitorContextSchema>;
}) => {
	return deleteCompetitorAction(params);
};
