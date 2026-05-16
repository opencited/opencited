# Issue Tracker

## Where issues live

- **GitHub Issues**: `github.com/opencited/opencited/issues`
- **GitHub Projects board**: `github.com/orgs/opencited/projects/1` (private)

## Workflow

Drafts and planning live on the private GitHub Projects board. Public GitHub Issues are created only when work is ready to be visible.

Skills use the `gh` CLI for all issue operations:

```sh
# Create an issue
gh issue create --title "..." --body "..." --label "..."

# List issues
gh issue list --state open

# View an issue
gh issue view <number>
```

## Projects board

The board at `orgs/opencited/projects/1` is the primary planning surface. It has custom fields including:

- Status
- Priority
- Effort
- Phase
- Triage Status (see `triage-labels.md`)

Skills should be aware of the board but do not manipulate project fields directly — that is a human workflow. When creating issues, skills should note that the issue may need to be added to the board manually or via `gh project item-add`.

## Project ID

For `gh project` commands, the project number is `1` (org-level):

```sh
gh project item-add 1 --owner opencited --url "https://github.com/opencited/opencited/issues/<number>"
```
