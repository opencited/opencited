# tRPC Package

## Core Principle

**Actions pattern** — All database operations go through actions. Routers delegate to handlers and handle auth.

## Pattern: Actions

```
src/actions/
└── {resource}/
    ├── createAction.ts    # create
    ├── getAction.ts       # get one
    ├── listAction.ts      # get many
    ├── updateAction.ts    # update
    ├── deleteAction.ts    # delete
    └── index.ts           # barrel export
```

Each action file exports:

```typescript
export const {action}InputSchema = ...     // router input validation
export const {action}OutputSchema = ...    // router output shape
export const {action}ContextSchema = ...    // context type

export const {action}Action = async (params) => { ... }   // business logic
export const {action}Handler = async (params) => { ... }  // wraps action
```

**Rule:** Routers never access the database directly — only through actions.

## Pattern: Routers

Routers handle auth (Clerk) and pass necessary IDs to handlers.

```typescript
export const {resource}Router = createTRPCRouter({
  create: publicProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await auth();
      if (!orgId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return createHandler({ input, ctx, orgId });
    }),
});
```

## Pattern: Context

`baseActionContextSchema` in `trpc.ts` is the base for all action contexts:

```typescript
export const baseActionContextSchema = z.object({
  userId: z.string().nullable(),
  isAuthenticated: z.boolean(),
  db: z.any(),
});
```

## Pattern: Zod Schemas

Each table exports base schemas + an extended insert schema for validation:

```typescript
export const {table}SelectSchema = createSelectSchema(table)
export const {table}BaseInsertSchema = createInsertSchema(table)
export const {table}InsertSchema = {table}BaseInsertSchema.extend({ ...field validations })
export const {table}UpdateSchema = createUpdateSchema(table)
```

## Naming

| Item | Convention |
|------|------------|
| Action files | `createAction.ts`, `getAction.ts`, `listAction.ts`, `updateAction.ts`, `deleteAction.ts` |
| Exports | `{action}InputSchema`, `{action}OutputSchema`, `{action}ContextSchema`, `{action}Action`, `{action}Handler` |
| Routers | `{resource}Router` (e.g., `domainProjectRouter`) |

## Procedures

| Procedure | Auth | Use Case |
|-----------|------|----------|
| `publicProcedure` | None | Public endpoints |
| `protectedProcedure` | userId required | User operations |
| `authProtectedProcedure` | Type-guard validated | Strongly typed user ops |

## Directory Structure

```
src/
├── actions/           # business logic (never accessed by routers directly)
│   └── {resource}/
├── procedures/         # procedure definitions
├── router/            # route definitions (delegates to actions)
├── trpc.ts            # tRPC init, context, baseActionContextSchema
└── index.ts           # package exports
```

## Adding a New Resource

1. Create `src/actions/{resource}/` with CRUD action files
2. Create `src/router/{resource}.ts` — router delegates to handlers, handles auth
3. Register router in `src/router/root.ts`
4. Export from `src/index.ts` if needed by consumers