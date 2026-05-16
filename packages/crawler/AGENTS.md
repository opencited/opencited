# Crawler Package (`@opencited/crawler`)

## Purpose

Sitemap fetching, parsing, and page content extraction. HTTP-based (no browser automation).

## Architecture

- **Service-based**: Each service handles a specific crawling concern
- **HTTP-only**: Uses fetch, not Playwright (that's `@opencited/browser-crawler`)
- **LLM integration**: Optional page analysis via `llm-analyzer.ts`

## Directory Structure

```
src/
├── index.ts           # exports
├── types.ts           # shared type definitions
└── services/
    ├── index.ts       # service barrel
    ├── sitemap.ts     # sitemap discovery + parsing
    ├── page-fetcher.ts # HTTP page fetching
    ├── content-extractor.ts # DOM content extraction
    └── llm-analyzer.ts # LLM-based page analysis
```

## Key Exports

| Function | Purpose |
|----------|---------|
| `crawlSitemap` | Full sitemap crawl |
| `getSitemapInfo` | Get sitemap metadata |
| `getSitemapUrls` | Extract URLs from sitemap |
| `getSitemapChildUrls` | Get child sitemap URLs |
| `fetchPage` | Fetch page via HTTP |
| `extractContent` | Extract text/structure from HTML |
| `analyzeWithLLM` | Analyze page with LLM |

## Types

| Type | Purpose |
|------|---------|
| `CrawledUrl` | URL + lastmod/changefreq/priority |
| `CrawlResult` | Collection of crawled URLs |
| `SitemapInfo` | Sitemap metadata (type, url count) |
| `SitemapType` | `"urlset"` or `"sitemapindex"` |
| `SitemapSource` | `"robots.txt"` | `"standard"` | `"sitemap-index"` |

## Usage

```typescript
import { getSitemapUrls, extractContent } from "@opencited/crawler";

const urls = await getSitemapUrls("https://example.com/sitemap.xml");
const content = await extractContent(urls[0].url);
```
