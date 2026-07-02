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

export { captureDebugInfo } from "./debug";
export {
	capturePageState,
	probeSourcesCandidates,
	waitForSourcesButton,
	type DebugContext,
	type SourceCandidate,
} from "./debug-state";

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
	type LoggerContext,
} from "@opencited/logger";

export {
	CrawlerError,
	AuthenticationError,
	NavigationError,
	ExtractionError,
	AllProxiesFailedError,
	classifyError,
	shouldRotateProxy,
	toErrorMessage,
	type FailureType,
} from "./errors";

export { PerplexityProvider } from "./providers/perplexity";
export { ChatGPTProvider } from "./providers/chatgpt";
export { createProvider, providerRegistry } from "./providers/factory";
export type {
	CrawlerProvider,
	AuthCredentials,
	CrawlResult,
	CrawlMetadata,
	InlineLink,
} from "./providers";

export type {
	BrowserSession,
	BrowserOptions,
	ProxyOptions,
	SnapshotOptions,
	ExtractContentOptions,
	ExtractedContent,
	LinkInfo,
	ImageInfo,
	SourceInfo,
	PageMetadata,
	ActionResult,
} from "./types";
