import { eq, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	sitemapSelectSchema,
	sitemapTable,
	domainProjectTable,
	sitemapUrlTable,
} from "@opencited/db";

export const sitemapListInputSchema = z.object({});
export const sitemapListOutputSchema = sitemapSelectSchema
	.extend({
		urlCount: z.number(),
	})
	.array();
export const sitemapListContextSchema = baseActionContextSchema;

export const sitemapListAction = async (params: {
	ctx: z.infer<typeof sitemapListContextSchema>;
	domainProjectId: string;
}) => {
	const { ctx, domainProjectId } = params;

	const result = await ctx.db
		.select({
			sitemap: sitemapTable,
			urlCount: count(sitemapUrlTable.id).as("url_count"),
		})
		.from(sitemapTable)
		.leftJoin(sitemapUrlTable, eq(sitemapUrlTable.sitemapId, sitemapTable.id))
		.where(eq(sitemapTable.domainProjectId, domainProjectId))
		.groupBy(sitemapTable.id);

	return result.map((row: any) => ({
		...row.sitemap,
		urlCount: Number(row.urlCount),
	}));
};

export const sitemapListHandler = async (params: {
	input: z.infer<typeof sitemapListInputSchema>;
	ctx: z.infer<typeof sitemapListContextSchema>;
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
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Domain project not found",
		});
	}

	return sitemapListAction({ ...params, domainProjectId: domainProject[0].id });
};
