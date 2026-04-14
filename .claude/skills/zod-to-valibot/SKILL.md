---
name: zod-to-valibot
description: Migrates validation schemas and related code from Zod to Valibot. Use when asked to replace Zod with Valibot, migrate validation schemas, convert z.object/z.string/z.coerce/z.discriminatedUnion/z.nativeEnum patterns, or update validation utilities to use Valibot's pipeline API. Works for any TypeScript/JavaScript repo.
---

# Zod → Valibot Migration

## Quick start

```ts
// Before
import { z } from "zod";
const Schema = z.object({ email: z.string().email(), age: z.coerce.number().int() });
type Schema = z.infer<typeof Schema>;
const result = Schema.safeParse(data);
if (!result.success) result.error.flatten().fieldErrors;
else result.data;

// After
import * as v from "valibot";
const Schema = v.object({ email: v.pipe(v.string(), v.email()), age: v.pipe(v.string(), v.transform(Number), v.integer()) });
type Schema = v.InferOutput<typeof Schema>;
const result = v.safeParse(Schema, data);
if (!result.success) v.flatten(result.issues).nested;
else result.output;
```

## Workflow

1. **Install** — `npm install valibot` / remove `zod` after full migration
2. **Run the official codemod first** (handles ~80% of cases):
   ```
   npx codemod zod-to-valibot
   ```
3. **Handle patterns the codemod misses** — see [REFERENCE.md](REFERENCE.md):
   - `z.coerce.number()` → manual pipeline
   - `z.nativeEnum(Enum)` → `v.enum(Enum)`
   - `z.discriminatedUnion` → `v.variant`
   - `.flatten().fieldErrors` → `v.flatten(issues).nested`
   - `result.data` → `result.output`
   - `z.ZodType` / `z.infer` → `v.GenericSchema` / `v.InferOutput`
4. **Migrate central validation utilities** — if there's a `validation.ts` helper that wraps safeParse, update it to the Valibot types and error shape. See [EXAMPLES.md](EXAMPLES.md) for complete before/after for `parseFormData`, `parseParams`, and `parseJsonBody`
5. **Check `z.union([ z.object({...}), ... ])` patterns** — prefer `v.variant` when all members share a discriminant key, else use `v.union`
6. **Run type-check** — `tsc --noEmit`

## Key rules

- Valibot parses `parse(schema, data)` — schema is always the **first** argument, not the caller
- Chained methods become `v.pipe(v.string(), v.email(), v.minLength(5))`
- Error messages are plain strings, not objects: `v.minLength(5, "Too short")`
- Custom errors on the schema itself: `v.string("Must be a string")` (first arg, not an object)
- `result.success === true` → `result.output` (not `.data`)
- `result.success === false` → `result.issues` (not `.error`)

See [REFERENCE.md](REFERENCE.md) for the full API mapping table and [EXAMPLES.md](EXAMPLES.md) for complete wrapper migration examples.
