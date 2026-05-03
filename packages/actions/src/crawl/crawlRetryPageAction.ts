import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { crawledPageTable } from "@opencited/db";

export const crawlRetryPageInputSchema = z.object({
	sitemapUrlId: z.string().uuid(),
});
export const crawlRetryPageOutputSchema = z.object({
	triggered: z.boolean(),
});
export const crawlRetryPageContextSchema = baseActionContextSchema;

export const crawlRetryPageAction = async (params: {
	input: z.infer<typeof crawlRetryPageInputSchema>;
	ctx: z.infer<typeof crawlRetryPageContextSchema>;
}) => {
	const { input, ctx } = params;

	const existing = await ctx.db
		.select({ id: crawledPageTable.id })
		.from(crawledPageTable)
		.where(eq(crawledPageTable.sitemapUrlId, input.sitemapUrlId))
		.limit(1);

	if (existing.length === 0) {
		return { triggered: false };
	}

	await ctx.db
		.update(crawledPageTable)
		.set({ crawlStatus: "pending" })
		.where(eq(crawledPageTable.id, existing[0]?.id));

	return { triggered: true };
};

export const crawlRetryPageHandler = async (params: {
	input: z.infer<typeof crawlRetryPageInputSchema>;
	ctx: z.infer<typeof crawlRetryPageContextSchema>;
}) => {
	return crawlRetryPageAction(params);
};
