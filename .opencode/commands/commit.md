---
description: Generate a git commit message from staged changes and recent commit history
---

Analyze the staged changes and recent commit history to generate an effective commit message.

## Context

Staged changes:
!`git diff --cached --stat`

Full diff:
!`git diff --cached`

Recent commits (pattern reference):
!`git log --oneline -10`

Recent commit messages (style reference):
!`git log -5 --format="%s"`

## Instructions

1. Identify the primary change type from the diff
2. Match the commit message style from recent history
3. Follow conventional commits format: `type(scope): description`
4. Subject line must be <= 72 characters
5. Use imperative mood ("add" not "added")
6. No period at end of subject line
7. Body explains WHAT and WHY, not HOW
8. Include body only when change is non-obvious

## Output

Propose 1-3 commit message options (short to detailed). Do NOT run `git commit` or any mutating git command. Only read-only commands are allowed.
