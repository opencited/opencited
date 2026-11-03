import {
	EngineDisabledError,
	getAnswerEnginesHandler,
	getAnswerEnginesOutputSchema,
} from "@opencited/actions";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export function rethrowEngineDisabled(error: unknown): never {
	if (error instanceof EngineDisabledError) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: error.reason,
			cause: error,
		});
	}
	throw error;
}

export const answerEngineRouter = createTRPCRouter({
	/**
	 * Availability is read from the database on every request. The client sets
	 * a 30s stale time, refetches on that same interval, and refetches on
	 * window focus. Together with the worker's 30s cache, a row edit shows up
	 * within about 60 seconds with no redeploy.
	 */
	list: protectedProcedure
		.output(getAnswerEnginesOutputSchema)
		.query(async ({ ctx }) => {
			return getAnswerEnginesHandler({ input: {}, ctx });
		}),
});
