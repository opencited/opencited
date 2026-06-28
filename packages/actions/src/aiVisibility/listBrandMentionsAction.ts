import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	crawlBrandMentionTable,
	crawlBrandMentionSelectSchema,
} from "@opencited/db";

export const listBrandMentionsInputSchema = z.object({
	crawlId: z.string().min(1),
});

export const listBrandMentionsOutputSchema = z.array(
	crawlBrandMentionSelectSchema,
);

export const listBrandMentionsContextSchema = baseActionContextSchema;

export const listBrandMentionsAction = async (params: {
	input: z.infer<typeof listBrandMentionsInputSchema>;
	ctx: z.infer<typeof listBrandMentionsContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(eq(crawlBrandMentionTable.crawlId, input.crawlId))
		.orderBy(crawlBrandMentionTable.createdAt);

	return result;
};

export const listBrandMentionsHandler = async (params: {
	input: z.infer<typeof listBrandMentionsInputSchema>;
	ctx: z.infer<typeof listBrandMentionsContextSchema>;
}) => {
	return listBrandMentionsAction(params);
};
