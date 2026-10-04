import type { AiMentionProbe } from "./types";

const MAX_CRAWLS = 3;
const OVERALL_BUDGET_MS = 3 * 60 * 1000;

export type MentionProbeCrawlFn = (
	query: string,
) => Promise<{ answer: string; citationUrls: string[] }>;

export async function runBrowserMentionProbe(params: {
	domain: string;
	brandName: string | null;
	queries: string[];
	crawl: MentionProbeCrawlFn;
	rowFromCrawl: (input: {
		domain: string;
		brandName: string | null;
		query: string;
		answer: string;
		citationUrls: string[];
	}) => {
		query: string;
		visibility: "visible" | "not-visible";
		excerpt: string;
		citationUrls: string[];
	};
	now?: () => Date;
	startedAt?: number;
	onCrawlError?: (query: string, error: unknown) => void;
}): Promise<AiMentionProbe> {
	const now = params.now ?? (() => new Date());
	const startedAt = params.startedAt ?? now().getTime();
	const queries = params.queries.slice(0, MAX_CRAWLS);
	const rows: Array<{
		query: string;
		visibility: "visible" | "not-visible";
		excerpt: string;
		citationUrls: string[];
	}> = [];

	for (const query of queries) {
		if (now().getTime() - startedAt >= OVERALL_BUDGET_MS) {
			break;
		}
		try {
			const { answer, citationUrls } = await params.crawl(query);
			rows.push(
				params.rowFromCrawl({
					domain: params.domain,
					brandName: params.brandName,
					query,
					answer,
					citationUrls,
				}),
			);
		} catch (error) {
			params.onCrawlError?.(query, error);
		}
	}

	if (rows.length === 0) {
		return { status: "unavailable" };
	}

	return { status: "ok", queries: rows };
}
