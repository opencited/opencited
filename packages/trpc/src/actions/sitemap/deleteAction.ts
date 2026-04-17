import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { sitemapSelectSchema, sitemapTable } from "@opencited/db";

export const deleteSitemapInputSchema = z.object({
	id: z.string(),
});
export const deleteSitemapOutputSchema = sitemapSelectSchema.nullable();
export const deleteSitemapContextSchema = baseActionContextSchema;

export const deleteSitemapAction = async (params: {
	input: z.infer<typeof deleteSitemapInputSchema>;
	ctx: z.infer<typeof deleteSitemapContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.delete(sitemapTable)
		.where(eq(sitemapTable.id, input.id))
		.returning();

	return result[0] || null;
};

export const deleteSitemapHandler = async (params: {
	input: z.infer<typeof deleteSitemapInputSchema>;
	ctx: z.infer<typeof deleteSitemapContextSchema>;
}) => {
	return deleteSitemapAction(params);
};
