# Kanban Board

A Trello-inspired Kanban board built with React, TypeScript, Zustand, dnd-kit, and Framer Motion.

## Live Demo

Add your deployment URL here after Vercel setup:

https://your-kanban.vercel.app

## Stack

- React 19 + TypeScript (strict)
- Vite 7
- Zustand + Immer + Persist middleware
- dnd-kit (drag and drop)
- Framer Motion (animations)
- Tailwind CSS 4
- Better Auth (email/password + OAuth + JWT token endpoint)
- Convex (database + authenticated API)

## Architecture Decisions

### Why Zustand over Redux?

Zustand was chosen because this project benefits from:

- A small API surface and low boilerplate for feature iteration
- Direct selector-based subscriptions to reduce unnecessary re-renders
- Easy integration of middleware (persist + immer)

This keeps the store concise while still allowing predictable updates.

### State Normalization

Board state is normalized into:

- tasks: Record<TaskId, Task>
- columns: Record<ColumnId, Column>
- columnOrder: ColumnId[]

This enables O(1) task lookups, simplifies move/reorder operations, and avoids deeply nested immutable updates.

### Undo/Redo Implementation

Undo/redo uses immutable snapshots of the board shape:

- Snapshot fields: tasks, columns, columnOrder
- Snapshot strategy: structuredClone for object graphs, array copy for columnOrder
- History truncation: if new actions happen after undo, future snapshots are dropped

This yields deterministic timeline behavior without mutating historical entries.

### Persistence + Runtime Safety

State is persisted with Zustand persist middleware under the kanban-board-storage key.
Hydration is guarded with runtime validation before merge so invalid localStorage data does not corrupt active state.

## Concepts Applied

| Concept | Where It Is Used |
| --- | --- |
| Debounce | Task content autosave in TaskCard |
| Deep Clone | Undo/redo snapshots in boardStore |
| Type Guards | Persisted state validation during merge |
| useEffect Cleanup | Debounce timer cleanup and matchMedia listener cleanup |
| useMemo | Search filtering and derived per-column task lists |
| Optimistic UI + Rollback | Task update with rollback on remote failure |
| Async Queue | Concurrency-limited remote save queue |

## Functional Coverage

- Add task per column
- Inline edit with debounced autosave
- Optimistic save with rollback on failure
- Drag and drop task movement across columns
- Undo/redo in store timeline
- Search/filter task content
- Dark mode based on system preference with manual toggle

## Theme Notes

- Dark mode uses a class-driven Tailwind v4 variant so UI state follows the in-app toggle reliably instead of only OS media queries.
- Theme preference is persisted in localStorage under `kanban-theme` and restored on load.
- Root page colors, modal surfaces, and form inputs now have explicit dark-mode styles so dialogs (Create Column / Delete Column) render correctly in both themes.

## Pre-Deployment Checklist (Completed)

Executed locally on 2026-03-18:

- npm run typecheck: pass
- npm run lint: pass
- npm run build: pass

Latest production build summary:

- dist/index.html: 0.46 kB (gzip 0.29 kB)
- dist/assets/index-DTyIB-XY.css: 18.00 kB (gzip 4.18 kB)
- dist/assets/index-B1Tnxc9T.js: 202.29 kB (gzip 63.85 kB)

## Local Development

Install and run:

1. npm install
2. npm run dev

## Convex Backend

Convex backend scaffold and setup instructions are documented in `CONVEX_BACKEND_SETUP.md`.

## Authentication

Authentication is now powered by Better Auth.

- Sign up, sign in, and sign out are implemented in the app UI.
- OAuth provider buttons are rendered from `VITE_BETTER_AUTH_OAUTH_PROVIDERS`.
- Convex requests are authenticated with JWT access tokens from Better Auth `GET /token`.
- Board data is scoped per authenticated user in Convex.
- The local Better Auth server currently uses an in-memory adapter, so auth state resets when that server restarts.

Minimum env vars for the full auth stack:

```env
VITE_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
VITE_BETTER_AUTH_URL=http://localhost:3000/api/auth
VITE_BETTER_AUTH_OAUTH_PROVIDERS=google,github
BETTER_AUTH_SECRET=replace-with-a-strong-secret
```

Important: `convex/auth.config.ts` must point to your Better Auth issuer and audience (`applicationID`) must match the JWT `aud` claim (default in this project: `convex`).

Useful scripts:

- npm run typecheck
- npm run lint
- npm run build
- npm run preview

## Deployment Guide (Vercel)

### Option A: Vercel Dashboard (recommended)

1. Push code to GitHub.
2. In Vercel, click Add New Project and import this repository.
3. Set Root Directory to kanban-board.
4. Build Command: npm run build
5. Output Directory: dist
6. Install Command: npm ci
7. Deploy.

### Option B: Vercel CLI

1. npm i -g vercel
2. From the repository root, run vercel
3. When prompted, set project root to kanban-board
4. Confirm build/output settings and deploy

## How To See Everything During Deployment

### Local visibility

- npm run preview to verify production output locally
- Browser devtools:
  - Network tab for request timing/errors
  - Console tab for runtime logs
  - Performance tab for render bottlenecks

### Vercel visibility

- Deployments tab: each build and status
- Build Logs: install/build output with exact failing command
- Runtime Logs: request-time logs for serverless/edge functions
- Domains tab: active URL and aliases
- Analytics tab (if enabled): traffic and Web Vitals

## CI (Bonus)

A GitHub Actions workflow is included at repository level to run:

- npm ci
- npm run typecheck
- npm run lint
- npm run build

for pushes and pull requests.

## What I Learned

- Normalized state makes drag/drop and history logic significantly easier to reason about.
- Optimistic updates are most useful when combined with explicit rollback behavior.
- Debounce and memoization are high-impact when applied only where needed.
- Deployment quality improves when typecheck, lint, and build are automated in CI.
