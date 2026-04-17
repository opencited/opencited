import { eq, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	createDomainProjectHandler,
	getDomainProjectHandler,
	listDomainProjectHandler,
	updateDomainProjectHandler,
	deleteDomainProjectHandler,
} from "../actions/domainProject";
import { createDomainProjectInputSchema } from "../actions/domainProject/createAction";
import { listDomainProjectInputSchema } from "../actions/domainProject/listAction";
import { updateDomainProjectInputSchema } from "../actions/domainProject/updateAction";
import { deleteDomainProjectInputSchema } from "../actions/domainProject/deleteAction";
import { domainProjectTable } from "@opencited/db";

export const domainProjectRouter = createTRPCRouter({
	create: publicProcedure
		.input(createDomainProjectInputSchema)
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

	get: publicProcedure.query(async ({ ctx }) => {
		const { orgId } = await auth();
		if (!orgId) {
			return null;
		}
		return getDomainProjectHandler({ ctx, clerkOrganizationId: orgId });
	}),

	list: publicProcedure
		.input(listDomainProjectInputSchema)
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
});
