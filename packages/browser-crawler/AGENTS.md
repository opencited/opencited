# Browser Crawler Package (`@opencited/browser-crawler`)

## Purpose

Browser automation with Camoufox for web crawling and data extraction from dynamic/AI-powered sites.

## Architecture

**Strategy Pattern + Orchestrator + Factory Registry:**

- **Providers** (`CrawlerProvider` interface): Implement provider-specific automation (Perplexity, ChatGPT, etc.)
- **Crawler** (Orchestrator): Manages browser lifecycle, error handling, logging
- **Provider Factory** (`providerFactory` in `providers/factory.ts`): Maps a provider name string to a constructor. The worker calls `createProvider(name)` and gets back a configured instance. Adding a new provider means one new file in `providers/` and one entry in the factory map.
- **Actions**: Low-level page interaction wrappers (click, type, etc.)
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
├── types.ts           # shared types
└── providers/
    ├── base.ts        # CrawlerProvider interface
    ├── types.ts       # provider types (CitationSource, InlineLink, CrawlResult, etc.)
    ├── factory.ts     # providerFactory — name → constructor map
    ├── index.ts       # provider exports
    ├── perplexity.ts  # Perplexity.ai provider
    └── chatgpt.ts     # ChatGPT provider
```

## Key Exports

| Export | Type | Purpose |
|--------|------|---------|
| `Crawler` | Class | High-level crawl orchestrator |
| `PerplexityProvider` | Class | Perplexity.ai automation |
| `ChatGPTProvider` | Class | ChatGPT automation (chatgpt.com, ProseMirror editor) |
| `createProvider` | Function | Factory — instantiate a provider by name |
| `providerRegistry` | Object | Map of provider name → constructor |
| `openBrowser` | Function | Launch browser session |
| `closeBrowser` | Function | Close browser session |
| `extractContent` | Function | Extract text/links/images |
| `CrawlerProvider` | Interface | Provider contract |
| `CitationSource` | Type | Search-engine citation (Perplexity sources panel) |
| `InlineLink` | Type | Chat-engine inline anchor (ChatGPT decorated-link) |
| `CrawlerError` | Class | Base error type |
| `NavigationError` | Class | Navigation failure |
| `AuthenticationError` | Class | Auth failure |
| `ExtractionError` | Class | Extraction failure |

## Usage

```typescript
import { Crawler, createProvider } from "@opencited/browser-crawler";

const crawler = new Crawler();
const result = await crawler.crawl({
  query: "What is TypeScript?",
  provider: createProvider("chatgpt"),
  browserOptions: { headless: true },
});
```

## Provider Reference

### Perplexity

- **URL:** `https://www.perplexity.ai/`
- **Auth:** `requiresAuth: false`
- **Input:** `<textarea id="ask-input">`, Enter to submit
- **Response container:** `.prose` inside `div[id^="markdown-content-"]`
- **Citations:** Dedicated sources panel + inline `[1]`-style markers. Each citation card has a URL, title, domain, favicon. Extracted into `CitationSource[]`.
- **Streaming:** Detect via the stop button visibility + content stability for 2s
- **Cloudflare:** May show a challenge. `waitForCloudflareChallenge()` polls up to 15s.

### ChatGPT

- **URL:** `https://chatgpt.com/`
- **Auth:** `requiresAuth: false` (works in incognito, no login needed for queries)
- **Input:** ProseMirror contenteditable div `#prompt-textarea.ProseMirror`. The `<textarea>` is a hidden fallback (`display: none`) and must not be targeted. Click the ProseMirror div to focus, then `keyboard.type()`.
- **Sign-in popup:** On first visit, ChatGPT shows a "Sign in with Google" modal in the top-right. Dismiss it before interacting with the input: click outside, press Escape, or remove `[role='dialog']` elements via JS.
- **Response container:** `.markdown.prose` (class `markdown prose dark:prose-invert wrap-break-word w-full dark markdown-new-styling`). The response is standard markdown HTML — `<p>`, `<table>`, `<ul>`, etc.
- **Citations / inline links:** ChatGPT has no citation panel. It embeds `<a class="decorated-link">` anchors inline in the response prose as it mentions a brand or product. Extract these into `InlineLink[]`. The link text becomes `title`, the `href` becomes `url`, the parsed hostname becomes `domain`.
- **Streaming:** No dedicated stop button. Detect via content stability — poll the response text, wait for it to remain unchanged for 3 consecutive checks (~6s).
- **Bot detection:** More aggressive than Perplexity. Camoufox with the default config passes through, but a Google sign-in modal appears on detected automation. Apply the `CRAWL_RATE_LIMITS` env var with a conservative RPS for `chatgpt` (e.g. `0.2`).
- **Empty state:** Before any query, the page shows "Ready when you are." or "What's on your mind today?" — the response container will be empty. After submitting, the user message appears in a `[data-message-id]` div followed by the assistant's response in another `[data-message-id]` div.

## Lifecycle Hooks

The `CrawlerProvider` interface includes optional lifecycle hooks that the
`Crawler` orchestrator calls at specific points. Providers implement only the
hooks they need; the orchestrator no-ops for missing ones.

| Hook | When called | Use case |
|------|-------------|----------|
| `beforePrompt` | After navigate/auth, before submitQuery | Dismiss modals, prepare input |
| `afterTyping` | After submitQuery (typing), before waitForResponse | Additional UI interactions |
| `beforeSubmit` | After typing, before response wait | Confirm submission state |
| `afterSubmit` | After waitForResponse completes | Post-response cleanup |
| `beforeRetry` | After a failed attempt, before next retry | Reset state between retries |
| `betweenPrompts` | Between retry attempts on same proxy | Clean up between retries |

ChatGPT uses `beforePrompt`, `afterTyping`, `beforeSubmit`, `afterSubmit` for
its auth-modal dismissal flow (the "Stay logged out" button at four lifecycle
points with growing wait windows).

## Adding a New Provider

1. **Explore the target site.** Write a throwaway script in
   `/var/folders/.../opencode/<provider>-explorer.ts` (or a similar scratch
   location) that opens the site in Camoufox, submits a test query, and dumps
   the DOM structure. Capture:
   - The actual input element (textarea vs ProseMirror vs other)
   - The response container selector
   - How citations / references appear (sources panel, inline links, none)
   - Any sign-in / anti-bot modals on first visit
   - Streaming completion signal (stop button, content stability)

2. **Create the provider file** at
   `packages/browser-crawler/src/providers/<provider>.ts`. Implement
   `CrawlerProvider`:

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

   The `extractResult` method must return the right structured data type for
   the provider — `CitationSource[]` for search engines, `InlineLink[]` for
   chat engines, or a new type for a third shape. Document the choice in a
   comment at the top of the file.

3. **Register the provider** in
   `packages/browser-crawler/src/providers/factory.ts`:

   ```typescript
   export const providerRegistry = {
     perplexity: PerplexityProvider,
     chatgpt: ChatGPTProvider,
     "my-provider": MyProvider,  // ← add this
   };
   ```

4. **Add the enum value** in two places (Zod enums):
   - `packages/db/src/schema/promptQueryCrawl.ts` — `crawlProviderEnum`
   - `packages/queue/src/jobs.ts` — `crawlProviderEnum`

5. **Set the rate limit** in the `CRAWL_RATE_LIMITS` env var (JSON map). If
   unsure, start at `0.5` RPS and adjust based on observed failure rates.

6. **Add the dropdown item** in the frontend. Two locations:
   - `apps/web/app/app/prompts/_components/run-crawl-button.tsx` — the
     provider selector on the single-crawl dialog
   - `apps/web/app/app/prompts/_components/batch-run-dialog.tsx` — the
     provider selector on the batch run dialog

7. **Add the new job payload type to `computeVisibilityScoreAction`.** The
   fallback `crawl.provider ?? "perplexity"` in
   `packages/actions/src/aiVisibility/computeVisibilityScoreAction.ts` must
   be updated to include the new provider name.

8. **Document the provider** by appending a subsection to the "Provider
   Reference" section of this file. Capture the same findings from step 1:
   URL, input mechanism, response container, citation/ink shape, streaming
   detection, anti-bot behaviour, empty state.

9. **Write a smoke test.** Add a quick run script that submits a known query
   ("What is the best CRM for small business?") and asserts the response
   text contains expected substrings. Run it manually after any change to
   the provider or its selectors.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADLESS` | `true` | `true`, `false`, or `virtual` (virtual display) |
| `CRAWL_RATE_LIMITS` | `{}` | JSON map of provider name to `{rps: number}`. Enforced in the worker. |

## Logging

Uses `@opencited/logger` for structured logging with pluggable transports. See the [logger package docs](../logger/AGENTS.md).
