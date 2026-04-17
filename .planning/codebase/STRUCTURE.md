# STRUCTURE.md — Directory Layout & Organization

## Root Layout

```
cohort-003-project/
├── app/                   # Main application source
│   ├── components/        # Shared React components
│   │   └── ui/            # shadcn/ui primitives
│   ├── db/                # Database schema and client
│   ├── lib/               # Utility modules (server + client)
│   ├── routes/            # React Router v7 route modules
│   ├── services/          # Business logic (service layer)
│   └── test/              # Test utilities and setup
├── drizzle/               # Drizzle migration files
├── public/                # Static assets
├── scripts/               # One-off utility scripts
├── ralph/                 # (Internal tooling / course content)
├── _internal/             # Internal reference materials
├── .planning/             # GSD planning documents
│   └── codebase/          # Codebase map documents
├── build/                 # Compiled output (gitignored)
├── data.db                # SQLite database file
├── package.json
├── react-router.config.ts
├── drizzle.config.ts
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## Key Directories

### `app/routes/`
React Router v7 route modules using file-based dot-notation routing:
- `home.tsx` → `/`
- `login.tsx` → `/login`
- `signup.tsx` → `/signup`
- `courses.tsx` → `/courses`
- `courses.$slug.tsx` → `/courses/:slug`
- `courses.$slug.lessons.$lessonId.tsx` → `/courses/:slug/lessons/:lessonId`
- `courses.$slug.purchase.tsx` → `/courses/:slug/purchase`
- `instructor.tsx` → `/instructor` (layout)
- `instructor.$courseId.tsx` → `/instructor/:courseId`
- `instructor.$courseId.lessons.$lessonId.tsx` → lesson edit
- `instructor.$courseId.lessons.$lessonId.quiz.tsx` → quiz editor
- `instructor.$courseId.modules.$moduleId.tsx` → module edit
- `instructor.$courseId.students.tsx` → student list
- `instructor.analytics.tsx` → instructor analytics
- `instructor.new.tsx` → create course
- `admin.analytics.$instructorId.tsx` → admin analytics by instructor
- `admin.categories.tsx` → category management
- `admin.courses.tsx` → course moderation
- `admin.users.tsx` → user management
- `api.course-rating.ts` → rating API action
- `api.logout.ts` → logout action
- `api.set-dev-country.ts` → dev PPP override
- `api.switch-user.ts` → dev user impersonation
- `api.video-tracking.ts` → video progress tracking
- `layout.app.tsx` → authenticated layout wrapper
- `dashboard.tsx` → student dashboard
- `settings.tsx` → account settings
- `team.tsx` → team page
- `redeem.$code.tsx` → coupon redemption

### `app/services/`
Pure business logic modules — one file per domain. Each tested service has a co-located `.test.ts` file:
- `analyticsService.ts` + `.test.ts` — instructor revenue/enrollment analytics
- `bookmarkService.ts` + `.test.ts` — lesson bookmarks
- `categoryService.ts` + `.test.ts` — course categories
- `commentService.ts` — lesson comments (untested)
- `couponService.ts` + `.test.ts` — coupon/discount management
- `courseService.ts` + `.test.ts` — course CRUD
- `enrollmentService.ts` + `.test.ts` — enrollment management
- `lessonService.ts` + `.test.ts` — lesson CRUD and ordering
- `moduleService.ts` + `.test.ts` — module CRUD and ordering
- `progressService.ts` + `.test.ts` — lesson completion tracking
- `purchaseService.ts` + `.test.ts` — purchase records
- `quizScoringService.ts` — quiz grading (untested)
- `quizService.ts` — quiz CRUD (untested)
- `ratingService.ts` — course ratings (untested)
- `teamService.ts` + `.test.ts` — team/cohort members
- `userService.ts` — user CRUD (untested)
- `videoTrackingService.ts` — video watch progress (untested)

### `app/db/`
- `index.ts` — drizzle client singleton (better-sqlite3)
- `schema.ts` — all table definitions and enums

### `app/lib/`
- `session.ts` — cookie-based session (iron-session)
- `validation.ts` — Valibot form parsing helpers
- `markdown.server.ts` — marked-based markdown → HTML
- `ppp.ts` + `.test.ts` — Purchasing Power Parity pricing
- `country.server.ts` + `.test.ts` — country detection from request
- `utils.ts` — cn() classname utility

### `app/components/`
- `ui/` — shadcn/ui: button, card, input, label, select, skeleton, tabs, textarea
- `comment-section.tsx` — lesson comments UI
- `course-image.tsx` — course thumbnail
- `dev-ui.tsx` — dev mode overlay (user switcher, country override)
- `monaco-markdown-editor.tsx` — Monaco editor for lesson content
- `sidebar.tsx` — course navigation sidebar
- `star-rating.tsx` — interactive rating component
- `user-avatar.tsx` — avatar display
- `youtube-player.tsx` — YouTube embed with progress tracking

### `app/test/`
- `setup.ts` — `createTestDb()` (in-memory SQLite) and `seedBaseData()`

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Route files | dot-notation, lowercase | `courses.$slug.tsx` |
| Service files | camelCase + `Service` suffix | `lessonService.ts` |
| Component files | kebab-case | `course-image.tsx` |
| UI primitives | kebab-case in `ui/` | `ui/button.tsx` |
| DB schema | camelCase tables | `courses`, `lessons` |
| Test files | co-located `.test.ts` | `lessonService.test.ts` |
| Server-only | `.server.ts` suffix | `markdown.server.ts` |

## New Code Placement

| What | Where |
|---|---|
| New route | `app/routes/<route-name>.tsx` |
| New service | `app/services/<domain>Service.ts` + `.test.ts` |
| New shared component | `app/components/<name>.tsx` |
| New shadcn primitive | `app/components/ui/<name>.tsx` |
| New schema table | `app/db/schema.ts` + new migration |
| New utility | `app/lib/<name>.ts` |
| New server utility | `app/lib/<name>.server.ts` |
