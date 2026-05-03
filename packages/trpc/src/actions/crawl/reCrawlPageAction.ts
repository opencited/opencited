import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { crawledPageTable } from "@opencited/db";

export const reCrawlPageInputSchema = z.object({
	sitemapUrlId: z.string().uuid(),
});
export const reCrawlPageOutputSchema = z.object({
	triggered: z.boolean(),
});
export const reCrawlPageContextSchema = baseActionContextSchema;

export const reCrawlPageAction = async (params: {
	input: z.infer<typeof reCrawlPageInputSchema>;
	ctx: z.infer<typeof reCrawlPageContextSchema>;
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
		// biome-ignore lint/style/noNonNullAssertion: TypeScript narrows `existing[0]` after the length check above
		.where(eq(crawledPageTable.id, existing[0]!.id));

	return { triggered: true };
};

export const reCrawlPageHandler = async (params: {
	input: z.infer<typeof reCrawlPageInputSchema>;
	ctx: z.infer<typeof reCrawlPageContextSchema>;
}) => {
	return reCrawlPageAction(params);
};
