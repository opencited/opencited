import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import {
	sitemapSelectSchema,
	sitemapTable,
	domainProjectTable,
} from "@opencited/db";

export const listSitemapInputSchema = z.object({});
export const listSitemapOutputSchema = sitemapSelectSchema.array();
export const listSitemapContextSchema = baseActionContextSchema;

export const listSitemapAction = async (params: {
	ctx: z.infer<typeof listSitemapContextSchema>;
	domainProjectId: string;
}) => {
	const { ctx, domainProjectId } = params;

	const result = await ctx.db
		.select()
		.from(sitemapTable)
		.where(eq(sitemapTable.domainProjectId, domainProjectId));

	return result;
};

export const listSitemapHandler = async (params: {
	input: z.infer<typeof listSitemapInputSchema>;
	ctx: z.infer<typeof listSitemapContextSchema>;
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

	return listSitemapAction({ ...params, domainProjectId: domainProject[0].id });
};
