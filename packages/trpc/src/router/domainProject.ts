import {
	createTRPCRouter,
	orgOnlyProcedure,
	orgProtectedProcedure,
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
import { TRPCError } from "@trpc/server";

export const domainProjectRouter = createTRPCRouter({
	create: orgOnlyProcedure
		.input(createDomainProjectInputSchema)
		.output(createDomainProjectOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await getDomainProjectHandler({
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Domain project already exists for this organization",
				});
			}

			return createDomainProjectHandler({
				input: { ...input, clerkOrganizationId: ctx.orgId },
				ctx,
			});
		}),

	get: orgOnlyProcedure
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

	hasDomainProject: orgOnlyProcedure.query(async ({ ctx }) => {
		const project = await getDomainProjectHandler({
			ctx,
			clerkOrganizationId: ctx.orgId,
		});
		return project != null;
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

	discoverSitemaps: orgOnlyProcedure
		.input(discoverSitemapsInputSchema)
		.output(discoverSitemapsOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return discoverSitemapsHandler({ input, ctx });
		}),
});
