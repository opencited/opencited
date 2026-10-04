---
name: close-github-issue
description: >-
  Close a GitHub issue with a structured closing comment after implementation is
  verified. Use when the user asks to close an issue number or finish an issue.
disable-model-invocation: true
---

# Close GitHub issue

Close a GitHub issue following `docs/agents/closing-issues.md`.

The user must provide the issue number (e.g. `#42` or `42`).

## Steps

1. **Read the issue** — `gh issue view <number>` for title, body, acceptance criteria.
2. **Verify tests pass** — run `bun run test` and `bun run tsc`, capture results.
3. **Gather context** — read files changed for this issue (`git log --oneline -5`, diff vs main if needed).
4. **Write the comment** following the 7-section pattern in `docs/agents/closing-issues.md`:
   - One-liner: what shipped
   - Files: list each file with 1-line description, mark new files `(new)`
   - Tests: new test files, count, what they cover
   - Test results: `X pass / Y skip / Z fail`
   - Spec compliance: copy each acceptance criterion as `- [x]` checkbox
   - Deferred (if any): what's out of scope, where it's tracked
   - Closing line: parent issue/PRD this closes, what it unblocks
5. **Post comment** — `gh issue comment <number> --body '...'`
6. **Close issue** — `gh issue close <number>`

## Rules

- Always comment before closing — the comment is the record of what shipped.
- Copy acceptance criteria verbatim from the issue — don't paraphrase.
- If tests fail, don't close — report failures first.
- Do not run `git commit` or `git push` unless the user explicitly asks.
