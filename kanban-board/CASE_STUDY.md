# Kanban Board Case Study

Last updated: 2026-04-08

## 1. Executive Summary

This project is a production-style Kanban board with:
- React + TypeScript frontend (Vite)
- shadcn/ui-style design 
- Zustand for local state management
- Convex as backend database synchronization
- Better Auth as authenticator (email/password + Google OAuth)
- Vercel serverless auth route bridge
- Cloudinary image uploads for avatars

The architecture is split so UI is fast and local-first, while all persistent board/user/auth data is eventually consistent with Convex.

## 2. Repository and Runtime Topology

Main areas:
- `kanban-board/`: primary React app + Convex functions + auth API handler
- `api/auth/[...handler].js` (root): auth handler 
- `better-auth-server/`: local standalone Better Auth server for non-Vercel scenarios

Key runtime path in production:
1. Browser loads Vite app from `kanban-board/dist`.
2. Browser calls Better Auth endpoints under `/api/auth/*` (Vercel rewrite route).
3. Better Auth uses Convex adapter to persist auth tables.
4. Frontend fetches JWT from `/api/auth/token`.
5. Frontend attaches JWT to Convex HTTP client.
6. Frontend calls Convex board/user queries.

## 3. Folder-by-Folder Responsibilities

### `kanban-board/src`
- React UI, state hooks, local persistence, drag-and-drop behavior.
- Converts remote Convex board payloads into local typed normalized model.
- Handles auth session, token refresh, and user-facing auth errors.

### `kanban-board/convex`
- Data schema and all board/user/auth storage functions.
- Enforces owner-based authorization via `ctx.auth.getUserIdentity()`.
- Stores both app domain data and Better Auth model tables.

### `kanban-board/api/auth`
- Better Auth configuration and serverless request handler.
- Convex adapter for Better Auth model CRUD (`authDb` functions).

### Root `api/auth`
- Entry route used by Vercel rewrite.
- Maps startup/runtime auth failures to explicit response payloads.

### Root `better-auth-server/src`
- Local Node HTTP server that serves Better Auth at `/api/auth`.

## 4. Frontend Architecture and Behavior

## 4.1 App bootstrap
File: `src/main.tsx`
- Renders `App` inside React `StrictMode`.

File: `src/App.tsx`
- Global shell, auth gating, profile/board view switching.
- Coordinates:
  - `useBetterAuthSession` for session + token readiness.
  - `useBoardStore.initializeFromRemote` when authenticated token is ready.
  - `useBoardStore.resetForSignOut` on logout/unauthed state.
- Handles keyboard undo/redo:
  - `Ctrl/Cmd + Z` -> undo
  - `Ctrl/Cmd + Shift + Z` -> redo

Core flow:
```tsx
if (!isAuthenticated) return <AuthPanel ... />;
if (isAuthenticated && !isTokenReady) return loading/error states;
return <BoardView /> or <AccountProfilePage />;
```

## 4.2 Board UI and drag/drop
File: `src/features/board/BoardView.tsx`
- Uses `@dnd-kit/core` and `@dnd-kit/sortable`.
- Maintains local drag preview state to show hover placement across columns before final drop commit.
- Implements search semantics:
  - Match task content.
  - Match column title and show all tasks in that column.
- Implements horizontal board scrolling with:
  - left/right buttons
  - shift+wheel horizontal behavior
  - edge mask fade effect

Drag lifecycle:
- `handleDragStart`: set active task/column preview.
- `handleDragOver`: update preview ordering map in-memory.
- `handleDragEnd`: finalize with store mutation (`moveTask` or `reorderColumns`).
- `handleDragCancel`: clear overlays and preview state.

## 4.3 Columns and tasks
File: `src/components/board/Column.tsx`
- Column title inline edit, task creation, delete column confirmation trigger.
- Uses `AutoTextarea` for task creation and local draft control.

File: `src/components/board/TaskCard.tsx`
- Task inline edit with debounced autosave.
- Uses `useOptimisticUpdate` with rollback snapshot.
- Uses `AsyncQueue(2)` to limit concurrent remote task saves.

Save path:
1. Local optimistic update (`updateTask` in store).
2. Debounced network mutation (`updateTaskRemote`).
3. On failure: rollback content + status message.

## 4.4 Account profile
File: `src/features/account/AccountProfilePage.tsx`
- Display name update.
- Avatar upload to Cloudinary + Convex user upsert.
- Better Auth profile mirror best-effort update.
- Password update (credential accounts).
- Account deletion with typed confirmation string.
- Contains Convex retry-on-unauthorized logic by refreshing Better Auth JWT.

## 4.5 Auth panel
File: `src/features/auth/AuthPanel.tsx`
- Sign in / sign up switch.
- OAuth provider buttons from env-driven provider list.
- Local form validation and selective message suppression for known OAuth noise patterns.

## 4.6 State model and persistence
File: `src/store/boardStore.ts`
- Single source of board state in normalized shape:
  - `tasks: Record<TaskId, Task>`
  - `columns: Record<ColumnId, Column>`
  - `columnOrder: ColumnId[]`
- Undo/redo via immutable snapshots.
- Persist middleware key: `kanban-board-storage`.
- Hydration validated by runtime guard (`toBoardState`).
- Remote sync functions:
  - bootstrap default board
  - fetch board
  - map to local state
  - reset history from remote snapshot

Mutation strategy:
- UI-first local update
- async remote mutation
- on backend error, store `remoteError` and re-sync from backend

Important behavior:
- create/delete operations avoid unnecessary success-path full re-sync to preserve undo/redo continuity.

## 4.7 Frontend infra utilities

File: `src/lib/authClient.ts`
- Better Auth client init (`createAuthClient`).
- Route JSON helpers with error payload parsing and sanitization.
- Token fetch with timeout from `/token`.
- OAuth provider parser from `VITE_BETTER_AUTH_OAUTH_PROVIDERS`.

File: `src/lib/convexClient.ts`
- Lazy singleton `ConvexHttpClient`.
- in-memory auth token cache + set/clear methods.

File: `src/lib/convexRefs.ts`
- Function references for all used Convex queries/mutations.

File: `src/lib/cloudinary.ts`
- Validates image type/size.
- Uploads unsigned image to Cloudinary endpoint.

File: `src/lib/taskApi.ts`
- Remote mutation wrapper for task content updates.

Hooks:
- `useBetterAuthSession`: session state + periodic token refresh + auth operations.
- `useDarkMode`: localStorage theme + prefers-color-scheme fallback + root class toggling.
- `useDebouncedCallback`: cancellation-safe timeout debouncer.
- `useOptimisticUpdate`: reusable optimistic mutation primitive.

## 4.8 UI system (shadcn usage)

The project uses a shadcn/ui-inspired component architecture rather than raw HTML controls spread across feature files.

Key implementation details:
- Primitive wrappers under `src/components/ui` are authored in the same style as shadcn components: typed React wrappers with composable className overrides.
- Variant-driven styling is implemented with `class-variance-authority` (`cva`) for components like `Button`, `Input`, and `IconButton`.
- Headless primitives from Radix UI are used where needed (for example `DropdownMenu`), then styled with Tailwind utility classes.
- Class composition is done with `clsx` to keep variant/state combinations readable and predictable.
- This keeps design tokens and interaction patterns centralized while allowing feature modules to compose UI rapidly.

Runtime guards:
- `src/utils/boardGuards.ts`: parse and validate persisted board shape.

Concurrency primitive:
- `src/utils/asyncQueue.ts`: bounded concurrency async queue.

## 5. Backend Architecture (Convex)

## 5.1 Schema
File: `convex/schema.ts`
Tables:
- App tables: `users`, `boards`, `columns`, `tasks`
- Better Auth tables: `sessions`, `accounts`, `verification`, `jwks`

Notable indexes:
- `users.by_email`, `users.by_token_identifier`
- `boards.by_ownerId_and_slug`
- `columns.by_board_position`
- `tasks.by_column_position`

## 5.2 Auth helpers
File: `convex/auth.ts`
- `getCurrentUserId(ctx)`
- `requireCurrentUserId(ctx)`

All secure board mutations route through this identity extraction.

## 5.3 Board functions
File: `convex/board.ts`

Private helpers:
- `getBoardByOwnerAndSlug`
- `getColumnsByBoard`
- `getTasksByColumn`
- `createDefaultBoard`
- `requireOwnedBoard`
- `requireOwnedColumn`
- `requireOwnedTask`
- `reindexColumns`
- `reindexTasksInColumn`
- `serializeBoard`

Public Convex functions:
- `bootstrapDefaultBoard` (mutation)
- `getBoard` (query)
- `addColumn` (mutation)
- `updateColumnTitle` (mutation)
- `deleteColumn` (mutation)
- `reorderColumns` (mutation)
- `addTask` (mutation)
- `updateTaskContent` (mutation)
- `deleteTask` (mutation)
- `moveTask` (mutation)

Authorization model:
- Every read/write is bound to `ownerId` resolved from auth identity.
- Cross-user and cross-board operations are blocked (`Forbidden`, ownership checks).

Ordering model:
- Uses position gaps (`POSITION_GAP = 1024`) for stable ordering and reindexing after destructive/move operations.

## 5.4 User functions
File: `convex/users.ts`

Helpers:
- `normalizeEmail`
- `normalizeAvatarUrl`

Public functions:
- `getCurrentUser` (query)
- `upsertCurrentUser` (mutation)
- `saveCurrentUserAvatar` (mutation)

Behavior notes:
- Resolves by `tokenIdentifier` first, falls back to normalized email.
- Consolidates duplicate email rows to canonical newest row.
- Validates avatar URL protocol (`http/https`).

## 5.5 Better Auth database bridge
File: `convex/authDb.ts`

Core helper functions:
- `modelToTable`
- `tableSupportsUpdatedAt`
- `isRelationalComparable`
- `getNestedString`
- `cmp`
- `matchesWhere`
- `project`
- `sanitizeForConvex`
- `normalizeCreateData`
- `normalizeUpdateData`
- `filterToSchemaFields`

Public bridge functions used by adapter:
- `create`
- `findMany`
- `findOne`
- `count`
- `update`
- `updateMany`
- `remove`
- `removeMany`

This file effectively emulates adapter-like model CRUD over Convex tables with where filters, pagination, select projection, and schema-field filtering.

## 5.6 Auth storage helper
File: `convex/authStorage.ts`
- `parseAuthTable`
- `createRecord`
- `getAllRecords`
- `updateRecord`
- `deleteRecord`

## 6. Better Auth Server/API Layer

## 6.1 Nested app auth route (serverless target)
File: `kanban-board/api/auth/[...handler].js`
- Dynamically imports `authConfig.mjs`.
- Wraps Better Auth node handler.
- Returns `null` session on get-session fallback path if init/runtime errors occur.

## 6.2 Better Auth configuration
File: `kanban-board/api/auth/authConfig.mjs`

Helper functions:
- `getCsvEnv`
- `getTrimmedEnv`
- `getRequiredEnv`
- `getConvexUrl`
- `resolveDefaultBaseUrl`
- `resolveTrustedOrigins`

Exports:
- `auth` (Better Auth instance)
- `baseURL`
- `jwtIssuer`

Plugins and settings:
- JWT plugin with `audience: "convex"`, `expirationTime: "15m"`
- Dash plugin
- email/password enabled
- optional Google OAuth from env vars
- account linking for trusted provider(s)
- rate-limit rules

Database adapter:
- `database: convexAdapter(convexClient)`

## 6.3 Convex adapter for Better Auth
File: `kanban-board/api/auth/convexAdapter.mjs`

Helpers:
- `sanitizeValue`
- `sanitizeWhere`
- `describeError`
- `throwAdapterError`

Export:
- `convexAdapter(convexClient)`

Adapter methods implemented:
- `create`
- `findOne`
- `findMany`
- `count`
- `update`
- `updateMany`
- `delete`
- `deleteMany`

`findOne` includes special user->account join enrichment logic and filtering for credential accounts with password material.

## 6.4 Optional storage adapter and Prisma utility
File: `kanban-board/api/auth/convexStorageAdapter.mjs`
- `convexStorageAdapter`
- `createMemoryOnlyAdapter`
- `createMemoryAdapter`
- `syncToConvex` (inner helper)

File: `kanban-board/api/auth/prismaClient.mjs`
- `createPrismaClient`
- global singleton export `prisma`

## 6.5 Root auth bridge for Vercel rewrite
File: `api/auth/[...handler].js` (root)

Functions:
- `writeJson`
- `mapAuthError`
- `authHandler` (default export)

Responsibilities:
- Import nested auth config/handler.
- Serve OIDC discovery and JWKS endpoints.
- Route auth errors to explicit structured diagnostics.

## 6.6 Standalone local auth server
Files:
- `better-auth-server/src/auth.mjs` exports `auth` from nested config.
- `better-auth-server/src/server.mjs` hosts `/api/auth`, OIDC metadata, JWKS mirror, health endpoint.

## 7. API Surface and Connections

## 7.1 Frontend -> Better Auth HTTP calls
From `src/lib/authClient.ts`:
- `GET /list-accounts`
- `POST /update-user`
- `POST /change-password`
- `POST /set-password` (fallback variants attempted)
- `POST /delete-user`
- `GET /token`

Also Better Auth client actions in `useBetterAuthSession`:
- `authClient.signIn.email`
- `authClient.signUp.email`
- `authClient.signIn.social`
- `authClient.signOut`
- `authClient.useSession`

## 7.2 Frontend -> Convex calls
All references in `src/lib/convexRefs.ts`:
- `board:getBoard`
- `board:bootstrapDefaultBoard`
- `board:addColumn`
- `board:updateColumnTitle`
- `board:deleteColumn`
- `board:reorderColumns`
- `board:addTask`
- `board:updateTaskContent`
- `board:deleteTask`
- `board:moveTask`
- `users:getCurrentUser`
- `users:upsertCurrentUser`
- `users:saveCurrentUserAvatar`

## 7.3 Better Auth adapter -> Convex calls
From `api/auth/convexAdapter.mjs`:
- `api.authDb.create`
- `api.authDb.findOne`
- `api.authDb.findMany`
- `api.authDb.count`
- `api.authDb.update`
- `api.authDb.updateMany`
- `api.authDb.remove`
- `api.authDb.removeMany`

## 8. Data Models and State Shapes

## 8.1 Frontend board state types
File: `src/types/board.ts`
- `TaskId` branded string
- `ColumnId` branded string
- `Task`
- `Column`
- `BoardState`
- `BoardAction` union

## 8.2 Remote board response shape
Defined in `src/store/boardStore.ts` as `RemoteBoardData`:
- `board` metadata
- normalized `state.tasks`, `state.columns`, `state.columnOrder`

## 8.3 Persisted local state validation
File: `src/utils/boardGuards.ts`
- Converts unknown persisted payload into safe `BoardState` or rejects.

## 9. Environment Variables

Frontend/runtime critical:
- `VITE_CONVEX_URL`
- `VITE_BETTER_AUTH_URL`
- `VITE_BETTER_AUTH_OAUTH_PROVIDERS`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`
- `VITE_CLOUDINARY_UPLOAD_FOLDER`

Auth server critical:
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_JWT_ISSUER`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `BETTER_AUTH_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Convex auth provider config:
- `CONVEX_BETTER_AUTH_DOMAIN` (used in `convex/auth.config.ts` fallback chain)

## 10. Scripts and Operational Commands

Root scripts (`package.json`):
- `dev`, `build`, `typecheck`, `lint`, `preview`
- `auth:dev`, `auth:start`
- `convex:dev`, `convex:deploy`, `convex:codegen`

App scripts (`kanban-board/package.json`):
- `dev`
- `build`
- `typecheck`
- `lint`
- `preview`
- `convex:dev`
- `convex:deploy`
- `convex:codegen`

## 11. Deployment Wiring

Root `vercel.json`:
- builds app from `kanban-board/`
- rewrites `/api/auth/:path*` -> `/api/auth/[...handler]`

App `kanban-board/vercel.json`:
- vite framework build settings for app-only deployment contexts

## 12. Complete Function Inventory

This section lists all significant functions/components/classes used by the running architecture.

Frontend exports:
- `App` (default)
- `BoardView`
- `AuthPanel`
- `AccountProfilePage`
- `Column`
- `SortableColumn`
- `TaskCard`
- `SortableTaskCard`
- `AutoTextarea`
- `Button`
- `Card`
- `Input`
- `IconButton`
- `Modal`
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
- `useBetterAuthSession`
- `useDarkMode`
- `useDebouncedCallback`
- `useOptimisticUpdate`
- `authClient`
- `sanitizeUserFacingErrorMessage`
- `listLinkedAccounts`
- `updateUserProfile`
- `changePassword`
- `setPassword`
- `deleteCurrentUser`
- `fetchConvexJwtToken`
- `getConfiguredOauthProviders`
- `hasConvexAuthToken`
- `getConvexClient`
- `setConvexAuthToken`
- `clearConvexAuthToken`
- `convexRefs`
- `uploadImageToCloudinary`
- `updateTaskRemote`
- `useBoardStore`
- `AsyncQueue`
- `toBoardState`
- `isValidBoardState`
- `createTaskId`
- `createColumnId`

Backend exports (Convex):
- `getCurrentUserId`
- `requireCurrentUserId`
- `bootstrapDefaultBoard`
- `getBoard`
- `addColumn`
- `updateColumnTitle`
- `deleteColumn`
- `reorderColumns`
- `addTask`
- `updateTaskContent`
- `deleteTask`
- `moveTask`
- `getCurrentUser`
- `upsertCurrentUser`
- `saveCurrentUserAvatar`
- `authDb.create`
- `authDb.findMany`
- `authDb.findOne`
- `authDb.count`
- `authDb.update`
- `authDb.updateMany`
- `authDb.remove`
- `authDb.removeMany`
- `authStorage.createRecord`
- `authStorage.getAllRecords`
- `authStorage.updateRecord`
- `authStorage.deleteRecord`

Auth API exports:
- `api/auth/[...handler].js` (nested) -> default `authHandler`
- `api/auth/authConfig.mjs` -> `auth`, `baseURL`, `jwtIssuer`
- `api/auth/convexAdapter.mjs` -> `convexAdapter`
- `api/auth/convexStorageAdapter.mjs` -> `convexStorageAdapter`
- `api/auth/prismaClient.mjs` -> `prisma`
- root `api/auth/[...handler].js` -> default `authHandler`
- `better-auth-server/src/auth.mjs` -> `auth`

## 13. High-Value Implementation Snippets

### 13.1 Token sync into Convex client
```ts
const token = await fetchConvexJwtToken();
if (!token) throw new Error("Failed to fetch Better Auth JWT token for Convex.");
setConvexAuthToken(token);
```

### 13.2 Owner-scoped board fetch
```ts
const ownerId = await requireCurrentUserId(ctx);
const board = await getBoardByOwnerAndSlug(ctx, ownerId, slug);
```

### 13.3 Optimistic task edit with rollback
```ts
const snapshot = current?.content ?? task.content;
updateTask(task.id, { content: nextContent });
// on error:
setContent(snapshot);
updateTask(task.id, { content: snapshot });
```

### 13.4 Drag preview commit on drop
```ts
const toColumnId = findColumnIdByTaskIdFromPreview(dragTaskIdsByColumn, taskId);
if (toColumnId) {
  const toIndex = previewTaskIds.indexOf(taskId);
  moveTask(taskId, fromColumn.id, toColumnId, toIndex);
}
```

## 14. Failure Modes and Recovery Patterns

Auth failures:
- Session init/runtime failures in serverless handler return diagnostic JSON.
- `get-session` route is made resilient by returning `null` on certain auth failures.
- Frontend sanitizes backend-heavy error text before rendering.

Token failures:
- Retry loop with backoff on token fetch.
- Preserve existing token on transient refresh failure to avoid auth flapping.
- Clear auth after consecutive failures threshold.

Data mutation failures:
- Store records `remoteError`.
- Trigger remote sync to recover consistency.
- Optimistic UI rollbacks in task editing.

## 15. What Makes This Architecture Strong

- Clear separation of concerns: UI/store/auth/backend adapters.
- Owner-scoped backend authorization (not client-trusted user identity).
- Good UX under network issues via optimistic updates and retries.
- Explicit token sync bridge between Better Auth and Convex.
- Typed normalized board model and validated persisted hydration.
- Works in both local standalone auth mode and Vercel serverless mode.

## 16. Optional Improvements

- Add E2E tests for drag reorder, auth refresh recovery, and account delete scenarios.
- Add API contract docs for Better Auth custom route responses.
- Add metrics/logging around auth adapter failures and sync retries.
- Add formal architecture diagram image to this file.
