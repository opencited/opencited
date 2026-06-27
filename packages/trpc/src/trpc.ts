import { auth } from "@clerk/nextjs/server";
import { TRPCError, initTRPC } from "@trpc/server";
import { eq } from "drizzle-orm";
import { baseActionContextSchema } from "@opencited/actions";
import { type Db, domainProjectTable, getFreshDbInstance } from "@opencited/db";

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

export const orgProtectedProcedure = publicProcedure.use(
	async ({ ctx, next }) => {
		const { orgId } = await auth();
		if (!orgId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "Organization not found",
			});
		}

		const domainProjectResult = await ctx.db
			.select()
			.from(domainProjectTable)
			.where(eq(domainProjectTable.clerkOrganizationId, orgId))
			.limit(1);

		const domainProject = domainProjectResult[0];
		if (!domainProject) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Organization not set up",
			});
		}

		return next({
			ctx: {
				orgId,
				domainProject,
			} as const,
		});
	},
);
