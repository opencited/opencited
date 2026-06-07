import { createTRPCRouter } from "../trpc";
import { userRouter } from "./user";
import { domainProjectRouter } from "./domainProject";
import { sitemapRouter } from "./sitemap";
import { crawlRouter } from "./crawl";
import { promptQueryRouter } from "./promptQuery";
import { promptQueryCrawlRouter } from "./promptQueryCrawl";
import { competitorRouter } from "./competitor";
import { aiVisibilityRouter } from "./aiVisibility";
import { dashboardRouter } from "./dashboard";
import { proxyConfigRouter } from "./proxyConfig";

export const appRouter = createTRPCRouter({
	user: userRouter,
	domainProject: domainProjectRouter,
	sitemap: sitemapRouter,
	crawl: crawlRouter,
	promptQuery: promptQueryRouter,
	promptQueryCrawl: promptQueryCrawlRouter,
	competitor: competitorRouter,
	aiVisibility: aiVisibilityRouter,
	dashboard: dashboardRouter,
	proxyConfig: proxyConfigRouter,
});

export type AppRouter = typeof appRouter;
