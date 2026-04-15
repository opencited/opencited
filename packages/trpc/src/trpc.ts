import { auth } from "@clerk/nextjs/server";
import { TRPCError, initTRPC } from "@trpc/server";

export type Context = {
	userId: string | null;
	isAuthenticated: boolean;
};

export const createTRPCContext = async (): Promise<Context> => {
	const { userId, isAuthenticated } = await auth();
	return { userId, isAuthenticated };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

export const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			...ctx,
			userId: ctx.userId,
		},
	});
});
