import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// User operations
export const createUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    subject: v.string(),
    issuer: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  },
});

export const getUserByToken = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier)
      )
      .first();
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    await ctx.db.patch(userId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(userId);
  },
});

// Session operations
export const createSession = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getSessionByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
  },
});

export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// Account operations
export const createAccount = mutation({
  args: {
    userId: v.id("users"),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getAccountsByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Verification operations
export const createVerification = mutation({
  args: {
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("verification", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getVerificationByIdentifier = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verification")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.identifier))
      .first();
  },
});

export const deleteVerification = mutation({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("verification")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.identifier))
      .first();
    if (verification) {
      await ctx.db.delete(verification._id);
    }
  },
});

// JWKS operations
export const createJwks = mutation({
  args: {
    publicKey: v.string(),
    privateKey: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jwks", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getLatestJwks = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("jwks")
      .order("desc")
      .first();
  },
});

// ============================================================
// Better Auth adapter functions
// ============================================================

export const createUser = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      _id: args.id,
      id: args.id,
      name: args.name,
      email: args.email,
      emailVerified: args.emailVerified,
      image: args.image,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getUserById = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.userId))
      .first();
  },
});

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
  },
});

export const updateUser = mutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.userId))
      .first();

    if (!user) return null;

    const updates = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.emailVerified !== undefined) updates.emailVerified = args.emailVerified;
    if (args.image !== undefined) updates.image = args.image;
    updates.updatedAt = Date.now();

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});

export const deleteUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.userId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), args.token))
      .first();
  },
});

export const createSession = mutation({
  args: {
    id: v.string(),
    token: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      _id: args.id,
      token: args.token,
      userId: args.userId,
      expiresAt: args.expiresAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateSession = mutation({
  args: {
    token: v.string(),
    expiresAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), args.token))
      .first();

    if (!session) return null;

    const updates = {};
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;
    if (args.ipAddress !== undefined) updates.ipAddress = args.ipAddress;
    if (args.userAgent !== undefined) updates.userAgent = args.userAgent;
    updates.updatedAt = Date.now();

    await ctx.db.patch(session._id, updates);
    return session._id;
  },
});

export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

export const getAccount = query({
  args: {
    userId: v.string(),
    providerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.and(
            q.eq(q.field("providerId"), args.providerId),
            q.eq(q.field("accountId"), args.accountId)
          )
        )
      )
      .first();
  },
});

export const listAccounts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();
  },
});

export const createAccount = mutation({
  args: {
    id: v.string(),
    accountId: v.string(),
    userId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", {
      _id: args.id,
      accountId: args.accountId,
      userId: args.userId,
      providerId: args.providerId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      idToken: args.idToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      refreshTokenExpiresAt: args.refreshTokenExpiresAt,
      scope: args.scope,
      password: args.password,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateAccount = mutation({
  args: {
    userId: v.string(),
    providerId: v.string(),
    accountId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.and(
            q.eq(q.field("providerId"), args.providerId),
            q.eq(q.field("accountId"), args.accountId)
          )
        )
      )
      .first();

    if (!account) return null;

    const updates = {};
    if (args.accessToken !== undefined) updates.accessToken = args.accessToken;
    if (args.refreshToken !== undefined) updates.refreshToken = args.refreshToken;
    if (args.idToken !== undefined) updates.idToken = args.idToken;
    if (args.accessTokenExpiresAt !== undefined)
      updates.accessTokenExpiresAt = args.accessTokenExpiresAt;
    if (args.refreshTokenExpiresAt !== undefined)
      updates.refreshTokenExpiresAt = args.refreshTokenExpiresAt;
    if (args.scope !== undefined) updates.scope = args.scope;
    if (args.password !== undefined) updates.password = args.password;
    updates.updatedAt = Date.now();

    await ctx.db.patch(account._id, updates);
    return account._id;
  },
});

export const deleteAccount = mutation({
  args: {
    userId: v.string(),
    providerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.and(
            q.eq(q.field("providerId"), args.providerId),
            q.eq(q.field("accountId"), args.accountId)
          )
        )
      )
      .first();

    if (account) {
      await ctx.db.delete(account._id);
    }
  },
});

export const getVerification = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verification")
      .filter((q) => q.eq(q.field("identifier"), args.identifier))
      .first();
  },
});

export const createVerification = mutation({
  args: {
    id: v.string(),
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("verification", {
      _id: args.id,
      identifier: args.identifier,
      value: args.value,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const deleteVerification = mutation({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("verification")
      .filter((q) => q.eq(q.field("identifier"), args.identifier))
      .first();

    if (verification) {
      await ctx.db.delete(verification._id);
    }
  },
});
