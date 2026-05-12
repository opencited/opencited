import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlSelectSchema,
	promptQueryCrawlTable,
} from "@opencited/db";

export const getCrawlInputSchema = z.object({
	id: z.string().min(1, "Crawl ID is required"),
});

export const getCrawlOutputSchema = promptQueryCrawlSelectSchema.nullable();

export const getCrawlContextSchema = baseActionContextSchema;

export const getCrawlAction = async (params: {
	input: z.infer<typeof getCrawlInputSchema>;
	ctx: z.infer<typeof getCrawlContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.id, input.id))
		.limit(1);

	return result[0] ?? null;
};

export const getCrawlHandler = async (params: {
	input: z.infer<typeof getCrawlInputSchema>;
	ctx: z.infer<typeof getCrawlContextSchema>;
}) => {
	return getCrawlAction(params);
};
