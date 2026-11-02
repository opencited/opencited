import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { z } from "zod";
import { env } from "./env";
import * as schema from "./schema";

export const getFreshDbInstance = () => {
	neonConfig.webSocketConstructor = ws;

	const pool = new Pool({ connectionString: env.DATABASE_URL });
	return drizzle({ client: pool, schema });
};

export type Db = ReturnType<typeof getFreshDbInstance>;
export const dbSchema = z.custom<Db>();

export * from "drizzle-orm";
export * from "./prompt-templates";
export * from "./schema/answerEngine";
export * from "./schema/competitor";
export * from "./schema/crawlBrandMention";
export * from "./schema/crawledPage";
export * from "./schema/crawlReference";
export * from "./schema/crawlSource";
export * from "./schema/crawlVisibilityScore";
export * from "./schema/domainProject";
export * from "./schema/pageAnalysis";
export * from "./schema/promptQuery";
export * from "./schema/promptQueryCrawl";
export * from "./schema/promptTemplate";
export * from "./schema/proxyConfig";
export * from "./schema/publicScan";
export * from "./schema/publicScanEvent";
export * from "./schema/scanLead";
export * from "./schema/sitemap";
export * from "./schema/sitemapUrl";
