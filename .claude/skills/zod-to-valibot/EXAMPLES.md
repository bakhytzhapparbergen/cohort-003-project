# Examples: Migrating Validation Wrappers

## parseFormData

```ts
// BEFORE (Zod)
import type { z } from "zod";

export function parseFormData<T extends z.ZodType>(
  formData: FormData,
  schema: T
): ParseResult<z.infer<T>> {
  const raw = Object.fromEntries(formData);
  const result = schema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }

  return { success: false, errors };
}

// AFTER (Valibot)
import * as v from "valibot";

export function parseFormData<T extends v.GenericSchema>(
  formData: FormData,
  schema: T
): ParseResult<v.InferOutput<T>> {
  const raw = Object.fromEntries(formData);
  const result = v.safeParse(schema, raw);

  if (result.success) {
    return { success: true, data: result.output };
  }

  const nested = v.flatten(result.issues).nested ?? {};
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(nested)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }

  return { success: false, errors };
}
```

---

## parseParams

```ts
// BEFORE (Zod)
export function parseParams<T extends z.ZodType>(
  params: Record<string, string | undefined>,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(params);

  if (result.success) {
    return result.data;
  }

  throw data("Invalid parameters", { status: 400 });
}

// AFTER (Valibot)
export function parseParams<T extends v.GenericSchema>(
  params: Record<string, string | undefined>,
  schema: T
): v.InferOutput<T> {
  const result = v.safeParse(schema, params);

  if (result.success) {
    return result.output;
  }

  throw data("Invalid parameters", { status: 400 });
}
```

---

## parseJsonBody

```ts
// BEFORE (Zod)
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<ParseResult<z.infer<T>>> {
  const raw = await request.json();
  const result = schema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }

  return { success: false, errors };
}

// AFTER (Valibot)
export async function parseJsonBody<T extends v.GenericSchema>(
  request: Request,
  schema: T
): Promise<ParseResult<v.InferOutput<T>>> {
  const raw = await request.json();
  const result = v.safeParse(schema, raw);

  if (result.success) {
    return { success: true, data: result.output };
  }

  const nested = v.flatten(result.issues).nested ?? {};
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(nested)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }

  return { success: false, errors };
}
```

---

## Call sites (no changes needed)

Because the wrapper signatures preserve the same return shape (`ParseResult<T>`), call sites that destructure `success`, `data`, and `errors` do **not** need to change. Only the wrapper implementation changes.
