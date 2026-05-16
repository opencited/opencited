export {
	openBrowser,
	closeBrowser,
	navigate,
	takeSnapshot,
	screenshot,
	reload,
	goBack,
	goForward,
} from "./browser";

export {
	click,
	type,
	press,
	hover,
	waitFor,
	extractContent,
	evaluate,
	getHtml,
	getText,
	getClipboard,
} from "./actions";

export { Crawler } from "./crawler";
export {
	createLogger,
	defaultLogger,
	type Logger,
	type LogLevel,
} from "./logger";

export {
	CrawlerError,
	AuthenticationError,
	NavigationError,
	ExtractionError,
} from "./errors";

export { PerplexityProvider } from "./providers/perplexity";
export type {
	CrawlerProvider,
	AuthCredentials,
	CrawlResult,
	CrawlMetadata,
} from "./providers";

export type {
	BrowserSession,
	BrowserOptions,
	SnapshotOptions,
	ExtractContentOptions,
	ExtractedContent,
	LinkInfo,
	ImageInfo,
	SourceInfo,
	PageMetadata,
	ActionResult,
} from "./types";
