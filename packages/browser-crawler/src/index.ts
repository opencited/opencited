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

export { runPerplexityQuery } from "./workflows/perplexity";

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

export type { PerplexityOptions } from "./workflows/perplexity";
