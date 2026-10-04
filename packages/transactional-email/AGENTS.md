# Transactional Email (`@opencited/transactional-email`)

React Email templates for product emails. Used by `@opencited/actions` (public scan verification + report).

## Local preview

```sh
bun run dev:email
```

Opens the React Email dev server at http://localhost:3030 with live reload. Templates live in `emails/`; each file exports a default component and sets `PreviewProps` for mock data.

## Adding a template

1. Add `emails/your-template.tsx` (default export + `PreviewProps`).
2. Add a builder in `src/build-emails.ts` using `render()` from `@react-email/render`.
3. Export the builder from `src/index.ts`.
