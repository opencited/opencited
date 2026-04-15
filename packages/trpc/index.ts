export { type AppRouter, appRouter } from "./src/router/root";
export {
	type Context,
	type TRPCContext,
	createTRPCContext,
	createTRPCRouter,
	mergeRouters,
	publicProcedure,
	protectedProcedure,
	t,
} from "./src/trpc";
export { authProtectedProcedure } from "./src/procedures/authProtectedProcedure";
