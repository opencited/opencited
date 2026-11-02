# DB Package (`@opencited/db`)

## Purpose

Drizzle ORM layer + Neon Postgres connection. Only used by `@opencited/trpc`.

## Architecture

- **Drizzle ORM** with Neon serverless driver
- **Schema-per-table**: Each table in its own file under `src/schema/`
- **Zod schemas**: Each table exports select, insert, and update schemas

## Directory Structure

```
src/
├── index.ts               # db instance + schema re-exports
├── schema/
│   ├── index.ts           # schema barrel
│   ├── common-fields.ts   # shared column definitions
│   ├── domainProject.ts
│   ├── sitemap.ts
│   ├── sitemapUrl.ts
│   ├── crawledPage.ts
│   ├── pageAnalysis.ts
│   └── promptQuery.ts
drizzle/                   # migration files (generated)
drizzle.config.ts          # drizzle-kit config
```

## Tables

| Table | Purpose |
|-------|---------|
| `domainProjectTable` | Domain + project management |
| `sitemapTable` | Sitemap registry |
| `sitemapUrlTable` | URLs within sitemaps |
| `crawledPageTable` | Crawled page data + status |
| `pageAnalysisTable` | LLM-analyzed page content |
| `promptQueryTable` | Prompt query history |
| `promptTemplateTable` | System-curated prompt library templates |
| `answerEngineTable` | Which answer engines are available to run, and the reason when one is off |

## Schema Pattern

Each table file exports:

```typescript
export const {table}Table = pgTable(...)           // Drizzle table definition
export const {table}SelectSchema = createSelectSchema(table)
export const {table}BaseInsertSchema = createInsertSchema(table)
export const {table}InsertSchema = {table}BaseInsertSchema.extend({ ... })  // with validations
export const {table}UpdateSchema = createUpdateSchema(table)
```

## Commands

```bash
# Generate migrations
bun run db:generate

# Run migrations
bun run db:migrate

# Push schema (dev only)
bun run db:push

# Sync prompt templates from seed file
bun run sync:templates
```

## Environment

Requires `DATABASE_URL` (Neon Postgres connection string).

## Turning an answer engine on or off

`answer_engine` is the source of truth for whether ChatGPT or Perplexity can run. The app and the worker read it on their own, so a change shows up within about 60 seconds with no redeploy or restart.

Run this on the production database (Neon SQL editor) or locally with `bun run --filter @opencited/db dev` (Drizzle Studio).

```sql
-- Disable an engine with a reason users will see
UPDATE answer_engine
SET status = 'disabled',
    disabled_reason = 'Perplexity is temporarily unavailable while we fix an issue with it. ChatGPT is fully working.',
    updated_at = now()
WHERE key = 'perplexity';

-- Change only the reason
UPDATE answer_engine SET disabled_reason = 'New message here', updated_at = now() WHERE key = 'perplexity';

-- Re-enable
UPDATE answer_engine SET status = 'enabled', disabled_reason = NULL, updated_at = now() WHERE key = 'perplexity';

-- Check current state
SELECT key, display_name, status, disabled_reason, updated_at FROM answer_engine ORDER BY sort_order;
```

One-off cleanup to run once after deploy (it frees prompts blocked by stuck Perplexity runs):

```sql
UPDATE prompt_query_crawl
SET status = 'failed',
    error = 'Skipped: Perplexity is disabled.',
    completed_at = now(),
    updated_at = now()
WHERE provider = 'perplexity' AND status IN ('pending', 'running');
```
