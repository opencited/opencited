import { authProtectedProcedure } from "../procedures/authProtectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createTRPCRouter } from "../trpc";

export const userRouter = createTRPCRouter({
	hello: publicProcedure.query(({ ctx }) => {
		const { isAuthenticated, userId } = ctx;
		return {
			greeting: isAuthenticated
				? `Hello ${userId}!`
				: "Hello! You are not signed in.",
		};
	}),
	me: authProtectedProcedure.query(({ ctx }) => {
		const { userId } = ctx;
		return { userId };
	}),
});
