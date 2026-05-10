# @opencited/trigger

Trigger.dev background tasks package for @opencited monorepo.

## Quick Start

```bash
# Start Trigger.dev dev server
bun run dev

# Deploy to Trigger.dev Cloud
bun run deploy
```

## Tasks

### perplexityCrawlTask

Crawl Perplexity.ai queries using the browser-crawler package.

**Trigger from Next.js:**
```typescript
import type { perplexityCrawlTask } from "@opencited/trigger";
import { tasks } from "@trigger.dev/sdk/v3";

const handle = await tasks.trigger<typeof perplexityCrawlTask>(
  "perplexity-crawl",
  { query: "top ai contact center" }
);
```

**Payload:**
```typescript
{
  query: string
}
```

**Returns:**
```typescript
{
  success: boolean,
  content: string,
  url: string,
  title: string,
  timestamp: string // ISO 8601
}
```

## Configuration

- **Project**: `proj_ltacdxbnugurdrodhdwx`
- **Runtime**: Node.js
- **Max Duration**: 3600s (1 hour)
- **Retries**: 3 attempts with exponential backoff
- **Browser**: Chromium (headless)

## Environment Variables

Required in `.env.local`:
```bash
TRIGGER_SECRET_KEY=tr_dev_...  # From Trigger.dev dashboard
OPENAI_API_KEY=sk-...           # For LLM analysis (optional)
```

## Architecture

```
packages/trigger/
├── trigger/
│   ├── init.ts                 # Global lifecycle hooks
│   └── perplexity-crawl.ts     # Perplexity crawler task
├── src/
│   └── index.ts                # Barrel exports
├── trigger.config.ts           # Trigger.dev configuration
├── package.json
└── tsconfig.json
```

## Dependencies

- `@trigger.dev/sdk` — Core Trigger.dev SDK
- `@trigger.dev/build` — Build extensions (Playwright)
- `@opencited/browser-crawler` — Browser automation
- `playwright` — Browser automation engine

## Development

```bash
# Typecheck
bun run tsc

# Start dev server (watches for changes)
bun run dev

# Deploy to production
bun run deploy
```

## Testing

1. Start dev server: `bun run dev`
2. Visit Test page in Trigger.dev dashboard
3. Select "perplexity-crawl" task
4. Enter payload: `{"query": "your query here"}`
5. Click "Run test"
6. View logs in dashboard

## Triggering from Web App

The web app can trigger tasks via API route:

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"query": "top ai contact center"}'
```

See `apps/web/app/api/crawl/route.ts` for implementation.

## Notes

- Tasks run in Trigger.dev Cloud (not in Next.js bundle)
- Type-only imports prevent task code bundling in web app
- Browser automation runs in Trigger.dev worker environment
- Playwright extension auto-installs Chromium dependencies
