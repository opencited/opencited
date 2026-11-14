import type { CrawlResult } from "@opencited/browser-crawler";

/**
 * Shared floor for a usable answer. `scripts/test-perplexity.ts` uses the
 * same 80-character minimum; ChatGPT extraction already rejects anything
 * under 50 characters, so this is deliberately a little stricter.
 */
export const MIN_CRAWL_HEALTH_CONTENT_CHARS = 80;

/** Engines the daily canary knows how to crawl. Extend with the factory. */
export const CRAWL_HEALTH_ENGINES = ["chatgpt", "perplexity"] as const;

export type CrawlHealthEngine = (typeof CRAWL_HEALTH_ENGINES)[number];
export type CrawlHealthStatus = "ok" | "degraded" | "failed" | "skipped";
export type CrawlHealthTrigger = "schedule" | "manual";

/** Stable Axiom filter keys. Keep these strings free of prose. */
export const CRAWL_HEALTH_EVENT = "crawl_health_check";
export const CRAWL_HEALTH_DAILY_EVENT = "crawl_health_check_daily";

export const DEFAULT_CRAWL_HEALTH_QUERY =
	"What is the best CRM for small business?";

export interface CrawlHealthCounts {
	contentLength: number;
	inlineLinksCount: number;
	sourcePanelLinksCount: number;
	sourcesCount: number;
}

export interface CrawlHealthClassification extends CrawlHealthCounts {
	status: Exclude<CrawlHealthStatus, "skipped">;
	error: string | null;
}

type CrawlResultContent = Pick<CrawlResult, "content" | "structured">;

export function crawlHealthCounts(
	result: CrawlResultContent,
): CrawlHealthCounts {
	const inlineLinksCount = result.structured?.inlineLinks.length ?? 0;
	const sourcePanelLinksCount = result.structured?.sourcePanelLinks.length ?? 0;

	return {
		contentLength: result.content.trim().length,
		inlineLinksCount,
		sourcePanelLinksCount,
		sourcesCount: inlineLinksCount + sourcePanelLinksCount,
	};
}

/**
 * Classify a raw browser crawl result (the `CrawlResult` from `Crawler.crawl`,
 * before intake, LLM extraction, or scoring).
 *
 * - `ok`: content is long enough and at least one citation was extracted.
 * - `degraded`: content is present but no inline or source-panel links. This
 *   is the 9 Nov production failure: the answer rendered, the source button
 *   did not, and the crawl still finished as "completed".
 * - `failed`: extraction produced less than `MIN_CRAWL_HEALTH_CONTENT_CHARS`.
 */
export function classifyCrawlResult(
	result: CrawlResultContent,
): CrawlHealthClassification {
	const counts = crawlHealthCounts(result);

	if (counts.contentLength < MIN_CRAWL_HEALTH_CONTENT_CHARS) {
		return {
			...counts,
			status: "failed",
			error: `content_too_short: ${counts.contentLength} chars, need at least ${MIN_CRAWL_HEALTH_CONTENT_CHARS}`,
		};
	}

	if (counts.sourcesCount === 0) {
		return {
			...counts,
			status: "degraded",
			error: null,
		};
	}

	return {
		...counts,
		status: "ok",
		error: null,
	};
}

const STATUS_SEVERITY: Record<CrawlHealthStatus, number> = {
	skipped: 0,
	ok: 1,
	degraded: 2,
	failed: 3,
};

/**
 * Worst status among the engines that actually ran. Engines that were skipped
 * do not make the day look healthy, but they do not create a failure either:
 * if every engine was skipped the overall status is `skipped`.
 */
export function worstCrawlHealthStatus(
	statuses: CrawlHealthStatus[],
): CrawlHealthStatus {
	const ran = statuses.filter((status) => status !== "skipped");
	if (ran.length === 0) return "skipped";

	return ran.reduce((worst, status) =>
		STATUS_SEVERITY[status] > STATUS_SEVERITY[worst] ? status : worst,
	);
}

/**
 * Host:port for the Axiom event. Never include proxy credentials, and drop
 * the scheme because every public-scan proxy option is HTTP.
 */
export function proxyServerLabel(server: string | undefined): string | null {
	if (!server) return null;

	const withoutScheme = server.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
	const withoutCredentials = withoutScheme.replace(/^[^@/]*@/, "");
	const hostAndPort = withoutCredentials.replace(/\/.*$/, "").trim();

	return hostAndPort.length > 0 ? hostAndPort : null;
}
