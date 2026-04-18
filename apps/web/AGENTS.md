# Web App

## Rules

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
