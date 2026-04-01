# Production Deployment Guide

You now have a fully automated setup. Here's how to finalize production deployment:

## Step 1: Get Your Vercel Project URL

1. Go to your Vercel project dashboard: https://vercel.com
2. Find your Kanban Board project
3. Copy your production URL (e.g., `https://my-kanban-board.vercel.app`)

## Step 2: Set Environment Variables in Vercel

In your Vercel project settings, go to **Settings → Environment Variables** and add these:

| Name | Value | Where to get it |
|------|-------|-----------------|
| `VITE_CONVEX_URL` | `https://rare-squirrel-171.convex.cloud` | From earlier deploy ✅ |
| `VITE_BETTER_AUTH_URL` | `https://YOUR_VERCEL_PROJECT.vercel.app/api/auth` | From Step 1 above |
| `BETTER_AUTH_SECRET` | Use the random value you generated earlier | Save in password manager! |
| `BETTER_AUTH_JWT_ISSUER` | `https://YOUR_VERCEL_PROJECT.vercel.app/api/auth` | Same as VITE_BETTER_AUTH_URL |
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID | From Google Console |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret | From Google Console |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `https://YOUR_VERCEL_PROJECT.vercel.app` | From Step 1 above |

**Replace `YOUR_VERCEL_PROJECT` with your actual domain** (e.g., `kanban-board-ahnaf.vercel.app`)

## Step 3: Update Convex Auth Config (Production URL)

Now update Convex to know about your production auth server:

```bash
# From the kanban-board directory
npm run convex:deploy
```

When prompted, say **Yes** to deploy to production.

This will deploy with the temporary tunnel URL. After Vercel redeploys (Step 4), we'll update it to the real production URL.

## Step 4: Redeploy Frontend to Vercel

Now trigger a fresh Vercel deployment so it picks up the new environment variables:

**Option A (Easiest):** Push a new commit to GitHub:
```bash
git add kanban-board/.env.production vercel.json
git commit -m "Deploy Better Auth to Vercel"
git push origin main
```
Vercel will auto-redeploy.

**Option B:** Redeploy manually in Vercel dashboard → Deployments → "Redeploy"

Wait for the deployment to complete (check the Deployments tab).

## Step 5: Get Your Production Auth URL and Update Convex Again

Once Vercel finishes deploying:

1. Go to your Vercel project deployment logs
2. Verify that the `/api/auth` endpoint is working by visiting:
   ```
   https://YOUR_VERCEL_PROJECT.vercel.app/api/auth/get-session
   ```
   You should see a JSON response (even if it says `session: null`)

3. Now update Convex to use this production auth URL:

**Create a `.env` file in `kanban-board/` temporarily:**
```bash
CONVEX_BETTER_AUTH_DOMAIN=https://YOUR_VERCEL_PROJECT.vercel.app/api/auth
```

**Then redeploy:**
```bash
npm run convex:deploy
```

Say **Yes** again when prompted.

4. **Remove that temporary `.env` file afterward:**
   ```bash
   rm kanban-board/.env
   ```

## Step 6: Test End-to-End

1. Visit your Vercel project: `https://YOUR_VERCEL_PROJECT.vercel.app`
2. Try to sign up with email/password
3. Try to sign in with Google
4. Create a board and add a task
5. Check Convex dashboard → Data to see your boards in production

## Troubleshooting

**"AuthProviderDiscoveryFailed" in frontend?**
- Convex can't reach your auth server's OIDC config
- Check that env var `BETTER_AUTH_JWT_ISSUER` and `VITE_BETTER_AUTH_URL` match exactly
- Verify Vercel endpoint is reachable: `https://YOUR_VERCEL_PROJECT.vercel.app/.well-known/openid-configuration`

**"Failed to fetch" from frontend?**
- `VITE_BETTER_AUTH_URL` in Vercel env doesn't match actual deployment URL
- Double-check it matches your Vercel domain exactly

**Sign-ups work but can't create boards?**
- Better Auth server might not have access to Convex URL in its env
- Verify `VITE_CONVEX_URL` is set in Vercel env vars

## What's Running Where Now

| Component | Location | Update When |
|-----------|----------|-------------|
| Frontend (React/Vite) | Vercel | Automatic on git push |
| Better Auth Server | Vercel `/api/auth` | Automatic on Vercel redeploy |
| Convex Backend | Convex Cloud `rare-squirrel-171` | Manual: `npm run convex:deploy` |

## Summary

- ✅ Convex backend functions deployed to production
- ✅ Better Auth server migrated to Vercel serverless
- ✅ Frontend builds and deploys to Vercel
- 🔄 Next: Set Vercel env vars and redeploy
- 🔄 Then: Update Convex auth config with production URL
