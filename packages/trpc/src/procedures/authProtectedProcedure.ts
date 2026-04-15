import { TRPCError } from "@trpc/server";
import { publicProcedure } from "./publicProcedure";

export const authProtectedProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!isValidUserInCtx(ctx)) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not logged in",
		});
	}

	return next({
		ctx: {
			...ctx,
			userId: ctx.userId,
		},
	});
});

function isValidUserInCtx(
	ctx: Record<string, unknown>,
): ctx is { userId: string } {
	return typeof ctx.userId === "string";
}
