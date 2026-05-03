import { eq, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	createDomainProjectHandler,
	createDomainProjectOutputSchema,
	getDomainProjectHandler,
	getDomainProjectOutputSchema,
	listDomainProjectHandler,
	listDomainProjectOutputSchema,
	updateDomainProjectHandler,
	updateDomainProjectOutputSchema,
	deleteDomainProjectHandler,
	deleteDomainProjectOutputSchema,
	discoverSitemapsHandler,
	discoverSitemapsOutputSchema,
	createDomainProjectInputSchema,
	discoverSitemapsInputSchema,
	listDomainProjectInputSchema,
	updateDomainProjectInputSchema,
	deleteDomainProjectInputSchema,
} from "@opencited/actions";
import { domainProjectTable } from "@opencited/db";

export const domainProjectRouter = createTRPCRouter({
	create: publicProcedure
		.input(createDomainProjectInputSchema)
		.output(createDomainProjectOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return createDomainProjectHandler({
				input: { ...input, clerkOrganizationId: orgId },
				ctx,
			});
		}),

	get: publicProcedure
		.output(getDomainProjectOutputSchema)
		.query(async ({ ctx }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return null;
			}
			return getDomainProjectHandler({ ctx, clerkOrganizationId: orgId });
		}),

	list: publicProcedure
		.input(listDomainProjectInputSchema)
		.output(listDomainProjectOutputSchema)
		.query(async ({ ctx }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return [];
			}
			return listDomainProjectHandler({ ctx, clerkOrganizationId: orgId });
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

	update: publicProcedure
		.input(updateDomainProjectInputSchema)
		.output(updateDomainProjectOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return updateDomainProjectHandler({
				input,
				ctx,
				clerkOrganizationId: orgId,
			});
		}),

	delete: publicProcedure
		.input(deleteDomainProjectInputSchema)
		.output(deleteDomainProjectOutputSchema)
		.mutation(async ({ ctx }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return deleteDomainProjectHandler({ ctx, clerkOrganizationId: orgId });
		}),

	discoverSitemaps: publicProcedure
		.input(discoverSitemapsInputSchema)
		.output(discoverSitemapsOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return discoverSitemapsHandler({ input, ctx });
		}),
});
