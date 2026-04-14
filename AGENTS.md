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

## Monorepo structure

| Package | Name | Type |
|---|---|---|
| `apps/web` | `web` | Next.js 16 App Router |
| `packages/ui` | `@opencited/ui` | React component library (shadcn, Tailwind v4) |
| `packages/tailwind-config` | `@opencited/tailwind-config` | Shared Tailwind theme + PostCSS config |
| `packages/typescript-config` | `@opencited/typescript-config` | Shared tsconfigs |

### Build order

Turbo's `dependsOn: ["^build"]` ensures dependencies build first:
1. `packages/tailwind-config` — no build (pure CSS/config, consumed at build time)
2. `packages/ui` — `build:styles` (tailwindcss CLI) + `build:components` (tsc) run in parallel
3. `apps/web` — `next build`

### UI package internals

- Components live in `packages/ui/src/*.tsx`. Exports via `index.tsx`.
- CSS: `src/styles.css` imports `@opencited/tailwind-config` and uses `@source "../src"` to scan component files.
- `build:styles` compiles CSS to `dist/index.css` via `@tailwindcss/cli`.
- `build:components` compiles TS to `dist/*.js` via `tsc` (tsconfig: `outDir: ./dist`, `rootDir: ./src`).
- `exports` field maps `.` → `dist/index.js`, `./styles.css` → `dist/index.css`.
- shadcn config in `components.json` — `style: "new-york"`, `rsc: false`, `baseColor: zinc`.
- Adding a component: `bun run --filter=@opencited/ui generate:component`.

### Tailwind theme

`packages/tailwind-config/shared-styles.css` defines all shadcn `@theme` variables (zinc palette). Both the UI package and web app share this via `@import "@opencited/tailwind-config"`.

## Dependencies

All shared versions are pinned in root `package.json` `workspaces.catalog`. Use `catalog:` in package.json files, not hardcoded versions. Workspace packages use `workspace:*`.

## Environment files

`.env*` files are gitignored. The `lint` script loads `.env` via `dotenv-cli`.

## Clerk Authentication

`apps/web` uses Clerk for auth with Next.js App Router:

| File | Purpose |
|------|---------|
| `apps/web/proxy.ts` | `clerkMiddleware()` — protects routes |
| `apps/web/app/components/auth-ui.tsx` | `<Show>`, `<SignInButton>`, `<SignUpButton>`, `<UserButton>` |
| `apps/web/app/layout.tsx` | `<ClerkProvider>` wraps the app |
| `.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |

Keys are declared in `turbo.json` `globalEnv` so they are available during builds.
