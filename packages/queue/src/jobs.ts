import { z } from "zod";
import type { DefaultJobOptions } from "bullmq";

export interface JobDefinition<T extends z.ZodType> {
	payload: T;
	options: DefaultJobOptions;
}

export const jobs = {
	"perplexity-crawl": {
		payload: z.object({
			query: z.string(),
			promptQueryId: z.string(),
			promptQueryCrawlId: z.string(),
		}),
		options: {
			attempts: 0,
			backoff: {
				type: "exponential",
				delay: 1000,
			},
		},
	},
} satisfies Record<string, JobDefinition<z.ZodType>>;

export type JobName = keyof typeof jobs;
export type JobPayload<K extends JobName> = z.infer<
	(typeof jobs)[K]["payload"]
>;
