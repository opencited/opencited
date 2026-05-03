import { sql } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { crawledPageTable, crawlStatusEnum } from "@opencited/db";

export const crawledPageUpsertBatchInputSchema = z.object({
	pages: z.array(
		z.object({
			sitemapUrlId: z.string().uuid(),
			url: z.string().url(),
			httpStatus: z.number().nullable(),
			contentLength: z.number().nullable(),
			contentHash: z.string().nullable(),
			fetchError: z.string().nullable(),
			crawlStatus: crawlStatusEnum,
			fetchedAt: z.string(),
		}),
	),
});

export const crawledPageUpsertBatchOutputSchema = z.object({
	saved: z.array(
		z.object({
			id: z.string().uuid(),
			sitemapUrlId: z.string().uuid(),
		}),
	),
});

export const crawledPageUpsertBatchContextSchema = baseActionContextSchema;

export const crawledPageUpsertBatchAction = async (params: {
	input: z.infer<typeof crawledPageUpsertBatchInputSchema>;
	ctx: z.infer<typeof crawledPageUpsertBatchContextSchema>;
}) => {
	const { input, ctx } = params;
	const { pages } = input;
	const { db } = ctx;

	const result = await db
		.insert(crawledPageTable)
		.values(
			pages.map((page) => ({
				sitemapUrlId: page.sitemapUrlId,
				url: page.url,
				httpStatus: page.httpStatus,
				contentLength: page.contentLength,
				contentHash: page.contentHash,
				fetchedAt: page.fetchedAt,
				crawlStatus: page.crawlStatus,
				fetchError: page.fetchError,
			})),
		)
		.onConflictDoUpdate({
			target: crawledPageTable.sitemapUrlId,
			set: {
				httpStatus: sql`excluded.http_status`,
				contentLength: sql`excluded.content_length`,
				contentHash: sql`excluded.content_hash`,
				fetchedAt: sql`excluded.fetched_at`,
				crawlStatus: sql`excluded.crawl_status`,
				fetchError: sql`excluded.fetch_error`,
				updatedAt: new Date(),
			},
		})
		.returning({
			id: crawledPageTable.id,
			sitemapUrlId: crawledPageTable.sitemapUrlId,
		});

	return { saved: result };
};

export const crawledPageUpsertBatchHandler = async (params: {
	input: z.infer<typeof crawledPageUpsertBatchInputSchema>;
	ctx: z.infer<typeof crawledPageUpsertBatchContextSchema>;
}) => {
	return crawledPageUpsertBatchAction(params);
};
