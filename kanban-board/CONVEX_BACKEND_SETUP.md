# Convex Backend Setup For This Project

This repository now contains a Convex backend scaffold in the `convex/` folder.

## What Is Already Added

- Convex schema: `convex/schema.ts`
- Board backend functions: `convex/board.ts`
- Auth utility for future login work: `convex/auth.ts`
- Auth provider config placeholder: `convex/auth.config.ts`
- User backend functions: `convex/users.ts`
- Convex scripts in `package.json`
- Convex package dependency (`convex`)
- Environment template: `.env.example`

## 1) Steps You Must Do Outside VS Code

Run these commands in a terminal from the `kanban-board/` directory:

```bash
npm run convex:dev
```

On first run, Convex CLI will:

1. Ask you to log in via browser.
2. Ask to create/select a Convex project.
3. Generate `convex/_generated/*` files.
4. Print your deployment URL.

Then create `.env.local` with your real URL:

```env
VITE_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
```

To deploy functions/schema to production later:

```bash
npm run convex:deploy
```

## 2) Backend API Added (Ready To Use)

Functions in `convex/board.ts`:

- `bootstrapDefaultBoard` (mutation)
- `getBoard` (query)
- `addColumn` (mutation)
- `deleteColumn` (mutation)
- `reorderColumns` (mutation)
- `addTask` (mutation)
- `updateTaskContent` (mutation)
- `deleteTask` (mutation)
- `moveTask` (mutation)

The schema is normalized and supports ordered columns/tasks.

User/Auth functions in `convex/users.ts`:

- `getCurrentUser` (query)
- `upsertCurrentUser` (mutation)

## 3) Minimal Frontend Integration (When You Are Ready)

Add provider in `src/main.tsx`:

```tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
```

Then in a component/hook:

```tsx
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const board = useQuery(api.board.getBoard, { slug: "default" });
const bootstrap = useMutation(api.board.bootstrapDefaultBoard);
```

## 4) Login Later: What New Stuff You Need

When you implement authentication, add these pieces:

1. Auth provider integration in frontend (Clerk/Auth0/NextAuth/etc).
2. Update `convex/auth.config.ts` with your real auth provider issuer and audience.
3. Use `ConvexProviderWithAuth` in frontend so Convex receives access tokens.
4. Call `upsertCurrentUser` right after successful login (or on app bootstrap) to keep profile in sync.
5. Replace open board access with user-scoped access:
  - Set `ownerId` on board creation from identity tokenIdentifier.
   - Filter `getBoard` by owner + slug.
   - Validate owner in every mutation before changing board/task data.
6. Add route guards in frontend (optional if app is private-only UI).

## 6) Better Auth Setup (Implemented In Frontend)

This project now expects Better Auth as the identity provider and Convex as the application database.

### Required Better Auth server features

1. Email/password enabled for sign-up and sign-in.
2. OAuth providers enabled (for example Google/GitHub).
3. JWT plugin enabled in Better Auth so authenticated sessions can call `GET /api/auth/token`.
4. JWT `aud` claim must be `convex` (matches `applicationID` in `convex/auth.config.ts`).
5. JWT issuer must match your Better Auth base URL used by Convex domain discovery.

### Convex auth config

Set `convex/auth.config.ts` provider values to your Better Auth deployment:

- `domain`: your Better Auth issuer URL (example `https://auth.example.com/api/auth`)
- `applicationID`: `convex`

After updating auth config, run:

```bash
npm run convex:dev
```

### Frontend env vars

Create/update `.env.local`:

```env
VITE_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
VITE_BETTER_AUTH_URL=http://localhost:3000/api/auth
VITE_BETTER_AUTH_OAUTH_PROVIDERS=google,github
```

### Runtime flow now used by this app

1. User signs in/signs up with Better Auth (email/password or OAuth).
2. Frontend requests `GET /token` from Better Auth (JWT plugin endpoint).
3. Frontend passes JWT access token to Convex client with `setAuth`.
4. Convex validates JWT using Better Auth JWKS and auth config.
5. Board reads/writes are owner-scoped in Convex by authenticated `tokenIdentifier`.
6. Token refresh is handled by Better Auth session cookies and periodic token sync.

## 5) Suggested Migration Strategy

To avoid breaking your current app while moving from Zustand-persisted local data:

1. Keep existing store for UI interactions.
2. Replace mutation internals one by one with Convex mutations.
3. Switch board hydration source to Convex query.
4. Remove localStorage persist once Convex is source of truth.

This incremental path reduces risk and keeps drag/drop behavior stable while backend rolls in.
