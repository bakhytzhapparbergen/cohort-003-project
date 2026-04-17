# CONCERNS.md — Technical Debt, Issues & Risks

## Critical (Production Blockers)

### 1. Hardcoded Session Secret
**File:** `app/lib/session.ts` (line 9)
- Session secret is hardcoded as `"cadence-dev-secret"` — committed to version control
- No environment variable fallback for production
- **Risk:** Session forgery in production
- **Fix:** `process.env.SESSION_SECRET ?? throwIfMissing("SESSION_SECRET")`

### 2. XSS via Unsanitized Markdown
**File:** `app/lib/markdown.server.ts`
- `marked` renders HTML from user-authored content with no sanitization
- Output injected via `dangerouslySetInnerHTML` in lesson views
- **Risk:** Stored XSS from instructor-authored lesson content
- **Fix:** Add `isomorphic-dompurify` sanitization pass after `marked.parse()`

### 3. No Rate Limiting on Any Endpoints
**Files:** `app/routes/api.video-tracking.ts`, `api.course-rating.ts`, quiz submission routes
- No throttling on video progress floods, quiz re-submission, or rating manipulation
- **Risk:** Data integrity corruption, resource exhaustion
- **Fix:** Add rate limiting middleware (e.g., `express-rate-limit` adapter or edge-layer)

## High (Quality / Correctness)

### 4. Quiz Scoring Service — Type Safety Collapse
**File:** `app/services/quizScoringService.ts`
- 11+ parameters typed as `any` across 8 functions
- No null validation before score calculations
- `console.log` used for error reporting instead of thrown errors or return values
- Separate `better-sqlite3` connection (bypasses drizzle ORM) — lines 10-12
- No tests for critical grading logic
- **Fix:** Add TypeScript interfaces, replace raw SQLite connection with drizzle, add `.test.ts`

### 5. Missing Tests for 6 Services
Services with no test coverage (violates CLAUDE.md rule):
- `app/services/commentService.ts`
- `app/services/quizScoringService.ts` ← highest priority
- `app/services/quizService.ts`
- `app/services/ratingService.ts`
- `app/services/userService.ts`
- `app/services/videoTrackingService.ts`

### 6. N+1 Query Patterns
**Files:**
- `app/routes/courses.$slug.tsx` — 7-8 sequential DB queries in loader
- `app/routes/instructor.$courseId.tsx` — 7+ sequential queries in loader
- No query batching or DataLoader pattern
- **Impact:** Slow page loads on courses with many modules/lessons

## Medium (Maintainability)

### 7. Monolithic Route Components
Three route files exceed 1,000 lines — mixing UI, validation, CRUD logic:
- `app/routes/instructor.$courseId.tsx` — ~1,697 lines
- `app/routes/courses.$slug.lessons.$lessonId.tsx` — ~1,182 lines
- `app/routes/instructor.$courseId.lessons.$lessonId.quiz.tsx` — ~1,055 lines
- **Impact:** High coupling, hard to test, high risk of merge conflicts
- **Fix:** Extract sub-components and move mutations to dedicated action modules

### 8. Inconsistent Object Parameter Convention
CLAUDE.md mandates object parameters for functions with 2+ same-type params.
`app/services/lessonService.ts` `createLesson` uses positional params (`moduleId, title, content, videoUrl, position, durationMinutes`) — all mixed types but still fragile ordering.
Some newer services follow the convention, older ones do not.

### 9. SQLite WAL Files in Repo Root
`data.db`, `data.db-shm`, `data.db-wal` are present in the project root — likely gitignored but a local state concern. The WAL file is 428KB indicating active writes.

## Low (Future Scaling)

### 10. No Caching Layer
- No Redis, no in-memory cache, no HTTP cache headers on loaders
- All data fetched fresh per request
- Acceptable for current scale; becomes a bottleneck under load

### 11. No Error Monitoring
- No Sentry or equivalent error tracking integrated
- Production errors will be silent

### 12. `better-sqlite3` Concurrency Limit
- SQLite with `better-sqlite3` is single-writer
- Fine for a cohort-scale app; will need migration to Postgres for multi-instance or high concurrency

### 13. Monaco Editor Bundle Size
**File:** `app/components/monaco-markdown-editor.tsx`
- Monaco Editor is a large dependency (~2MB+ minified)
- No lazy loading or dynamic import observed
- **Impact:** Slow initial load for instructor routes

## Fragile Areas

| File | Why Fragile |
|---|---|
| `app/services/quizScoringService.ts` | Raw SQL + any types + no tests |
| `app/routes/instructor.$courseId.tsx` | 1,697 lines, mixed concerns |
| `app/lib/session.ts` | Hardcoded secret |
| `app/lib/markdown.server.ts` | No XSS sanitization |
| All `api.*` routes | No rate limiting |
