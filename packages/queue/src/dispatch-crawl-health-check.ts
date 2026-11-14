import { dispatch, type JobPayload } from "./index";

export async function dispatchCrawlHealthCheck(
	payload: JobPayload<"crawl-health-check">,
): Promise<{ jobId: string }> {
	return dispatch("crawl-health-check", payload);
}
