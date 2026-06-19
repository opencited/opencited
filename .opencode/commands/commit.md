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
4. Subject line must be <= 64 characters
5. Use imperative mood ("add" not "added")
6. No period at end of subject line
7. Body explains WHAT and WHY, not HOW
8. Include body only when change is non-obvious

## Output

Generate a single commit message formatted for direct copy-paste into czg's interactive prompts.

Output exactly in this format:

---
**Subject:**
<type>: <description>

**Description:**
<line 1> | <line 2> | <line 3>

**Footer:**
<ISSUES or references, e.g.: ✅ Closes: #123>
---

Rules:
- Subject must be <= 64 characters, imperative mood, no period at end
- Description uses ` | ` (space-pipe-space) to separate lines — this is czg's line break format
- Include description only when change is non-obvious
- Include footer only when there are related issues
- Each section on its own line(s) for easy copy-paste
- Do NOT run `git commit` or any mutating git command. Only read-only commands are allowed.
