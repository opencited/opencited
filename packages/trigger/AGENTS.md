# Trigger Package (`@opencited/trigger`)

## Purpose

Trigger.dev background tasks for long-running operations (browser crawling, AI analysis).

## Architecture

- **Trigger.dev v3**: Serverless task execution with retries and scheduling
- **Playwright integration**: Build extension installs Chromium for browser automation
- **Task definitions**: Live in `trigger/` directory, exported from `src/index.ts`

## Directory Structure

```
src/
├── index.ts           # task exports + Trigger SDK re-exports
trigger/
├── init.ts            # Trigger SDK initialization
└── perplexity-crawl.ts # Perplexity crawl task
trigger.config.ts      # Trigger.dev configuration
```

## Configuration

```typescript
// trigger.config.ts
{
  project: "proj_ltacdxbnugurdrodhdwx",
  runtime: "node",
  maxDuration: 3600,  // 1 hour
  retries: { default: { maxAttempts: 3 } },
  build: {
    extensions: [playwright({ browsers: ["chromium"], headless: true })],
  },
}
```

## Key Exports

| Export | Type | Purpose |
|--------|------|---------|
| `perplexityCrawlTask` | Task | Browser-based Perplexity crawl |
| `task` | SDK | Trigger.dev task builder |
| `logger` | SDK | Task logging |
| `wait` | SDK | Sleep/delay utility |
| `batch` | SDK | Batch task execution |
| `tasks` | SDK | Task management |

## Environment

| Variable | Purpose |
|----------|---------|
| `TRIGGER_SECRET_KEY` | Trigger.dev authentication |
| `OPENAI_API_KEY` | LLM analysis for crawler |

## Commands

```bash
# Deploy tasks
bun run trigger:deploy

# Dev mode (local dev server)
bun run trigger:dev
```
