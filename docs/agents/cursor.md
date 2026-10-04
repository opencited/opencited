# Cursor editor setup

This repo is configured for [Cursor](https://cursor.com) agents. Legacy OpenCode paths (`.opencode/`, `opencode.json`) were removed in favor of the files below.

## Project config (committed)

| Path | Purpose |
|------|---------|
| `.cursor/mcp.json` | MCP servers (shadcn registry tools). Generated via `shadcn mcp init --client cursor`. |
| `.cursor/hooks.json` | Impeccable design hook on `preToolUse` (blocks bad UI writes before they land). |
| `.cursor/skills/*` | Repo workflows: `czg-commit`, `close-github-issue`, `ui-audit`. |
| `.cursor/agents/*` | Impeccable subagents (finish reviewer, documenter, etc.). |
| `.agents/skills/*` | Shared agent skills (Clerk, Next.js, Impeccable, workflow, …). |
| `AGENTS.md` | Root agent instructions (also applied as Cursor rules). |

## One-time setup per machine

1. **Trust the workspace** so Cursor loads `.cursor/hooks.json` (Settings → Hooks).
2. **Enable Impeccable hook** (optional but recommended):

   ```sh
   .agents/skills/impeccable/scripts/impeccable hooks on
   ```

   Hook config lives under `.impeccable/` (gitignored). `hooks on` writes local consent and enables the detector.

3. **MCP**: Restart Cursor or reload MCP after pulling `.cursor/mcp.json`. Requires `npx` for the shadcn server.

## Workflows (replacing OpenCode slash commands)

| OpenCode command | Cursor skill |
|------------------|--------------|
| `/commit` | Invoke skill **czg-commit** |
| `/close-issue` | Invoke skill **close-github-issue** (pass issue number) |
| `/ui-audit` | Invoke skill **ui-audit** (pass folder path, e.g. `apps/web/app/app/prompts`) |

## Codex / OpenCode

- **Codex**: `.codex/hooks.json` still runs Impeccable post-edit reminders for Codex users.
- **OpenCode**: use `.cursor/mcp.json` as the reference for MCP; reinstall shadcn MCP with `shadcn mcp init --client opencode` if you stay on OpenCode.

## Design context

Run `/impeccable init` (Impeccable skill) once per project to create `PRODUCT.md` / `DESIGN.md`. See `.impeccable.md` for UI rules that apply on every change.
