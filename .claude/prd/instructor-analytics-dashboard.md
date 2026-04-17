# PRD: Instructor Analytics Dashboard

## Problem Statement

Instructors have no way to understand the performance of their courses as a business. They can view a student roster with individual progress, but there is no aggregate view of revenue, enrollments over time, or course ratings. Making informed decisions about pricing, content investment, or marketing requires manually piecing together data that the platform already has.

## Solution

A dedicated analytics dashboard accessible to instructors at `/instructor/analytics`. The page shows three summary cards (total revenue, total enrollments, average rating), a revenue-over-time line chart, and a detailed per-course breakdown table. All data respects a selected time period (7 days, 30 days, 12 months) stored in the URL as a search param. Admins can view any instructor's dashboard via a link on the admin users page.

## User Stories

1. As an instructor, I want a dedicated analytics page, so that I can understand my course business at a glance.
2. As an instructor, I want to see total revenue for a selected time period, so that I know how much I've earned recently.
3. As an instructor, I want to see total enrollments for a selected time period, so that I can track student acquisition trends.
4. As an instructor, I want to see my average rating and rating count, so that I know how students perceive my content.
5. As an instructor, I want a revenue-over-time line chart, so that I can spot trends, spikes, and slow periods visually.
6. As an instructor, I want to select fixed time periods (7 days, 30 days, 12 months), so that I can compare short-term and long-term performance.
7. As an instructor, I want the selected time period to be stored in the URL, so that I can bookmark or share a specific view.
8. As an instructor, I want the summary cards to reflect the selected time period, so that all numbers on the page are consistent.
9. As an instructor, I want the line chart to auto-scale granularity (daily for 7d/30d, monthly for 12m), so that the chart is readable at every time range.
10. As an instructor, I want a per-course breakdown table, so that I can compare the performance of my individual courses.
11. As an instructor, I want the course table to show revenue, enrollments, average rating, rating count, and completion rate per course, so that I have maximum useful data in one place.
12. As an instructor, I want to sort the course table by any column, so that I can quickly identify my best and worst performers.
13. As an instructor, I want the course table to respect the selected time period, so that revenue and enrollments shown are period-accurate.
14. As an instructor, I want an empty state message when I have no courses or no data, so that the page doesn't appear broken.
15. As an admin, I want to view any instructor's analytics dashboard, so that I can support instructors and monitor platform health.
16. As an admin, I want a "View Analytics" link on the admin users page next to each instructor, so that I can navigate directly to their dashboard.
17. As an admin, I want the instructor analytics URL to include the instructor ID, so that I can share or bookmark a specific instructor's view.

## Implementation Decisions

**New route: `/instructor/analytics`**
- Accessible to instructors (own data) and admins (redirects to admin route).
- Reads `?period=7d|30d|12m` from URL; defaults to `30d`.
- Server loader fetches all analytics data for the authenticated instructor.

**New route: `/admin/analytics/:instructorId`**
- Admin-only access guard (403 for non-admins).
- Same layout as instructor route; data scoped to the specified instructor.
- Linked from the admin users page with a "View Analytics" button per instructor row.

**New service: `analyticsService`**
Three public functions, each accepting `{ instructorId, period }`:
- `getInstructorSummary` → `{ totalRevenue, totalEnrollments, avgRating, ratingCount }`
- `getRevenueTimeSeries` → `Array<{ date: string, revenue: number }>`
- `getCourseBreakdown` → `Array<{ courseId, title, revenue, enrollments, avgRating, ratingCount, completionRate }>`

Period-to-date-range resolution and chart granularity (daily vs monthly) are handled inside the service, not in the route loader.

**UI components (co-located with routes)**
- `PeriodSelector` — renders 3 buttons (7d / 30d / 12m), updates `?period` search param on click, reads current value from URL.
- `SummaryCard` — generic card: formatted value + label.
- `RevenueLineChart` — wraps Recharts; x-axis is date, y-axis is revenue in dollars.
- `CourseAnalyticsTable` — sortable table; sort column and direction managed as client-side state (not URL).

**Schema changes**
None. All required data exists: `purchases.pricePaid`, `purchases.createdAt`, `enrollments.enrolledAt`, `courseRatings.rating`, `enrollments.completedAt`.

**Admin users page**
Add a "View Analytics" link/button to each row where `user.role === 'instructor'`. Links to `/admin/analytics/:userId`.

**Completion rate calculation**
`completedAt IS NOT NULL` count divided by total enrollment count for the course, within the selected period.

**Revenue values**
Stored as integer cents in the DB; formatted as dollars in the UI (divide by 100).

## Testing Decisions

**What makes a good test:** Test the externally observable output of a function given specific inputs. Do not assert on SQL queries, internal variable names, or implementation structure. Tests should pass even if the internal implementation is refactored.

**`analyticsService` tests**
- Seed a real SQLite test DB (matching the existing pattern using `@effect/vitest` with `it.effect()` and drizzle-kit `pushSchema`).
- Test each of the three functions independently.
- Cover: correct aggregation for each period, empty state (no purchases/enrollments), multiple instructors (assert data is scoped to the correct instructor), boundary dates (a purchase on the exact start date of the period is included).

**Route loader tests**
- Test that the loader for `/instructor/analytics` returns correctly shaped data for an authenticated instructor.
- Test that the loader rejects (403) a non-instructor, non-admin user.
- Test that the admin loader at `/admin/analytics/:instructorId` rejects non-admins and returns data for the specified instructor when called by an admin.
- Prior art: existing route loader patterns in the codebase.

## Out of Scope

- Custom date range picker (only fixed periods: 7d, 30d, 12m).
- Revenue breakdown by country or PPP vs full-price split.
- Per-student drill-down from the analytics page (existing student roster covers this).
- Email/export of analytics data.
- Platform-wide aggregate analytics for admins.
- Real-time or live-updating data.
- Revenue forecasting or trend annotations.
- Coupon/discount impact metrics.
- Team purchase breakdown.

## Further Notes

- No charting library is currently in the project. Recharts is the recommended addition (React-native, widely used, good TypeScript support).
- SQLite does not support materialized views or scheduled aggregation jobs. All queries run on page load. If query performance becomes an issue, computed aggregation columns or a separate reporting table can be introduced later.
- The `purchases.country` field is available for future geographic breakdown if needed.
