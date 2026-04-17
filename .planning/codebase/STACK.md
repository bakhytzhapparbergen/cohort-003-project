# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- TypeScript 5.9.2 - Full application (backend and frontend)
- JavaScript - Runtime environment (via Node.js)

**Secondary:**
- CSS - Styling via Tailwind CSS

## Runtime

**Environment:**
- Node.js (via `@react-router/node` 7.12.0) - Server-side execution
- Browser - Client-side execution

**Package Manager:**
- pnpm 9.12.3 - Dependency management
- Lockfile: package-lock.json (present)

## Frameworks

**Core Web Framework:**
- React Router 7.12.0 - Full-stack routing and SSR
  - `@react-router/node` 7.12.0 - Node.js server adapter
  - `@react-router/serve` 7.12.0 - Production server

**UI Framework:**
- React 19.2.4 - Component library
- Radix UI 1.4.3 - Headless UI components
- Tailwind CSS 4.1.13 - Utility-first CSS framework
  - `@tailwindcss/vite` 4.1.13 - Vite plugin integration
  - `@tailwindcss/typography` 0.5.19 - Typography plugin
- shadcn 3.8.4 - Component library generator

**Editor & Code Display:**
- Monaco Editor (`@monaco-editor/react` 4.7.0) - Code editing component
- Shiki 3.22.0 - Syntax highlighting
- Marked 17.0.1 - Markdown parsing

**Data Visualization:**
- Recharts 3.8.1 - React charts library

**Testing:**
- Vitest 3.2.3 - Unit testing framework
  - Config: `vitest.config.ts`

**Build & Development:**
- Vite 7.1.7 - Build tool and dev server
  - Config: `vite.config.ts`
- tsx 4.19.4 - TypeScript execution (for scripts)
- Drizzle Kit 0.31.4 - Database schema management

## Database

**ORM:**
- Drizzle ORM 0.44.2 - Type-safe SQL query builder
  - Config: `drizzle.config.ts`
  - Schema: `app/db/schema.ts`

**Database Driver:**
- Better SQLite3 12.8.0 - Synchronous SQLite driver
  - Database file: `data.db`
  - WAL mode enabled for concurrency
  - Foreign keys enforced

## Key Dependencies

**Critical:**
- drizzle-orm 0.44.2 - Database abstraction layer
- react-router 7.12.0 - Full-stack routing framework
- better-sqlite3 12.8.0 - SQLite database access

**UI Components:**
- lucide-react 0.563.0 - Icon library (250+ icons)
- clsx 2.1.1 - Dynamic className utility
- class-variance-authority 0.7.1 - CSS variant management
- tailwind-merge 3.4.0 - Tailwind CSS merge utility
- sonner 2.0.3 - Toast notifications

**Utilities:**
- valibot 1.3.1 - Schema validation
- isbot 5.1.31 - Bot detection (for SSR optimization)

**Drag & Drop:**
- `@hello-pangea/dnd` 18.0.1 - Drag-and-drop library

## Configuration Files

**TypeScript:**
- `tsconfig.json` - Compiler configuration
  - Target: ES2022
  - Module: ES2022
  - Strict mode enabled
  - Path alias: `~/*` → `./app/*`

**Build:**
- `vite.config.ts` - Vite configuration with React Router plugin
- `react-router.config.ts` - React Router SSR configuration
- `vitest.config.ts` - Vitest configuration
- `.prettierrc` - Code formatter config (2 spaces, 80 char width, trailing commas)

**Database:**
- `drizzle.config.ts` - Drizzle Kit configuration
  - Schema path: `./app/db/schema.ts`
  - Output: `./drizzle/`
  - Dialect: SQLite
  - DB file: `./data.db`

## Environment Configuration

**Session Management:**
- Cookie-based sessions via React Router
  - Cookie name: `cadence_session`
  - Security: httpOnly, sameSite=lax
  - Dev secret: `cadence-dev-secret` (in `app/lib/session.ts`)

**Required Environment Variables:**
- `DISCORD_INVITE_URL` (optional) - Discord community link for course welcome page
  - Referenced in: `app/routes/courses.$slug.welcome.tsx`

**Dev Overrides:**
- Session-based dev country override for PPP pricing testing
  - Set via: `app/routes/api.set-dev-country.ts`

## Platform Requirements

**Development:**
- Node.js (v20+ recommended, based on `@types/node` v22)
- pnpm 9.12.3+
- SQLite 3

**Production:**
- Node.js for server execution
- SQLite database (single-file, file-based)
- Disk space for `data.db` SQLite database

**Browser Support:**
- ES2022+ support (TypeScript compiles to ES2022)
- Modern browsers only (no legacy IE support)

---

*Stack analysis: 2026-04-17*
