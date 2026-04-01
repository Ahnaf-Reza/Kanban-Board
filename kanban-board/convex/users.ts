import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function normalizeEmail(email: string | null | undefined): string | undefined {
  if (typeof email !== "string") {
    return undefined;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const byToken = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (byToken) {
      return byToken;
    }

    const normalizedEmail = normalizeEmail(identity.email);
    if (!normalizedEmail) {
      return null;
    }

    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();

    if (byEmail.length === 0) {
      return null;
    }

    return byEmail.sort((a, b) => b.updatedAt - a.updatedAt)[0];
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
    const normalizedEmail = normalizeEmail(identity.email);

    let existing = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!existing && normalizedEmail) {
      const matches = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .collect();

      if (matches.length > 0) {
        const sorted = matches.sort((a, b) => b.updatedAt - a.updatedAt);
        existing = sorted[0];

        // Keep a single canonical user row for each email to avoid duplicate accounts.
        for (const duplicate of sorted.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    }

    const nextName = args.name ?? identity.name ?? undefined;
    const nextAvatarUrl = args.avatarUrl ?? identity.pictureUrl ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        tokenIdentifier: identity.tokenIdentifier,
        subject: identity.subject,
        issuer: identity.issuer,
        email: normalizedEmail,
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
      email: normalizedEmail,
      name: nextName,
      avatarUrl: nextAvatarUrl,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
  },
});
