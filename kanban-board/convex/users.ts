import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function normalizeEmail(email: string | null | undefined): string | undefined {
  if (typeof email !== "string") {
    return undefined;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (typeof avatarUrl !== "string") {
    return undefined;
  }

  const trimmed = avatarUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
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
    const nextAvatarUrl = normalizeAvatarUrl(args.avatarUrl) ?? normalizeAvatarUrl(identity.pictureUrl);

    if (existing) {
      await ctx.db.patch(existing._id, {
        id: identity.subject,
        tokenIdentifier: identity.tokenIdentifier,
        subject: identity.subject,
        issuer: identity.issuer,
        email: normalizedEmail ?? existing.email ?? "",
        emailVerified: true,
        image: nextAvatarUrl,
        name: nextName ?? existing.name ?? "",
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      id: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      subject: identity.subject,
      issuer: identity.issuer,
      email: normalizedEmail ?? "",
      emailVerified: true,
      image: nextAvatarUrl,
      name: nextName ?? "",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveCurrentUserAvatar = mutation({
  args: {
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const normalizedAvatarUrl = normalizeAvatarUrl(args.avatarUrl);
    if (!normalizedAvatarUrl) {
      throw new Error("Please provide a valid HTTP(S) image URL.");
    }

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
        existing = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        image: normalizedAvatarUrl,
        avatarUrl: normalizedAvatarUrl,
        updatedAt: now,
      });
      return normalizedAvatarUrl;
    }

    await ctx.db.insert("users", {
      id: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      subject: identity.subject,
      issuer: identity.issuer,
      email: normalizedEmail ?? "",
      emailVerified: true,
      image: normalizedAvatarUrl,
      avatarUrl: normalizedAvatarUrl,
      name: identity.name ?? "",
      createdAt: now,
      updatedAt: now,
    });

    return normalizedAvatarUrl;
  },
});
