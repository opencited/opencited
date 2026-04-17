export interface CrawledUrl {
	url: string;
	lastmod: string | null;
	changefreq: Changefreq | null;
	priority: string | null;
}

export type Changefreq =
	| "always"
	| "hourly"
	| "daily"
	| "weekly"
	| "monthly"
	| "yearly";

export interface CrawlResult {
	urls: CrawledUrl[];
}

export interface CrawlError {
	message: string;
}
