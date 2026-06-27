# Closing Issues

## When to use

After an issue has been fully implemented and verified (tests pass, lint clean).

## The comment pattern

Every closed issue gets a structured comment before `gh issue close`. The comment has 6 sections in this order:

### 1. One-liner

What shipped, in plain English. No preamble.

### 2. Files

List every file touched with a 1-line description of what changed. Mark new files with `(new)`. Group by concern (UI, actions, tests, router).

### 3. Tests

New test files, test count, what they cover (one line per file).

### 4. Test results

Copy the summary line from `bun run test`:

```
X pass / Y skip / Z fail
```

### 5. Spec compliance check

Copy each acceptance criterion from the issue body as a `- [x]` checkbox. Confirm each one. This is the most important section — it proves the issue is done.

### 6. Deferred / out of scope (if any)

Anything explicitly not covered by this issue, with a note on where it's tracked.

### 7. Closing line

Which parent issue / PRD this closes a half of, and what it unblocks.

## Example

```markdown
Shipped. The crawl detail sheet now has a "Score" tab with composite score, 5 sub-scores, and sentiment retry.

**Files**
- `apps/web/.../score-tab.tsx` (new) — Score tab component with composite hero, sub-score rows, tooltips, retry button.
- `apps/web/.../crawl-detail-sheet.tsx` — added "Score" as 3rd tab.
- `packages/actions/src/aiVisibility/getCrawlScoreAction.ts` (new) — reads crawl_visibility_score row.
- `packages/actions/src/aiVisibility/computeVisibilityScoreAction.ts` — added retrySentimentAction with 60s rate limit.
- `packages/trpc/src/router/aiVisibility.ts` — added getCrawlScore query + retrySentiment mutation.

**Tests** (10 new)
- `getCrawlScoreAction.test.ts` — 2 tests: row exists / row missing.
- `retrySentimentAction.test.ts` — 8 tests: success, failure, fresh cache, rate limiting, error paths.

**Test results**: 58 pass / 8 skip / 0 fail

**Spec compliance check**
- [x] A new "Score" tab appears as the 3rd tab.
- [x] The tab shows composite hero number, formula version, 5 sub-scores with tooltips.
- [x] When sentimentIsFallback = true, Badge variant="warning" "Pending retry" + retry button visible.
- [x] Clicking retry optimistically updates UI; success clears badge and updates composite.
- [x] Failing retry shows error toast, badge stays.
- [x] getCrawlScoreAction registered in tRPC router; UI subscribes via tRPC client.
- [x] Retry rate-limited (60s per crawl), enforced in the action.
- [x] bun run tsc and bun run lint-ci pass.

Closes the detail-sheet UX half of #22. Unblocks #30 (per-prompt table column).
```

## gh CLI commands

```sh
# Comment then close
gh issue comment <number> --body '...'
gh issue close <number>

# Or close with reason
gh issue close <number> --reason completed
```

## Rules

- Always comment before closing — the comment is the record of what shipped.
- Always run `bun run test` and `bun run tsc` before writing the comment so test results are accurate.
- Copy acceptance criteria verbatim from the issue — don't paraphrase.
- If the issue has no acceptance criteria, list what the issue body asked for.
