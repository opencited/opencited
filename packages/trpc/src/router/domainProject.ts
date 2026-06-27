import { eq, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import {
	createTRPCRouter,
	orgProtectedProcedure,
	publicProcedure,
} from "../trpc";
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
	create: orgProtectedProcedure
		.input(createDomainProjectInputSchema)
		.output(createDomainProjectOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return createDomainProjectHandler({
				input: { ...input, clerkOrganizationId: ctx.orgId },
				ctx,
			});
		}),

	get: orgProtectedProcedure
		.output(getDomainProjectOutputSchema)
		.query(async ({ ctx }) => {
			return getDomainProjectHandler({ ctx, clerkOrganizationId: ctx.orgId });
		}),

	list: orgProtectedProcedure
		.input(listDomainProjectInputSchema)
		.output(listDomainProjectOutputSchema)
		.query(async ({ ctx }) => {
			return listDomainProjectHandler({ ctx, clerkOrganizationId: ctx.orgId });
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

	update: orgProtectedProcedure
		.input(updateDomainProjectInputSchema)
		.output(updateDomainProjectOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return updateDomainProjectHandler({
				input,
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
		}),

	delete: orgProtectedProcedure
		.input(deleteDomainProjectInputSchema)
		.output(deleteDomainProjectOutputSchema)
		.mutation(async ({ ctx }) => {
			return deleteDomainProjectHandler({
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
		}),

	discoverSitemaps: orgProtectedProcedure
		.input(discoverSitemapsInputSchema)
		.output(discoverSitemapsOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return discoverSitemapsHandler({ input, ctx });
		}),
});
