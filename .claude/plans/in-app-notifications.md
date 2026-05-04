## Implementation Plan

### 1. Delivery Strategy
Implement this as thin vertical slices. Ship the smallest end-to-end path first, then expand. Each slice must include backend, frontend, auth checks, and tests.

### 2. Slices

#### Slice 1 — Persistent notification model + read API
Goal:
Create the backend foundation.

Scope:
- Add `notifications` table
- Add notification domain/service layer
- Implement:
  - `GET /notifications`
  - `GET /notifications/unread-count`
  - `POST /notifications/{id}/read`
  - `POST /notifications/mark-all-read`
- Enforce authenticated user scoping
- Add backend tests for auth, filtering, ordering, and read transitions

Exit criteria:
- Notifications can be created internally and fetched by recipient
- Read state changes persist correctly
- Cross-user access is impossible

#### Slice 2 — Header bell + badge + list UI
Goal:
Expose notifications to users in the app shell.

Scope:
- Add bell icon to global header
- Add unread badge
- Add notification center panel/page
- Fetch notifications on open
- Show loading, empty, error states
- Render unread/read styles
- Add frontend tests for rendering and interaction

Exit criteria:
- User can open the notification center and view their notifications
- Badge count matches backend unread count
- Empty state and error state behave correctly

#### Slice 3 — Click-through + mark as read
Goal:
Make notifications actionable.

Scope:
- Clicking a notification marks it as read
- Navigate to deep link target
- Add manual “mark as read” action per item
- Optimistically update UI with rollback on error if desired
- Add tests for navigation + status update

Exit criteria:
- Clicking or manually reading updates badge and item state correctly
- Invalid deep links fail gracefully

#### Slice 4 — Mark all read + pagination
Goal:
Make the system usable at moderate scale.

Scope:
- Add “Mark all as read”
- Implement pagination/cursor loading in UI
- Preserve stable ordering
- Add tests for large lists and repeated fetches

Exit criteria:
- Users can clear unread state in one action
- Large notification histories remain performant

#### Slice 5 — Event producers integration
Goal:
Connect real product events.

Scope:
- Identify first 2–3 notification-producing events
- Integrate backend service calls from those flows
- Add idempotency or de-duplication rules where needed
- Add integration tests for event -> notification creation

Exit criteria:
- Real product workflows generate notifications reliably
- Duplicate generation is controlled

#### Slice 6 — Polling + multi-tab consistency
Goal:
Improve freshness and robustness.

Scope:
- Poll unread count and/or latest notifications on interval
- Refresh panel state when open
- Handle multi-tab consistency on next poll
- Add tests for race conditions and stale UI

Exit criteria:
- New notifications appear without refresh within acceptable delay
- Read state converges across tabs

### 3. Backend Work Breakdown
- Add DB migration for `notifications`
- Add ORM/entity model
- Add repository/service methods:
  - create_notification
  - list_notifications_for_user
  - count_unread_for_user
  - mark_read
  - mark_all_read
- Add API schemas
- Add authorization guards
- Add event producer integration points
- Add observability:
  - creation failures
  - read action failures
  - endpoint latency

### 4. Frontend Work Breakdown
- Add header notification bell component
- Add unread badge
- Add notification panel/page component
- Add API client methods
- Add notification item component
- Handle polling lifecycle
- Handle optimistic updates and retries
- Add responsive/mobile behavior

### 5. Testing Plan

#### Backend
- Create notification for recipient
- List returns only current user notifications
- Order is newest first
- Read single notification
- Mark all read
- Already-read notification is idempotent
- Unauthorized access to another user’s notification fails
- Invalid notification id returns correct error
- Pagination works correctly

#### Frontend
- Bell renders correctly
- Badge hidden at zero, shown when > 0
- Panel opens and closes
- Empty, loading, and error states render
- Clicking notification navigates and updates read state
- Mark-as-read updates item and badge
- Mark-all-read clears unread state
- Pagination/load more works
- Polling refresh updates badge/list

#### E2E
- Seed user with notifications
- Verify badge count on login
- Open center and inspect ordering
- Click notification and confirm redirect
- Confirm unread count decrements
- Confirm cross-user isolation

### 6. Rollout Plan
- Behind feature flag
- Enable for internal users first
- Monitor unread count endpoint latency and notification creation errors
- Enable for small cohort
- Roll out generally after stability check

### 7. Risks
- Notification spam if product events are noisy
- Security issues if recipient scoping is weak
- Broken deep links causing poor UX
- Polling frequency increasing backend load
- Duplicate notifications from retried event producers

### 8. Mitigations
- Start with limited event types
- Add server-side auth and test it hard
- Use opaque ids
- Add idempotency keys where events can retry
- Rate-limit or debounce noisy producers if needed
- Instrument all notification creation paths

### 9. Definition of Done
- PRD scope for v1 implemented
- Secure recipient-based access enforced
- Notification bell, badge, list, read actions, and mark-all-read work
- At least 2 real event sources integrated
- Backend, frontend, and E2E tests pass
- Feature flag and rollout notes documented
- Basic metrics/logging in place