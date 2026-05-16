import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { competitorTable, competitorSelectSchema } from "@opencited/db";

export const listCompetitorsInputSchema = z.object({
	domainProjectId: z.string().min(1),
});

export const listCompetitorsOutputSchema = z.array(competitorSelectSchema);

export const listCompetitorsContextSchema = baseActionContextSchema;

export const listCompetitorsAction = async (params: {
	input: z.infer<typeof listCompetitorsInputSchema>;
	ctx: z.infer<typeof listCompetitorsContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(competitorTable)
		.where(eq(competitorTable.domainProjectId, input.domainProjectId));

	return result;
};

export const listCompetitorsHandler = async (params: {
	input: z.infer<typeof listCompetitorsInputSchema>;
	ctx: z.infer<typeof listCompetitorsContextSchema>;
}) => {
	return listCompetitorsAction(params);
};
