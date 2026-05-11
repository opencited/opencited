import { createTRPCRouter } from "../trpc";
import { userRouter } from "./user";
import { domainProjectRouter } from "./domainProject";
import { sitemapRouter } from "./sitemap";
import { crawlRouter } from "./crawl";
import { promptQueryRouter } from "./promptQuery";

export const appRouter = createTRPCRouter({
	user: userRouter,
	domainProject: domainProjectRouter,
	sitemap: sitemapRouter,
	crawl: crawlRouter,
	promptQuery: promptQueryRouter,
});

export type AppRouter = typeof appRouter;
