# OpenCited

OpenCited is an open-source platform for Answer Engine Optimization (AEO) — helping you analyze, track, and improve your website's visibility in AI-powered answer engines like ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini, and more.

Built for developers, indie hackers, and marketing teams who want to understand and act on where they appear (or don't) in AI-generated answers — without paying $200-500/month for closed-source tools.

OpenCited is MIT licensed, self-hostable, and puts no limits on workspaces, domains, or users in the open-source version.

## Tech Stack

- **Runtime**: Bun 1.3.10, Node 24.14.1
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui
- **Auth**: Clerk
- **Database**: Neon Postgres (serverless)
- **Job Queue**: BullMQ + Valkey (Redis fork)
- **Browser Automation**: Playwright (Chromium)
- **Code Quality**: Biome (linting + formatting), TypeScript (strict mode)

## What's inside

### Apps

- `apps/web` — Next.js 16 web application with Clerk authentication
- `apps/worker` — BullMQ worker process for background jobs (browser crawling, AI analysis)

### Packages

- `@opencited/ui` — React component library (shadcn/ui components)
- `@opencited/queue` — BullMQ job registry and dispatch (shared between tRPC and worker)
- `@opencited/actions` — Reusable database action functions
- `@opencited/db` — Drizzle ORM + Neon Postgres
- `@opencited/trpc` — tRPC server and client
- `@opencited/browser-crawler` — Playwright-based browser automation
- `@opencited/crawler` — Sitemap fetching and parsing
- `@opencited/tailwind-config` — Shared Tailwind v4 theme and PostCSS config
- `@opencited/typescript-config` — Shared TypeScript configurations

## Getting Started

### Prerequisites

- **Bun** 1.3.10+
- **Node.js** 24.14.1+
- **Docker** (for Valkey/Redis)

### Install dependencies

```sh
bun install
```

### Start Valkey (Redis) for background jobs

```sh
docker compose up redis -d
```

### Set up environment variables

Create a `.env.local` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Redis (for BullMQ worker)
REDIS_URL="redis://localhost:6379"

# LLM Provider (for AI analysis)
LLM_PROVIDER="openai"  # or "groq", "openai-compatible"
LLM_API_KEY="sk-..."
LLM_MODEL="gpt-4o-mini"
# LLM_BASE_URL="https://api.openai.com/v1"  # required for openai-compatible
```

### Run development servers

```sh
bun run dev
```

This starts:
- **Web app** at http://localhost:3000
- **Worker** (background job processor)
- **Drizzle Studio** for database management

### Run a specific app

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
| `docker compose up redis` | Start Valkey (Redis) for background jobs |

## Self-Hosting Guide

OpenCited consists of two main services:

1. **Web App** (`apps/web`) — Next.js application, deployable to Vercel, Railway, or any Node.js host
2. **Worker** (`apps/worker`) — BullMQ background job processor, requires Docker for Playwright/Chromium

### Infrastructure Requirements

| Service | Purpose | Options |
|---------|---------|---------|
| **Postgres** | Database | Neon (recommended), Supabase, or self-hosted Postgres |
| **Redis** | Job queue | Valkey (self-hosted via Docker), or any Redis-compatible service |
| **Auth** | Authentication | Clerk (required for open-source version) |
| **LLM API** | AI analysis | OpenAI, Groq, or any OpenAI-compatible API |

### Deploying the Web App

The web app is a standard Next.js application. Deploy to:

- **Vercel** (recommended): Connect your repo and deploy
- **Railway/Render**: Use the Dockerfile or Node.js buildpack
- **Self-hosted VM**: Run `bun run build && bun run start`

### Deploying the Worker on a VM

The worker runs background jobs (browser crawling, AI analysis) and requires Playwright/Chromium. It must be deployed via Docker.

1. **Clone the repository on your VM**

```bash
git clone https://github.com/opencited/opencited.git
cd opencited
```

2. **Create `.env` file** with the required environment variables (see [Worker Configuration](#worker-configuration) below)

3. **Build and start** using the production Docker Compose file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The production compose file (`docker-compose.prod.yml`) runs both Valkey and the worker with health checks and auto-restart. See the [Dockerfile](apps/worker/Dockerfile) for the worker image configuration.

4. **Verify the worker is running**

```bash
curl http://localhost:3001/health
```

### Worker Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `REDIS_URL` | Redis/Valkey connection string | Required |
| `DATABASE_URL` | Postgres connection string | Required |
| `WORKER_CONCURRENCY` | Max concurrent jobs | `5` |
| `PORT` | Bull Board dashboard port | `3001` |
| `LLM_PROVIDER` | LLM provider (`openai`, `groq`, `openai-compatible`) | Required |
| `LLM_API_KEY` | LLM API key | Required |
| `LLM_MODEL` | LLM model identifier | Required |

### Monitoring

The worker exposes:

- **Health check**: `GET /health` — Returns Redis connectivity status
- **Bull Board**: `/admin/queues` — Web UI for inspecting job queues, statuses, and retrying failed jobs

Use these endpoints with your monitoring system or reverse proxy.

### Scaling

- **Vertical**: Increase `WORKER_CONCURRENCY` (each job spawns a Chromium instance, ~200-500MB RAM per job)
- **Horizontal**: Run multiple worker instances pointing to the same Redis — BullMQ handles job distribution automatically

## Committing

Run `bun run commit` to create commits using Commitizen. Follow conventional commits format.

## Git Hooks

Pre-commit hook runs `format && lint && tsc` before each commit (via Husky).

## License

MIT
