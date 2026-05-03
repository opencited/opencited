import { eq, count, inArray, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	sitemapUrlSelectSchema,
	sitemapUrlTable,
	sitemapTable,
	domainProjectTable,
	crawledPageTable,
	crawlStatusEnum,
} from "@opencited/db";

export const sitemapUrlListInputSchema = z.object({
	sitemapId: z.string(),
});

export const sitemapUrlListOutputSchema = z.object({
	urls: sitemapUrlSelectSchema
		.extend({
			crawlStatus: crawlStatusEnum.nullable(),
			fetchedAt: z.string().nullable(),
			httpStatus: z.number().int().nullable(),
		})
		.array(),
	sitemapActiveCrawlRunId: z.string().nullable(),
});

export const sitemapUrlListContextSchema = baseActionContextSchema;

export const sitemapUrlListAction = async (params: {
	input: z.infer<typeof sitemapUrlListInputSchema>;
	ctx: z.infer<typeof sitemapUrlListContextSchema>;
}) => {
	const { input, ctx } = params;

	const sitemap = await ctx.db
		.select()
		.from(sitemapTable)
		.where(eq(sitemapTable.id, input.sitemapId))
		.limit(1);

	if (!sitemap[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Sitemap not found",
		});
	}

	const result = await ctx.db
		.select({
			id: sitemapUrlTable.id,
			sitemapId: sitemapUrlTable.sitemapId,
			url: sitemapUrlTable.url,
			lastmod: sitemapUrlTable.lastmod,
			changefreq: sitemapUrlTable.changefreq,
			priority: sitemapUrlTable.priority,
			activeCrawlRunId: sitemapUrlTable.activeCrawlRunId,
			createdAt: sitemapUrlTable.createdAt,
			updatedAt: sitemapUrlTable.updatedAt,
			crawlStatus: crawledPageTable.crawlStatus,
			fetchedAt: crawledPageTable.fetchedAt,
			httpStatus: crawledPageTable.httpStatus,
		})
		.from(sitemapUrlTable)
		.leftJoin(
			crawledPageTable,
			eq(crawledPageTable.sitemapUrlId, sitemapUrlTable.id),
		)
		.orderBy(desc(sitemapUrlTable.updatedAt))
		.where(eq(sitemapUrlTable.sitemapId, input.sitemapId));

	return {
		urls: result,
		sitemapActiveCrawlRunId: sitemap[0].activeCrawlRunId,
	};
};

export const sitemapUrlListHandler = async (params: {
	input: z.infer<typeof sitemapUrlListInputSchema>;
	ctx: z.infer<typeof sitemapUrlListContextSchema>;
}) => {
	return sitemapUrlListAction(params);
};

export const sitemapUrlGetCountInputSchema = z.object({});
export const sitemapUrlGetCountOutputSchema = z.object({
	count: z.number(),
});
export const sitemapUrlGetCountContextSchema = baseActionContextSchema;

export const sitemapUrlGetCountAction = async (params: {
	ctx: z.infer<typeof sitemapUrlGetCountContextSchema>;
}) => {
	const { ctx } = params;
	const { orgId } = await import("@clerk/nextjs/server").then((m) => m.auth());
	if (!orgId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "No organization found",
		});
	}

	const domainProject = await ctx.db
		.select()
		.from(domainProjectTable)
		.where(eq(domainProjectTable.clerkOrganizationId, orgId))
		.limit(1);

	if (!domainProject[0]) {
		return { count: 0 };
	}

	const sitemaps = await ctx.db
		.select({ id: sitemapTable.id })
		.from(sitemapTable)
		.where(eq(sitemapTable.domainProjectId, domainProject[0].id));

	if (sitemaps.length === 0) {
		return { count: 0 };
	}

	const sitemapIds = sitemaps.map((s: { id: string }) => s.id);

	const result = await ctx.db
		.select({ count: count() })
		.from(sitemapUrlTable)
		.where(inArray(sitemapUrlTable.sitemapId, sitemapIds));

	return { count: result[0]?.count ?? 0 };
};

export const sitemapUrlGetCountHandler = async (params: {
	ctx: z.infer<typeof sitemapUrlGetCountContextSchema>;
}) => {
	return sitemapUrlGetCountAction(params);
};
