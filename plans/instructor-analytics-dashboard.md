# Plan: Instructor Analytics Dashboard

## Durable Architectural Decisions

**Routes**
- `app/routes/instructor.analytics.tsx` — instructor's own dashboard; reads `?period=7d|30d|12m` (defaults `30d`); guarded to instructor + admin roles
- `app/routes/admin.analytics.$instructorId.tsx` — admin-only view of any instructor's dashboard; same layout, data scoped to `:instructorId`
- Both routes are loaders-only (no actions); period drives data fetching server-side

**Service**
- `app/services/analyticsService.ts` + `app/services/analyticsService.test.ts`
- Three public functions, each accepting `{ instructorId: number; period: "7d" | "30d" | "12m" }`:
  - `getInstructorSummary` → `{ totalRevenue: number; totalEnrollments: number; avgRating: number; ratingCount: number }`
  - `getRevenueTimeSeries` → `Array<{ date: string; revenue: number }>`
  - `getCourseBreakdown` → `Array<{ courseId: number; title: string; revenue: number; enrollments: number; avgRating: number; ratingCount: number; completionRate: number }>`
- Period-to-date-range and chart granularity resolved inside the service
- Revenue stored as integer cents; divided by 100 in the UI only

**Data sources (no schema changes)**
- `purchases.pricePaid` + `purchases.createdAt` → revenue
- `enrollments.enrolledAt` + `enrollments.completedAt` → enrollments + completion rate
- `courseRatings.rating` → average rating + count

**Auth pattern** (matches existing codebase)
- `getCurrentUserId(request)` → `getUserById(id)` → role check → `throw data(msg, { status: 403 })`

**Charting**
- Add `recharts` (no charting library currently in project)

**Admin users page**
- Add "View Analytics" link per instructor row → `/admin/analytics/:userId`

---

## Phase 1 — Tracer Bullet: Service + Summary Cards

Wire the full stack end-to-end with the simplest possible data path: three aggregate numbers from DB to UI.

**Layers touched:** service, service tests, route loader, route component, UI components

**Deliverables**
- `analyticsService.ts`: implement `getInstructorSummary` with period-to-date-range resolution
- `analyticsService.test.ts`: test `getInstructorSummary` — correct aggregation per period, empty state, multi-instructor isolation, boundary date inclusion
- `instructor.analytics.tsx`: loader reads `?period`, calls `getInstructorSummary`, guards instructor/admin roles; component renders `PeriodSelector` + three `SummaryCard` components + empty state
- `PeriodSelector` component: three buttons (7d / 30d / 12m), updates `?period` search param, reads current value from URL
- `SummaryCard` component: formatted value + label; revenue displayed as dollars

**User stories covered:** 1, 2, 3, 4, 6, 7, 8, 14

---

## Phase 2 — Chart & Course Table

Extend the service with the remaining two functions, add their tests, and render both the revenue chart and course breakdown table.

**Layers touched:** service, service tests, route loader (extend), UI components (new)

**Deliverables**
- Install `recharts`
- `analyticsService.ts`: implement `getRevenueTimeSeries` (daily buckets for 7d/30d, monthly for 12m) and `getCourseBreakdown` (completion rate = `completedAt IS NOT NULL` count / total enrollments for the period)
- `analyticsService.test.ts`: test `getRevenueTimeSeries` — correct granularity per period, empty state returns zero-value buckets, revenue summed correctly per bucket; test `getCourseBreakdown` — all columns aggregate correctly, completion rate calculation, empty state, period scoping
- `instructor.analytics.tsx`: loader adds `revenueTimeSeries` and `courseBreakdown` to returned data; component renders `RevenueLineChart` and `CourseAnalyticsTable`
- `RevenueLineChart` component: wraps Recharts `LineChart`; x-axis is date label, y-axis is dollars; granularity auto-scales from data
- `CourseAnalyticsTable` component: columns — title, revenue, enrollments, avg rating, rating count, completion rate; sort column + direction as client-side state

**User stories covered:** 5, 9, 10, 11, 12, 13

---

## Phase 3 — Empty States & Edge Cases

Harden every layer against missing data: instructors with no courses, periods with no activity, and boundary-date precision.

**Layers touched:** service tests (extend), route component (extend)

**Deliverables**
- `analyticsService.test.ts`: add edge case coverage across all three functions — instructor with no courses (all zeros/empty arrays), period with purchases/enrollments but none in the selected window, purchase/enrollment on the exact start date of the period is included, multiple instructors' data does not bleed across
- `instructor.analytics.tsx`: render explicit empty states — no-courses message when `courseBreakdown` is empty, zero-activity message when `totalRevenue === 0 && totalEnrollments === 0` for the selected period; chart and table suppress themselves rather than rendering broken/empty visuals
- `HydrateFallback`: skeleton placeholders for summary cards, chart area, and table rows

**User stories covered:** 14

---

## Phase 4 — Admin Access

Add the admin-facing route and the entry point on the admin users page.

**Layers touched:** new route, existing route (admin users page), route loader tests

**Deliverables**
- `admin.analytics.$instructorId.tsx`: admin-only guard (403 for non-admins); loader calls all three analytics service functions with `instructorId` from params; same component layout as instructor route
- Route loader tests for both routes:
  - `instructor.analytics` loader: returns correct data for authenticated instructor; 403 for non-instructor non-admin
  - `admin.analytics.$instructorId` loader: 403 for non-admins; returns data scoped to specified instructor when called by admin
- `admin.users.tsx`: add "View Analytics" link/button per row where `user.role === UserRole.Instructor`; links to `/admin/analytics/:userId`

**User stories covered:** 15, 16, 17
