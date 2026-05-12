# Agents

## Dev commands

```sh
bun run dev                      # dev server for all packages (UI builds CSS in watch mode)
bun run dev --filter=web         # dev server for specific app
bun run build                    # build all packages
bun run tsc                     # typecheck all packages (runs next typegen first)
bun run lint                     # biome lint --write (auto-fixes)
bun run lint-ci                  # biome lint (read-only)
bun run format                   # biome format --write
```

## Toolchain

- **Package manager**: bun (bun@1.3.10, node@24.14.1). Do NOT use npm/yarn/pnpm.
- **Linter/formatter**: Biome v2 (NOT ESLint/Prettier). Config in `biome.json`. Tabs + double quotes.
- **Build**: Turbo v2. `turbo.json` defines `build`, `lint`, `tsc`, `dev` tasks.
- **TypeScript**: Strict mode. `apps/web` extends `@opencited/typescript-config/nextjs.json`; `packages/*` extends `react-library.json`.
- **Framework**: Next.js 16 App Router (`apps/web/app/`).

## Pre-commit hook

```
bun run format && bun run lint && bun run tsc && git add .
```

Runs on every `git commit` via Husky. The `prepare` script in root `package.json` installs Husky.

## Commit conventions

- Commitizen (`czg`) is configured. Running `git commit` (without `-m`) launches the interactive prompt.
- Commit types: `chore`, `feat`, `fix`, `perf`, `refactor`, `release`, `style`, `ci`, `docs`.
- `scope` and `breaking` questions are skipped.

## Git operations

Agents MUST NOT use `git commit` or `git push`. Git is only to be used for read-only operations (e.g., `git status`, `git diff`, `git log`).

## Monorepo structure

| Package | Name | Type |
|---|---|---|
| `apps/web` | `web` | Next.js 16 App Router |
| `packages/ui` | `@opencited/ui` | React component library (shadcn, Tailwind v4) |
| `packages/trpc` | `@opencited/trpc` | tRPC server & client (routers, procedures, context) |
| `packages/db` | `@opencited/db` | Drizzle ORM + Neon Postgres (used only by tRPC) |
| `packages/crawler` | `@opencited/crawler` | Sitemap fetching and parsing (used by tRPC) |
| `packages/browser-crawler` | `@opencited/browser-crawler` | Browser automation with Playwright (Strategy Pattern + Orchestrator) |
| `packages/actions` | `@opencited/actions` | Vercel Workflow SDK actions (DB operations) |
| `packages/trigger` | `@opencited/trigger` | Trigger.dev background tasks (Playwright + AI providers) |
| `packages/tailwind-config` | `@opencited/tailwind-config` | Shared Tailwind theme + PostCSS config |
| `packages/typescript-config` | `@opencited/typescript-config` | Shared tsconfigs |

### Tailwind theme

`packages/tailwind-config/shared-styles.css` defines all shadcn `@theme` variables (zinc palette). Both the UI package and web app share this via `@import "@opencited/tailwind-config"`.

## Dependencies

All shared versions are pinned in root `package.json` `workspaces.catalog`. Use `catalog:` in package.json files, not hardcoded versions. Workspace packages use `workspace:*`.

**When adding new packages/dependencies:**
1. Always use `catalog:` for version pinning — never hardcode versions
2. Add the package to root `package.json` `workspaces.catalog` with the latest stable version first
3. Then use `catalog:` in all package.json files
4. Run `bun install` to update the lockfile
5. Verify with `bun run tsc && bun run build`

## Environment files

`.env*` files are gitignored. The `lint` script loads `.env` via `dotenv-cli`.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `packages/db`, `turbo.json` | Neon Postgres connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/web` | Clerk auth |
| `CLERK_SECRET_KEY` | `apps/web` | Clerk auth |
| `TRIGGER_SECRET_KEY` | `packages/trigger`, `turbo.json` | Trigger.dev authentication |
| `OPENAI_API_KEY` | `packages/trigger`, `turbo.json` | LLM analysis for crawler |
| `LOGGER_LEVEL` | `packages/browser-crawler` | Browser crawler log level (`silent` | `info` | `debug`) |

`turborepo` `globalEnv` includes all env vars required during builds.

## Clerk Authentication

`apps/web` uses Clerk for auth with Next.js App Router. Keys are declared in `turbo.json` `globalEnv` so they are available during builds.

## UI Component Rules

**Always use `@opencited/ui` components without custom style overrides.** See [.impeccable.md](.impeccable.md) for design principles.

**Allowed:** Layout (`flex`, `grid`), size (`h-*`, `w-*`), spacing (`p-*`, `gap-*`), typography sizing (`text-sm`), interaction states (`hover:*`), opacity modifiers.

**Not Allowed:** Color overrides (`text-destructive`, `bg-*`), border styles (`border-dashed`), custom variants (ring shadows, etc.).

**Need a variant?** Add it to the component in `packages/ui/src/` using `cva`, then use `variant` prop instead of `className`.

```tsx
// ❌ WRONG
<Badge variant="outline" className="text-emerald-600">Valid</Badge>
<Card className="border-dashed">

// ✅ CORRECT
<Badge variant="success">Valid</Badge>
<Card variant="dashed">
```
