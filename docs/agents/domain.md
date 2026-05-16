# Domain Docs

## Layout

This repo uses a **single-context** layout:

- `CONTEXT.md` at the repo root — domain language, key entities, relationships
- `docs/adr/` at the repo root — architectural decision records

## How skills use these files

Skills like `improve-codebase-architecture`, `diagnose`, and `tdd` read `CONTEXT.md` to:

- Learn the project's domain language (what things are called)
- Understand key entities and how they relate
- Avoid introducing terminology that conflicts with existing conventions

They read `docs/adr/` to:

- Understand past architectural decisions
- Avoid re-litigating settled choices
- Align new work with established direction

## Consumer rules

1. **Read before writing** — always check `CONTEXT.md` and relevant ADRs before proposing changes that touch domain concepts
2. **Use the project's language** — adopt the terms already in use; don't introduce synonyms
3. **Respect ADRs** — past decisions are binding unless there's a documented reason to revisit
4. **Update when decisions are made** — if a new architectural decision is made during work, record it as a new ADR

## Creating these files

If `CONTEXT.md` or `docs/adr/` do not yet exist, skills should prompt the user to create them rather than guessing at domain language.
