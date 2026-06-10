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
