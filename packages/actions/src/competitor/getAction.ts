import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { competitorTable, competitorSelectSchema } from "@opencited/db";

export const getCompetitorInputSchema = z.object({
	id: z.string().min(1),
});

export const getCompetitorOutputSchema = competitorSelectSchema;

export const getCompetitorContextSchema = baseActionContextSchema;

export const getCompetitorAction = async (params: {
	input: z.infer<typeof getCompetitorInputSchema>;
	ctx: z.infer<typeof getCompetitorContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(competitorTable)
		.where(eq(competitorTable.id, input.id))
		.limit(1);

	if (!result[0]) {
		throw new Error("Competitor not found");
	}

	return result[0];
};

export const getCompetitorHandler = async (params: {
	input: z.infer<typeof getCompetitorInputSchema>;
	ctx: z.infer<typeof getCompetitorContextSchema>;
}) => {
	return getCompetitorAction(params);
};
