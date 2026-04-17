# TESTING.md — Test Structure & Practices

## Framework
- **Vitest** (`vitest.config.ts`) — global test APIs, tsconfigPaths plugin
- Tests run with `npm run test` (or `vitest`)
- No `@effect/vitest` — plain Vitest with `describe/it/expect`

## Test File Locations
Co-located with source files in `app/services/` and `app/lib/`:

```
app/
├── lib/
│   ├── country.server.test.ts   # country detection tests
│   └── ppp.test.ts              # PPP pricing tests
└── services/
    ├── analyticsService.test.ts
    ├── bookmarkService.test.ts
    ├── categoryService.test.ts
    ├── couponService.test.ts
    ├── courseService.test.ts
    ├── enrollmentService.test.ts
    ├── lessonService.test.ts
    ├── moduleService.test.ts
    ├── progressService.test.ts
    ├── purchaseService.test.ts
    └── teamService.test.ts
```

## Test Setup (`app/test/setup.ts`)

### `createTestDb()`
Creates a fresh in-memory SQLite DB per test using the real Drizzle migrations:
```typescript
import { createTestDb } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;

beforeEach(() => {
  testDb = createTestDb(); // isolated, fresh DB each test
});
```
- Uses `better-sqlite3` with `:memory:`
- Applies real `drizzle/` migrations — schema always matches production
- Enables `WAL` and `foreign_keys` pragmas

### `seedBaseData(testDb)`
Seeds minimal baseline: one student, one instructor, one category, one published course:
```typescript
const base = seedBaseData(testDb); // { user, instructor, category, course }
```

## DB Mocking Pattern
Services import `db` from `~/db`. Tests mock that module to redirect to the test DB:

```typescript
import { vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb; // getter ensures latest testDb reference
  },
}));

// Import service AFTER mock setup
import { getInstructorSummary } from "./analyticsService";

beforeEach(() => {
  testDb = createTestDb();
  base = seedBaseData(testDb);
});
```

**Critical:** Use a `get db()` getter — not a static value — so each test gets the freshly created DB instance.

## Test Structure
Standard `describe`/`it` nesting:
```typescript
describe("analyticsService", () => {
  describe("getInstructorSummary", () => {
    describe("correct aggregation per period", () => {
      it("sums revenue within the 7d period", () => {
        // arrange
        // act
        // assert
      });
    });
  });
});
```

## Coverage — What's Tested

| Service | Tested |
|---|---|
| `analyticsService` | ✅ |
| `bookmarkService` | ✅ |
| `categoryService` | ✅ |
| `couponService` | ✅ |
| `courseService` | ✅ |
| `enrollmentService` | ✅ |
| `lessonService` | ✅ |
| `moduleService` | ✅ |
| `progressService` | ✅ |
| `purchaseService` | ✅ |
| `teamService` | ✅ |
| `commentService` | ❌ missing |
| `quizScoringService` | ❌ missing (critical) |
| `quizService` | ❌ missing |
| `ratingService` | ❌ missing |
| `userService` | ❌ missing |
| `videoTrackingService` | ❌ missing |
| `lib/ppp` | ✅ |
| `lib/country.server` | ✅ |

## Rules (CLAUDE.md)
> Anything marked as a 'service' (by the name of the file, e.g. `authTokenService.ts`) should have tests written for them in an accompanying `.test.ts` file.

All new service files **must** include a co-located `.test.ts`.

## What's NOT Tested
- Route loaders/actions (no integration test harness)
- UI components (no component test setup)
- End-to-end flows (no Playwright/Cypress)

## Running Tests
```bash
npm test           # run all tests
npm test -- --run  # single run (no watch)
npm test -- lessonService  # filter by name
```
