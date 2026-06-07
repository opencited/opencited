import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	createProxyConfigHandler,
	createProxyConfigInputSchema,
	createProxyConfigOutputSchema,
	getProxyConfigHandler,
	getProxyConfigInputSchema,
	getProxyConfigOutputSchema,
	updateProxyConfigHandler,
	updateProxyConfigInputSchema,
	updateProxyConfigOutputSchema,
	deleteProxyConfigHandler,
	deleteProxyConfigInputSchema,
	deleteProxyConfigOutputSchema,
} from "@opencited/actions";

export const proxyConfigRouter = createTRPCRouter({
	create: publicProcedure
		.input(createProxyConfigInputSchema)
		.output(createProxyConfigOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return createProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: orgId,
			});
		}),

	get: publicProcedure
		.input(getProxyConfigInputSchema)
		.output(getProxyConfigOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return null;
			}
			return getProxyConfigHandler({ input, ctx, clerkOrganizationId: orgId });
		}),

	update: publicProcedure
		.input(updateProxyConfigInputSchema)
		.output(updateProxyConfigOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return updateProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: orgId,
			});
		}),

	delete: publicProcedure
		.input(deleteProxyConfigInputSchema)
		.output(deleteProxyConfigOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return deleteProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: orgId,
			});
		}),
});
