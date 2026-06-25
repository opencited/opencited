# PRD: AI Visibility Score (0–100)

**Linked issue:** #22
**Status:** Ready for agent
**Author:** growupanand
**Date:** 2026-06-25
**ADR:** [docs/adr/0002-visibility-score.md](../adr/0002-visibility-score.md)
**Formula spec:** [docs/agents/visibility-score.md](../agents/visibility-score.md)

---

## Problem Statement

A user tracking a brand with OpenCited has no single, defensible number that answers "how visible is my brand in AI answers right now?" The platform surfaces raw operational data — per-crawl mention counts, citation lists, sentiment on crawled pages — but leaves the synthesis to the user. As a result:

- A marketer opening the dashboard cannot answer the headline question ("am I showing up?") in under five seconds.
- Comparing one brand against another across engines requires manual spreadsheet work.
- A user cannot tell whether their brand is gaining or losing AI visibility over time, because there is no longitudinal metric to trend.
- The platform's existing per-crawl metadata (mention, citation, position) is presented as a checklist, not as a quality signal. Two brands with the same mention rate are indistinguishable even if one is cited as a primary recommendation and the other is mentioned as an aside.

Without a composite score, OpenCited is a data-collection tool. With one, it is a measurement product — and the measurement is the value.

## Solution

Ship a composite **AI Visibility Score** in the [0, 100] range, computed at three layers from five weighted sub-scores, normalised against the user's tracked competitor set per engine, and surfaced across the dashboard, the visibility table, and the crawl detail sheet.

The score is **deterministic for the same input**, **documented in the README** (verbatim from the formula spec), and **validated against a 50-response test harness** before launch. It is the only number on the dashboard that the user has to understand; everything else is supporting evidence.

User-facing surface:

- **Dashboard** — one hero number per AI engine (Perplexity today, ChatGPT/Gemini/Claude tomorrow), with a per-engine breakdown card and a trend sparkline.
- **AI Visibility page** — a new "Score" column in the visibility table, with sub-score breakdown on hover and a "low confidence" badge when the prompt has fewer than 3 crawls.
- **Crawl detail sheet** — a new "Score" tab showing the 5 sub-scores, the composite, and a "Retry sentiment analysis" button when the LLM-as-judge call fell back to neutral.

When the formula is upgraded, every historical score row preserves its `formulaVersion`, and a one-off migration re-scores crawls with the new version. The user never sees a score change without a recorded reason.

## User Stories

### Reading the score

1. As a solo developer, I want to see a single 0–100 number on the dashboard for each AI engine, so that I can tell at a glance how visible my brand is.
2. As a solo developer, I want the score to update within a few seconds of a crawl finishing, so that I can iterate on my prompt library and see the impact.
3. As a solo developer, I want to hover over the score and see the 5 sub-score components, so that I understand *why* the number is what it is.
4. As a solo developer, I want to see the score change over time (week / month / quarter), so that I can tell if my AI visibility is trending up or down.
5. As a solo developer, I want to compare my brand's score against my tracked competitors, so that I know whether I am winning or losing in my category.
6. As a solo developer, I want the score to be on the same 0–100 scale across every AI engine, so that I can compare a Perplexity score to a ChatGPT score without doing math.
7. As a solo developer, I want the score formula to be published in the README, so that I can trust the number and explain it to my co-founder or investor.
8. As a solo developer, I want a deterministic score, so that re-running the same crawl returns the same number and I can trust the historical trend.
9. As a solo developer, I want the score to be empty (not zero, not 50) when I have fewer than 3 crawls, so that I do not draw conclusions from noise.
10. As a solo developer, I want the score to be empty (with a "add a competitor" CTA) when I have not tracked any competitors, so that I understand why a peer-relative score is unavailable.
11. As a solo developer, I want a "what does this mean?" tooltip on every score display, so that I can interpret unfamiliar numbers without leaving the page.

### Sub-score visibility

12. As a solo developer, I want to see my *mention rate* (the % of crawls where my brand is named), so that I know whether my brand is even in the conversation.
13. As a solo developer, I want to see my *position score* (how early my brand is named in the AI answer), so that I know whether I am the first recommendation or the fifth.
14. As a solo developer, I want to see my *citation rate* (the % of crawls where my domain is cited as a source), so that I know whether AI engines consider my content authoritative.
15. As a solo developer, I want to see my *sentiment score* (positive / neutral / negative toward my brand), so that I know whether AI engines are recommending me, mentioning me neutrally, or warning against me.
16. As a solo developer, I want to see my *co-mention share* (how much of the "brand mention pie" my brand owns when competitors are also mentioned), so that I know how I stack up in head-to-head scenarios.
17. As a solo developer, I want each sub-score to be displayed as a 0–100 number, so that I can compare sub-scores against each other.
18. As a solo developer, I want each sub-score to have a tooltip explaining what it measures, so that I can learn what the formula is doing.

### Cross-engine and period views

19. As a solo developer, I want a cross-engine aggregate score (one number across all engines), so that I can see my overall AI visibility at a glance.
20. As a solo developer, I want per-engine scores side-by-side, so that I can see where I am strong (Perplexity) vs weak (ChatGPT).
21. As a solo developer, I want the cross-engine aggregate to use equal weight per engine for v1, so that the math is simple and defensible.
22. As a solo developer, I want a weekly score trend on the dashboard, so that I can see if my last prompt-library edit moved the needle.
23. As a solo developer, I want a monthly score trend, so that I can see the longer-term trajectory for stakeholder reporting.
24. As a solo developer, I want the trend sparkline to use the same per-engine normalised score as the headline number, so that the trend and the headline are apples-to-apples.
25. As a solo developer, I want a "no data" state for engines that have not been crawled yet, so that the cross-engine aggregate does not penalise me for an untracked engine.

### Crawl-level diagnostics

26. As a solo developer, I want to see the per-crawl score in the crawl detail sheet, so that I can drill into why a particular crawl scored the way it did.
27. As a solo developer, I want to see the 5 sub-scores per crawl in the detail sheet, so that I can identify which sub-score is the bottleneck for that particular answer.
28. As a solo developer, I want a "Retry sentiment analysis" button on a crawl where the LLM call fell back to neutral, so that I can recover the real sentiment without re-running the entire crawl.
29. As a solo developer, I want the retry to update the score in place, so that I do not have to refresh the page to see the new sentiment.
30. As a solo developer, I want a "Pending sentiment retry" badge on crawls in the visibility table, so that I know which scores are temporarily using a neutral sentiment fallback.
31. As a solo developer, I want the retry to be limited (max 1 retry per crawl, then we give up), so that a misbehaving LLM cannot block my score forever.
32. As a solo developer, I want the sentiment LLM call to be cached, so that re-scoring a prompt (e.g., after a weight tweak) does not re-bill the LLM provider.

### Validation and trust

33. As a solo developer, I want the score formula published in the README verbatim, so that I can copy-paste it and verify the math myself.
34. As a solo developer, I want the score to have a 0.7 Spearman correlation against human-labelled ground truth, so that I can trust it.
35. As a solo developer, I want the score to be byte-identical on repeated runs, so that the trend line is real, not noise.
36. As a solo developer, I want the score to be stable under small weight perturbations (±5%), so that future formula tweaks do not invalidate my historical record.
37. As a solo developer, I want the test harness to run in CI on every PR, so that a formula change cannot break the contract without a reviewer noticing.

### Operational

38. As a solo developer, I want the score to be computed in the worker, not in the tRPC request, so that the dashboard loads fast.
39. As a solo developer, I want a sentiment LLM failure to never block the score, so that a flaking provider cannot blank my dashboard.
40. As a solo developer, I want the worker to log score computation (sub-scores, formula version, sentiment cache hit), so that I can debug from the logs.
41. As a solo developer, I want the score to be stored in a dedicated table (`crawl_visibility_score`), so that re-scoring with a new formula is a migration, not a schema change.
42. As a solo developer, I want every score row to record its `formulaVersion`, so that I can audit why a score changed when the formula is upgraded.

### Edge cases and cold start

43. As a solo developer, I want a clear empty state on the dashboard when I have zero crawls, so that I am not confused by a missing score.
44. As a solo developer, I want a progress indicator showing "X of 3 checks needed" when I am below the cold-start threshold, so that I know when my first real score will appear.
45. As a solo developer, I want a "Add a competitor" CTA when my peer set is empty, so that I know how to unlock the peer-relative score.
46. As a solo developer, I want the cold-start threshold to be 3 crawls per engine, so that the first score is statistically meaningful.
47. As a solo developer, I want failed crawls to not count toward the cold-start threshold, so that I do not hit the threshold on a flapping proxy.

### Coverage gaps (deferred)

48. As a solo developer, I want third-party citations (Wikipedia, news) to count toward my citation score — *deferred to v1.1*, with a documented gap.
49. As a solo developer, I want within-sentence mention position (character offset) — *deferred to v1.1*.
50. As a solo developer, I want per-competitor head-to-head position comparisons — *deferred to v1.1*.
51. As a solo developer, I want category-relative baselines (broader than my tracked competitors) — *deferred to v1.1*.
52. As a solo developer, I want time-decayed scores (recent crawls weighted higher) — *deferred to v1.1*.
53. As a solo developer, I want per-project weight overrides — *deferred to v1.1* (weights are locked in v1).

## Implementation Decisions

### Module structure

The implementation is organised around **four deep modules** in a new `packages/score-actions/` workspace package. The existing `packages/actions/` package is too domain-coupled (it knows about `domainProject`, `competitor`, etc.) to host the pure scoring functions; the new package is a pure, framework-agnostic scoring library that can be tested in isolation.

**1. `computeVisibilityScore` — the core formula (deep module)**

A pure function:

```
computeVisibilityScore({
  crawlContent,           // string
  crawlProvider,          // 'perplexity' | 'chatgpt' | ...
  crawlCitations,         // { domain, url, position, isOwnDomain, isCompetitorDomain }[]
  brandMentions,          // { brandName, mentionType, position }[]
  targetBrand,            // { name, domain, aliases }
  sentimentInput,         // { label, cacheHit, fallback, retryCount }
}) → {
  mentionScore, positionScore, citationScore, sentimentScore, coMentionScore,
  visibilityScore, formulaVersion, computedAt
}
```

- No DB, no network, no LLM call. The sentiment input is pre-computed.
- 5 sub-scores, all in [0, 100], the composite is a weighted sum, the formula version is hard-coded to `v1.0.0`.
- Stable interface — the function signature does not change between v1.0.0 and v1.1.0. Additions go in a new optional `options` field.
- Tested with synthetic inputs against the worked example in the formula spec.

**2. `callSentimentJudge` — the LLM boundary (deep module)**

```
callSentimentJudge({
  content, brandName, promptVersion, modelName
}) → { label, cacheHit, fallback, retryCount }
```

- Encapsulates the LLM call, the content-hash cache, the retry budget, and the fallback to neutral.
- Uses the existing `packages/actions/src/ai/provider.ts` (which wraps the `ai` SDK) — no new LLM client.
- The cache is in-memory keyed by `sha256(content + promptVersion + modelName + brandName)`. Persisted to disk on shutdown, not in DB (re-derivable).
- The retry budget is hard-capped at 2 attempts (initial + 1 retry) per the ADR.

**3. `aggregateVisibilityScores` — the normalisation layer (deep module)**

```
aggregateVisibilityScores({
  perCrawlScores,         // { crawlId, subScores, computedAt, provider }[]
  peerSet,                // { brandId, name, ... }[]
  options,                // { winsorisePercentile: 0.05, minCrawlsForScore: 3 }
}) → {
  perPromptScores, perBrandPerEngineScores, crossEngineScore
}
```

- Pure function — no DB, no I/O. Takes pre-fetched per-crawl scores, returns aggregates.
- Min-max normalisation per sub-score per engine, winsorised at the 5th/95th percentiles.
- Returns `null` for the per-brand-per-engine score when the per-engine crawl count is below 3 or the peer set is empty (cold start).

**4. `validateScoreAgreement` — the test harness boundary (deep module)**

Lives in `packages/score-validation/`. Pure function over a frozen test fixture:

```
validateScoreAgreement({
  fixtures,        // { crawlData, humanLabel }[]
  compute,         // (crawlData) → score
  options          // { spearmanThreshold: 0.7, weightPerturbation: 0.05 }
}) → {
  spearmanCorrelation, weightStability, determinismCheck, cacheHitRate
}
```

- Returns a structured result; the CI runner asserts each threshold.
- Determinism check runs the score 5 times and asserts byte-identical output.

### Module wiring

A thin action layer in `packages/actions/src/aiVisibility/` glues the deep modules to the DB and the worker:

- `computeVisibilityScoreAction` — wraps `computeVisibilityScore` + `callSentimentJudge`, persists the result to `crawl_visibility_score`. Called from the worker after `saveBrandIntelligenceAction`.
- `getVisibilityAggregateAction` — fetches per-crawl scores, runs `aggregateVisibilityScores`, returns per-prompt and per-brand-per-engine aggregates. Called by the dashboard and the visibility table.
- `retrySentimentAction` — busts the cache, re-runs `callSentimentJudge`, recomputes the sentiment sub-score + composite, updates the row. Exposed as a tRPC mutation.
- `getCrawlScoreAction` — fetches the per-crawl score row for the detail sheet.

The tRPC layer in `packages/trpc/src/router/aiVisibility.ts` exposes:

- `getVisibilityOverview` — extended to include the per-prompt score column.
- `retrySentimentAnalysis` — new mutation, calls `retrySentimentAction`.
- `getDashboardMetrics` — extended to return the per-brand-per-engine hero number per engine + trend sparkline (last 30 days).

### Sentiment sub-score in the formula spec

The sentiment label uses lowercase (`positive | neutral | negative`) on the new `crawl_visibility_score` table. The pre-existing `pageAnalysisTable` uses capitalised (`Positive | Negative | Neutral`) for a different concept (sentiment of crawled page content, not AI answer sentiment). The casing mismatch is a known inconsistency; both enum sets will be left as-is in v1 and harmonised in a dedicated migration in v1.1.

### Schema changes (already migrated)

Two schema changes are part of this PRD. The migration is already generated and applied per the implementer's confirmation:

- **New table `crawl_visibility_score`** — one row per crawl, primary key `crawlId`, holding the 5 sub-scores, the composite, the sentiment provenance, the `formulaVersion`, and the `computedAt` timestamp. Cascade-on-delete with `prompt_query_crawl`. Full DDL and column types in `packages/db/src/schema/crawlVisibilityScore.ts`.
- **New column `position` (integer, nullable) on `crawl_brand_mention`** — 1-indexed ordinal rank of the brand mention among all detected brand mentions in the same answer, in order of first appearance. Populated by the LLM extraction step in the worker; nullable for backwards compatibility with pre-existing rows.

### Computation timing

The score is computed **in the worker**, immediately after `saveBrandIntelligenceAction` succeeds. The integration point is annotated with a `TODO(issue-22)` comment in `apps/worker/src/handlers/perplexity-crawl.ts` (already in place from the design pass). The score writes use the existing DB connection — no new infrastructure.

### Sentiment failure handling

If the LLM call times out (>10s) or returns a parse error, the score is computed with `sentimentScore = 50` (neutral) and `sentimentIsFallback = true`. A single background retry is enqueued in the same BullMQ queue the crawl uses. After the retry budget is exhausted, the score stays at neutral and the user is shown a "Pending sentiment retry" badge in the UI. The user can manually re-trigger from the crawl detail sheet.

### Determinism

- All four pure sub-scores (`mentionScore`, `positionScore`, `citationScore`, `coMentionScore`) are pure functions of stored data.
- `sentimentScore` uses `temperature = 0` and a content-hash cache. Re-running the score for the same crawl returns the same label.
- The composite is a pure function of the 5 sub-scores.
- The aggregate functions are pure functions of the per-crawl scores + the peer set.
- The test harness runs the score 5 times per fixture and asserts byte-identical output.

### UI surface

Three UI integration points:

1. **Dashboard** (`apps/web/app/app/dashboard/page.tsx`) — new "AI Visibility Score" card with one hero number per engine, a 30-day trend sparkline, and a "what does this mean?" tooltip.
2. **AI Visibility page** (`apps/web/app/app/ai-visibility/_components/visibility-table.tsx`) — new "Score" column with the per-prompt score and a hover popover showing the 5 sub-scores. A small badge marks prompts where any crawl is in sentiment fallback.
3. **Crawl detail sheet** (`apps/web/app/app/ai-visibility/_components/crawl-detail-sheet.tsx`) — new "Score" tab showing the 5 sub-scores + composite + formula version, with a "Retry sentiment analysis" button when `sentimentIsFallback = true`.

All UI components reuse the existing `@opencited/ui` primitives — no new shadcn components, no color overrides. The new `Score` column on the visibility table uses the existing `Badge` component for the fallback state.

### Backfill

A one-off backfill script runs after the migration is applied: it iterates over all `promptQueryCrawl` rows that have no corresponding `crawl_visibility_score` row, runs the score against the stored data, and inserts the result with `formulaVersion = "v1.0.0"`. Sentiment is backfilled using the LLM with the content-hash cache. The backfill runs in batches of 50 to avoid overwhelming the LLM provider.

## Testing Decisions

### What makes a good test (for this PRD)

A good test exercises **the formula spec, not the wiring**. The four deep modules are pure functions; their tests assert the *outputs* match the spec, not that the modules "call this method" or "set this state". For impure modules (the worker integration, the tRPC mutation), the test asserts the **observable side effect** (a row appears in `crawl_visibility_score`, the cache is consulted, the fallback flag is set) — not the implementation details.

### Module test coverage

| Module | Test approach |
|--------|--------------|
| `computeVisibilityScore` | Unit tests against the worked example in the formula spec (the `MyBrand` example with deterministic inputs and the 71 expected output). Edge cases: brand not mentioned, brand at rank 5, no citations, no competitors. |
| `callSentimentJudge` | Unit tests with a mock LLM provider. Asserts: cache hit on second call, fallback on timeout, retry budget enforced, prompt version is in the cache key. |
| `aggregateVisibilityScores` | Unit tests with synthetic per-crawl scores. Asserts: min-max normalisation, winsorisation, cold-start nulls, equal-weight cross-engine aggregation. |
| `validateScoreAgreement` | Self-test — the validation harness is itself a pure function. The test asserts the harness returns the expected metrics on a synthetic fixture. |
| Worker integration | Integration test that calls the worker pipeline against a fake crawl fixture and asserts a `crawl_visibility_score` row is written. |
| tRPC `retrySentimentAnalysis` | Integration test that calls the mutation and asserts the score row is updated and the cache is busted. |

### Prior art

The codebase has **no existing tests**. This PRD sets the test pattern. We will use **Bun's built-in test runner** (`bun test`) — it is already part of the toolchain (Bun 1.3.10 per `AGENTS.md`) and does not require a new dependency. Test files live next to the source as `*.test.ts` (e.g., `packages/score-actions/src/computeVisibilityScore.test.ts`).

### CI integration

The validation harness runs in CI on every PR. The PR fails if:

- `spearmanCorrelation < 0.7` against the 50-response ground truth.
- `weightStability` is violated (any brand's rank moves more than 1 position when weights are perturbed by ±5%).
- `determinismCheck` fails (5 consecutive runs of the same fixture do not return byte-identical scores).
- `cacheHitRate < 1.0` for the second run of any fixture with a pre-warmed cache.

### Ground truth fixture

50 historical (already-completed) crawls hand-labelled by the implementer. Each fixture records:

- The crawl's stored content, citations, and brand mentions.
- A human-assigned composite score (0–100).
- A human-assigned sentiment label.

The fixtures live in `packages/score-validation/fixtures/ground-truth.json` and are committed to the repo.

## Out of Scope

The following are **explicitly deferred** and are not part of this PRD:

- **Third-party citations** (Wikipedia, news, review sites) in the citation sub-score. v1 scores only own-domain citations. Tracked as a v1.1 follow-up.
- **Within-sentence position** (character offset of first mention in the answer body). v1 uses ordinal rank among brand mentions. Tracked as v1.1.
- **Per-competitor head-to-head position comparisons** (the "appears before you / after you" UI from ADR-0001). Tracked as v1.1.
- **Category-relative baselines** (broader peer set than the user's tracked competitors). Tracked as v1.1.
- **Time-decayed aggregation** (recent crawls weighted higher in the per-prompt mean). Tracked as v1.1.
- **Per-project weight overrides**. Weights are locked at `0.35 / 0.25 / 0.20 / 0.10 / 0.10` for v1. Tracked as v1.1.
- **Traffic-share weighted cross-engine aggregation**. v1 uses equal weight per engine. Tracked as v1.1 when we have a second engine.
- **AI crawler log tracking** (Profound's signature feature). Out of scope for visibility scoring; tracked as a separate issue.
- **Sentiment calibration dashboard** (a UI for re-labelling sentiment to improve the LLM judge). Out of scope; the LLM judge is good enough for v1.
- **Public API exposure** of the score for external integrations. Internal-only for v1.

## Further Notes

### Existing domain language

This PRD uses the glossary from `CONTEXT.md`. New terms added by this work: `visibilityScore`, `sub-score`, `mentionPosition`, `peer set`, `formulaVersion`, `sentimentFallback`. The schema and the worker integration are consistent with these terms.

### Decision log

The 13 design decisions captured during the interview (granularity, position decay, mention denominator, citation scope, sentiment granularity, co-mention semantics, weights, normalisation, cross-engine aggregation, determinism, cold start, storage, computation timing) are recorded in `docs/adr/0002-visibility-score.md`. The normative spec — the actual formulas, mappings, and worked example — is in `docs/agents/visibility-score.md`. If a future PR disagrees with either, update the docs in the same PR.

### Acceptance criteria mapping

| Issue #22 criterion | How this PRD satisfies it |
|---------------------|----------------------------|
| Composite score 0–100 per brand per engine per period | Three-layer model; per-crawl, per-prompt, per-brand-per-engine; period = derived on read. |
| Mention frequency, position, sentiment, citation count, co-mention | 5 sub-scores, fixed weights. |
| Engine-level + cross-engine aggregate | Per-engine + equal-weight cross-engine for v1. |
| Score normalisation against competitor baseline | Min-max per sub-score per engine against peer set, winsorised. |
| Documentation of algorithm in README | Formula spec is normative; a README section will link to it. |
| Deterministic for the same input | Pure sub-scores + `temperature=0` + content-hash cache + `formulaVersion` audit trail. |
| Validated against manual scoring of 50 test responses | `packages/score-validation/` with 50 hand-curated fixtures, Spearman ≥ 0.7 in CI. |
