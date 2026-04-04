import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

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
    const nextAvatarUrl = args.avatarUrl ?? existing?.image ?? identity.pictureUrl ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        id: identity.subject,
        tokenIdentifier: identity.tokenIdentifier,
        subject: identity.subject,
        issuer: identity.issuer,
        email: normalizedEmail ?? existing.email ?? "",
        emailVerified: true,
        image: nextAvatarUrl,
        avatarUrl: nextAvatarUrl,
        avatarStorageId: existing.avatarStorageId,
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
      avatarUrl: nextAvatarUrl,
      name: nextName ?? "",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateCurrentUserProfile = mutation({
  args: {
    name: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const normalizedEmail = normalizeEmail(identity.email) ?? "";

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

        for (const duplicate of sorted.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }
      }
    }

    let nextAvatarUrl = existing?.image ?? identity.pictureUrl ?? undefined;
    let nextAvatarStorageId = existing?.avatarStorageId as Id<"_storage"> | undefined;

    if (args.avatarStorageId) {
      const resolvedUrl = await ctx.storage.getUrl(args.avatarStorageId);
      if (!resolvedUrl) {
        throw new Error("Uploaded profile image is unavailable.");
      }
      nextAvatarUrl = resolvedUrl;
      nextAvatarStorageId = args.avatarStorageId;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        id: identity.subject,
        tokenIdentifier: identity.tokenIdentifier,
        subject: identity.subject,
        issuer: identity.issuer,
        email: normalizedEmail || existing.email || "",
        emailVerified: true,
        name: args.name,
        image: nextAvatarUrl,
        avatarUrl: nextAvatarUrl,
        avatarStorageId: nextAvatarStorageId,
        updatedAt: now,
      });

      return {
        name: args.name,
        avatarUrl: nextAvatarUrl ?? null,
      };
    }

    await ctx.db.insert("users", {
      id: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      subject: identity.subject,
      issuer: identity.issuer,
      email: normalizedEmail,
      emailVerified: true,
      name: args.name,
      image: nextAvatarUrl,
      avatarUrl: nextAvatarUrl,
      avatarStorageId: nextAvatarStorageId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      name: args.name,
      avatarUrl: nextAvatarUrl ?? null,
    };
  },
});
