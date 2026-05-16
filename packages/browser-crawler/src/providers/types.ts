export interface CrawlResult {
	provider: string;
	query: string;
	content: string;
	metadata: CrawlMetadata;
	structured?: StructuredCrawlData;
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
	position: number;
	brandUrl?: string;
}

export type AnswerFormat =
	| "numbered_list"
	| "paragraph"
	| "comparison_table"
	| "conversational"
	| "unknown";

export type AuthCredentials = Record<string, string>;
