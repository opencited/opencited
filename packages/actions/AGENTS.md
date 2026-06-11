# Actions Package (`@opencited/actions`)

## Purpose

Reusable database action functions. Consumed by `@opencited/trpc` routers and `@opencited/worker` tasks.

## Architecture

**Action pattern**: Each resource has CRUD action files that encapsulate database operations. Actions receive context (including `db` instance) — they never create their own connections.

## Directory Structure

```
src/
├── index.ts           # barrel exports
├── context.ts         # baseActionContextSchema + Context type
└── {resource}/
    ├── createAction.ts
    ├── getAction.ts
    ├── listAction.ts
    ├── updateAction.ts
    ├── deleteAction.ts
    └── index.ts       # barrel export
```

## Resources

| Resource | Purpose |
|----------|---------|
| `domainProject` | Domain + project CRUD |
| `sitemap` | Sitemap operations |
| `crawl` | Crawl-related actions |
| `promptQuery` | Prompt query operations |
| `promptTemplate` | Prompt library template listing |
| `browser` | Browser crawl actions |

## Context Schema

```typescript
export const baseActionContextSchema = z.object({
  userId: z.string().nullable(),
  isAuthenticated: z.boolean(),
  db: z.any(),
});
```

## Action Pattern

Each action file exports:

```typescript
export const {action}InputSchema = ...      // Input validation
export const {action}OutputSchema = ...     // Output shape
export const {action}ContextSchema = ...    // Extended context
export const {action}Action = async (...) => { ... }   // Business logic
export const {action}Handler = async (...) => { ... }  // Wraps action for router
```

## Rules

- Actions receive `db` via context — never import `db` from `@opencited/db` directly
- Actions are framework-agnostic (used by both tRPC and BullMQ worker)
- Handlers wrap actions and adapt to specific framework needs
