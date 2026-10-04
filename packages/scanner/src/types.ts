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

export interface HomepageSnapshot {
	title: string | null;
	metaDescription: string | null;
	h1: string | null;
	brandName: string | null;
	textExcerpt: string;
}

export interface ScanResult {
	domain: string;
	finalUrl: string;
	score: number;
	issues: ScanIssue[];
	durationMs: number;
	fetchedAt: string;
	homepageSnapshot: HomepageSnapshot;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type LookupFn = (hostname: string) => Promise<string[]>;

export interface ScanOptions {
	fetcher?: FetchLike;
	lookup?: LookupFn;
	timeoutMs?: number;
}
