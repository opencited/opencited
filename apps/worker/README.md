# @opencited/worker

BullMQ worker for browser crawls, scan mention probes, sentiment retries, and
the daily search-engine crawl health check. Runs Camoufox + Playwright in
Docker; see the deployment section of the root [README](../../README.md).

## Daily crawl health check

A production crawl can finish as `completed` while the answer has no citations
— the 9 Nov 2026 ChatGPT runs returned 3k–10k characters with zero inline and
zero source-panel links. `GET /health` only pings Redis, so it cannot catch
that. The canary runs the same browser path as user crawls once a day, stops
after the raw `CrawlResult`, and emits structured events to Axiom.

What it does **not** do:

- No `intakeCrawlResultAction`, `failCrawlAction`,
  `extractBrandIntelligenceAction`, or `computeVisibilityScoreAction`.
- No writes to `prompt_query_crawl`, scores, or user projects.
- No customer crawl credits, sticky-proxy keys, or public HTTP route.
- Never logs the full answer text or proxy credentials.

### Schedule

| Variable | Default | Notes |
|---|---|---|
| `CRAWL_HEALTH_CHECK_CRON` | `0 0 6 * * *` | BullMQ second-precision cron: 06:00 IST daily, before the 07:30 IST AEO digest |
| `CRAWL_HEALTH_CHECK_TZ` | `Asia/Kolkata` | Timezone for the cron |
| `CRAWL_HEALTH_CHECK_QUERY` | `What is the best CRM for small business?` | Fixed, brand-neutral query |

On startup the worker reads `getJobScheduler("crawl-health-check-daily")`.
When the cron pattern and timezone are unchanged it leaves the scheduler alone,
so an overdue delayed job survives a restart — if the worker is down at 06:00
IST and comes back at 06:30, it still runs that day. If the scheduler is
unchanged but its next delayed job is missing (for example deleted in Bull
Board), it is upserted so the next run is not lost. The scheduler is upserted
only when it is missing, its next job is missing, or the pattern/timezone
changed; that upsert replaces
the previous delayed job, so a changed schedule with an already-overdue run
also enqueues one deterministic catch-up job
(`crawl-health-check-catchup-YYYY-MM-DD` in the configured timezone). The
registration completes before the health-check worker starts processing. Bull
Board shows the scheduler under the `crawl-health-check` queue.

### Run it manually

Dispatch to the worker (recommended — uses its proxies, Camoufox, and Axiom):

```bash
bun run crawl-health-check
bun run crawl-health-check -- --engines=chatgpt
bun run crawl-health-check -- --engines=chatgpt,perplexity
```

The `bun run crawl-health-check` script loads `.env.local` with dotenv-cli,
enqueues a job with `trigger: "manual"`, and exits. Follow it in Bull Board at
`/admin/queues`. Running `bun run scripts/crawl-health-check.ts` directly also
works when the worker env is already exported.

Run in the current process (development only — needs `DATABASE_URL`, proxies,
and a Camoufox install):

```bash
bun run crawl-health-check -- --local
bun run crawl-health-check -- --engines=perplexity --local
```

On EC2 after a deploy, run it from the worker tmux session. The root script
loads `.env.local` with dotenv-cli:

```bash
cd ~/opencited && bun run crawl-health-check -- --engines=chatgpt
```

Alternative: exec it inside the worker container, which already has the env
file:

```bash
docker compose --project-name opencited-worker \
  -f docker-compose.prod.yml exec worker \
  bun run scripts/crawl-health-check.ts --engines=chatgpt
```

### Status rules

The classifier reads only the raw `CrawlResult`
(`apps/worker/src/lib/crawl-health.ts`):

| Status | When |
|---|---|
| `ok` | No throw/timeout, trimmed content ≥ 80 chars, `sourcesCount > 0` |
| `degraded` | Content ≥ 80 chars and the first run has `sourcesCount === 0` (the “no sources button found” case), and either the retry also has zero sources or the retry was skipped/failed |
| `failed` | Throw, timeout, empty/short extraction (< 80 chars), or bot detection |
| `skipped` | Engine is disabled in `answer_engine`, or not requested by a manual run |

`sourcesCount = inlineLinks.length + sourcePanelLinks.length`.
`contentLength` is the raw `result.content.length`; only the 80-character floor
trims surrounding whitespace.

Each engine gets an 8-minute crawl budget, measured from just before the first
crawl rather than from when the engine started waiting for user crawls; the
event's `durationMs` still covers the whole engine, including that wait. A
`Crawler.crawl` call rotates proxies internally. If the first result is
`degraded`, the engine is crawled once more (after another
`rateLimit(engine)`) only when at least 3 minutes of the budget remain. If the
retry is skipped for budget or rate limiting, or the retry errors or times out,
the event reports the first result as `degraded` with `zeroSourceRetryOutcome`
and a short `error` note; `zeroSourceRetry` is true only when a retry actually
started. Otherwise the event reports the second result. `attemptCount` is the
sum across both runs. On timeout the handler aborts the crawl, which closes the
open Camoufox session and stops further proxy attempts, then waits up to 60s
for the crawl to settle before logging and moving on. Engines run sequentially,
one Camoufox at a time. If the matching user-crawl queue has active jobs, the
canary waits and polls every 15s for up to 20 minutes, then runs anyway. It
calls `rateLimit(engine)` and `resolveProxiesForPublicScan()` (ThorData /
`PROXY_SERVER`, no sticky keys).

The worker flushes the Axiom transport after every engine and once after the
daily summary.

### Axiom events

Dataset: `worker-app` (when `AXIOM_TRANSPORT_ENABLED=true`).

Per engine — `message: "crawl_health_check"` (level: `info` for ok/skipped,
`warn` for degraded, `error` for failed). Context:

```text
event, engine, status, durationMs, contentLength, sourcesCount,
inlineLinksCount, sourcePanelLinksCount, error, failureType, proxyUsed,
proxySource, proxyServer, attemptCount, zeroSourceRetry, zeroSourceRetryOutcome,
trigger, skippedReason
```

Daily summary — `message: "crawl_health_check_daily"`:

```text
event, chatgptStatus, perplexityStatus, overallStatus, enginesRun,
enginesSkipped, trigger, durationMs
```

`overallStatus` is the worst engine that actually ran (`failed > degraded >
ok`), or `skipped` if every live engine was skipped. Summary level is `error`
for a failure, `warn` for degradation, otherwise `info`.

### Axiom monitors

Create these in the OpenCited Axiom org after a manual run has produced at
least one `crawl_health_check_daily` event. Do not create monitors from app
code, and never commit Axiom API tokens. Use an email notifier: **Monitors →
Manage notifiers → New notifier → Email**, then attach it to each monitor.

1. **Crawl health check — daily status** (Match monitor). One email per run,
   including days that are `ok`.

```apl
['worker-app']
| where message == "crawl_health_check_daily"
| project _time, overallStatus, chatgptStatus, perplexityStatus, enginesRun, enginesSkipped, trigger, durationMs, level
```

2. **Crawl health check — failed or degraded** (Match monitor). Emails as soon
   as an engine is degraded or failed, so a “no sources button found” run is
   not silent.

```apl
['worker-app']
| where message == "crawl_health_check" and (status == "failed" or status == "degraded")
| project _time, engine, status, durationMs, contentLength, sourcesCount, inlineLinksCount, sourcePanelLinksCount, error, failureType, proxySource, proxyServer, attemptCount, zeroSourceRetry, zeroSourceRetryOutcome, trigger
```

3. **Crawl health check — missing daily run** (Threshold monitor). Worker down,
   scheduler broken, or the summary never flushed. Frequency 60 minutes, range
   1560 minutes (26 hours — a 2 hour grace after 06:00 IST), comparison
   `below 1`, enable **Alert on no data**.

```apl
['worker-app']
| where message == "crawl_health_check_daily"
| summarize run_count=count()
```

Dashboard query (not a monitor):

```apl
['worker-app']
| where message == "crawl_health_check"
| project _time, engine, status, durationMs, contentLength, sourcesCount, error, trigger
| order by _time desc
```
