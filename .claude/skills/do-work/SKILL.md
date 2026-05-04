---
name: do-work
description: Execute a unit of work in this repository end-to-end: plan, implement, validate via type check and tests, then commit. Use when the user asks to implement a feature, fix a bug, refactor code, or do any bounded piece of work in the cohort-003-project repo.
---

# Do Work

Execute a bounded unit of work end-to-end.

## Workflow

### 1. Plan (optional but recommended)

Before touching any code:

- Read the relevant source files to understand the current state.
- Identify all files that will need to change.
- Write a concise numbered plan (3–10 steps) directly in the conversation.
- Call out any ambiguities and resolve them — ask the user only if truly blocked.
- Confirm the plan with the user before proceeding (one message, no essay).

### 2. Implement

Follow the project CLAUDE.md rules strictly:

- Functions with 2+ same-type parameters **must** use an object parameter.
- Every file named `*Service.ts` **must** have a matching `.test.ts` file.
- Write complete, production-ready code — no placeholders or TODOs.
- Make one logical change at a time; keep diffs reviewable.

### 3. Feedback loop — type check

```bash
pnpm typecheck
```

- Fix **every** type error before continuing.
- Re-run until the output is clean.

### 4. Feedback loop — tests

```bash
pnpm test
```

- Fix every failing test.
- If you added a service, add tests in `*.test.ts` using `@effect/vitest` with `it.effect()`.
- Re-run until all tests pass.

### 5. Commit

Stage only the files you changed (never `git add -A` blindly):

```bash
git add <files>
git commit -m "<type>: <concise summary of what changed and why>"
```

Commit message types: `feat`, `fix`, `refactor`, `test`, `chore`.  
Keep the message under 72 characters.  
Do **not** push unless the user explicitly asks.

## Rules

- Never skip the type check or test steps.
- Never commit with failing types or tests.
- Never amend a previous commit — always create a new one.
- If a pre-commit hook fails, fix the issue and re-commit (do not use `--no-verify`).
