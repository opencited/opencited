import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	crawlVisibilityScoreTable,
	crawlVisibilityScoreSelectSchema,
} from "@opencited/db";

export const getCrawlScoreInputSchema = z.object({
	crawlId: z.string().min(1),
});

export const getCrawlScoreOutputSchema =
	crawlVisibilityScoreSelectSchema.nullable();

export const getCrawlScoreContextSchema = baseActionContextSchema;

export const getCrawlScoreInternal = async (params: {
	input: z.infer<typeof getCrawlScoreInputSchema>;
	ctx: z.infer<typeof getCrawlScoreContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(crawlVisibilityScoreTable)
		.where(eq(crawlVisibilityScoreTable.crawlId, input.crawlId))
		.limit(1);

	return result[0] ?? null;
};

export const getCrawlScoreAction = async (params: {
	input: z.infer<typeof getCrawlScoreInputSchema>;
	ctx: z.infer<typeof getCrawlScoreContextSchema>;
}) => {
	return getCrawlScoreInternal(params);
};

export const getCrawlScoreHandler = async (params: {
	input: z.infer<typeof getCrawlScoreInputSchema>;
	ctx: z.infer<typeof getCrawlScoreContextSchema>;
}) => {
	return getCrawlScoreAction(params);
};
