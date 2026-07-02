export const CRAWL_PROVIDER_OPTIONS = [
	{ id: "perplexity" as const, label: "Perplexity" },
	{ id: "chatgpt" as const, label: "ChatGPT" },
] as const;

export type CrawlProviderId = (typeof CRAWL_PROVIDER_OPTIONS)[number]["id"];

export const defaultCrawlProvider: CrawlProviderId = "perplexity";
