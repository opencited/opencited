import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { crawlSourceTable, crawlSourceSelectSchema } from "@opencited/db";

export const listCrawlSourcesInputSchema = z.object({
	crawlId: z.string().min(1),
});

export const listCrawlSourcesOutputSchema = z.array(crawlSourceSelectSchema);

export const listCrawlSourcesContextSchema = baseActionContextSchema;

export const listCrawlSourcesAction = async (params: {
	input: z.infer<typeof listCrawlSourcesInputSchema>;
	ctx: z.infer<typeof listCrawlSourcesContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(crawlSourceTable)
		.where(eq(crawlSourceTable.crawlId, input.crawlId))
		.orderBy(crawlSourceTable.position);

	return result;
};

export const listCrawlSourcesHandler = async (params: {
	input: z.infer<typeof listCrawlSourcesInputSchema>;
	ctx: z.infer<typeof listCrawlSourcesContextSchema>;
}) => {
	return listCrawlSourcesAction(params);
};
