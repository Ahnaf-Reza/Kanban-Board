import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    id: v.string(),
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
    subject: v.optional(v.string()),
    issuer: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_token_identifier", ["tokenIdentifier"]),

  boards: defineTable({
    slug: v.string(),
    title: v.string(),
    ownerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerId_and_slug", ["ownerId", "slug"]),

  columns: defineTable({
    boardId: v.id("boards"),
    title: v.string(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_position", ["boardId", "position"]),

  tasks: defineTable({
    boardId: v.id("boards"),
    columnId: v.id("columns"),
    content: v.string(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_column_position", ["columnId", "position"]),

  sessions: defineTable({
    id: v.string(),
    token: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  accounts: defineTable({
    id: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  verification: defineTable({
    id: v.string(),
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier", ["identifier"]),

  jwks: defineTable({
    id: v.string(),
    publicKey: v.string(),
    privateKey: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  }),
});
