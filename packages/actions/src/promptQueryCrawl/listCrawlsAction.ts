import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlSelectSchema,
	promptQueryCrawlTable,
	promptQueryTable,
} from "@opencited/db";

export const listCrawlsInputSchema = z.object({
	domainProjectId: z.string().min(1, "Domain project is required"),
	limit: z.number().int().positive().optional(),
	offset: z.number().int().nonnegative().optional(),
});

export const listCrawlsOutputSchema = promptQueryCrawlSelectSchema.array();

export const listCrawlsContextSchema = baseActionContextSchema;

export const listCrawlsAction = async (params: {
	input: z.infer<typeof listCrawlsInputSchema>;
	ctx: z.infer<typeof listCrawlsContextSchema>;
}) => {
	const { input, ctx } = params;

	// Join with promptQuery to filter by domainProjectId
	const result = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.innerJoin(
			promptQueryTable,
			eq(promptQueryCrawlTable.promptQueryId, promptQueryTable.id),
		)
		.where(eq(promptQueryTable.domainProjectId, input.domainProjectId))
		.orderBy(desc(promptQueryCrawlTable.createdAt))
		.limit(input.limit ?? 100)
		.offset(input.offset ?? 0);

	return result.map(
		(row: { prompt_query_crawl: any }) => row.prompt_query_crawl,
	);
};

export const listCrawlsHandler = async (params: {
	input: z.infer<typeof listCrawlsInputSchema>;
	ctx: z.infer<typeof listCrawlsContextSchema>;
}) => {
	return listCrawlsAction(params);
};
