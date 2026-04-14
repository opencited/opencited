# opencited

Monorepo for opencited web application.

## Tech Stack

- **Runtime**: Bun 1.3.10, Node 24.14.1
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui
- **Auth**: Clerk
- **Code Quality**: Biome (linting + formatting), TypeScript (strict mode)

## What's inside

### Apps

- `apps/web` — Next.js 16 web application with Clerk authentication

### Packages

- `@opencited/ui` — React component library (shadcn/ui components)
- `@opencited/tailwind-config` — Shared Tailwind v4 theme and PostCSS config
- `@opencited/typescript-config` — Shared TypeScript configurations

## Getting Started

Install dependencies:

```sh
bun install
```

Run development servers:

```sh
bun run dev
```

Run a specific app:

```sh
bun run dev --filter=web
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all dev servers |
| `bun run build` | Build all packages |
| `bun run tsc` | Type-check all packages |
| `bun run lint` | Lint and auto-fix with Biome |
| `bun run format` | Format with Biome |
| `bun run commit` | Create a commit with Commitizen |

## Committing

Run `bun run commit` to create commits using Commitizen. Follow conventional commits format.

## Git Hooks

Pre-commit hook runs `format && lint && tsc` before each commit (via Husky).
