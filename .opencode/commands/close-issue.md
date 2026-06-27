---
description: Close a GitHub issue with a structured comment documenting what shipped
---

Close issue `#$1` following the pattern in `docs/agents/closing-issues.md`.

## Steps

1. **Read the issue** — fetch title, body, acceptance criteria
2. **Verify tests pass** — run `bun run test` and `bun run tsc`, capture results
3. **Gather context** — read the files changed for this issue (check recent commits or ask user)
4. **Write the comment** following the 7-section pattern:
   - One-liner: what shipped
   - Files: list each file with 1-line description, mark new files `(new)`
   - Tests: new test files, count, what they cover
   - Test results: `X pass / Y skip / Z fail`
   - Spec compliance: copy each acceptance criterion as `- [x]` checkbox
   - Deferred (if any): what's out of scope, where it's tracked
   - Closing line: parent issue/PRD this closes, what it unblocks
5. **Post comment** — `gh issue comment $1 --body '...'`
6. **Close issue** — `gh issue close $1`

## Rules

- Always comment before closing — the comment is the record of what shipped
- Copy acceptance criteria verbatim from the issue — don't paraphrase
- If tests fail, don't close — report failures first
- Check recent commits (`git log --oneline -5`) to identify what was implemented

## Context

Issue body:
!`gh issue view $1 --json body --jq '.body' 2>/dev/null`

Recent commits:
!`git log --oneline -5`
