# Zod → Valibot API Reference

## Imports

```ts
// Zod
import { z } from "zod";

// Valibot
import * as v from "valibot";
```

---

## Schema types

| Zod | Valibot | Notes |
|-----|---------|-------|
| `z.string()` | `v.string()` | Direct |
| `z.number()` | `v.number()` | Direct |
| `z.boolean()` | `v.boolean()` | Direct |
| `z.object({})` | `v.object({})` | Direct |
| `z.array(s)` | `v.array(s)` | Direct |
| `z.literal(x)` | `v.literal(x)` | Direct |
| `z.union([a,b])` | `v.union([a,b])` | Direct |
| `z.optional(s)` | `v.optional(s)` | Direct |
| `z.nullable(s)` | `v.nullable(s)` | Direct |
| `z.record(k,v)` | `v.record(k,v)` | Direct |
| `z.tuple([...])` | `v.tuple([...])` | Direct |
| `z.enum(["a","b"])` | `v.picklist(["a","b"])` | Renamed |
| `z.nativeEnum(Enum)` | `v.enum(Enum)` | Renamed |
| `z.discriminatedUnion("key", [...])` | `v.variant("key", [...])` | Renamed |
| `z.intersection(a,b)` | `v.intersect([a,b])` | Renamed, array arg |
| `z.object({}).strict()` | `v.strictObject({})` | Separate function |
| `z.object({}).passthrough()` | `v.looseObject({})` | Separate function |
| `z.object({}).catchall(s)` | `v.objectWithRest({}, s)` | Separate function |

---

## Validation (pipeline pattern)

All chained methods become `v.pipe(schema, ...actions)`:

```ts
// Zod
z.string().email().min(5).max(100).trim()

// Valibot
v.pipe(v.string(), v.email(), v.minLength(5), v.maxLength(100), v.trim())
```

### Validator mapping

| Zod method | Valibot action | Notes |
|------------|---------------|-------|
| `.min(n)` on string | `v.minLength(n)` | |
| `.max(n)` on string | `v.maxLength(n)` | |
| `.min(n)` on number | `v.minValue(n)` | |
| `.max(n)` on number | `v.maxValue(n)` | |
| `.email()` | `v.email()` | |
| `.url()` | `v.url()` | |
| `.trim()` | `v.trim()` | |
| `.int()` | `v.integer()` | Renamed |
| `.positive()` | `v.minValue(1)` | No direct equivalent |
| `.negative()` | `v.maxValue(-1)` | No direct equivalent |
| `.gt(n)` | `v.gtValue(n)` | |
| `.gte(n)` | `v.minValue(n)` | |
| `.lt(n)` | `v.ltValue(n)` | |
| `.lte(n)` | `v.maxValue(n)` | |
| `.length(n)` | `v.length(n)` | |
| `.regex(r)` | `v.regex(r)` | |
| `.includes(s)` | `v.includes(s)` | |
| `.startsWith(s)` | `v.startsWith(s)` | |
| `.endsWith(s)` | `v.endsWith(s)` | |
| `.refine(fn)` | `v.check(fn)` | |
| `.superRefine(fn)` | `v.rawCheck(fn)` | |
| `.transform(fn)` | `v.transform(fn)` in pipe | |
| `.default(x)` | `v.optional(s, x)` | |
| `.catch(x)` | `v.fallback(s, x)` | Renamed |
| `.brand()` | `v.brand(s, "name")` | |

---

## Coercion

```ts
// Zod — coerce string → number
z.coerce.number().int()

// Valibot — explicit pipeline
v.pipe(v.string(), v.transform(Number), v.integer())
```

For FormData or URL params (always strings), use `v.transform(Number)` before numeric validators.

---

## Parsing & results

```ts
// Zod
const result = schema.safeParse(data);
if (result.success) result.data;       // typed output
else result.error;                      // ZodError

// Valibot
const result = v.safeParse(schema, data);
if (result.success) result.output;     // typed output
else result.issues;                    // BaseIssue[]
```

```ts
// Throwing parse (throws on failure)
z.string().parse(data)   →   v.parse(v.string(), data)
```

---

## Error flattening

```ts
// Zod
const fieldErrors = result.error.flatten().fieldErrors;
// → Record<string, string[]>

// Valibot
const fieldErrors = v.flatten(result.issues).nested;
// → Record<string, [string, ...string[]]>
// root-level errors: v.flatten(result.issues).root
```

---

## Type inference

```ts
// Zod
type Output = z.infer<typeof Schema>;
type Input  = z.input<typeof Schema>;

// Valibot
type Output = v.InferOutput<typeof Schema>;
type Input  = v.InferInput<typeof Schema>;
```

---

## Generic schema parameters

```ts
// Zod — generic function accepting any schema
function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T>

// Valibot
function parse<T extends v.GenericSchema>(schema: T, data: unknown): v.InferOutput<T>
```

---

## Error messages

```ts
// Zod
z.string({ invalid_type_error: "Not a string" }).min(5, { message: "Too short" })

// Valibot
v.pipe(v.string("Not a string"), v.minLength(5, "Too short"))
```

---

## Patterns common in React Router / Remix apps

### FormData parsing utility (validation.ts pattern)

```ts
// Before (Zod)
import type { z } from "zod";
export function parseFormData<T extends z.ZodType>(
  formData: FormData,
  schema: T
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) return { success: true, data: result.data };
  const fieldErrors = result.error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) errors[key] = messages[0];
  }
  return { success: false, errors };
}

// After (Valibot)
import * as v from "valibot";
export function parseFormData<T extends v.GenericSchema>(
  formData: FormData,
  schema: T
): ParseResult<v.InferOutput<T>> {
  const result = v.safeParse(schema, Object.fromEntries(formData));
  if (result.success) return { success: true, data: result.output };
  const nested = v.flatten(result.issues).nested ?? {};
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(nested)) {
    if (messages && messages.length > 0) errors[key] = messages[0];
  }
  return { success: false, errors };
}
```

### discriminatedUnion → variant

```ts
// Zod
z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("create"), name: z.string() }),
  z.object({ intent: z.literal("delete"), id: z.coerce.number().int() }),
])

// Valibot
v.variant("intent", [
  v.object({ intent: v.literal("create"), name: v.string() }),
  v.object({ intent: v.literal("delete"), id: v.pipe(v.string(), v.transform(Number), v.integer()) }),
])
```

### nativeEnum (TypeScript enum)

```ts
// Zod
z.nativeEnum(CourseStatus)

// Valibot
v.enum(CourseStatus)
```

---

## Official codemod

```bash
npx codemod zod-to-valibot
```

Handles: basic schema types, method chains, import rewrites.
Does NOT handle: `z.coerce`, `z.nativeEnum`, `result.data`→`result.output`, `flatten().fieldErrors`→`v.flatten().nested`, generic `ZodType` parameters.
