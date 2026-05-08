# @opencited/browser-crawler

Browser automation package built on Playwright for web crawling and data extraction.

## Quick Start

```bash
# Run the playground (opens Perplexity.ai)
bun run playground

# Run with visible browser (for debugging)
HEADLESS=false bun run playground
```

## Features

- 🌐 Browser management (open, close, navigate)
- 🖱️ Page interactions (click, type, press keys, hover)
- 📊 Content extraction (text, links, images, sources)
- 📸 Screenshots and snapshots
- 🔧 Extensible workflow system

## Usage

### Basic Example

```typescript
import {
	openBrowser,
	closeBrowser,
	navigate,
	extractContent,
} from "@opencited/browser-crawler";

const session = await openBrowser({ headless: true });

try {
	await navigate(session, "https://example.com");

	const content = await extractContent(session, {
		text: true,
		links: true,
		images: true,
	});

	console.log(content.title);
	console.log(content.metadata.wordCount);
	console.log(content.links);
} finally {
	await closeBrowser(session);
}
```

### Playground

The playground script opens Perplexity.ai for manual testing:

```bash
bun run playground
```

Close the browser window to exit the script.

### Perplexity Example

```typescript
import {
	openBrowser,
	closeBrowser,
	navigate,
	runPerplexityQuery,
} from "@opencited/browser-crawler";

const session = await openBrowser({ headless: true });

try {
	await navigate(session, "https://www.perplexity.ai/");

	await runPerplexityQuery(session, {
		query: "What is TypeScript?",
		waitForResponse: true,
		extractSources: true,
	});
} finally {
	await closeBrowser(session);
}
```

## API

### Browser Management

```typescript
openBrowser(options?: BrowserOptions): Promise<BrowserSession>
closeBrowser(session: BrowserSession): Promise<void>
navigate(session: BrowserSession, url: string): Promise<void>
takeSnapshot(session: BrowserSession): Promise<string>
screenshot(session: BrowserSession, filename?: string): Promise<string>
```

### Page Actions

```typescript
click(session: BrowserSession, selector: string): Promise<boolean>
type(session: BrowserSession, selector: string, text: string): Promise<boolean>
press(session: BrowserSession, key: string): Promise<boolean>
hover(session: BrowserSession, selector: string): Promise<boolean>
waitFor(session: BrowserSession, selector: string, timeout?: number): Promise<boolean>
```

### Content Extraction

```typescript
extractContent(
	session: BrowserSession,
	options?: ExtractContentOptions
): Promise<ExtractedContent>

getHtml(session: BrowserSession, selector?: string): Promise<string>
getText(session: BrowserSession, selector?: string): Promise<string>
evaluate(session: BrowserSession, pageFunction: string): Promise<unknown>
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADLESS` | `true` | Set to `false` to show browser UI |

### Browser Options

```typescript
interface BrowserOptions {
	headless?: boolean;
	browserName?: "chromium" | "firefox" | "webkit";
	viewport?: { width: number; height: number };
	userAgent?: string;
}
```

## Workflows

Workflows are pre-built automation sequences for specific websites:

- `runPerplexityQuery` - Query Perplexity.ai and extract responses + sources

Create custom workflows in `src/workflows/`:

```typescript
export async function myWorkflow(
	session: BrowserSession,
	options: MyOptions,
): Promise<void> {
	await waitFor(session, "#search-input");
	await type(session, "#search-input", options.query);
	await press(session, "Enter");
	await waitFor(session, ".results");
	const content = await extractContent(session);
	return content;
}
```

## Development

```bash
# Typecheck
bun run tsc

# Run playground (opens Perplexity.ai)
bun run playground

# Run with visible browser
HEADLESS=false bun run playground

# Quick test
bun run test
```

## Installing Playwright Browsers

If browsers are not installed:

```bash
bunx playwright install chromium
bunx playwright install firefox  # optional
bunx playwright install webkit   # optional
```
