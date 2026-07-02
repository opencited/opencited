# ADR-0003: Multi-Provider Crawl Architecture

**Status:** Accepted
**Date:** 2026-06-28
**Context:** Adding ChatGPT as a second crawler provider alongside Perplexity.

## Problem

The system was built around a single crawler provider (Perplexity) and the
integration layer above the browser-crawler package hardcoded that provider at
every seam: the DB enum, the BullMQ job name, the worker handler, the tRPC
dispatch, and the frontend. The `CrawlerProvider` interface in
`packages/browser-crawler` was designed for extensibility, but no infrastructure
above it supported more than one provider. Adding a second provider (ChatGPT)
required either duplicating the hardcoded path or generalising the integration
layer.

We initially believed that Perplexity and ChatGPT produced structurally different
"reference" data. Perplexity was thought to have a dedicated sources panel with
inline `[1]`-style citation markers — sources the engine explicitly cites to
back a claim. ChatGPT was thought to embed `<a>` anchors inline in the response
prose as it mentions a brand or product. We planned to treat these as two
semantically different signals with distinct types (`CitationSource` vs
`InlineLink`).

However, upon implementation, we discovered that **both providers actually
produce inline links** — `<a>` elements extracted from the answer prose. The
only real distinction is that ChatGPT also has a side-panel "Sources" UI that
can be opened to show explicit citations. This led to a simplification: both
providers produce `inline-link` rows, and ChatGPT additionally produces
`source-panel` rows when the panel is available.

## Decision

### 1. Provider factory in browser-crawler

Add a `providerFactory` in `packages/browser-crawler/src/providers/factory.ts`
that maps a provider name string to a constructor:

```ts
export const providerRegistry: Record<string, new (logger?: Logger) => CrawlerProvider> = {
  perplexity: PerplexityProvider,
  chatgpt: ChatGPTProvider,
};

export function createProvider(name: string, logger?: Logger): CrawlerProvider { ... }
```

The worker and tRPC router call `createProvider(name)` instead of
`new PerplexityProvider()`. Adding a third provider means one new file in
`providers/` and one entry in the registry.

### 2. Per-provider job queues

Each provider has its own BullMQ queue (`perplexity-crawl`, `chatgpt-crawl`).
Per-provider concurrency, retries, and dead-letter handling are isolated. The
provider is in the queue name AND in the job payload.

### 3. Polymorphic `crawl_reference` table

A new DB table stores all reference links from AI answer engines:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `crawl_id` | uuid | FK → `prompt_query_crawl.id`, cascade delete |
| `kind` | enum | `'inline-link' \| 'source-panel'` |
| `position` | int | 1-indexed ordinal in the response |
| `url` | text | The referenced URL |
| `domain` | text | Parsed hostname (for fast `citationScore` lookups) |
| `title` | text | The anchor text or source title |
| `metadata` | jsonb | Optional fields (e.g., `citedText` for panel links) |

The `kind` column distinguishes between:
- **`inline-link`**: Links extracted from the answer prose (both Perplexity and ChatGPT)
- **`source-panel`**: Links from ChatGPT's side-panel "Sources" UI

The `citationScore` sub-score reads from this one table, deduplicates by domain
(binary per domain), and asks the same question for both kinds: "is the brand's
own domain in the reference list?"

### 4. Unified `InlineLink` type

Both providers return `InlineLink[]` for their prose links. ChatGPT additionally
returns `sourcePanelLinks: InlineLink[]` when the panel is available. The DB
layer stores both with the appropriate `kind` discriminator.

This keeps the provider interface simple while preserving the semantic
distinction in the DB for debugging and analysis.

### 5. Per-provider rate limit via env

`CRAWL_RATE_LIMITS` env var, parsed as JSON, gives per-provider requests-per-
second caps:

```json
{"perplexity": {"rps": 0.5}, "chatgpt": {"rps": 0.2}}
```

The worker's job handler enforces the limit with an in-process token bucket
before dispatch. ChatGPT shows a Google sign-in popup to detected automation,
so a more conservative limit is required than for Perplexity. Proxies handle
IP-level rotation; the rate limit handles request-level throttling.

### 6. Per-crawl provider selection

The user picks the provider at crawl time (on `RunCrawlButton` /
`BatchRunDialog`). The `promptQueryCrawl.provider` column already exists in the
DB and the tRPC input already accepts it — no schema migration needed at the
crawl level, just a new enum value.

## Consequences

### Positive

- **One adapter per provider** in the browser-crawler package, no more
  hardcoded `new PerplexityProvider()` scattered across the worker and tRPC.
- **Adding a new provider is a checklist** (see
  `packages/browser-crawler/AGENTS.md` "Adding a New Provider"): new file in
  `providers/`, one entry in the factory map, one env var entry for rate
  limits, one DB enum value, one UI dropdown item.
- **The visibility score formula stays engine-agnostic** (ADR-0002). The
  `citationScore` reads from `crawl_reference`, deduplicates by domain, and
  doesn't care which kind the row is. No `formulaVersion` bump required.
- **The polymorphic table is queryable**: `WHERE crawl_id = ? AND domain = ?`
  gives the citation sub-score in one index lookup, regardless of kind.
- **Simplified type system**: Only `InlineLink` type, no redundant `CitationSource`.

### Trade-offs

- **Two kinds in the DB, one type in the provider layer** — there's a
  translation step in the worker when saving structured data. The worker
  knows which kind to set on each row based on the source (prose vs panel).
- **Per-provider rate limit is an in-process token bucket** — not
  distributed. If we scale to multiple worker instances, each instance has
  its own bucket. This is fine for the current single-instance deployment,
  but a Redis-backed limiter would be needed for horizontal scaling.
- **`kind` enum is open-coded** in the DB and the TS code. Adding a third
  kind (e.g. `ai-overview-source` for Google AI Overviews) requires a
  migration to extend the enum, but no schema change to the columns
  themselves — the discriminator is the only thing that moves.

### Reversibility

- **Factory pattern is low-cost to reverse** — the registry is a plain object
  map; replacing it with a switch is mechanical.
- **Polymorphic `crawl_reference` table is low-cost to split** — backfill
  the two existing kinds into separate tables with a one-off migration, drop
  the `kind` column.
- **Rate limit env var is low-cost to replace** with a Redis-backed
  distributed limiter when we need it.
