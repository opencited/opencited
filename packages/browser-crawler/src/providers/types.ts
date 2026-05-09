export interface CrawlResult {
	provider: string;
	query: string;
	content: string;
	metadata: CrawlMetadata;
	structured?: Record<string, unknown>;
}

export interface CrawlMetadata {
	url: string;
	title: string;
	timestamp: Date;
	loadTimeMs: number;
}

export type AuthCredentials = Record<string, string>;
