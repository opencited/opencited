import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { defaultLogger } from "@opencited/logger";
import ws from "ws";
import * as schema from "./schema";
import { z } from "zod";
import { env } from "./env";

neonConfig.webSocketConstructor = ws;

const logger = defaultLogger.withContext({ component: "db" });

export interface DbClientOptions {
	/** Replaces the default logger when the pool emits an `'error'` event. */
	onPoolError?: (error: Error) => void;
}

/**
 * Creates a Drizzle client together with the Neon pool backing it. Callers
 * that open short-lived connections (workers, scripts) must `await pool.end()`
 * when they are done; `getFreshDbInstance` keeps the pool alive implicitly.
 */
export const getFreshDbInstanceWithPool = (options?: DbClientOptions) => {
	const pool = new Pool({ connectionString: env.DATABASE_URL });

	// Neon closes idle WebSockets server-side. When that happens the Pool
	// emits `'error'`; EventEmitter throws when an `'error'` event has no
	// listener, which would take down the whole process. Log it instead — the
	// pool drops the dead client and reconnects on the next query.
	pool.on("error", (error: Error) => {
		if (options?.onPoolError) {
			options.onPoolError(error);
			return;
		}

		logger.error("Neon pool client error", {
			error: error.message,
			stack: error.stack,
		});
	});

	const db = drizzle({ client: pool, schema });
	return { db, pool };
};

export type Db = ReturnType<typeof getFreshDbInstanceWithPool>["db"];
export type DbPool = ReturnType<typeof getFreshDbInstanceWithPool>["pool"];

export const getFreshDbInstance = () => getFreshDbInstanceWithPool().db;
export const dbSchema = z.custom<Db>();

export * from "./schema/answerEngine";
export * from "./schema/domainProject";
export * from "./schema/sitemap";
export * from "./schema/sitemapUrl";
export * from "./schema/crawledPage";
export * from "./schema/pageAnalysis";
export * from "./schema/promptQuery";
export * from "./schema/promptQueryCrawl";
export * from "./schema/competitor";
export * from "./schema/crawlSource";
export * from "./schema/crawlReference";
export * from "./schema/crawlBrandMention";
export * from "./schema/crawlVisibilityScore";
export * from "./schema/proxyConfig";
export * from "./schema/promptTemplate";
export * from "./schema/publicScan";
export * from "./schema/publicScanEvent";
export * from "./schema/scanLead";
export * from "./prompt-templates";
export * from "drizzle-orm";
