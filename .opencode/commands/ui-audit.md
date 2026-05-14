---
description: Audit a folder for UI component compliance with @opencited/ui conventions
subtask: true
---

Audit all `.tsx` files in `$1` (recursively) for compliance with the project's UI conventions. Follow these steps:

## Step 1: Gather Context

Read these files to understand the available components and conventions:
- `packages/ui/src/index.tsx` — all exported components
- `packages/ui/AGENTS.md` — component conventions
- `packages/ui/src/button.tsx` — example of cva variants pattern
- `packages/ui/src/badge.tsx` — example of cva variants pattern
- `packages/ui/src/spinner.tsx` — spinner component for inline loading
- `packages/ui/src/skeleton.tsx` — skeleton component for layout loading
- `apps/web/AGENTS.md` — web app rules

## Step 2: Find All Components

Glob for all `.tsx` files in `$1` recursively. Read each file.

## Step 3: Audit Each File

Check each file against these rules:

### Rule 1: Missing UI Components
If a file uses raw HTML elements that have a `@opencited/ui` equivalent, flag it.

**Examples:**
- `<button>` → `Button`
- `<input>` → `Input`
- `<textarea>` → `Textarea`
- `<div>` with card-like styles → `Card`
- `<span>`/`<div>` with badge-like styles → `Badge`
- `<table>`, `<tr>`, `<td>` → `Table`, `TableRow`, `TableCell`
- `<dialog>` → `Dialog`
- `<nav>` with list → `Sidebar` / `SidebarMenu`

### Rule 2: Illegal Style Overrides on UI Components
If a `@opencited/ui` component has `className` with **color** or **border** styles (not layout), flag it.

**Not allowed (color/border):**
- `text-destructive`, `bg-red-500`, `border-dashed`, `text-emerald-600`
- Any `bg-*`, `text-*`, `border-*` that changes color/border style

**Allowed (layout only):**
- `flex`, `grid`, `gap-*`, `p-*`, `m-*`
- `h-*`, `w-*`, `max-w-*`
- `text-sm`, `text-xs` (sizing, not color)
- `hover:*` interaction states

### Rule 3: Missing Variant Extraction
If a file has custom styles on a UI component that could be reusable, propose adding a new variant to the component in `packages/ui/`.

**Example:** If `CrawlStatusBadge` uses `className="border-amber-500/50 text-amber-600"` on `<Badge>`, propose adding a `warning` variant to `packages/ui/src/badge.tsx` using `cva`.

### Rule 4: Raw `<a>` Tags for Internal Navigation
If a file uses `<a href="/...">` for internal routes instead of `<Link>` from `next/link`, flag it. External links (`href="https://..."`) are fine.

### Rule 5: Manual Loading/Error States
If a file manually handles loading/error states for data fetching instead of using `<QueryCell>` from `@/app/components/query-cell`, flag it as a suggestion (not auto-fix).

### Rule 6: Loading State Patterns
Only two loading patterns are allowed in the entire app:

**Skeleton-based loading** — Used for page-level, list, or card-level loading states. The skeleton must match the layout and structure of the success state (not just generic boxes). Use `<Skeleton>` from `@opencited/ui` arranged in the same layout as the actual content.

**Spinner-based loading** — Used for inline/action-level loading (e.g., inside buttons, small status indicators). Use `<Spinner>` from `@opencited/ui` and **must** include accompanying text to give context to the user about what is loading.

**Not allowed:**
- Plain text like "Loading..." without a spinner
- Custom HTML/CSS loading indicators (custom spinners, dots, bars, etc.)
- Skeletons that don't resemble the actual content layout
- Spinner without descriptive text
- Mixed patterns (e.g., skeleton + spinner for the same loading state)

**Guidelines:**
- Page/list/card loading → Skeleton
- Button action loading → Spinner + text
- Small inline status → Spinner + text
- Dialog/form submission → Spinner + text

## Step 4: Report Findings

### If no issues found:
Tell the user: "Everything looks good! No UI compliance issues found in `$1`."

### If issues found:
Present a categorized plan:

**Auto-fixable (will apply on approval):**
- Rule 1: Replace raw HTML with `@opencited/ui` components
- Rule 2: Remove illegal style overrides
- Rule 4: Replace `<a>` with `<Link>`
- Rule 6: Replace custom loading indicators with `<Skeleton>` or `<Spinner>` patterns

**Needs approval (complex changes):**
- Rule 3: List proposed variant additions to `packages/ui/` components
- Rule 5: Suggest QueryCell refactoring

For each issue, show:
- File path and line number
- Current code
- Proposed fix
- Brief explanation

## Step 5: Execute Changes

Ask the user: "Would you like me to apply the auto-fixable changes? And which of the complex changes would you like me to implement?"

On approval:
1. Apply auto-fixable changes directly
2. For Rule 3 (variant extraction):
   - Edit the component in `packages/ui/src/` to add the new variant using `cva`
   - Update the component's usage in the web app file to use the new variant
   - Re-export from `packages/ui/src/index.tsx` if needed
3. For Rule 5: Implement the QueryCell refactoring if approved
4. For Rule 6: Replace custom loading states:
   - Page/list/card loading → restructure as skeleton matching content layout
   - Button/inline loading → replace with `<Spinner>` + descriptive text
5. Run `bun run tsc && bun run lint` to verify changes
6. Report what was changed
