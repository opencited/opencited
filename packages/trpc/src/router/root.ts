import { createTRPCRouter } from "../trpc";
import { userRouter } from "./user";
import { domainProjectRouter } from "./domainProject";

export const appRouter = createTRPCRouter({
	user: userRouter,
	domainProject: domainProjectRouter,
});

export type AppRouter = typeof appRouter;
