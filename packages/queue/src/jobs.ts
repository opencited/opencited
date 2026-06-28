import { z } from "zod";
import type { DefaultJobOptions } from "bullmq";
import { crawlProviderEnum } from "@opencited/db";

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
} satisfies Record<string, JobDefinition<z.ZodType>>;

export type JobName = keyof typeof jobs;
export type JobPayload<K extends JobName> = z.infer<
	(typeof jobs)[K]["payload"]
>;
