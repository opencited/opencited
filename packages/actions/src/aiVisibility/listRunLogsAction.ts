import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryCrawlTable,
	promptQueryCrawlSelectSchema,
	promptQueryCrawlStatusEnum,
	crawlBrandMentionTable,
} from "@opencited/db";

export const listRunLogsInputSchema = z.object({
	domainProjectId: z.string().min(1),
	promptQueryId: z.string().optional(),
	provider: z.string().optional(),
	status: promptQueryCrawlStatusEnum.optional(),
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).default(0),
});

export const listRunLogsOutputSchema = z.object({
	runs: z.array(
		promptQueryCrawlSelectSchema.extend({
			cited: z.boolean(),
		}),
	),
	total: z.number(),
});

export const listRunLogsContextSchema = baseActionContextSchema;

export const listRunLogsAction = async (params: {
	input: z.infer<typeof listRunLogsInputSchema>;
	ctx: z.infer<typeof listRunLogsContextSchema>;
}) => {
	const { input, ctx } = params;

	const conditions = [
		eq(promptQueryCrawlTable.domainProjectId, input.domainProjectId),
	];

	if (input.promptQueryId) {
		conditions.push(
			eq(promptQueryCrawlTable.promptQueryId, input.promptQueryId),
		);
	}

	if (input.provider) {
		conditions.push(eq(promptQueryCrawlTable.provider, input.provider));
	}

	if (input.status) {
		conditions.push(eq(promptQueryCrawlTable.status, input.status));
	}

	const whereClause =
		conditions.length > 1 ? and(...conditions) : conditions[0];

	const [runs, countResult] = await Promise.all([
		ctx.db
			.select()
			.from(promptQueryCrawlTable)
			.where(whereClause)
			.orderBy(desc(promptQueryCrawlTable.createdAt))
			.limit(input.limit)
			.offset(input.offset),
		ctx.db
			.select({ count: promptQueryCrawlTable.id })
			.from(promptQueryCrawlTable)
			.where(whereClause),
	]);

	if (runs.length === 0) {
		return {
			runs: [],
			total: countResult.length,
		};
	}

	type CrawlRow = typeof promptQueryCrawlTable.$inferSelect;

	const crawlIds = runs.map((r: CrawlRow) => r.id);

	const brandMentions = await ctx.db
		.select()
		.from(crawlBrandMentionTable)
		.where(inArray(crawlBrandMentionTable.crawlId, crawlIds));

	const mentionedCrawlIds = new Set<string>();
	for (const mention of brandMentions) {
		if (mention.mentionType === "target") {
			mentionedCrawlIds.add(mention.crawlId);
		}
	}

	const runsWithCited = runs.map((run: CrawlRow) => ({
		...run,
		cited: mentionedCrawlIds.has(run.id),
	}));

	return {
		runs: runsWithCited,
		total: countResult.length,
	};
};

export const listRunLogsHandler = async (params: {
	input: z.infer<typeof listRunLogsInputSchema>;
	ctx: z.infer<typeof listRunLogsContextSchema>;
}) => {
	return listRunLogsAction(params);
};
