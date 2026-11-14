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

On startup the worker calls `upsertJobScheduler("crawl-health-check-daily", …)`,
so restarts reuse one scheduler instead of creating duplicates. BullMQ stores
the next run as a delayed job: if the worker is down at 06:00 IST, the job runs
when the worker comes back up and the delayed job becomes due. Bull Board shows
it under the `crawl-health-check` queue.

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

On EC2 after a deploy, the worker container already has the env file:

```bash
docker compose --project-name opencited-worker \
  -f docker-compose.prod.yml exec worker \
  bun run scripts/crawl-health-check.ts --engines=chatgpt

# or, if bun is installed on the VM and REDIS_URL is exported:
bun run scripts/crawl-health-check.ts --engines=chatgpt
```

### Status rules

The classifier reads only the raw `CrawlResult`
(`apps/worker/src/lib/crawl-health.ts`):

| Status | When |
|---|---|
| `ok` | No throw/timeout, trimmed content ≥ 80 chars, `sourcesCount > 0` |
| `degraded` | Content ≥ 80 chars but `sourcesCount === 0` (the “no sources button found” case) |
| `failed` | Throw, timeout, empty/short extraction (< 80 chars), or bot detection |
| `skipped` | Engine is disabled in `answer_engine`, or not requested by a manual run |

`sourcesCount = inlineLinks.length + sourcePanelLinks.length`. Each engine gets
an 8-minute wall-clock timeout and one `Crawler.crawl` call (the Crawler rotates
proxies internally). Engines run sequentially, one Camoufox at a time. If the
matching user-crawl queue has active jobs, the canary waits and polls every 15s
for up to 20 minutes, then runs anyway. It calls `rateLimit(engine)` and
`resolveProxiesForPublicScan()` (ThorData / `PROXY_SERVER`, no sticky keys).

The worker flushes the Axiom transport after every engine and once after the
daily summary.

### Axiom events

Dataset: `worker-app` (when `AXIOM_TRANSPORT_ENABLED=true`).

Per engine — `message: "crawl_health_check"` (level: `info` for ok/skipped,
`warn` for degraded, `error` for failed). Context:

```text
event, engine, status, durationMs, contentLength, sourcesCount,
inlineLinksCount, sourcePanelLinksCount, error, failureType, proxyUsed,
proxySource, proxyServer, attemptCount, trigger, skippedReason
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
| project _time, engine, status, durationMs, contentLength, sourcesCount, inlineLinksCount, sourcePanelLinksCount, error, failureType, proxySource, proxyServer, attemptCount, trigger
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
