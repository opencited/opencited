import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { sitemapSelectSchema, sitemapTable } from "@opencited/db";

export const sitemapGetInputSchema = z.object({
	domainProjectId: z.string(),
});
export const sitemapGetOutputSchema = sitemapSelectSchema.nullable();
export const sitemapGetContextSchema = baseActionContextSchema;

export const sitemapGetAction = async (params: {
	input: z.infer<typeof sitemapGetInputSchema>;
	ctx: z.infer<typeof sitemapGetContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(sitemapTable)
		.where(eq(sitemapTable.domainProjectId, input.domainProjectId))
		.limit(1);

	return result[0] || null;
};

export const sitemapGetHandler = async (params: {
	input: z.infer<typeof sitemapGetInputSchema>;
	ctx: z.infer<typeof sitemapGetContextSchema>;
}) => {
	return sitemapGetAction(params);
};
