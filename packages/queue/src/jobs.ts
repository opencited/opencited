import { crawlProviderEnum } from "@opencited/db";
import type { DefaultJobOptions } from "bullmq";
import { z } from "zod";

export interface JobDefinition<T extends z.ZodType> {
	payload: T;
	options: DefaultJobOptions;
}

const crawlJobPayload = z.object({
	query: z.string(),
	promptQueryId: z.string(),
	promptQueryCrawlId: z.string(),
	domainProjectId: z.string(),
	provider: crawlProviderEnum,
});

export const jobs = {
	"perplexity-crawl": {
		payload: crawlJobPayload,
		options: {
			attempts: 0,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
		},
	},
	"chatgpt-crawl": {
		payload: crawlJobPayload,
		options: {
			attempts: 0,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
		},
	},
	"scan-mention-probe": {
		payload: z.object({
			publicScanId: z.string().uuid(),
			domain: z.string().min(1),
			brandName: z.string().nullable(),
			queries: z.array(z.string().min(1)).min(1).max(3),
		}),
		options: {
			attempts: 1,
		},
	},
	"sentiment-retry": {
		// Single-attempt re-score of the sentiment sub-score for a crawl where
		// the original LLM call fell back to neutral. The handler re-runs only
		// the sentiment step (not the whole composite) and updates the row in
		// place. See docs/adr/0002-visibility-score.md §"Computation timing".
		payload: z.object({
			crawlId: z.string(),
			promptQueryCrawlId: z.string(),
			domainProjectId: z.string(),
		}),
		options: {
			attempts: 1,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
		},
	},
	"crawl-health-check": {
		// Daily browser canary. It stops after the raw CrawlResult, so it never
		// writes user crawl rows or spends LLM credits. Crawler already rotates
		// proxies inside one attempt, so retrying the whole daily job would only
		// duplicate browsers and delay the alert.
		payload: z.object({
			trigger: z.enum(["schedule", "manual"]),
			engines: z.array(crawlProviderEnum).min(1).optional(),
		}),
		options: {
			attempts: 1,
			removeOnComplete: { count: 30 },
			removeOnFail: { count: 30 },
		},
	},
} satisfies Record<string, JobDefinition<z.ZodType>>;

export type JobName = keyof typeof jobs;
export type JobPayload<K extends JobName> = z.infer<
	(typeof jobs)[K]["payload"]
>;
