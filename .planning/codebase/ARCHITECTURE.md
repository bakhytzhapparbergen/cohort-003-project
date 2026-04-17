# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Full-Stack Server-Rendered Web Application (React Router SSR)

**Key Characteristics:**
- Server-side rendering with React Router v7 - all routes are SSR by default
- Layered architecture separating routes, services, database, and components
- SQLite database with Drizzle ORM for type-safe query building
- File-based routing with nested layouts and loader/action patterns
- Domain-driven services for business logic isolation
- UI component library built with shadcn/Radix UI + Tailwind CSS

## Layers

**Routes Layer:**
- Purpose: HTTP handlers that receive requests, call services, and return data to components
- Location: `app/routes/`
- Contains: Page components (TSX), API endpoints (TS), loaders, actions, error boundaries
- Depends on: Services, session library, validation library
- Used by: React Router framework; serves as public API handlers

**Services Layer:**
- Purpose: Business logic, database queries, domain operations, validation
- Location: `app/services/`
- Contains: Exported functions like `getCourseById()`, `createEnrollment()`, CRUD operations
- Depends on: Database layer, schema types
- Used by: Routes layer; some services call other services

**Database Layer:**
- Purpose: Schema definitions, table structure, ORM setup
- Location: `app/db/` (schema and connection)
- Contains: `schema.ts` (table definitions, enums), `index.ts` (Drizzle instance)
- Depends on: better-sqlite3, Drizzle ORM
- Used by: Services layer exclusively

**Components Layer:**
- Purpose: Reusable React UI components, visual presentation
- Location: `app/components/` (feature components), `app/components/ui/` (shadcn primitives)
- Contains: Page components from routes, functional components, UI primitives
- Depends on: React, utilities, hooks, icons (lucide-react)
- Used by: Routes layer

**Utilities & Helpers:**
- Purpose: Cross-cutting concerns like session management, validation, markdown rendering
- Location: `app/lib/`
- Contains: `session.ts` (auth), `validation.ts` (schema parsing), `ppp.ts` (pricing), `markdown.server.ts`, `utils.ts`, `country.server.ts`
- Depends on: External libraries (valibot, react-router)
- Used by: Routes, services, and components

**Test Layer:**
- Purpose: Test infrastructure and test database setup
- Location: `app/test/setup.ts`
- Contains: `createTestDb()` function, `seedBaseData()` helper
- Used by: All `*.test.ts` files

## Data Flow

**Page Request → Response Flow:**

1. User requests `/courses/python-101`
2. React Router matches route in `app/routes.ts` → routes to `app/routes/courses.$slug.tsx`
3. **Loader phase** (server-side, pre-render):
   - Route's `loader()` function executes
   - Extracts `params.slug` → "python-101"
   - Calls `getCourseBySlug(slug)` from `app/services/courseService.ts`
   - Service queries database via `db.select().from(courses).where(...).get()`
   - Loader calls additional services: `getCourseWithDetails()`, `isUserEnrolled()`, `calculateProgress()`
   - Returns object with all data needed for component
4. **Component render phase** (server-side for SSR):
   - Component receives loader data via `Route` type
   - Component renders JSX with data
   - HTML is sent to client
5. **Hydration phase** (client-side):
   - React hydrates the HTML
   - User interactions now handled client-side
6. **User action** (e.g., enroll button click):
   - Form submits to route's `action()` function or fetcher calls API route
   - API route validates input with valibot schema
   - Calls service function: `createEnrollment(userId, courseId)`
   - Service performs CRUD operation: `db.insert(enrollments).values(...).returning().get()`
   - Returns success/error response
   - Client receives response and triggers re-render or toast notification

**State Management:**
- Server-side: Loader data passed to component props (React Router's built-in loader state)
- Client-side: Component-level React state via `useState()` for UI state (form inputs, modals, etc.)
- Session state: HTTP cookie-based with `createCookieSessionStorage()` from React Router
- Database as source of truth: All persistent state stored in SQLite

## Key Abstractions

**Service Functions:**
- Purpose: Encapsulate domain operations and database queries
- Examples: `app/services/courseService.ts`, `app/services/enrollmentService.ts`, `app/services/progressService.ts`
- Pattern: Export named functions that take primitive parameters and return typed results
  - Query functions: `getCourseById(id: number): Course | undefined`
  - Creation functions: `createCourse(title, slug, description, ...): Course`
  - Update functions: `updateCourse(id, updates): Course`

**Validation Schemas:**
- Purpose: Validate user input from forms and API requests
- Tool: Valibot (lightweight schema validation)
- Location: Defined inline in routes using `v.object({ ... })`
- Usage: `const parsed = await parseJsonBody(request, schema)`

**Database Queries:**
- Purpose: Type-safe database access
- Tool: Drizzle ORM
- Pattern: Build queries with `db.select().from(table).where(condition).get()` or `.all()`
- Examples: `app/services/courseService.ts` lines 16-50

**Route Loaders & Actions:**
- Purpose: Server-side data loading and form handling
- Pattern in routes:
  - `loader()`: Returns data for initial render
  - `action()`: Handles POST/PUT/DELETE form submissions
- Example: `app/routes/courses.$slug.tsx` loader calls multiple services

## Entry Points

**Web Application:**
- Location: `app/root.tsx`
- Triggers: Server startup or browser navigation to `/`
- Responsibilities: Layout wrapper, error boundary, navigation loading bar, theme initialization

**Route System:**
- Location: `app/routes.ts`
- Triggers: Matched route from URL path
- Responsibilities: Map URLs to route components, define nested layouts

**Public Routes:**
- `/` - Home page (`app/routes/home.tsx`)
- `/login` - Auth entry point (`app/routes/login.tsx`)
- `/signup` - Registration (`app/routes/signup.tsx`)

**Authenticated Routes** (wrapped in `app/routes/layout.app.tsx` layout):
- `/dashboard` - User dashboard
- `/courses` - Course catalog
- `/courses/:slug` - Course details and enrollment
- `/courses/:slug/lessons/:lessonId` - Lesson content viewer
- `/instructor/*` - Instructor dashboard (course management)
- `/admin/*` - Admin panels (analytics, users, courses, categories)

**API Routes:**
- `/api/logout` - Session destruction
- `/api/switch-user` - Dev tool for switching users
- `/api/video-tracking` - Track lesson watch events
- `/api/set-dev-country` - Dev tool for PPP testing
- `/api/course-rating` - Submit/update course ratings

## Error Handling

**Strategy:** Mixed approach with service-level exceptions and result objects

**Patterns:**

1. **Throw on Critical Errors** (services):
   - Used for database constraint violations
   - Example: `app/services/categoryService.ts` throws on duplicate name/slug
   - Message: `throw new Error('A category with the name "${name}" already exists.')`

2. **Result Objects for Expected Failures** (optional outcomes):
   - Used for business logic failures that might succeed
   - Example: `app/services/couponService.ts` redeemCoupon returns `{ ok: true } | { ok: false; error: string }`
   - Allows caller to handle without try-catch

3. **Route Error Boundaries** (routes):
   - Every route can export `ErrorBoundary()` function
   - Root error boundary in `app/root.tsx` catches unhandled errors
   - Returns user-friendly error page with status code

4. **HTTP Status Codes** (routes):
   - Routes throw data with status: `throw data("Not found", { status: 404 })`
   - Example: `app/routes/courses.$slug.tsx` line 63

## Cross-Cutting Concerns

**Logging:** No explicit logging framework detected. Uses browser console in development. No structured server-side logging.

**Validation:** Valibot schemas for input validation
- Route level: API routes validate request bodies in `action()` functions
- Service level: Some services throw on validation failures (e.g., duplicate checks)
- Pattern: `const parsed = await parseJsonBody(request, schema)` then check `parsed.success`

**Authentication:** Session-based with cookie storage
- Implemented in `app/lib/session.ts`
- `getCurrentUserId(request)` retrieves user ID from session
- `setCurrentUserId(request, userId)` sets after login
- `destroySession(request)` clears on logout
- Session is read on every request that needs it

**Authorization:** Role-based access control (RBAC)
- Roles defined in schema: `UserRole.Student`, `UserRole.Instructor`, `UserRole.Admin`
- Checked in route loaders: verify `currentUser.role` before proceeding
- Example: `app/routes/instructor.tsx` checks for Instructor role
- Sidebar navigation filters menu items by role: `app/components/sidebar.tsx` line 48

**Pricing & PPP:** Dynamic pricing based on country
- `app/lib/ppp.ts` implements Purchasing Power Parity adjustments
- `getCountryTierInfo(country)` returns tier/pricing multiplier
- Routes detect country via GeoIP or session override
- Example: `app/routes/courses.$slug.tsx` line 45

---

*Architecture analysis: 2026-04-17*
