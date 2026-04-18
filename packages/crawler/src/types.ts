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

export type SitemapType = "urlset" | "sitemapindex";

export interface SitemapInfo {
	url: string;
	type: SitemapType;
	urlCount: number;
	source: "robots.txt" | "standard" | "sitemap-index";
}
