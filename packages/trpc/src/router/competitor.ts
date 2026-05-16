import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	createCompetitorHandler,
	createCompetitorInputSchema,
	createCompetitorOutputSchema,
	listCompetitorsHandler,
	listCompetitorsInputSchema,
	listCompetitorsOutputSchema,
	getCompetitorHandler,
	getCompetitorInputSchema,
	getCompetitorOutputSchema,
	updateCompetitorHandler,
	updateCompetitorInputSchema,
	updateCompetitorOutputSchema,
	deleteCompetitorHandler,
	deleteCompetitorInputSchema,
	deleteCompetitorOutputSchema,
} from "@opencited/actions";

export const competitorRouter = createTRPCRouter({
	create: publicProcedure
		.input(createCompetitorInputSchema)
		.output(createCompetitorOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return createCompetitorHandler({
				input,
				ctx,
			});
		}),

	list: publicProcedure
		.input(listCompetitorsInputSchema)
		.output(listCompetitorsOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return [];
			}
			return listCompetitorsHandler({ ctx, input });
		}),

	get: publicProcedure
		.input(getCompetitorInputSchema)
		.output(getCompetitorOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return getCompetitorHandler({ ctx, input });
		}),

	update: publicProcedure
		.input(updateCompetitorInputSchema)
		.output(updateCompetitorOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return updateCompetitorHandler({ ctx, input });
		}),

	delete: publicProcedure
		.input(deleteCompetitorInputSchema)
		.output(deleteCompetitorOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return deleteCompetitorHandler({ ctx, input });
		}),
});
