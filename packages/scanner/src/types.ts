export type CheckId =
	| "robots-txt"
	| "ai-bot-access"
	| "sitemap"
	| "llms-txt"
	| "json-ld"
	| "https"
	| "canonical-host"
	| "x-robots-tag";

export interface ScanIssue {
	check: CheckId;
	goal: string;
	issue: string;
	howToFix: string;
	weight: number;
}

export interface ScanResult {
	domain: string;
	finalUrl: string;
	score: number;
	issues: ScanIssue[];
	durationMs: number;
	fetchedAt: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type LookupFn = (hostname: string) => Promise<string[]>;

export interface ScanOptions {
	fetcher?: FetchLike;
	lookup?: LookupFn;
	timeoutMs?: number;
}
