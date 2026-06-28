export interface CrawlResult {
	provider: string;
	query: string;
	content: string;
	metadata: CrawlMetadata;
	structured?: StructuredCrawlData;
	/** The proxy that was used to successfully complete this crawl, if any. */
	usedProxy?: import("../types").ProxyOptions;
}

export interface CrawlMetadata {
	url: string;
	title: string;
	timestamp: Date;
	loadTimeMs: number;
}

export interface StructuredCrawlData {
	citations: CitationSource[];
	brandMentions: BrandMention[];
	relatedQuestions?: string[];
	answerFormat?: AnswerFormat;
	headings?: string[];
}

export interface CitationSource {
	domain: string;
	url: string;
	title?: string;
	description?: string;
	position: number;
	favicon?: string;
	sourceName?: string;
}

export interface BrandMention {
	brandName: string;
	context: string;
	brandUrl?: string;
}

export type AnswerFormat =
	| "numbered_list"
	| "paragraph"
	| "comparison_table"
	| "conversational"
	| "unknown";

export type AuthCredentials = Record<string, string>;

/**
 * Inline link extracted from a chat-engine response (e.g., ChatGPT's
 * `<a class="decorated-link">` anchors). Populated in Slice 3.
 */
export interface InlineLink {
	title: string;
	url: string;
	domain: string;
}
