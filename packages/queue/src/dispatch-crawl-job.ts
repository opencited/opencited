import type { CrawlProvider } from "@opencited/db";
import { dispatch, type JobPayload } from "./index";

const CRAWL_JOB_NAMES: Record<CrawlProvider, string> = {
	perplexity: "perplexity-crawl",
	chatgpt: "chatgpt-crawl",
};

export function getJobNameForProvider(provider: CrawlProvider): string {
	const jobName = CRAWL_JOB_NAMES[provider];
	if (!jobName) {
		throw new Error(
			`No crawl job defined for provider: "${provider}". Registered: ${Object.keys(CRAWL_JOB_NAMES).join(", ")}`,
		);
	}
	return jobName;
}

type CrawlJobPayload = JobPayload<"perplexity-crawl">;

export async function dispatchCrawlJob(
	provider: CrawlProvider,
	payload: Omit<CrawlJobPayload, "provider"> & { provider: CrawlProvider },
): Promise<{ jobId: string }> {
	const jobName = getJobNameForProvider(provider);
	return dispatch(jobName as "perplexity-crawl", payload as CrawlJobPayload);
}
