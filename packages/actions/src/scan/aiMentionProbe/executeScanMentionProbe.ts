import type { JobPayload } from "@opencited/queue";
import { probeRowFromCrawl } from "./probeRowFromCrawl";
import {
	runBrowserMentionProbe,
	type MentionProbeCrawlFn,
} from "./runBrowserMentionProbe";

export async function executeScanMentionProbe(
	payload: JobPayload<"scan-mention-probe">,
	crawl: MentionProbeCrawlFn,
	now: () => Date = () => new Date(),
	onCrawlError?: (query: string, error: unknown) => void,
) {
	return runBrowserMentionProbe({
		domain: payload.domain,
		brandName: payload.brandName,
		queries: payload.queries,
		crawl,
		rowFromCrawl: probeRowFromCrawl,
		now,
		onCrawlError,
	});
}
