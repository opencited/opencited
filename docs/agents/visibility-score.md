# AI Visibility Score — Formula Specification

**Status:** Normative
**Version:** v1.0.0
**Applies to:** ADR-0002
**Last updated:** 2026-06-25

This document is the **authoritative reference** for the OpenCited AI Visibility Score. If code and this document disagree, this document wins (the code is the bug).

## Glossary of symbols

| Symbol | Meaning |
|--------|---------|
| `b` | target brand (the user's brand) |
| `C` | tracked competitor set for `b`'s `domainProject` |
| `e` | an AI engine (Perplexity, ChatGPT, Gemini, Claude, AI Overviews) |
| `a` | a single crawl (an AI answer) |
| `P` | set of prompts the user has configured for the `domainProject` |
| `M` | set of brand mentions detected in `a` (target + competitor + other) |
| `M_b` | mentions of `b` in `a` |
| `M_C` | mentions of any competitor in `C` in `a` |
| `rank(b, a)` | 1-indexed ordinal rank of `b` among `M`, in order of first appearance; `∞` if not in `M` |
| `cited(b, a)` | boolean: is the `b`'s own domain in the citation list of `a`? |
| `cited_any(C, a)` | boolean: is any competitor in `C` cited in `a`? |
| `sent(b, a)` | 3-class sentiment label from LLM-as-judge: `+1` (positive), `0` (neutral), `-1` (negative) |

All sub-scores are integers in `[0, 100]`. The composite is an integer in `[0, 100]`.

---

## 1. Per-crawl sub-scores

### 1.1 mentionScore (0 or 100)

```
mentionScore(a) = 100  if b ∈ M
                 0     otherwise
```

Multi-mention density is captured by `coMentionScore`, not here.

### 1.2 positionScore (logarithmic decay on rank)

```
positionScore(a) = round(100 / log2(1 + rank(b, a)))   if b ∈ M
                 0                                      otherwise
```

| Rank | positionScore |
|------|---------------|
| 1    | 100           |
| 2    | 63            |
| 3    | 50            |
| 4    | 43            |
| 5    | 39            |
| 6    | 36            |
| 7    | 33            |
| 8    | 32            |
| ∞ (not mentioned) | 0 |

The decay curve matches the research finding that the first brand mentioned in an AI answer captures 60–70% of clicks.

### 1.3 citationScore (binary at per-crawl, ratio at aggregate)

At the per-crawl layer:

```
citationScore(a) = 100  if cited(b, a)
                 0     otherwise
```

The peer-relative ratio is computed at the per-brand-per-engine layer (see §3).

### 1.4 sentimentScore (LLM-as-judge, 3-class mapped to 0–100)

**Prompt** (versioned; v1.0.0):

```
You are evaluating an AI-generated answer for a brand called {brandName}.

Answer:
---
{content}
---

What is the overall sentiment toward {brandName} in this answer?

Respond with exactly one of: positive, neutral, negative
```

**LLM call settings**:
- `temperature = 0` (deterministic)
- `seed` parameter set if provider supports it (Anthropic via header, OpenAI via `seed`)
- Response cached by `sha256(content + promptVersion + modelName + brandName)`

**Mapping**:

```
sentimentScore(a) = 100  if sent(b, a) = +1  (positive)
                   50   if sent(b, a) =  0  (neutral)
                   0    if sent(b, a) = -1  (negative)
```

**Failure handling**: if the LLM call times out (>10s) or returns a parse error, `sentimentScore = 50` (neutral) and `sentimentIsFallback = true` is set on the score row. A background retry is enqueued (1 retry max). The user can manually re-trigger from the crawl detail sheet.

### 1.5 coMentionScore (share-of-answer, Evertune's "Share of Answer")

```
coMentionScore(a) = round(100 * |M_b| / |M|)   if |M| > 0
                  0                              otherwise
```

This is the target brand's share of the brand mentions in the answer. A brand mentioned twice in an answer with 4 total brand mentions scores 50, regardless of where those mentions sit (rank is captured by `positionScore`).

When the answer has no brand mentions at all, `coMentionScore = 0` (we don't define the score for an empty mention set; we record `0` so the composite is still well-defined).

---

## 2. Per-crawl composite

```
visibilityScore(a) = 0.35 * mentionScore(a)
                   + 0.25 * positionScore(a)
                   + 0.20 * citationScore(a)
                   + 0.10 * sentimentScore(a)
                   + 0.10 * coMentionScore(a)
```

Weights sum to 1.0. All sub-scores are in `[0, 100]`, so the composite is in `[0, 100]`.

If any sub-score is missing (e.g., LLM extraction failed entirely and we have no `positionScore`), renormalise the weights over the available sub-scores. (In v1 we expect this to be rare — the worker fails closed if mentions can't be extracted.)

**Worked example** (perplexity answers a "best email marketing tool" prompt):

| Sub-score | Value | Reason |
|-----------|-------|--------|
| mentionScore | 100 | Target brand is mentioned |
| positionScore | 100 | Target is the 1st brand listed |
| citationScore | 0 | Target's own domain not in citations |
| sentimentScore | 50 | LLM says "neutral" (no opinion expressed) |
| coMentionScore | 25 | Target mentioned once, 4 brands total |

```
visibilityScore = 0.35*100 + 0.25*100 + 0.20*0 + 0.10*50 + 0.10*25
                = 35 + 25 + 0 + 5 + 2.5
                = 67.5
                → round to 68
```

---

## 3. Per-prompt aggregate (unnormalised)

For a prompt `p` with recent successful crawls `A_p` (the last N crawls of `p`, default N = 5; we use the mean rather than the most recent to dampen single-run variance):

```
visibilityScore(p) = round( mean(visibilityScore(a) for a in A_p) )
```

A prompt with no successful crawls has `visibilityScore(p) = null`.

---

## 4. Per-brand-per-engine aggregate (peer-relative, min-max normalised)

For each sub-score `s ∈ {mention, position, citation, sentiment, coMention}` and each engine `e`, we compute the min and max of `s` across the peer set `C ∪ {b}` from the per-crawl scores in the time window. We **winsorise** the min and max at the 5th and 95th percentiles of the per-crawl distribution to dampen outliers.

```
s_norm(b, e) = 100 * (s_b - s_min) / (s_max - s_min)   if s_max > s_min
              50                                       otherwise  (degenerate case: all peers identical)
```

The composite at this layer is the same weighted sum applied to the normalised sub-scores:

```
visibilityScore(b, e) = 0.35 * mentionScore_norm
                      + 0.25 * positionScore_norm
                      + 0.20 * citationScore_norm
                      + 0.10 * sentimentScore_norm
                      + 0.10 * coMentionScore_norm
```

This is what the dashboard hero number displays (one per engine).

**Cold start**:
- If `|A_e(b)| < 3` (fewer than 3 successful crawls for `b` on engine `e`): `visibilityScore(b, e) = null`. The UI shows "Needs N more checks" with a progress bar.
- If `|C| = 0` (no competitors tracked): `visibilityScore(b, e) = null`. The UI shows "Add a competitor to enable scoring".

---

## 5. Cross-engine aggregate (per brand)

```
visibilityScore(b) = Σ (w_e * visibilityScore(b, e))   for e in E_with_data
```

Where `Σ w_e = 1`. For v1: `w_e = 1 / |E_with_data|` (equal weight). The schema for engine weights is fixed so the upgrade to traffic-share weights is a config change, not a code change.

Engines with no data are excluded from the denominator — they score 0 by absence, not by inclusion.

---

## 6. Period-bucketed scores

A "time period" view (week / month / quarter) is the per-brand-per-engine score restricted to crawls in the period. We do not store period scores; we compute them on read in the action layer.

```
visibilityScore(b, e, period) = per-brand-per-engine formula applied to crawls in period
```

---

## 7. Determinism guarantees

For any crawl `a` with the same content, the same brand context, and the same `formulaVersion`:

- `mentionScore(a)` is identical.
- `positionScore(a)` is identical.
- `citationScore(a)` is identical.
- `coMentionScore(a)` is identical.
- `sentimentScore(a)` is identical (cache hit on `sha256(content + promptVersion + modelName + brandName)`).
- `visibilityScore(a)` is identical.
- `visibilityScore(p)` for any prompt is identical.
- `visibilityScore(b, e)` for any engine is identical.
- `visibilityScore(b)` (cross-engine) is identical.

If a re-run of the score for the same crawl returns a different value, the bug is in the implementation, not the spec.

---

## 8. Validation

A test harness in `packages/score-validation/` runs the score against 50 hand-curated historical responses and asserts:

1. **Spearman correlation** between OpenCited score and human-labelled ground truth > 0.7
2. **Sub-score stability** — perturbing the weights by ±5% does not flip the rank of any brand by more than 1 position
3. **Determinism** — re-running the harness 5 times returns byte-identical scores for every fixture
4. **Sentiment cache** — every fixture that has a cached sentiment shows `sentimentCacheHit = true` on the second run

The harness runs in CI. PRs that drop the Spearman correlation below 0.7 fail.

---

## 9. Known limitations (v1)

- **No third-party citations** — only own-domain citations are scored. The "earned media" signal is v1.1.
- **No within-sentence position** — ordinal rank among brands, not character offset. Two brands in the same sentence are ranked 1st and 2nd.
- **No per-engagement weighting** — we don't weight by citation position, answer word count, or load time. v1.1 will add citation position as a sub-component of `citationScore`.
- **No temporal decay** — the rolling mean treats a 1-month-old crawl the same as yesterday's. We will add exponential time decay in v1.1.
- **No category-relative baselines** — the peer set is the user's tracked competitors, not a global category baseline. For brands that don't track competitors, we cannot compute a peer-relative score.
- **Sentiment is the soft sub-score** — bounded LLM variance despite `temperature = 0`. The cache reduces it to "per content hash", but a 10% sub-score with some variance is acceptable.

---

## 10. Worked example (full pipeline)

A user tracks 2 competitors (`Acme`, `Beta`) for their brand `MyBrand`. They run 3 crawls of one prompt on Perplexity.

| Crawl | mentionScore | positionScore | citationScore | sentimentScore | coMentionScore | composite |
|-------|--------------|---------------|---------------|----------------|----------------|-----------|
| 1     | 100          | 100 (rank 1)  | 0             | 100 (positive) | 25 (1 of 4)    | 73        |
| 2     | 100          | 50 (rank 3)   | 100 (cited)   | 50 (neutral)   | 25 (1 of 4)    | 75        |
| 3     | 100          | 100 (rank 1)  | 0             | 50 (neutral)   | 50 (2 of 4)    | 70        |

Crawl 1 calculation: `0.35×100 + 0.25×100 + 0.20×0 + 0.10×100 + 0.10×25 = 35 + 25 + 0 + 10 + 2.5 = 72.5 → 73`
Crawl 2 calculation: `0.35×100 + 0.25×50 + 0.20×100 + 0.10×50 + 0.10×25 = 35 + 12.5 + 20 + 5 + 2.5 = 75 → 75`
Crawl 3 calculation: `0.35×100 + 0.25×100 + 0.20×0 + 0.10×50 + 0.10×50 = 35 + 25 + 0 + 5 + 5 = 70 → 70`

**Per-prompt score**: `mean(73, 75, 70) = 72.67 → 73`

**Per-brand-per-engine score (suppose after min-max against {MyBrand, Acme, Beta})**:
- `mentionScore` for MyBrand: 100 (always mentioned). Peer set: Acme 67, Beta 100. Min=67, Max=100. Norm = 100.
- `positionScore` for MyBrand: mean of 100, 50, 100 = 83. Peer set: Acme 70, Beta 60. Min=60, Max=83. Norm = 100.
- `citationScore` for MyBrand: 1 of 3 = 33. Peer set: Acme 67, Beta 33. Min=33, Max=67. Norm = 0.
- `sentimentScore` for MyBrand: mean = 67. Peer set: Acme 80, Beta 50. Min=50, Max=80. Norm = 57.
- `coMentionScore` for MyBrand: mean = 33. Peer set: Acme 33, Beta 33. Min=33, Max=33 (degenerate). Norm = 50.

```
visibilityScore(MyBrand, Perplexity) = 0.35*100 + 0.25*100 + 0.20*0 + 0.10*57 + 0.10*50
                                     = 35 + 25 + 0 + 5.7 + 5
                                     = 70.7
                                     → 71
```

This number is what the user sees on the dashboard as their Perplexity score.
