# Kanban Board Technical Documentation

Last updated: 2026-04-06

## 1) Project Snapshot

This repository contains a production-style Kanban board built with React + TypeScript on the frontend, Convex for application data, and Better Auth for authentication.

The app currently supports:

- Email/password authentication.
- Google OAuth (when provider env vars are configured).
- Better Auth JWT token exchange and Convex authenticated API calls.
- User-scoped board data in Convex (owner-based isolation).
- Task/column CRUD with drag and drop.
- Undo/redo timeline snapshots.
- Debounced autosave + optimistic task editing rollback behavior.
- Account profile management (name/avatar/password/delete-account).
- Cloudinary avatar upload with Convex user sync.
- Responsive horizontal board scrolling and dark mode.

## 2) What Changed Recently

The latest updates are centered around auth hardening, profile/account reliability, and board UX polish.

### 2.1 Auth + Session Updates

- Better Auth is now the active frontend identity provider through `useBetterAuthSession`.
- Convex token sync is handled by periodic JWT fetch (`/token`) and client auth injection (`setAuth`).
- Token refresh behavior now uses retries and graceful fallback to avoid auth flapping during transient failures.
- User-facing auth errors are sanitized to hide noisy backend details (request IDs, raw status noise, generic server internals).
- Auth adapter internals now use `unknown`-first typing in place of explicit TypeScript `any`, with runtime narrowing and schema-field filtering kept in place before Convex writes.

### 2.2 Account/Profile Updates

- Dedicated profile view supports:
  - Display name update.
  - Avatar upload to Cloudinary.
  - Password update (for credential accounts).
  - Account deletion flow with explicit confirmation.
- Linked provider introspection is used to determine whether credential-based password controls should be shown.
- Convex user upsert runs with auth retry semantics to recover from expired/invalid token states.
- Better Auth profile image mirror is best-effort after avatar upload (non-fatal failure path preserves good UX).

### 2.3 Board UX + State Updates

- Board scrolling improvements include:
  - Left/right scroll controls.
  - Edge fade masking for horizontal overflow.
  - Shift + mouse wheel horizontal scrolling.
  - Hidden desktop scrollbar while keeping touch panning behavior intact.
- Drag/drop behavior now includes local preview-state ordering for better cross-column hover feedback before drop finalization.
- Search behavior now supports both task-content matches and column-title matches.
- Task editing uses debounced save + optimistic rollback, with local draft synchronization to avoid stale edits.

## 3) Architecture Overview

## 3.1 Frontend Stack

- React 19 + TypeScript strict mode.
- Vite build pipeline.
- Zustand + Immer + Persist middleware for board state and local timeline.
- dnd-kit for task/column drag interactions.
- Framer Motion for board/task motion transitions.
- Tailwind CSS v4 utility styling.

## 3.2 Auth/Data Stack

- Better Auth for identity/session management.
- Better Auth JWT plugin configured with audience `convex`.
- Convex backend for board and user data persistence.
- Convex-backed Better Auth adapter (`api/auth/convexAdapter.mjs`) for auth model persistence.
- Cloudinary unsigned uploads for avatar images.

## 3.3 Runtime Ownership Model

- Board access is owner-scoped.
- Convex board mutations/queries derive identity server-side and validate ownership before writes.
- Frontend never passes user identity as a source of authorization truth.

## 4) App Runtime Flow

## 4.1 Sign-In To Board Data

1. User authenticates via Better Auth (email/password or OAuth).
2. Frontend obtains a Better Auth JWT using `GET /token`.
3. JWT is attached to Convex HTTP client via `setConvexAuthToken`.
4. Board store calls `initializeFromRemote`, which:
   - bootstraps the default board if missing,
   - fetches board state from Convex,
   - normalizes remote data to local typed structures,
   - resets local undo/redo history to a clean remote snapshot.

## 4.2 Token Refresh

- Token refresh runs on startup and an interval loop.
- Refresh failures are retried.
- Existing token can be temporarily retained on transient errors.
- If repeated failures exceed threshold, auth is cleared and token readiness is dropped.

## 4.3 Board Mutation Pattern

- Local store updates are immediate for responsive UX.
- Convex write is attempted asynchronously.
- On backend failure:
  - error is captured in `remoteError`,
  - board is resynced from Convex (`syncFromRemote`) to recover consistency.

Important nuance: create/delete operations avoid unnecessary success-path full-resyncs, which preserves undo/redo continuity for newly changed entities.

## 5) Board State Model

Board data is normalized in local state:

- `tasks: Record<TaskId, Task>`
- `columns: Record<ColumnId, Column>`
- `columnOrder: ColumnId[]`

Undo/redo behavior:

- Snapshot strategy uses deep clone semantics (`structuredClone`) plus ordered array copy for `columnOrder`.
- New actions after undo truncate future history.
- Keyboard shortcuts:
  - `Ctrl/Cmd + Z`: undo
  - `Ctrl/Cmd + Shift + Z`: redo

Persistence behavior:

- Zustand persist key: `kanban-board-storage`.
- Hydration merge is validated through runtime board guards before adopting persisted data.

## 6) Key Feature Modules

## 6.1 Application Shell

- `src/App.tsx`
  - Handles auth gating and loading/session-error states.
  - Orchestrates board/profile view switching.
  - Binds undo/redo commands and create-column modal.
  - Resolves profile avatar from Convex user record when available.

## 6.2 Board Feature

- `src/features/board/BoardView.tsx`
  - Search/filter orchestration.
  - DnD context and overlay rendering.
  - Cross-column drag preview staging.
  - Horizontal scroll controls and edge masks.

- `src/components/board/Column.tsx`
  - Inline column title editing.
  - Create task workflow per column.
  - Animated task list rendering.

- `src/components/board/TaskCard.tsx`
  - Inline task edit mode.
  - Debounced autosave.
  - Optimistic mutation + rollback status messaging.

## 6.3 Account Feature

- `src/features/account/AccountProfilePage.tsx`
  - Profile edits and avatar upload.
  - Password change controls based on linked account providers.
  - Account deletion safety gate.
  - Convex auth retry wrapper for unauthorized errors.

## 6.4 Auth Utilities

- `src/hooks/useBetterAuthSession.ts`
  - Session + token synchronization lifecycle.
  - Auth operation wrappers (sign in/up/out, OAuth).
  - Sanitized auth error pipeline.

- `src/lib/authClient.ts`
  - Better Auth client setup.
  - Token endpoint fetch logic with timeout.
  - Shared auth JSON call utilities.
  - User-facing error sanitization helper.

- `src/lib/convexClient.ts`
  - Convex HTTP singleton client.
  - Token set/clear auth bridge.

## 6.5 Convex Backend

- `convex/schema.ts`
  - Application tables: users, boards, columns, tasks.
  - Better Auth model tables: sessions, accounts, verification, jwks.

- `convex/board.ts`
  - Default board bootstrap.
  - Owner-scoped board querying.
  - Column/task CRUD and reorder/move operations.
  - Position-based ordering and reindexing.

- `convex/users.ts`
  - Current-user lookup by tokenIdentifier (fallback email resolution).
  - Canonical user upsert and duplicate consolidation logic.

- `convex/authDb.ts`
  - Auth adapter model CRUD bridge with normalization/filtering.

## 7) Environment Variables

Minimum environment values for local full-stack operation:

```env
VITE_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
VITE_BETTER_AUTH_URL=http://localhost:3000/api/auth
VITE_BETTER_AUTH_OAUTH_PROVIDERS=google
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
VITE_CLOUDINARY_UPLOAD_FOLDER=kanban-avatars
BETTER_AUTH_SECRET=replace-with-a-strong-secret
```

Optional/common auth runtime values:

```env
BETTER_AUTH_URL=http://localhost:3000/api/auth
BETTER_AUTH_JWT_ISSUER=http://localhost:3000/api/auth
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:5173,http://localhost:4173
BETTER_AUTH_API_KEY=optional-if-dash-plugin-is-used
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 8) Scripts And Operations

Inside `kanban-board/`:

- `npm run dev`: start Vite dev server.
- `npm run typecheck`: run TypeScript project references build check.
- `npm run lint`: run ESLint.
- `npm run build`: typecheck + production bundle build.
- `npm run preview`: serve built output locally.
- `npm run convex:dev`: run Convex dev environment.
- `npm run convex:deploy`: deploy Convex functions/schema.
- `npm run convex:codegen`: regenerate Convex typed client refs.

## 9) Deployment Notes

Current Vercel app config (frontend package):

- Framework: `vite`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

When deploying from repository root, ensure project root points to `kanban-board/` so the correct package and Vite config are used.


