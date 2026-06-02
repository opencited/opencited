# Logger Package (`@opencited/logger`)

## Purpose

Structured logging abstraction with pluggable transports. Used across all packages for consistent log output.

## Architecture

**Transport Pattern:**

- **Logger**: High-level interface with `info`, `warn`, `error`, `debug`, `withContext`, and `flush` methods
- **Transport**: Backend implementation (Console, Axiom, etc.) — multiple can be active simultaneously
- **Context**: Merged via `withContext()` — each log call receives the full context object

## Directory Structure

```
src/
├── index.ts           # exports
├── env.ts             # environment validation
├── logger.ts          # logger factory
├── types.ts           # shared types
└── transports/
    ├── index.ts       # transport exports
    ├── console.ts     # human-readable console output
    └── axiom.ts       # Axiom cloud logging
```

## Key Exports

| Export | Type | Purpose |
|--------|------|---------|
| `createLogger` | Function | Create a logger with optional level/transports |
| `defaultLogger` | Logger | Pre-configured logger using env defaults |
| `flush` | Function | Flush all transports (call before exit) |
| `ConsoleTransport` | Class | Pretty console output (dev) / JSON (prod) |
| `AxiomTransport` | Class | Structured logging to Axiom |
| `Logger` | Interface | Logger contract |
| `Transport` | Interface | Transport contract |
| `LogLevel` | Type | `"debug" \| "info" \| "warn" \| "error" \| "off"` |

## Usage

```typescript
import { createLogger, flush } from "@opencited/logger";

const logger = createLogger();

logger.info("Starting crawl", { jobId: "123" });
logger.debug("Request sent", { url: "https://example.com" });
logger.error("Crawl failed", { error: err.message });

// Child logger with merged context
const childLogger = logger.withContext({ provider: "perplexity" });
childLogger.info("Navigating..."); // includes provider in context

// Flush before exit
await flush();
```

## Custom Transports

```typescript
import { createLogger, ConsoleTransport } from "@opencited/logger";

const logger = createLogger({
  transports: [
    new ConsoleTransport({ level: "debug", pretty: true }),
  ],
});
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGGER_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `off` |
| `AXIOM_TOKEN` | — | Axiom API token |
| `AXIOM_DATASET` | — | Axiom dataset name |
| `AXIOM_TRANSPORT_ENABLED` | `false` | Enable Axiom logging (`true`/`false`) |

## Console Output

**Development** (`NODE_ENV !== "production"`): Pretty-printed with timestamp, level icon, and indented JSON context.

```
2026-06-02 14:32:01 ℹ️ Browser crawl completed
  url: "https://...",
  title: "Page Title",
  contentLength: 5333,
  loadTimeMs: 1355
```

**Production** (`NODE_ENV === "production"`): Raw JSON objects for log aggregation.

```json
{ "msg": "Browser crawl completed", "url": "...", "title": "...", "contentLength": 5333 }
```
