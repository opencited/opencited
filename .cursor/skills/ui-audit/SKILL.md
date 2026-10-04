---
name: ui-audit
description: >-
  Audit a folder of TSX files for @opencited/ui compliance (raw HTML, illegal
  className overrides, loading patterns). Use when the user asks for a UI audit
  on a path.
disable-model-invocation: true
---

# UI compliance audit

Audit all `.tsx` files under the path the user gives (recursively) for compliance with project UI conventions.

## Step 1: Gather context

Read:

- `packages/ui/src/index.tsx` — exported components
- `packages/ui/AGENTS.md` — component conventions
- `packages/ui/src/button.tsx`, `badge.tsx` — cva variant examples
- `apps/web/AGENTS.md` — web app rules
- Root `AGENTS.md` — UI component rules

## Step 2: Find components

Glob `**/*.tsx` under the target path. Read each file.

## Step 3: Audit rules

### Rule 1: Missing UI components

Flag raw HTML where `@opencited/ui` has an equivalent (`button` → `Button`, `input` → `Input`, card-like `div` → `Card`, badge-like spans → `Badge`, tables → `Table`, etc.).

### Rule 2: Illegal style overrides on UI components

Flag `className` with **color** or **border** styles on `@opencited/ui` components.

**Allowed:** layout (`flex`, `grid`, `gap-*`, `p-*`), size (`h-*`, `w-*`), typography sizing (`text-sm`), `hover:*`.

**Not allowed:** `text-destructive`, `bg-*`, `border-dashed`, color `text-*` / `bg-*` / decorative `border-*`.

### Rule 3: Missing variant extraction

If custom styles on a UI component could be reusable, propose a new `cva` variant in `packages/ui/`.

### Rule 4: Raw `<a>` for internal routes

Internal routes must use `next/link` `<Link>`. External `https://` links are fine.

### Rule 5: Manual loading/error for data fetching

Suggest `<QueryCell>` from `@/app/components/query-cell` when appropriate (suggestion only).

### Rule 6: Loading patterns

- Page/list/card loading → `<Skeleton>` matching content layout
- Button/inline/dialog loading → `<Spinner>` plus descriptive text
- Not allowed: bare "Loading...", custom spinners, skeletons that don't match layout

## Step 4: Report

If clean: say no issues found in the path.

If issues: categorize **auto-fixable** (rules 1, 2, 4, 6) vs **needs approval** (rules 3, 5). For each issue: file, line, current code, proposed fix.

## Step 5: Execute (only after user approval)

On approval: apply auto-fixes; for rule 3 add variants in `packages/ui`; run `bun run tsc && bun run lint`; summarize changes.
