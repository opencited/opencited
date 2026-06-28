---
description: Generate a czg-ready commit message — copy-pasteable into czg's prompts without editing
---

Generate a commit message the user can paste directly into czg's interactive prompts.

## Steps

1. Identify change type from the diff
2. Draft subject ≤64 chars matching repo conventions
3. Add description only when non-obvious
4. Add footer only when issues are referenced

## Format

**Subject:** `<type>: <emoji> <description>`

- Type: `chore`, `feat`, `fix`, `perf`, `refactor`, `release`, `style`, `ci`, `docs`
- Emoji: match from recent commits (🤖 chore, 🚀 feat, 💡 refactor, 📚 docs)
- Total: ≤64 chars including type and emoji

**Description:** `<line 1> | <line 2> | ...`

- Lines separated by ` | ` (czg's line-break format)
- Omit when subject is self-explanatory

**Footer:** `<references>`

- Format: `✅ Closes: #123`
- Omit when no related issues

## Context

Staged (summary):
!`git diff --cached --stat`

Staged (full):
!`git diff --cached`

Recent:
!`git log --oneline -10`
