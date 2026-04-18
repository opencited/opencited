# Web App

## Rules

### UI Components

**Always prefer shadcn/ui components over custom implementations.** Check shadcn registry first at https://ui.shadcn.com before building custom UI. Use `npx shadcn@latest search` to find components.

```bash
# Search for components
npx shadcn@latest search @shadcn -q "kbd"

# Add components
npx shadcn@latest add kbd
```

**When shadcn component exists:**
- Use it instead of creating custom UI
- If customization is needed, extend via variants or className
- Document any custom modifications

**When shadcn component doesn't exist:**
- Propose the feature request to shadcn first
- Only build custom if there's a compelling reason

### Internal Navigation

**Always use `<Link>` from `next/link` for internal navigation.** Never use raw `<a>` tags for routes within the app. This ensures client-side navigation, prefetching, and proper Next.js routing behavior.

```tsx
// ✅ Correct
import Link from "next/link";
<Link href="/app/dashboard">Dashboard</Link>

// ❌ Incorrect
<a href="/app/dashboard">Dashboard</a>
```

### Data Fetching

**Use `<QueryCell />` component for rendering query states.** Never manually handle loading/error states inline. Import from `@/app/components/query-cell`.

```tsx
import { QueryCell } from "@/app/components/query-cell";

<QueryCell
  query={someQuery}
  success={(data) => <Content data={data} />}
  error={(error) => <ErrorMessage error={error} />}
  loading={<LoadingSkeleton />}
/>
```

## Structure

```
app/
├── _trpc/              # tRPC client setup
├── api/trpc/[trpc]/    # tRPC API route
├── app/                # Protected app routes
│   ├── dashboard/      # Dashboard page
│   ├── sitemaps/       # Sitemaps pages
│   └── layout.tsx      # App layout with sidebar
└── components/         # Shared components
```

## Key Patterns

- Pages use `PageShell` for consistent layout
- Data fetching via tRPC hooks (`useTRPC()`)
- Auth state from Clerk (`useUser()`)

### Keyboard Shortcuts

Global keyboard shortcuts are implemented via `HelpOverlay` component in `app/components/help-overlay.tsx`. The overlay listens for key events and handles navigation.

**Available shortcuts:**

| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts help overlay (or click the indicator button) |
| `B` | Toggle sidebar |
| `G` | Go to Dashboard |
| `S` | Go to Sitemaps |

**UI Indicator:**
The shortcut hint button is located in the sidebar footer (visible when sidebar is expanded). It shows "Shortcuts" with a `?` badge. Clicking it opens the help overlay.

**Implementation notes:**
- Shortcuts are disabled when focus is on input/textarea elements
- The `HelpOverlay` logic is embedded in `AppSidebar` component
- Uses existing `Sheet` component from `@opencited/ui` for the overlay
- Use `<Kbd>` or `<KbdGroup>` from `@opencited/ui` for keyboard key badges

**Sidebar shortcut hints:**
Navigation items in the sidebar can display shortcut hints using the `shortcut` field in `navigationLinks`. The `Kbd` component is rendered on the right side of the link text for non-collapsed sidebar state, and included in the tooltip for collapsed state.
