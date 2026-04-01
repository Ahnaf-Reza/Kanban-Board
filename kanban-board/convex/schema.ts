import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    subject: v.string(),
    issuer: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

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
});
