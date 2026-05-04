# In-App Notifications
## PRD

### 1. Summary
Build an in-app notification system that informs users about important events inside the product in real time or near real time, without relying on email. Notifications must be visible, actionable, persist across sessions, support read/unread state, and scale to multiple notification types.

### 2. Problem Statement
Users currently miss important product events because there is no centralized in-app notification mechanism. This creates delays, weakens engagement, and forces users to poll pages manually. The product needs a reliable, low-noise notification center that surfaces relevant events at the right time and lets users act on them quickly.

### 3. Goals
- Give users a single place to view product notifications
- Surface critical events without requiring page refresh
- Let users distinguish unread vs read items
- Support deep links from notifications into the relevant entity/page
- Reduce missed important events
- Provide a foundation for future preferences and notification channels

### 4. Non-Goals
- Email notifications
- Push notifications
- SMS or external messaging channels
- Complex per-event user preference controls in v1
- Notification digesting / batching logic in v1
- Rich media notifications
- Cross-tenant broadcasts managed from an admin UI

### 5. Users
- End users of the product receiving notifications about activity relevant to them
- Admins/operators only indirectly, through system-generated events

### 6. User Stories
1. As a user, I want to see a notification badge in the app shell so that I know when something new requires my attention.
2. As a user, I want to open a notification center so that I can view my recent notifications in one place.
3. As a user, I want unread notifications to be visually distinct so that I can quickly identify what I have not seen.
4. As a user, I want to click a notification and be taken to the relevant page so that I can act immediately.
5. As a user, I want a notification to be marked as read when I open it so that my list stays current.
6. As a user, I want to manually mark a notification as read so that I can clear items without opening each destination.
7. As a user, I want to mark all notifications as read so that I can reset the badge quickly.
8. As a user, I want notifications to persist across sessions so that I do not lose important information.
9. As a user, I want the newest notifications first so that the list reflects current relevance.
10. As a user, I want an empty state when I have no notifications so that the UI still feels intentional.
11. As a user, I want only notifications relevant to me so that I am not distracted by noise.
12. As a product/system owner, I want a reusable backend notification model so that new event types can be added without redesigning the system.

### 7. Functional Requirements

#### 7.1 Notification Entry Points
- Notification bell/icon in the global app header
- Unread count badge displayed on the bell
- Notification center panel or page accessible from the bell

#### 7.2 Notification List
Each notification must include:
- id
- recipient user id
- type
- title
- body/short message
- status: unread/read
- created_at
- read_at (nullable)
- deep_link URL or route target
- optional metadata payload for rendering/actions

#### 7.3 Notification Behavior
- New notifications appear in reverse chronological order
- Unread count updates when notifications are fetched or changed
- Clicking a notification:
  - marks it as read
  - navigates to the target route if one exists
- Users can:
  - mark one as read
  - mark all as read
- Notifications remain accessible after being read
- Notification list is paginated or cursor-based

#### 7.4 Delivery Model
V1 supports:
- Fetch on app load
- Polling at fixed interval for new notifications
Optional later:
- WebSocket/SSE real-time delivery

#### 7.5 Notification Types
Initial system should support configurable types, for example:
- task_assigned
- mention
- comment_reply
- status_changed
- system_announcement
- file_processed
- report_ready

These are examples only. Final event list depends on product needs.

### 8. UX Requirements
- Badge hidden when unread count = 0
- Unread items have clear visual distinction
- Long text truncates safely in list view
- Clicking outside closes panel if panel pattern is used
- Empty state text should explain that notifications will appear here
- Loading, error, and empty states must be explicit
- Notification center should work on desktop and mobile layouts

### 9. Permissions and Security
- Users can only retrieve their own notifications
- API must enforce recipient-based access control server-side
- Deep links must not expose unauthorized resources
- Notification metadata must not include sensitive data that should not be visible in the client
- Notification IDs must not be enumerable in a way that grants cross-user access

### 10. Data Model
Suggested table: `notifications`

Fields:
- `id` UUID / opaque identifier
- `recipient_user_id` FK
- `type` string
- `title` string
- `body` text
- `status` enum(`unread`, `read`)
- `deep_link` string nullable
- `metadata` JSON nullable
- `created_at` timestamp
- `read_at` timestamp nullable

Indexes:
- `(recipient_user_id, created_at desc)`
- `(recipient_user_id, status, created_at desc)`

### 11. API Requirements

#### GET /notifications
Returns paginated notifications for current user.

Query params:
- `limit`
- `cursor` or `page`
- optional `status=unread|read|all`

#### GET /notifications/unread-count
Returns unread count for current user.

#### POST /notifications/{id}/read
Marks one notification as read for current user.

#### POST /notifications/mark-all-read
Marks all notifications as read for current user.

#### Internal event creation API / service
System components can create notifications through a backend service or internal API, not directly from the client.

### 12. Success Metrics
- % of active users opening notification center weekly
- average time from notification creation to first open
- click-through rate on actionable notifications
- unread backlog per active user
- failure rate of notification creation pipeline
- duplicate notification rate
- API latency for list and unread count

### 13. Edge Cases
- User has zero notifications
- User has only read notifications
- Duplicate event emitted twice
- Deep link target deleted or inaccessible
- Notification created while user is active on same page
- Polling races with mark-as-read action
- Large unread counts
- Multi-tab synchronization
- User session expired during fetch or action

### 14. Technical Decisions
- Delivery in v1: polling, not WebSocket
- Storage: persistent DB-backed notifications
- Status model: unread/read only in v1
- Sorting: newest first
- Count model: dedicated unread count endpoint
- Access control: current authenticated user only
- IDs: opaque UUIDs, not sequential ids
- Pagination: cursor preferred for scale

### 15. Out of Scope
- Notification preference center
- Mute/snooze per type
- Push/email fan-out
- Grouping similar notifications
- Per-notification archive/delete
- Admin broadcast composer
- Rich interactive notification templates

### 16. Open Questions
- What exact event types should ship in v1?
- Should clicking a notification always auto-mark as read, or only after successful destination load?
- How long should notifications be retained?
- Do we need tenant/org-scoped announcements in v1?
- Is polling interval fixed or adaptive?
- Should read notifications expire from the UI after N days?
