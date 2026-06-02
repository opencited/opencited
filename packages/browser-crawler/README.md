# @opencited/browser-crawler

Browser automation package built on Camoufox for web crawling and data extraction.

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
- 🤖 Provider-based architecture (Perplexity, ChatGPT, etc.)
- 🔒 Optional browser persistence for authenticated sessions
- 🪶 Pluggable logging with levels
- 📸 Screenshots and snapshots
- 🔧 Extensible workflow system

## Usage

### Crawler API (Recommended)

The `Crawler` class provides a high-level API for running crawls with automatic browser management:

```typescript
import { Crawler, PerplexityProvider, createLogger } from "@opencited/browser-crawler";

const logger = createLogger("info");
const crawler = new Crawler({ logger });
const provider = new PerplexityProvider();

const result = await crawler.crawl({
	query: "What is TypeScript?",
	provider,
	browserOptions: {
		headless: true,
		persist: false, // Optional: set to true for browser persistence
	},
});

console.log(result.content);
console.log(result.metadata.url);
console.log(result.metadata.timestamp);
```

### Logger Levels

Control log output with the `LOGGER_LEVEL` environment variable or `createLogger()`:

```typescript
// Via environment variable
// LOGGER_LEVEL=silent bun run script.ts
// LOGGER_LEVEL=info bun run script.ts (default)
// LOGGER_LEVEL=debug bun run script.ts

// Or programmatically
const logger = createLogger("debug"); // 'silent' | 'info' | 'debug'
```

| Level | Output |
|-------|--------|
| `silent` | Errors only |
| `info` | Errors + info + warn (default) |
| `debug` | All logs including debug |

### Browser Persistence

Enable browser persistence to reuse authenticated sessions:

```typescript
const result = await crawler.crawl({
	query: "What is TypeScript?",
	provider,
	browserOptions: {
		headless: false,
		persist: true,
		userDataDir: "./.browser-data", // Optional, defaults to ./.browser-data
	},
});
```

### Adding Custom Providers

Implement the `CrawlerProvider` interface to add support for new AI providers:

```typescript
import type { CrawlerProvider, CrawlResult, BrowserSession } from "@opencited/browser-crawler";

export class ChatGPTProvider implements CrawlerProvider {
	readonly name = "chatgpt";
	readonly requiresAuth = true;

	async navigate(session: BrowserSession) {
		await session.page.goto("https://chat.openai.com/");
	}

	async authenticate(session: BrowserSession, credentials?: AuthCredentials) {
		// Provider-specific auth flow
	}

	async submitQuery(session: BrowserSession, query: string) {
		// Submit query
	}

	async waitForResponse(session: BrowserSession) {
		// Wait for response
	}

	async extractResult(session: BrowserSession): Promise<CrawlResult> {
		// Extract result (provider-specific method)
		return {
			provider: this.name,
			query: "",
			content: "...",
			metadata: {
				url: session.page.url(),
				title: await session.page.title(),
				timestamp: new Date(),
				loadTimeMs: 0,
			},
		};
	}
}
```

### Low-Level API

For fine-grained control, use the browser and action functions directly:

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

### Error Handling

The crawler wraps specific errors with context:

```typescript
import { Crawler, ExtractionError, NavigationError, AuthenticationError } from "@opencited/browser-crawler";

const crawler = new Crawler();

try {
	const result = await crawler.crawl({
		query: "test",
		provider: new PerplexityProvider(),
	});
} catch (error) {
	if (error instanceof ExtractionError) {
		console.error("Failed to extract content:", error.message);
		console.error("Provider:", error.provider);
		console.error("Step:", error.step);
		console.error("Cause:", error.cause);
	} else if (error instanceof NavigationError) {
		console.error("Failed to navigate:", error.message);
	} else if (error instanceof AuthenticationError) {
		console.error("Authentication failed:", error.message);
	} else {
		console.error("Unknown error:", error);
	}
}
```

## Providers

### PerplexityProvider

Query Perplexity.ai and extract responses via clipboard:

```typescript
import { Crawler, PerplexityProvider } from "@opencited/browser-crawler";

const crawler = new Crawler();
const provider = new PerplexityProvider();

const result = await crawler.crawl({
	query: "top ai contact center",
	provider,
	browserOptions: { headless: false },
});

console.log(result.content);
```

**Note:** PerplexityProvider extracts content from the page DOM. Firefox/Camoufox does not support clipboard permissions, so a fallback extracts content from the main answer element.

## API Reference

### Crawler Class

```typescript
class Crawler {
	constructor(options?: { logger?: Logger });
	crawl(options: CrawlOptions): Promise<CrawlResult>;
}

interface CrawlOptions {
	query: string;
	provider: CrawlerProvider;
	browserOptions?: BrowserOptions & { persist?: boolean };
	authCredentials?: AuthCredentials;
	logger?: Logger;
}

interface CrawlResult {
	provider: string;
	query: string;
	content: string;
	metadata: {
		url: string;
		title: string;
		timestamp: Date;
		loadTimeMs: number;
	};
	structured?: Record<string, unknown>;
}
```

### Browser Management

```typescript
openBrowser(options?: BrowserOptions): Promise<BrowserSession>
closeBrowser(session: BrowserSession, userDataDir?: string): Promise<void>
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
getClipboard(session: BrowserSession): Promise<string>
evaluate(session: BrowserSession, pageFunction: string): Promise<unknown>
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADLESS` | `true` | `true`, `false`, or `virtual` (virtual display) |
| `LOGGER_LEVEL` | `info` | Log level: `silent` \| `info` \| `debug` |

### Browser Options

```typescript
interface BrowserOptions {
	headless?: boolean | "virtual";
	viewport?: { width: number; height: number };
	userDataDir?: string;
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

# Run with debug logging
LOGGER_LEVEL=debug bun run playground
```

## Installing Camoufox

```bash
# Download Camoufox browser binaries
cd packages/browser-crawler
bunx camoufox-js fetch
```

## Architecture

The browser-crawler package uses a **Strategy Pattern + Orchestrator** architecture:

- **Providers** (`CrawlerProvider` interface): Implement provider-specific automation logic (Perplexity, ChatGPT, etc.)
- **Crawler** (Orchestrator): Manages browser lifecycle, error handling, and logging
- **Actions**: Low-level page interaction wrappers (click, type, waitFor, etc.)
- **Browser**: Browser management via Camoufox (open, close, navigate, etc.)

The package is **DB-agnostic** — it only extracts data and returns results to the caller. Integration with databases or job queues (BullMQ, Workflow SDK) is handled by the consuming application.

## Migration Guide

### From Workflow API (v0.0.0)

If you were using the old `runPerplexityQuery` workflow:

**Before:**
```typescript
import { openBrowser, closeBrowser, navigate, runPerplexityQuery } from "@opencited/browser-crawler";

const session = await openBrowser({ headless: true });
try {
	await navigate(session, "https://www.perplexity.ai/");
	await runPerplexityQuery(session, { query: "test" });
} finally {
	await closeBrowser(session);
}
```

**After:**
```typescript
import { Crawler, PerplexityProvider } from "@opencited/browser-crawler";

const crawler = new Crawler();
const result = await crawler.crawl({
	query: "test",
	provider: new PerplexityProvider(),
	browserOptions: { headless: true },
});
console.log(result.content);
```

Benefits:
- ✅ Automatic browser management
- ✅ Consistent error handling
- ✅ Pluggable logging
- ✅ Easy to swap providers
- ✅ Browser persistence support
