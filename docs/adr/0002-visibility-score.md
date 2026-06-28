# ADR-0002: AI Visibility Score (Composite 0–100)

**Status:** Accepted
**Date:** 2026-06-25
**Context:** Issue #22 — visibility scoring algorithm

## Problem

A brand tracked by OpenCited needs a single, defensible number that answers "how visible is my brand in AI answers right now?". The number must be:

- **Deterministic** for the same input (acceptance criterion)
- **Documented** in the README for transparency
- **Comparable across AI engines** (Perplexity today; ChatGPT, Claude, Gemini, AI Overviews tomorrow)
- **Normalised against competitors** so a brand with low absolute mentions can still score well if it beats its peers
- **Trustworthy enough** for a marketer to base decisions on it

ADR-0001 explicitly deferred the position/trend/co-mention UI in favour of a composite score. ADR-0001 also locked the architectural rule that **one domainProject = one brand = 1:1:1**, so the score is scoped to a single `domainProjectId`.

## Decision

We adopt a **three-layer composite score** on a 0–100 scale, computed from five sub-scores with fixed weights, normalised against the tracked competitor set per engine.

### Three layers

| Layer | Unit | Semantics | Surface |
|------|------|----------|---------|
| **Per-crawl** | one AI response | raw formula output, unnormalised | crawl detail sheet (sub-score breakdown) |
| **Per-prompt** | one `promptQuery` | mean of per-crawl sub-scores across recent crawls of that prompt | visibility table (one row per prompt) |
| **Per-brand-per-engine** | one (domainProject, provider) | min-max normalised against the tracked peer set, then weighted-summed | dashboard hero number + per-engine comparison cards |

A fourth implicit layer — **per-brand-per-engine-per-period** — is the per-brand-per-engine score restricted to a time bucket (week / month / quarter). It is computed on read in the action layer; not stored.

### Five sub-scores (per-crawl)

All five are bounded to `[0, 100]`. The composite is a fixed-weight sum (weights below). Sub-score definitions are normative — see `docs/agents/visibility-score.md` for the full formula spec.

1. **mentionScore** — `0` if the target brand is not mentioned in this answer, `100` if it is. Multi-mention density is captured by `positionScore`, not here.
2. **positionScore** — `100 / log2(1 + rank)` where `rank` is the 1-indexed ordinal position of the target brand among all detected brand mentions in the answer (1st = 100, 2nd = 63, 3rd = 50, 4th = 39, …). If the brand is not mentioned, `positionScore = 0`.
3. **citationScore** — `100 × (crawls in this aggregate where the brand's own domain is cited as a source) / (crawls in this aggregate where any tracked brand's domain is cited)`. At the per-crawl layer, it is `100` if the brand's own domain is in the citation list, else `0`.
4. **sentimentScore** — LLM-as-judge on the whole answer with the prompt *"What is the overall sentiment toward {brandName} in this answer?"*. Label mapped: `positive → 100`, `neutral → 50`, `negative → 0`. Returns `50` on LLM timeout/failure (and sets `sentimentIsFallback = true`); retried in the background up to 1 time.
5. **coMentionScore** — `100 × (target brand mentions in this answer) / (total brand mentions in this answer)`, only averaged over answers with at least one brand mention. Captures share-of-answer (Evertune's "Share of Answer") and is orthogonal to `positionScore` (which captures rank, not density).

### Composite formula

Per-crawl:

```
visibilityScore = 0.35 * mentionScore
                + 0.25 * positionScore
                + 0.20 * citationScore
                + 0.10 * sentimentScore
                + 0.10 * coMentionScore
```

Per-prompt (unnormalised): simple mean of per-crawl `visibilityScore` across the prompt's recent successful crawls.

Per-brand-per-engine (peer-relative): for each sub-score, compute min and max across the tracked competitor set per engine (winsorised at 5th/95th percentile), then scale to `[0, 100]`. Composite is the same weighted sum applied to the normalised sub-scores, ensuring `S ∈ [0, 100]`.

Cross-engine (per brand): `S_global = Σ (w_e × S_e)` over engines with data, with `w_e = 1 / E_valid` for v1 (equal weight). When the user adds a second engine and we have platform traffic data, `w_e` switches to traffic-share weights from an external source.

### Determinism

The acceptance criterion requires determinism for the same input. We satisfy it by:

- **Four sub-scores are pure functions of stored data** (`mentionScore`, `positionScore`, `citationScore`, `coMentionScore`) — given the same `crawlId`, they always return the same value.
- **`sentimentScore` uses an LLM call** which is theoretically non-deterministic. We force `temperature = 0` and cache the LLM response by `sha256(content + promptVersion + modelName + brandName)`. Re-runs of the score for the same crawl always return the same sentiment label.
- **The composite is a pure function of the five sub-scores** — same inputs → same composite.
- **`formulaVersion` is stored on every score row** so re-scoring with a new formula never silently mutates historical scores.

### Cold start

A score is `null` (not zero, not 50) when:

- The engine has fewer than 3 successful crawls for the brand, OR
- The `domainProject` has zero tracked competitors (the peer set is undefined for the normalisation step)

The UI surfaces this as "N/A — needs N more checks" or "N/A — add a competitor to enable scoring". The threshold of 3 is the empirical minimum for any variance signal; it will be validated against the 50-response test harness in `packages/score-validation/`.

### Storage

- **New table `crawl_visibility_score`** — one row per crawl, holding the 5 sub-scores + composite + formula version + sentiment cache metadata. `onDelete: cascade` with `prompt_query_crawl`. See `packages/db/src/schema/crawlVisibilityScore.ts`.
- **New column `position` (integer) on `crawl_brand_mention`** — ordinal rank among detected brand mentions in the answer, populated at extraction time. Nullable for backwards compatibility with existing rows.
- **Per-prompt and per-brand-per-engine aggregates are NOT stored** — computed on read in the action layer (`getVisibilityOverviewAction`, dashboard hero). Cheap because it's a weighted average over an indexed table.

### Computation timing

The score is computed in the worker (`apps/worker/src/handlers/perplexity-crawl.ts`), **after** the LLM-based brand intelligence extraction completes, so we have all the data: `content`, mentions (with `position` populated), citations, and brand context. The sentiment LLM call is the only async step; on failure the score is computed with `sentimentScore = 50` and a background retry is enqueued.

The user can manually retry a fallback sentiment from the crawl detail sheet via a new `retrySentimentAnalysis` tRPC mutation that busts the cache and re-runs the LLM call.

## Consequences

### Positive

- **Single documented formula** — the README can publish it verbatim, satisfying the "documented for transparency" acceptance criterion.
- **Deterministic** for the same input — all five sub-scores are pure functions; sentiment is pinned by the content-hash cache.
- **Comparable across brands** — min-max normalisation against the tracked competitor set makes scores meaningful relative to peers.
- **Engine-agnostic from day one** — the formula has no Perplexity-specific terms; adding a second engine is a per-engine baseline change, not a formula rewrite.
- **Auditable** — every score row records `formulaVersion`; a single one-off migration can re-score all historical crawls with a new formula version, with old scores preserved.

### Trade-offs

- **Sentiment is the soft sub-score** — bounded LLM non-determinism and a 2-attempt retry budget mean `sentimentScore` has higher variance than the other four. We accept this because it's 10% of the composite and the cache reduces the variance to "per content hash", not "per call".
- **First-content offset is not captured** — we record ordinal rank among brands, not character offset within the answer body. If two brands are mentioned in the same sentence, they're ranked 1st and 2nd. This is a deliberate v1 simplification (the research treats "first brand the engine named" as the meaningful unit).
- **Third-party citations are not counted** — only own-domain citations are scored. The "earned media" signal (Wikipedia, news, review sites) is deferred to v1.1. We document this gap in the README.
- **Min-max normalisation is sensitive to peer set** — adding or removing a tracked competitor can move a brand's score. We winsorise at 5/95 to dampen this, but the effect is not zero.
- **Cold start leaves the dashboard empty** — below 3 crawls per engine, the score is `null`. We mitigate with progress indicators and CTAs, not with a default-50 score.
- **The 3-crawl threshold is empirically unvalidated** at write time; the 50-response test harness in `packages/score-validation/` is the validation step that will let us tune this.

### Reversibility

- **Schema changes are low-cost to reverse** — `crawl_visibility_score` is a new table; `crawl_brand_mention.position` is a new nullable column. Both can be dropped without affecting existing functionality.
- **The formula is the most costly thing to change** — re-scoring historical crawls is a one-off migration, but downstream UI copy and user expectations lock the formula in once shipped. We mitigate by versioning (`formulaVersion`) and by validating against the 50-response test harness before the first user-facing release.
- **Weights are deliberately locked in v1** (0.35 / 0.25 / 0.20 / 0.10 / 0.10) — no per-project overrides. If users later ask for tunability, we have a baseline to A/B test against.

## References

- Issue: https://github.com/opencited/opencited/issues/22
- Full formula spec: `docs/agents/visibility-score.md`
- Evertune's published formula (the only competitor that publishes one): `visibility × position`
- Share of Model (academic): `mentions / competitor mentions × 100`
- Position decay (research): `1 / log2(1 + rank)` → matches the 60–70% first-mention click capture
- LLM-as-judge position bias: arXiv:2406.07791
