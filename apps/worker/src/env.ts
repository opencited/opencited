import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import { env as BrowserCrawlerEnv } from "@opencited/browser-crawler/env";

export const env = createEnv({
	server: {
		REDIS_URL: z.string().url(),
		WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
		WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
		THORDATA_PROXY_API_URL: z.string().url().optional(),
		/** Country-entry gateway for IP whitelist (default pr.thordata.net:9999). */
		THORDATA_PROXY_GATEWAY: z.string().optional(),
		/** Use get-ip API host list instead of gateway (needs PROXY_USERNAME/PASSWORD). */
		THORDATA_PROXY_USE_API_LIST: z
			.enum(["true", "false"])
			.default("false")
			.transform((v) => v === "true"),
		PROXY_SERVER: z.string().optional(),
		PROXY_USERNAME: z.string().optional(),
		PROXY_PASSWORD: z.string().optional(),
		STICKY_PROXY_ENABLED: z.coerce.boolean().default(false),
		CRAWL_RATE_LIMITS: z.string().optional().default("{}"),
	},
	runtimeEnv: process.env,
	extends: [BrowserCrawlerEnv],
});
