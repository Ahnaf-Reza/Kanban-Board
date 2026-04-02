import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// User operations
export const getUser = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.id))
      .first();
    return user || null;
  },
});

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    return user || null;
  },
});

export const createUser = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    tokenIdentifier: v.string(),
    subject: v.string(),
    issuer: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      tokenIdentifier: args.tokenIdentifier,
      subject: args.subject,
      issuer: args.issuer,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
    return userId;
  },
});

export const updateUser = mutation({
  args: {
    id: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id as any, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Session operations
export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("token"), args.token))
      .first();
    return session || null;
  },
});

export const createSession = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      token: args.token,
      userId: args.userId as any,
      expiresAt: args.expiresAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: now,
      updatedAt: now,
    });
    return sessionId;
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

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;
    if (args.ipAddress !== undefined) updates.ipAddress = args.ipAddress;
    if (args.userAgent !== undefined) updates.userAgent = args.userAgent;

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

// Account operations
export const getAccount = query({
  args: { userId: v.string(), providerId: v.string(), accountId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .filter(
        (q) =>
          q.and(
            q.and(
              q.eq(q.field("userId"), args.userId),
              q.eq(q.field("providerId"), args.providerId),
            ),
            q.eq(q.field("accountId"), args.accountId),
          ),
      )
      .first();
    return account || null;
  },
});

export const listAccounts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();
    return accounts;
  },
});

export const createAccount = mutation({
  args: {
    userId: v.string(),
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
    const now = Date.now();
    const accountId = await ctx.db.insert("accounts", {
      userId: args.userId as any,
      accountId: args.accountId,
      providerId: args.providerId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      idToken: args.idToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      refreshTokenExpiresAt: args.refreshTokenExpiresAt,
      scope: args.scope,
      password: args.password,
      createdAt: now,
      updatedAt: now,
    });
    return accountId;
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
      .filter(
        (q) =>
          q.and(
            q.and(
              q.eq(q.field("userId"), args.userId),
              q.eq(q.field("providerId"), args.providerId),
            ),
            q.eq(q.field("accountId"), args.accountId),
          ),
      )
      .first();
    if (!account) return null;

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.accessToken !== undefined) updates.accessToken = args.accessToken;
    if (args.refreshToken !== undefined) updates.refreshToken = args.refreshToken;
    if (args.idToken !== undefined) updates.idToken = args.idToken;
    if (args.accessTokenExpiresAt !== undefined)
      updates.accessTokenExpiresAt = args.accessTokenExpiresAt;
    if (args.refreshTokenExpiresAt !== undefined)
      updates.refreshTokenExpiresAt = args.refreshTokenExpiresAt;
    if (args.scope !== undefined) updates.scope = args.scope;
    if (args.password !== undefined) updates.password = args.password;

    await ctx.db.patch(account._id, updates);
    return account._id;
  },
});

export const deleteAccount = mutation({
  args: { userId: v.string(), providerId: v.string(), accountId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .filter(
        (q) =>
          q.and(
            q.and(
              q.eq(q.field("userId"), args.userId),
              q.eq(q.field("providerId"), args.providerId),
            ),
            q.eq(q.field("accountId"), args.accountId),
          ),
      )
      .first();
    if (account) {
      await ctx.db.delete(account._id);
    }
  },
});

// Verification operations
export const getVerification = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("verification")
      .filter((q) => q.eq(q.field("identifier"), args.identifier))
      .first();
    return verification || null;
  },
});

export const createVerification = mutation({
  args: {
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const verificationId = await ctx.db.insert("verification", {
      identifier: args.identifier,
      value: args.value,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return verificationId;
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
