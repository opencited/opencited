import { crawlReferenceSelectSchema, crawlReferenceTable } from "@opencited/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";

export const listCrawlSourcesInputSchema = z.object({
	crawlId: z.string().min(1),
	kind: z.enum(["inline-link", "source-panel"]).optional(),
});

export const listCrawlSourcesOutputSchema = z.array(crawlReferenceSelectSchema);

export const listCrawlSourcesContextSchema = baseActionContextSchema;

export const listCrawlSourcesAction = async (params: {
	input: z.infer<typeof listCrawlSourcesInputSchema>;
	ctx: z.infer<typeof listCrawlSourcesContextSchema>;
}) => {
	const { input, ctx } = params;

	const conditions = [eq(crawlReferenceTable.crawlId, input.crawlId)];
	if (input.kind) {
		conditions.push(eq(crawlReferenceTable.kind, input.kind));
	}

	const result = await ctx.db
		.select()
		.from(crawlReferenceTable)
		.where(and(...conditions))
		.orderBy(crawlReferenceTable.position);

	return result;
};

export const listCrawlSourcesHandler = async (params: {
	input: z.infer<typeof listCrawlSourcesInputSchema>;
	ctx: z.infer<typeof listCrawlSourcesContextSchema>;
}) => {
	return listCrawlSourcesAction(params);
};
