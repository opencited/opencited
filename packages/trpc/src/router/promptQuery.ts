import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
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
	create: publicProcedure
		.input(createPromptQueryInputSchema)
		.output(createPromptQueryOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return createPromptQueryHandler({
				input,
				ctx,
			});
		}),

	list: publicProcedure
		.input(listPromptQueryInputSchema)
		.output(listPromptQueryOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return [];
			}
			return listPromptQueryHandler({ ctx, input });
		}),

	delete: publicProcedure
		.input(deletePromptQueryInputSchema)
		.output(deletePromptQueryOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return deletePromptQueryHandler({ ctx, input });
		}),

	count: publicProcedure
		.input(countPromptQueryInputSchema)
		.output(countPromptQueryOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				return { count: 0 };
			}
			return countPromptQueryHandler({ ctx, input });
		}),

	update: publicProcedure
		.input(updatePromptQueryInputSchema)
		.output(updatePromptQueryOutputSchema)
		.mutation(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return updatePromptQueryHandler({ ctx, input });
		}),
});
