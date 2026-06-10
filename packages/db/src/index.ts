import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";
import { z } from "zod";
import { env } from "./env";

export const getFreshDbInstance = () => {
	neonConfig.webSocketConstructor = ws;

	const pool = new Pool({ connectionString: env.DATABASE_URL });
	return drizzle({ client: pool, schema });
};

export type Db = ReturnType<typeof getFreshDbInstance>;
export const dbSchema = z.custom<Db>();

export * from "./schema/domainProject";
export * from "./schema/sitemap";
export * from "./schema/sitemapUrl";
export * from "./schema/crawledPage";
export * from "./schema/pageAnalysis";
export * from "./schema/promptQuery";
export * from "./schema/promptQueryCrawl";
export * from "./schema/competitor";
export * from "./schema/crawlSource";
export * from "./schema/crawlBrandMention";
export * from "./schema/proxyConfig";
export * from "./schema/promptTemplate";
export * from "./prompt-templates";
export * from "drizzle-orm";
