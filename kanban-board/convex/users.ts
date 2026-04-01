import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});

export const upsertCurrentUser = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    const nextName = args.name ?? identity.name ?? undefined;
    const nextAvatarUrl = args.avatarUrl ?? identity.pictureUrl ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        subject: identity.subject,
        issuer: identity.issuer,
        email: identity.email ?? undefined,
        name: nextName,
        avatarUrl: nextAvatarUrl,
        updatedAt: now,
        lastSeenAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      subject: identity.subject,
      issuer: identity.issuer,
      email: identity.email ?? undefined,
      name: nextName,
      avatarUrl: nextAvatarUrl,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
  },
});
