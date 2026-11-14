export {
	createLogger,
	defaultLogger,
	type Logger,
	type LoggerContext,
	type LogLevel,
} from "@opencited/logger";
export {
	click,
	evaluate,
	extractContent,
	getClipboard,
	getHtml,
	getText,
	hover,
	press,
	type,
	waitFor,
} from "./actions";
export {
	closeBrowser,
	goBack,
	goForward,
	navigate,
	openBrowser,
	reload,
	screenshot,
	takeSnapshot,
} from "./browser";
export { Crawler } from "./crawler";
export { captureDebugInfo } from "./debug";
export {
	capturePageState,
	type DebugContext,
	probeSourcesCandidates,
	type SourceCandidate,
	waitForSourcesButton,
} from "./debug-state";

export {
	AllProxiesFailedError,
	AuthenticationError,
	CrawlAbortedError,
	CrawlerError,
	classifyError,
	ExtractionError,
	type FailureType,
	NavigationError,
	shouldRotateProxy,
	toErrorMessage,
} from "./errors";
export type {
	AuthCredentials,
	CrawlerProvider,
	CrawlMetadata,
	CrawlResult,
	InlineLink,
} from "./providers";
export { ChatGPTProvider } from "./providers/chatgpt";
export { createProvider, providerRegistry } from "./providers/factory";
export { PerplexityProvider } from "./providers/perplexity";

export type {
	ActionResult,
	BrowserOptions,
	BrowserSession,
	ExtractContentOptions,
	ExtractedContent,
	ImageInfo,
	LinkInfo,
	PageMetadata,
	ProxyOptions,
	SnapshotOptions,
	SourceInfo,
} from "./types";
