# Tailwind Config Package (`@opencited/tailwind-config`)

## Purpose

Shared Tailwind theme + PostCSS configuration. Imported by `@opencited/ui` and `apps/web`.

## Architecture

- **CSS-first theme**: All shadcn `@theme` variables defined in `shared-styles.css`
- **Single source of truth**: Both UI package and web app import this package
- **Zinc palette**: Monochrome color scheme with CSS custom properties

## Files

| File | Purpose |
|------|---------|
| `shared-styles.css` | Tailwind theme variables (colors, spacing, etc.) |
| `postcss.config.js` | PostCSS configuration |
| `package.json` | Package metadata + dependencies |

## Usage

```css
@import "@opencited/tailwind-config";
```

Both `@opencited/ui/src/styles.css` and `apps/web` import this to share the same theme.

## Theme Variables

`shared-styles.css` defines all shadcn CSS variables:
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--border`, `--input`, `--ring`
- `--radius-*`

All colors use the zinc palette for a consistent monochrome design.
