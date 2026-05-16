import type { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	competitorTable,
	competitorSelectSchema,
	competitorInsertSchema,
} from "@opencited/db";

export const createCompetitorInputSchema = competitorInsertSchema.pick({
	domainProjectId: true,
	name: true,
	domain: true,
	active: true,
});

export const createCompetitorOutputSchema = competitorSelectSchema;

export const createCompetitorContextSchema = baseActionContextSchema;

export const createCompetitorAction = async (params: {
	input: z.infer<typeof createCompetitorInputSchema>;
	ctx: z.infer<typeof createCompetitorContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db.insert(competitorTable).values(input).returning();

	if (!result[0]) {
		throw new Error("Failed to create competitor");
	}

	return result[0];
};

export const createCompetitorHandler = async (params: {
	input: z.infer<typeof createCompetitorInputSchema>;
	ctx: z.infer<typeof createCompetitorContextSchema>;
}) => {
	return createCompetitorAction(params);
};
