import { createTRPCRouter } from "../trpc";
import { userRouter } from "./user";
import { domainProjectRouter } from "./domainProject";
import { sitemapRouter } from "./sitemap";
import { crawlRouter } from "./crawl";
import { promptQueryRouter } from "./promptQuery";
import { promptQueryCrawlRouter } from "./promptQueryCrawl";

export const appRouter = createTRPCRouter({
	user: userRouter,
	domainProject: domainProjectRouter,
	sitemap: sitemapRouter,
	crawl: crawlRouter,
	promptQuery: promptQueryRouter,
	promptQueryCrawl: promptQueryCrawlRouter,
});

export type AppRouter = typeof appRouter;
