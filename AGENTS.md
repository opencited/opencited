# Agents

## Dev commands

```sh
bun run dev                      # dev server for all packages
bun run dev --filter=web         # dev server for specific app
bun run build                    # build all packages
bun run tsc                     # typecheck all packages (runs next typegen first)
bun run lint                     # biome lint --write (auto-fixes)
bun run lint-ci                  # biome lint (read-only)
bun run format                   # biome format --write
```

## Toolchain

- **Package manager**: bun (bun@1.3.10, node@24.14.1). Do NOT use npm/yarn/pnpm.
- **Linter/formatter**: Biome v2 (NOT ESLint/Prettier). Config in `biome.json`.
- **Build**: Turbo v2. `turbo.json` defines `build`, `lint`, `tsc`, `dev` tasks.
- **TypeScript**: Strict mode. `apps/web` extends `@repo/typescript-config/nextjs.json`; `packages/*` extends `react-library.json`.
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
| `packages/ui` | `@opencited/ui` | React component library |
| `packages/typescript-config` | `@opencited/typescript-config` | Shared tsconfigs |

- `packages/ui` exports: `"@opencited/ui/button"` → `packages/ui/src/button.tsx`
- Build order is managed by Turbo's `dependsOn: ["^build"]` — dependencies always build first.
- `apps/web` has `strictNullChecks: true` in its tsconfig.

## Environment files

`.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` are gitignored. The `lint` script loads `.env` via `dotenv-cli`.
