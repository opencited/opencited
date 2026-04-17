import { createTRPCRouter } from "../trpc";
import { userRouter } from "./user";
import { domainProjectRouter } from "./domainProject";
import { sitemapRouter } from "./sitemap";

export const appRouter = createTRPCRouter({
	user: userRouter,
	domainProject: domainProjectRouter,
	sitemap: sitemapRouter,
});

export type AppRouter = typeof appRouter;
