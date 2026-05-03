import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { sitemapSelectSchema, sitemapTable } from "@opencited/db";

export const sitemapDeleteInputSchema = z.object({
	id: z.string(),
});
export const sitemapDeleteOutputSchema = sitemapSelectSchema.nullable();
export const sitemapDeleteContextSchema = baseActionContextSchema;

export const sitemapDeleteAction = async (params: {
	input: z.infer<typeof sitemapDeleteInputSchema>;
	ctx: z.infer<typeof sitemapDeleteContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.delete(sitemapTable)
		.where(eq(sitemapTable.id, input.id))
		.returning();

	return result[0] || null;
};

export const sitemapDeleteHandler = async (params: {
	input: z.infer<typeof sitemapDeleteInputSchema>;
	ctx: z.infer<typeof sitemapDeleteContextSchema>;
}) => {
	return sitemapDeleteAction(params);
};
