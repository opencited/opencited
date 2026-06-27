import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
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
	create: orgProtectedProcedure
		.input(createCompetitorInputSchema)
		.output(createCompetitorOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return createCompetitorHandler({
				input,
				ctx,
			});
		}),

	list: orgProtectedProcedure
		.input(listCompetitorsInputSchema)
		.output(listCompetitorsOutputSchema)
		.query(async ({ ctx, input }) => {
			return listCompetitorsHandler({ ctx, input });
		}),

	get: orgProtectedProcedure
		.input(getCompetitorInputSchema)
		.output(getCompetitorOutputSchema)
		.query(async ({ ctx, input }) => {
			return getCompetitorHandler({ ctx, input });
		}),

	update: orgProtectedProcedure
		.input(updateCompetitorInputSchema)
		.output(updateCompetitorOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return updateCompetitorHandler({ ctx, input });
		}),

	delete: orgProtectedProcedure
		.input(deleteCompetitorInputSchema)
		.output(deleteCompetitorOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return deleteCompetitorHandler({ ctx, input });
		}),
});
