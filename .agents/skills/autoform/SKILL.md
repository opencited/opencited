---
name: autoform
description: Generate forms from Zod schemas using AutoForm + shadcn/ui. Integrates with Drizzle ORM schemas and tRPC mutations for CRUD operations. Use when user wants to create a form, build a create/edit form, generate a form from a database schema, or mentions AutoForm, form generation, or schema-driven forms.
---

# AutoForm

Automatically render forms from Zod schemas using AutoForm with shadcn/ui. Integrates with the project's Drizzle ORM schemas and tRPC mutation patterns.

## Prerequisites

AutoForm requires `react-hook-form@^7` as a peer dependency. Check if installed before proceeding.

## Installation

Run these commands in order:

```sh
# 1. Install peer dependency
bun add react-hook-form@^7

# 2. Install AutoForm packages
bun add @autoform/react @autoform/zod

# 3. Add shadcn AutoForm component (runs in packages/ui where components.json lives)
bunx shadcn@latest add https://raw.githubusercontent.com/vantezzen/autoform/refs/heads/main/packages/shadcn/registry/autoform.json
```

The shadcn command adds the AutoForm component to `packages/ui/src/components/ui/autoform/`. After installation, verify the component exists.

## Schema Pattern

### Using `createAutoFormSchema` helper (recommended)

The project provides a typesafe helper that handles Zod v4's registry-based field config system:

```tsx
"use client";

import { AutoForm, createAutoFormSchema } from "@opencited/ui";
import { proxyConfigInsertSchema } from "@opencited/trpc/schemas";

const schemaProvider = createAutoFormSchema(
  proxyConfigInsertSchema.omit({
    id: true,
    domainProjectId: true,
    createdAt: true,
    updatedAt: true,
  }),
  {
    enabled: {
      label: "Enable custom proxy",
      description: "Use your proxy settings for all browser crawling requests",
      fieldType: "switch",
    },
    sourceType: {
      label: "Proxy source",
      fieldType: "select",
    },
    sourceValue: {
      label: "Proxy list (one per line)",
      fieldType: "textarea",
      inputProps: {
        placeholder: "proxy1.example.com:8080",
        rows: 6,
      },
    },
  },
);

export function ProxyConfigForm() {
  return (
    <AutoForm
      schema={schemaProvider}
      onSubmit={(data) => console.log(data)}
      withSubmit
    />
  );
}
```

**Key points:**
- Field keys are **fully typesafe** — passing an invalid key produces a TypeScript error
- Uses Zod v4's registry API under the hood (no `.check()` calls needed)
- Import schemas from `@opencited/trpc/schemas` in client components (avoids `server-only` import errors)
- Use `.omit()` or `.pick()` to exclude auto-generated fields (`id`, `createdAt`, `updatedAt`, `domainProjectId`)

### Manual pattern (legacy)

If you need fine-grained control, you can use the raw AutoForm APIs:

```tsx
"use client";

import { ZodProvider } from "@autoform/zod/v4";
import { fieldConfig } from "@autoform/zod/v4";
import { AutoForm, FieldTypes } from "@opencited/ui";
import { proxyConfigInsertSchema } from "@opencited/trpc/schemas";

const formSchema = proxyConfigInsertSchema.omit({
  id: true,
  domainProjectId: true,
  createdAt: true,
  updatedAt: true,
});

const [registry, meta] = fieldConfig({
  label: "Enable proxy",
  fieldType: "switch",
});
registry.add(formSchema.shape.enabled, meta);

const schemaProvider = new ZodProvider(formSchema);
```

## Form Component Pattern

### Create Form

```tsx
"use client";

import { AutoForm, createAutoFormSchema } from "@opencited/ui";
import { useTRPC } from "@/app/_trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { proxyConfigInsertSchema } from "@opencited/trpc/schemas";

const schemaProvider = createAutoFormSchema(
  proxyConfigInsertSchema.omit({
    id: true,
    domainProjectId: true,
    createdAt: true,
    updatedAt: true,
  }),
  {
    // field configs
  },
);

export function CreateProxyConfigForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.proxyConfig.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.proxyConfig.get.queryFilter());
        toast.success("Proxy config saved");
      },
      onError: (error) => {
        toast.error("Failed to save", { description: error.message });
      },
    }),
  );

  return (
    <AutoForm
      schema={schemaProvider}
      onSubmit={(data) => createMutation.mutate(data)}
      withSubmit
    />
  );
}
```

### Update Form

For update forms, pass existing data via `defaultValues`:

```tsx
"use client";

import { AutoForm, createAutoFormSchema } from "@opencited/ui";
import { useTRPC } from "@/app/_trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { proxyConfigUpdateSchema } from "@opencited/trpc/schemas";

const schemaProvider = createAutoFormSchema(
  proxyConfigUpdateSchema.omit({
    id: true,
    domainProjectId: true,
    createdAt: true,
    updatedAt: true,
  }),
  {
    // field configs
  },
);

export function UpdateProxyConfigForm({ config }: { config: ProxyConfig }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateMutation = useMutation(
    trpc.proxyConfig.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.proxyConfig.get.queryFilter());
        toast.success("Proxy config updated");
      },
      onError: (error) => {
        toast.error("Failed to update", { description: error.message });
      },
    }),
  );

  return (
    <AutoForm
      schema={schemaProvider}
      defaultValues={config}
      onSubmit={(data) => updateMutation.mutate({ id: config.id, ...data })}
      withSubmit
    />
  );
}
```

## Field Configuration Options

| Property | Type | Purpose |
|----------|------|---------|
| `label` | `string` | Overrides auto-generated label |
| `description` | `string` | Help text shown below field |
| `inputProps` | `object` | Props passed to input element (placeholder, disabled, rows, etc.) |
| `fieldType` | `FieldTypes` | Override input type (see table below) |
| `order` | `number` | Field ordering (lower = first) |
| `fieldWrapper` | `ComponentType` | Custom wrapper component |
| `customData` | `object` | Arbitrary metadata |

## Available Field Types

| `fieldType` | Component | Use case |
|-------------|-----------|----------|
| `string` (default) | `Input` | Text input |
| `textarea` | `Textarea` | Multi-line text |
| `number` | `Input type="number"` | Numeric input |
| `boolean` | `Checkbox` | Checkbox toggle |
| `switch` | `Switch` | Toggle switch |
| `select` | `Select` | Dropdown (auto-detected from `z.enum()`) |
| `date` | `DatePicker` | Date picker (auto-detected from `z.coerce.date()`) |

## Common Field Type Mappings

| Zod Type | AutoForm Input |
|----------|----------------|
| `z.string()` | Text input |
| `z.string().email()` | Email input |
| `z.string().url()` | URL input |
| `z.coerce.number()` | Number input |
| `z.coerce.date()` | Date picker |
| `z.boolean()` | Checkbox (use `fieldType: "switch"` for toggle) |
| `z.enum([...])` | Select dropdown |
| `z.array(z.object({...}))` | Repeatable field group |
| `z.object({...})` | Sub-section with title |

## Integration with tRPC Actions

The project uses an actions pattern. Reference the correct schemas:

```
packages/db/src/schema/           # Drizzle tables + Zod schemas
  → createInsertSchema(table)     # Base insert schema
  → createUpdateSchema(table)     # Base update schema
  → tableInsertSchema             # Extended with validations
  → tableUpdateSchema             # Extended for updates

packages/trpc/schemas.ts          # Re-exports for client components
  → proxyConfigInsertSchema
  → domainProjectInsertSchema
  → etc.

packages/trpc/src/router/         # tRPC routers
  → .input(createXxxInputSchema)
  → .mutation(async ({ ctx, input }) => ...)
```

**Rule:** Import schemas from `@opencited/trpc/schemas` in client components. The main `@opencited/trpc` export pulls in `server-only` and will cause build errors.

## RSC Requirements

AutoForm must be used in client components:

```tsx
// page.tsx (Server Component)
export default function Page() {
  return <CreateForm />;
}

// create-form.tsx (Client Component)
"use client";
import { AutoForm, createAutoFormSchema } from "@opencited/ui";
// ... form implementation
```

## UI Component Rules

Follow project conventions:
- Use `@opencited/ui` components without custom style overrides
- Allowed: layout (`flex`, `grid`), spacing (`p-*`, `gap-*`), typography sizing
- Not allowed: color overrides, border styles, custom variants
- Wrap forms in `Card` components for consistent styling:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Create Project</CardTitle>
    <CardDescription>Add a new domain project.</CardDescription>
  </CardHeader>
  <CardContent>
    <AutoForm schema={schemaProvider} onSubmit={handleSubmit} withSubmit />
  </CardContent>
</Card>
```

## Workflow Checklist

When asked to create a form:

1. [ ] Identify the Drizzle table and its Zod schemas in `packages/db/src/schema/`
2. [ ] Find the corresponding tRPC router and action for the mutation
3. [ ] Check if AutoForm is installed; if not, run installation steps
4. [ ] Create a client component with `"use client"` directive
5. [ ] Use `createAutoFormSchema(schema.omit({...}), { field: config })` to build the schema provider
6. [ ] Wire up `onSubmit` to the tRPC mutation with toast feedback
7. [ ] Wrap in Card component for consistent styling
8. [ ] Place in appropriate route directory under `apps/web/app/app/`
