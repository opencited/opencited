import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
import {
	createPromptQueryHandler,
	createPromptQueryOutputSchema,
	listPromptQueryHandler,
	listPromptQueryOutputSchema,
	deletePromptQueryHandler,
	deletePromptQueryOutputSchema,
	countPromptQueryHandler,
	countPromptQueryOutputSchema,
	updatePromptQueryHandler,
	updatePromptQueryOutputSchema,
	createPromptQueryInputSchema,
	listPromptQueryInputSchema,
	deletePromptQueryInputSchema,
	countPromptQueryInputSchema,
	updatePromptQueryInputSchema,
} from "@opencited/actions";

export const promptQueryRouter = createTRPCRouter({
	create: orgProtectedProcedure
		.input(createPromptQueryInputSchema)
		.output(createPromptQueryOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return createPromptQueryHandler({
				input,
				ctx,
			});
		}),

	list: orgProtectedProcedure
		.input(listPromptQueryInputSchema)
		.output(listPromptQueryOutputSchema)
		.query(async ({ ctx, input }) => {
			return listPromptQueryHandler({ ctx, input });
		}),

	delete: orgProtectedProcedure
		.input(deletePromptQueryInputSchema)
		.output(deletePromptQueryOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return deletePromptQueryHandler({ ctx, input });
		}),

	count: orgProtectedProcedure
		.input(countPromptQueryInputSchema)
		.output(countPromptQueryOutputSchema)
		.query(async ({ ctx, input }) => {
			return countPromptQueryHandler({ ctx, input });
		}),

	update: orgProtectedProcedure
		.input(updatePromptQueryInputSchema)
		.output(updatePromptQueryOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return updatePromptQueryHandler({ ctx, input });
		}),
});
