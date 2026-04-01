# Better Auth Server

This server provides Better Auth routes for the Kanban frontend and Convex JWT integration.

## 1) Configure environment

Copy `.env.example` to `.env` and fill values.

Required for Google OAuth:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Required for Convex JWT trust:
- `BETTER_AUTH_URL` (must match Convex issuer domain)
- `BETTER_AUTH_SECRET`

## 2) Run

```bash
npm install
npm run dev
```

Server endpoints:
- `http://localhost:3000/api/auth/get-session`
- `http://localhost:3000/api/auth/token`

## 3) Dashboard connect form

Use:
- Base URL: `http://localhost:3000`
- Base Path: `/api/auth`

## 4) Google redirect URI

Add this in Google Cloud OAuth client:
- `http://localhost:3000/api/auth/callback/google`
