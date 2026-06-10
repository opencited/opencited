# OpenCited — Context

## Glossary

| Term | Definition |
|------|------------|
| **domainProject** | The canonical brand entity for a workspace. 1:1:1 mapping of organization → domainProject → brand. Contains `domain` (primary URL), `name` (display name), `aliases` (for mention detection), `logoUrl`, `active`. All feature tables reference `domainProjectId`. |
| **proxyConfig** | Per-domainProject proxy settings. Controls whether crawls use custom proxies instead of environment defaults. Has `enabled`, `sourceType` (`batch` or `api`), `sourceValue`, and `stickyProxyEnabled`. |
| **sticky proxy** | A Redis-cached "last known good" proxy, scoped per domainProject, with a 30-minute TTL. Reused on subsequent crawls for speed; cleared on failure and falls back to the full proxy list. |
| **crawl** | A single browser automation run against an AI answer engine (e.g., Perplexity) to check how a query is answered. Produces content, structured data, and brand intelligence. |
| **promptQuery** | A saved search query associated with a domainProject. Can have multiple crawls over time. |
| **sitemap** | A registered sitemap URL for a domainProject, used to discover pages to analyze. |
| **competitor** | A competing brand/domain tracked within a domainProject for mention comparison. |
| **brandMention** | A detected mention of the target brand or its aliases in AI-generated content. |
| **promptTemplate** | A system-curated, pre-built prompt available in the prompt library (Library tab within `/app/prompts`). Independent of any domainProject. Has a human-readable slug `id` (e.g. `competitor-price-comparison`). Contains `text` (the query, may include `{brandName}` placeholder), `title`, `description`, `industry` (enum: SaaS, E-commerce, Healthcare, Finance, Media & Publishing, Education, Travel & Hospitality, Real Estate, Legal Services, Marketing & Advertising), `category` (enum: competitor-analysis, brand-monitoring, visibility, content-optimization, pricing-intelligence, feature-comparison), and `tags` (predefined array). Seeded from a hardcoded TS file (`packages/db/src/prompt-templates.ts`) via `bun run sync:templates`. When a user adds a template, `{brandName}` is auto-resolved from `domainProject.name` (falling back to `domainProject.domain`), then presented in a dedicated `AddTemplateDialog` (showing metadata + editable text) before saving as a `promptQuery`. Once copied, the prompt is fully owned by the user — template updates do not propagate back. |

## Proxy Resolution Order

When a crawl job runs, proxies are resolved in this order:

1. **Custom proxyConfig** (if enabled for the domainProject) — either a batch list or an API URL
2. **`THORDATA_PROXY_API_URL`** env var — platform-wide proxy API
3. **`PROXY_SERVER`** env var — single proxy fallback
