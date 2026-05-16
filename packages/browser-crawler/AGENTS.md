# Browser Crawler Package (`@opencited/browser-crawler`)

## Purpose

Browser automation with Playwright for web crawling and data extraction from dynamic/AI-powered sites.

## Architecture

**Strategy Pattern + Orchestrator:**

- **Providers** (`CrawlerProvider` interface): Implement provider-specific automation (Perplexity, ChatGPT, etc.)
- **Crawler** (Orchestrator): Manages browser lifecycle, error handling, logging
- **Actions**: Low-level Playwright wrappers (click, type, etc.)
- **Browser**: Browser management (open, close, navigate)

**DB-agnostic**: Only extracts data — integration with databases/job queues is handled by the consumer.

## Directory Structure

```
src/
├── index.ts           # exports
├── crawler.ts         # orchestrator class
├── browser.ts         # browser lifecycle
├── actions.ts         # page interactions
├── errors.ts          # typed error classes
├── logger.ts          # pluggable logging
├── types.ts           # shared types
└── providers/
    ├── base.ts        # CrawlerProvider interface
    ├── types.ts       # provider types
    ├── index.ts       # provider exports
    └── perplexity.ts  # Perplexity.ai provider
```

## Key Exports

| Export | Type | Purpose |
|--------|------|---------|
| `Crawler` | Class | High-level crawl orchestrator |
| `PerplexityProvider` | Class | Perplexity.ai automation |
| `openBrowser` | Function | Launch browser session |
| `closeBrowser` | Function | Close browser session |
| `extractContent` | Function | Extract text/links/images |
| `CrawlerProvider` | Interface | Provider contract |
| `CrawlerError` | Class | Base error type |
| `NavigationError` | Class | Navigation failure |
| `AuthenticationError` | Class | Auth failure |
| `ExtractionError` | Class | Extraction failure |

## Usage

```typescript
import { Crawler, PerplexityProvider } from "@opencited/browser-crawler";

const crawler = new Crawler();
const result = await crawler.crawl({
  query: "What is TypeScript?",
  provider: new PerplexityProvider(),
  browserOptions: { headless: true },
});
```

## Adding Providers

Implement `CrawlerProvider`:

```typescript
class MyProvider implements CrawlerProvider {
  readonly name = "my-provider";
  readonly requiresAuth = false;

  async navigate(session: BrowserSession) { ... }
  async submitQuery(session: BrowserSession, query: string) { ... }
  async waitForResponse(session: BrowserSession) { ... }
  async extractResult(session: BrowserSession): Promise<CrawlResult> { ... }
}
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGGER_LEVEL` | `info` | `silent` | `info` | `debug` |
| `HEADLESS` | `true` | Show browser UI when `false` |
