import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { sitemapSelectSchema, sitemapTable } from "@opencited/db";

export const getSitemapInputSchema = z.object({
	domainProjectId: z.string(),
});
export const getSitemapOutputSchema = sitemapSelectSchema.nullable();
export const getSitemapContextSchema = baseActionContextSchema;

export const getSitemapAction = async (params: {
	input: z.infer<typeof getSitemapInputSchema>;
	ctx: z.infer<typeof getSitemapContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(sitemapTable)
		.where(eq(sitemapTable.domainProjectId, input.domainProjectId))
		.limit(1);

	return result[0] || null;
};

export const getSitemapHandler = async (params: {
	input: z.infer<typeof getSitemapInputSchema>;
	ctx: z.infer<typeof getSitemapContextSchema>;
}) => {
	return getSitemapAction(params);
};
