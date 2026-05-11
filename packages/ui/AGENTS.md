# UI Package (`@opencited/ui`)

## Purpose

Shared React component library built on shadcn/ui + Tailwind v4. Used by `apps/web` and other packages.

## Architecture

- **shadcn-based**: Components are added via `npx shadcn@latest add`, not installed as npm packages
- **Tailwind v4**: Uses CSS-first config via `postcss.config.mjs` and `src/styles.css`
- **Barrel exports**: All components re-exported from `src/index.tsx`

## Directory Structure

```
src/
├── index.tsx              # barrel exports
├── styles.css             # Tailwind + shadcn theme
├── lib/                   # utilities (cn, etc.)
├── hooks/                 # shared hooks
└── *.tsx                  # individual components
```

## Key Exports

| Category | Components |
|----------|-----------|
| Layout | `Card`, `EntityCard`, `Sidebar`, `Sheet`, `Dialog`, `Accordion`, `Tabs`, `ScrollArea` |
| Form | `Input`, `Textarea`, `Checkbox`, `Label`, `Button` |
| Display | `Badge`, `PriorityBadge`, `DataList`, `MetadataItem`, `Kbd`, `Table`, `Tooltip`, `Skeleton`, `Separator`, `Progress` |
| Theme | `ThemeProvider`, `ThemeToggle` |

## Conventions

- Components use `cva` (class-variance-authority) for variants
- Export both component and variants (e.g., `Button`, `buttonVariants`)
- Custom components (`EntityCard`, `DataList`, `MetadataItem`, `PriorityBadge`) are app-specific additions
- Theme colors come from `@opencited/tailwind-config/shared-styles.css`

## Adding Components

```bash
npx shadcn@latest add <component>
```

Components are added to `src/` and re-exported from `src/index.tsx`.
