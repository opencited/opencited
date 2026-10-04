---
name: czg-commit
description: >-
  Draft a czg-ready commit message from staged changes. Use when the user asks
  for a commit message, czg prompt, or help committing with Commitizen.
disable-model-invocation: true
---

# czg-ready commit message

Generate a commit message the user can paste directly into czg's interactive prompts.

## Steps

1. Run `git diff --cached --stat` and `git diff --cached` (and `git log --oneline -10` for style).
2. Identify change type from the diff.
3. Draft subject ≤64 chars matching repo conventions.
4. Add description only when non-obvious.
5. Add footer only when issues are referenced.

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

Output the three parts clearly so the user can paste into czg. Do not run `git commit` unless the user explicitly asks.
