import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function getCurrentUserId(ctx: MutationCtx | QueryCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? null;
}

export async function requireCurrentUserId(ctx: MutationCtx | QueryCtx): Promise<string> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}
