import { sleep } from "workflow";
import { start } from "workflow/api";
import { crawlPageWorkflow } from "./crawl-page";
import type { CrawlPageResult } from "./crawl-page";

export interface CrawlSitemapInput {
	sitemapId: string;
	items: Array<{ url: string; sitemapUrlId: string }>;
}

export interface CrawlSitemapResult {
	sitemapId: string;
	total: number;
	succeeded: number;
	failed: number;
	pages: CrawlPageResult[];
}

const BATCH_SIZE = 10;
const BATCH_DELAY = "500ms";

async function crawlBatch(
	items: Array<{ url: string; sitemapUrlId: string }>,
): Promise<CrawlPageResult[]> {
	"use step";
	const results = await Promise.all(
		items.map((item) =>
			start(crawlPageWorkflow, [item.url, item.sitemapUrlId]).then(
				(run) => run.returnValue,
			),
		),
	);
	return results;
}

export async function crawlSitemapWorkflow(
	sitemapId: string,
	items: Array<{ url: string; sitemapUrlId: string }>,
): Promise<CrawlSitemapResult> {
	"use workflow";

	const pages: CrawlPageResult[] = [];

	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const batch = items.slice(i, i + BATCH_SIZE);
		const batchResults = await crawlBatch(batch);
		pages.push(...batchResults);

		if (i + BATCH_SIZE < items.length) {
			await sleep(BATCH_DELAY);
		}
	}

	const succeeded = pages.filter(
		(p) => p.httpStatus === 200 && !p.fetchError,
	).length;
	const failed = pages.length - succeeded;

	return {
		sitemapId,
		total: items.length,
		succeeded,
		failed,
		pages,
	};
}
