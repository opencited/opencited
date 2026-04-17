import { eq, count, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import {
	sitemapUrlSelectSchema,
	sitemapUrlTable,
	sitemapTable,
	domainProjectTable,
} from "@opencited/db";

export const listSitemapUrlsInputSchema = z.object({
	sitemapId: z.string(),
});
export const listSitemapUrlsOutputSchema = sitemapUrlSelectSchema.array();
export const listSitemapUrlsContextSchema = baseActionContextSchema;

export const listSitemapUrlsAction = async (params: {
	input: z.infer<typeof listSitemapUrlsInputSchema>;
	ctx: z.infer<typeof listSitemapUrlsContextSchema>;
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
		.select()
		.from(sitemapUrlTable)
		.where(eq(sitemapUrlTable.sitemapId, input.sitemapId));

	return result;
};

export const listSitemapUrlsHandler = async (params: {
	input: z.infer<typeof listSitemapUrlsInputSchema>;
	ctx: z.infer<typeof listSitemapUrlsContextSchema>;
}) => {
	return listSitemapUrlsAction(params);
};

export const getSitemapUrlCountInputSchema = z.object({});
export const getSitemapUrlCountOutputSchema = z.object({
	count: z.number(),
});
export const getSitemapUrlCountContextSchema = baseActionContextSchema;

export const getSitemapUrlCountAction = async (params: {
	ctx: z.infer<typeof getSitemapUrlCountContextSchema>;
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

export const getSitemapUrlCountHandler = async (params: {
	ctx: z.infer<typeof getSitemapUrlCountContextSchema>;
}) => {
	return getSitemapUrlCountAction(params);
};
