import { auth } from "@clerk/nextjs/server";
import { TRPCError, initTRPC } from "@trpc/server";
import { baseActionContextSchema } from "@opencited/actions";
import { type Db, getFreshDbInstance } from "@opencited/db";

export type Context = {
	userId: string | null;
	isAuthenticated: boolean;
	db: Db;
};

export { baseActionContextSchema };

export const createTRPCContext = async (): Promise<Context> => {
	const { userId, isAuthenticated } = await auth();
	const db = getFreshDbInstance();
	return { userId, isAuthenticated, db };
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
			userId: ctx.userId,
		} as const,
	});
});
