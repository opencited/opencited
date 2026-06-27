import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
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
	create: orgProtectedProcedure
		.input(createProxyConfigInputSchema)
		.output(createProxyConfigOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return createProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
		}),

	get: orgProtectedProcedure
		.input(getProxyConfigInputSchema)
		.output(getProxyConfigOutputSchema)
		.query(async ({ ctx, input }) => {
			return getProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
		}),

	update: orgProtectedProcedure
		.input(updateProxyConfigInputSchema)
		.output(updateProxyConfigOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return updateProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
		}),

	delete: orgProtectedProcedure
		.input(deleteProxyConfigInputSchema)
		.output(deleteProxyConfigOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return deleteProxyConfigHandler({
				input,
				ctx,
				clerkOrganizationId: ctx.orgId,
			});
		}),
});
