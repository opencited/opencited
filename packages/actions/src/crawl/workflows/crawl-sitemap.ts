import { sleep } from "workflow";
import { start } from "workflow/api";
import { db } from "@opencited/db";
import { crawlPageWorkflow } from "./crawl-page";
import type { CrawlPageResult } from "./crawl-page";
import { crawledPageUpsertBatchAction } from "../crawledPageUpsertBatchAction";
import { pageAnalysisUpsertBatchAction } from "../pageAnalysisUpsertBatchAction";

export interface CrawlSitemapInput {
	sitemapId: string;
	items: Array<{ url: string; sitemapUrlId: string }>;
}

export interface CrawlSitemapResult {
	sitemapId: string;
	total: number;
	succeeded: number;
	failed: number;
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

function getCrawlStatus(
	result: CrawlPageResult,
): "error" | "analyzed" | "fetched" {
	if (result.fetchError) return "error";
	if (result.content) return "analyzed";
	return "fetched";
}

async function saveBatchResults(results: CrawlPageResult[]) {
	"use step";
	const mockCtx = { db, userId: null, isAuthenticated: false };

	const pageInputs = results.map((result) => ({
		sitemapUrlId: result.sitemapUrlId,
		url: result.url,
		httpStatus: result.httpStatus,
		contentLength: result.contentLength,
		contentHash: result.contentHash,
		fetchError: result.fetchError,
		crawlStatus: getCrawlStatus(result),
		fetchedAt: new Date().toISOString(),
	}));

	const { saved } = await crawledPageUpsertBatchAction({
		input: { pages: pageInputs },
		ctx: mockCtx,
	});

	const savedMap = new Map<string, string>(
		saved.map((s: any) => [s.sitemapUrlId, s.id]),
	);

	const analysisInputs = results
		.filter((r) => r.content || r.llmInsights)
		.map((result) => {
			const crawledPageId = savedMap.get(result.sitemapUrlId);
			if (!crawledPageId) return null;

			return {
				crawledPageId: crawledPageId,
				wordCount: result.content?.wordCount ?? null,
				textHtmlRatio: result.content?.textHtmlRatio ?? null,
				headingStructure: result.content?.headingStructure ?? null,
				imagesTotal: result.content?.imagesTotal ?? null,
				imagesWithAlt: result.content?.imagesWithAlt ?? null,
				internalLinks: result.content?.internalLinks ?? null,
				externalLinks: result.content?.externalLinks ?? null,
				domDepthAvg: result.content?.domDepthAvg ?? null,
				tone: result.llmInsights?.tone ?? null,
				sentiment: result.llmInsights?.sentiment ?? null,
				sentimentScore: result.llmInsights?.sentimentScore ?? null,
				subjectivity: result.llmInsights?.subjectivity ?? null,
				perceivedPageType: result.llmInsights?.perceivedPageType ?? null,
				perceivedIntent: result.llmInsights?.perceivedIntent ?? null,
				perceivedAudience: result.llmInsights?.perceivedAudience ?? null,
				namedEntities: result.llmInsights?.namedEntities ?? null,
				verbTense: result.llmInsights?.verbTense ?? null,
				extractedText: result.content?.extractedText ?? null,
			};
		})
		.filter((a): a is NonNullable<typeof a> => a !== null);

	if (analysisInputs.length > 0) {
		await pageAnalysisUpsertBatchAction({
			input: { analyses: analysisInputs },
			ctx: mockCtx,
		});
	}
}

export async function crawlSitemapWorkflow(
	sitemapId: string,
	items: Array<{ url: string; sitemapUrlId: string }>,
): Promise<CrawlSitemapResult> {
	"use workflow";

	let succeeded = 0;
	let failed = 0;

	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const batch = items.slice(i, i + BATCH_SIZE);
		const batchResults = await crawlBatch(batch);

		await saveBatchResults(batchResults);

		succeeded += batchResults.filter(
			(p) => p.httpStatus === 200 && !p.fetchError,
		).length;
		failed +=
			batchResults.length -
			batchResults.filter((p) => p.httpStatus === 200 && !p.fetchError).length;

		if (i + BATCH_SIZE < items.length) {
			await sleep(BATCH_DELAY);
		}
	}

	return {
		sitemapId,
		total: items.length,
		succeeded,
		failed,
	};
}
