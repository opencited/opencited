import { createHash } from "node:crypto";
import { fetchPage, extractContent } from "@opencited/crawler";
import { analyzePageAction } from "../../ai/analyzePageAction";
import type { LLMInsights } from "../../ai/analyzePageAction";

export interface CrawlPageInput {
	url: string;
	sitemapUrlId: string;
}

export interface CrawlPageResult {
	sitemapUrlId: string;
	url: string;
	httpStatus: number | null;
	contentLength: number | null;
	contentHash: string | null;
	fetchError: string | null;
	content: {
		wordCount: number;
		textHtmlRatio: string;
		imagesTotal: number;
		imagesWithAlt: number;
		internalLinks: number;
		externalLinks: number;
		domDepthAvg: string;
		extractedText: string;
		headingStructure: {
			h1: string[];
			h2: string[];
			h3: string[];
			h4: string[];
			h5: string[];
			h6: string[];
		};
	} | null;
	llmInsights: LLMInsights | null;
}

async function computeHash(html: string): Promise<string> {
	"use step";
	return createHash("sha256").update(html, "utf8").digest("hex");
}

async function doFetchPage(url: string) {
	"use step";
	return fetchPage(url);
}

async function doExtractContent(html: string, pageUrl: string) {
	"use step";
	return extractContent(html, pageUrl);
}

async function doAnalyzeWithLLM(text: string) {
	"use step";
	return analyzePageAction(text);
}

async function doCrawl(
	url: string,
	sitemapUrlId: string,
): Promise<CrawlPageResult> {
	"use step";
	let pageResult: Awaited<ReturnType<typeof doFetchPage>> | null = null;
	let contentResult: Awaited<ReturnType<typeof doExtractContent>> | null = null;
	let llmInsights: LLMInsights | null = null;
	let fetchError: string | null = null;
	let contentHash: string | null = null;

	try {
		pageResult = await doFetchPage(url);
	} catch (err) {
		fetchError = err instanceof Error ? err.message : "Unknown fetch error";
	}

	if (pageResult && pageResult.httpStatus === 200) {
		try {
			contentResult = await doExtractContent(pageResult.html, url);
		} catch {
			contentResult = null;
		}

		if (contentResult && contentResult.extractedText.length > 0) {
			try {
				llmInsights = await doAnalyzeWithLLM(contentResult.extractedText);
			} catch {
				llmInsights = null;
			}
		}

		try {
			contentHash = await computeHash(pageResult.html);
		} catch {
			contentHash = null;
		}
	}

	return {
		sitemapUrlId,
		url,
		httpStatus: pageResult?.httpStatus ?? null,
		contentLength: pageResult?.contentLength ?? null,
		contentHash,
		fetchError,
		content: contentResult
			? {
					wordCount: contentResult.wordCount,
					textHtmlRatio: contentResult.textHtmlRatio,
					imagesTotal: contentResult.imagesTotal,
					imagesWithAlt: contentResult.imagesWithAlt,
					internalLinks: contentResult.internalLinks,
					externalLinks: contentResult.externalLinks,
					domDepthAvg: contentResult.domDepthAvg,
					extractedText: contentResult.extractedText.slice(0, 50_000),
					headingStructure: contentResult.headingStructure,
				}
			: null,
		llmInsights,
	};
}

export async function crawlPageWorkflow(
	url: string,
	sitemapUrlId: string,
): Promise<CrawlPageResult> {
	"use workflow";

	return await doCrawl(url, sitemapUrlId);
}
