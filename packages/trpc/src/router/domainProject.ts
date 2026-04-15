import { eq, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { domainProjectCreateSchema, domainProjectTable } from "@opencited/db";

export const domainProjectRouter = createTRPCRouter({
	create: publicProcedure
		.input(domainProjectCreateSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			const result = await ctx.db
				.insert(domainProjectTable)
				.values({
					clerkOrganizationId: orgId,
					domain: input.domain,
				})
				.returning();
			return result;
		}),

	get: publicProcedure.query(async ({ ctx }) => {
		const { orgId } = await auth();
		if (!orgId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "No organization found",
			});
		}
		const result = await ctx.db
			.select()
			.from(domainProjectTable)
			.where(eq(domainProjectTable.clerkOrganizationId, orgId))
			.limit(1);
		return result[0] || null;
	}),

	hasDomainProject: publicProcedure.query(async ({ ctx }) => {
		const { orgId } = await auth();
		if (!orgId) {
			return false;
		}
		const result = await ctx.db
			.select({ count: count() })
			.from(domainProjectTable)
			.where(eq(domainProjectTable.clerkOrganizationId, orgId))
			.limit(1);
		return (result[0]?.count ?? 0) > 0;
	}),
});
