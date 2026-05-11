# TypeScript Config Package (`@opencited/typescript-config`)

## Purpose

Shared TypeScript configurations for the monorepo.

## Configs

| File | Used by | Extends |
|------|---------|---------|
| `base.json` | Foundation config | — |
| `nextjs.json` | `apps/web` | `./base.json` |
| `react-library.json` | `packages/*` | `./base.json` |

## Usage

In `tsconfig.json`:

```json
{
  "extends": "@opencited/typescript-config/nextjs.json"
}
```

or

```json
{
  "extends": "@opencited/typescript-config/react-library.json"
}
```

## Convention

- **Apps** use `nextjs.json`
- **Packages** use `react-library.json`
- All configs use strict mode
