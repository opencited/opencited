# Triage Labels

## Storage

Triage state lives in the `"Triage Status"` custom field on the GitHub Projects board (`orgs/opencited/projects/1`). **Do not use repo labels for triage.**

## Values

| Value | Meaning |
|---|---|
| `needs-triage` | Maintainer needs to evaluate the issue |
| `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | Fully specified — an AFK agent can pick it up with no human context |
| `ready-for-human` | Needs a human to implement |
| `wontfix` | Will not be actioned |

## Setting the field

Use `gh project item-edit` to set the triage status field on a project item:

```sh
# Get the field ID first (run once to discover)
gh project field-list 1 --owner opencited

# Then set the value
gh project item-edit --id <item-id> --field-id <field-id> --single-select-option-id <option-id>
```

## Default state

New issues should start with `needs-triage`. The `triage` skill moves issues through the state machine based on evaluation.
