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

We also discovered that Perplexity and ChatGPT produce structurally different
"reference" data. Perplexity has a dedicated sources panel with inline
`[1]`-style citation markers — these are sources the engine explicitly cites to
back a claim. ChatGPT has no citation panel; it just embeds `<a>` anchors
inline in the response prose as it mentions a brand or product. Treating these
as the same concept would conflate two semantically different signals.

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

### 2. Single `crawl` job, provider in payload

Replace `perplexity-crawl` and any future `chatgpt-crawl` with a single `crawl`
job whose payload includes `provider: crawlProviderEnum`. The worker dispatches
to the right provider via the factory. Per-provider rate limits and
concurrency are configured via env, not via separate queues.

The BullMQ job name no longer encodes the provider. Retries, dead-letter
queues, and concurrency limits are per-queue and not per-provider — we have
one queue.

### 3. Polymorphic `crawl_reference` table

A new DB table stores both citation and inline-link data:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `crawl_id` | uuid | FK → `prompt_query_crawl.id`, cascade delete |
| `kind` | enum | `'citation' \| 'inline-link'` |
| `position` | int | 1-indexed ordinal in the response |
| `url` | text | The referenced URL |
| `domain` | text | Parsed hostname (for fast `citationScore` lookups) |
| `title` | text | For citations: the source title. For inline links: the anchor text. |
| `description` | text | Citation-only; null for inline links |
| `favicon` | text | Citation-only |
| `source_name` | text | Citation-only; null for inline links |

The `kind` column is the discriminator. The `citationScore` sub-score reads
from this one table and asks the same question for both kinds: "is the
brand's own domain in the reference list?"

### 4. Distinct types in the browser-crawler layer

`CitationSource` and `InlineLink` are two different types in
`packages/browser-crawler/src/providers/types.ts`. The provider that produced
the data knows which type to populate. The DB layer collapses both into
`crawl_reference` with a `kind` discriminator.

This keeps the provider interface honest about the data it produces, while
the DB layer normalises the storage shape. The visibility score doesn't care
which kind a row is — it only checks `domain`.

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
  `citationScore` reads from `crawl_reference` and doesn't care which kind
  the row is. No `formulaVersion` bump required.
- **The polymorphic table is queryable**: `WHERE crawl_id = ? AND domain = ?`
  gives the citation sub-score in one index lookup, regardless of kind.

### Trade-offs

- **Two types in the provider layer, one table in the DB** — there's a
  translation step in the worker when saving structured data. The worker
  knows which kind to set on each row.
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
- **The `CitationSource` vs `InlineLink` split is the costliest thing to
  reverse** — downstream code (UI, score actions) learns to handle both. If
  we later decide the split was wrong and unify them, every read site needs
  to change. We accept this because the semantic distinction is real and
  documented.
