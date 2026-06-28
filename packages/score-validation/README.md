# @opencited/score-validation

Score validation harness for the AI Visibility Score. Validates that computed scores agree with human-curated ground truth using Spearman rank correlation, weight stability analysis, determinism checks, and cache hit rate measurement.

## Quick start

```sh
bun test                          # run the validation harness
bun run tsc                       # typecheck
```

## How it works

The harness exposes `validateScoreAgreement()` which takes:
- **fixtures** — an array of `{ crawlData, humanLabel }` entries
- **compute** — a function `(crawlData, weights?) → score` (the scoring function under test)
- **options** — `{ spearmanThreshold, weightPerturbation, runs, weights }`

It returns four metrics:

| Metric | Description |
|--------|-------------|
| `spearmanCorrelation` | Spearman rank correlation between computed scores and human labels (≥ 0.7 required) |
| `weightStability` | Max rank move under ±5% weight perturbation (≤ 1 required) |
| `determinismCheck` | `true` if 5 runs produce byte-identical scores |
| `cacheHitRate` | Fraction of fixtures that hit the memo cache on the 2nd run (1.0 required) |

## CI gate

The test runs in **report-only mode** when fewer than 50 labelled fixtures are present. It logs metrics to the console but does not fail.

Once 50 labelled fixtures are present, the CI gate activates automatically and asserts:
- `spearmanCorrelation >= 0.7`
- `weightStability <= 1`
- `determinismCheck === true`
- `cacheHitRate === 1.0`

## Adding a new fixture

1. Open `fixtures/ground-truth.json`
2. Add a new entry with a unique `id`:

```json
{
  "id": "seed-XX-short-description",
  "crawlData": {
    "crawlContent": "The AI response text...",
    "crawlProvider": "perplexity",
    "crawlCitations": [
      { "domain": "example.com", "url": "https://example.com/page", "position": 1 }
    ],
    "brandMentions": [
      { "brandName": "MyBrand", "mentionType": "target", "position": 1, "brandUrl": "https://mybrand.com" }
    ],
    "targetBrand": { "name": "MyBrand", "domain": "mybrand.com", "aliases": [] },
    "sentimentInput": { "label": "positive", "cacheHit": false, "fallback": false, "retryCount": 0 }
  },
  "humanLabel": null
}
```

3. Set `humanLabel` to `null` initially (marks it as `PENDING_HUMAN_LABEL`)

## Filling in a human label

Replace `"humanLabel": null` with:

```json
"humanLabel": {
  "score": 75,
  "sentiment": "positive"
}
```

- `score`: integer 0–100 representing your assessment of the brand's AI visibility in this response
- `sentiment`: one of `"positive"`, `"neutral"`, `"negative"`

## Interpreting harness output

```
=== Score Validation Report ===
Fixtures: 9 total, 0 labelled
Spearman correlation: 0.0000
Weight stability (max rank move): 0
Determinism check: true
Cache hit rate: 1.0000
CI gate: report-only
===============================
```

- **Spearman correlation**: 1.0 = perfect agreement with human labels, 0 = no correlation. Only meaningful when fixtures have human labels.
- **Weight stability**: 0 = no rank changes under weight perturbation (ideal). Lower is better.
- **Determinism check**: Must be `true`. If `false`, the scoring function is non-deterministic.
- **Cache hit rate**: Should be 1.0 for deterministic functions. Below 1.0 indicates non-determinism.

## Target fixture coverage (at 50)

The full 50-fixture set must cover at least:

| Category | Minimum |
|----------|---------|
| Brand not mentioned | 5 |
| Rank-1 mentions | 5 |
| Rank-≥3 mentions | 5 |
| Cited | 5 |
| Not cited | 5 |
| Positive sentiment | 5 |
| Negative sentiment | 5 |
| No competitors tracked | 5 |
| Multiple competitors | 5 |

The seed set (9 fixtures) covers at least 1 fixture from each category.
