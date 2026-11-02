import { createTRPCRouter } from "../trpc";
import { aiVisibilityRouter } from "./aiVisibility";
import { answerEngineRouter } from "./answerEngine";
import { competitorRouter } from "./competitor";
import { crawlRouter } from "./crawl";
import { dashboardRouter } from "./dashboard";
import { domainProjectRouter } from "./domainProject";
import { promptQueryRouter } from "./promptQuery";
import { promptQueryCrawlRouter } from "./promptQueryCrawl";
import { promptTemplateRouter } from "./promptTemplate";
import { proxyConfigRouter } from "./proxyConfig";
import { scanRouter } from "./scan";
import { sitemapRouter } from "./sitemap";
import { userRouter } from "./user";

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
	promptTemplate: promptTemplateRouter,
	scan: scanRouter,
	answerEngine: answerEngineRouter,
});

export type AppRouter = typeof appRouter;
