import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type AuthTable = "users" | "sessions" | "accounts" | "verification" | "jwks";

function parseAuthTable(table: string): AuthTable {
  const normalized = table.toLowerCase();
  if (normalized === "users" || normalized === "user") return "users";
  if (normalized === "sessions" || normalized === "session") return "sessions";
  if (normalized === "accounts" || normalized === "account") return "accounts";
  if (normalized === "verification" || normalized === "verifications") return "verification";
  if (normalized === "jwks" || normalized === "jwk") return "jwks";
  throw new Error(`Unsupported auth table: ${table}`);
}

/**
 * Public storage functions for Better Auth adapter
 * These are exposed via HTTP API for the auth handler
 */

export const createRecord = mutation({
  args: {
    table: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const table = parseAuthTable(args.table);
    return await ctx.db.insert(table, {
      ...(args.data as Record<string, unknown>),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getAllRecords = query({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query(parseAuthTable(args.table)).collect();
  },
});

export const updateRecord = mutation({
  args: {
    table: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    parseAuthTable(args.table);
    const data = args.data as Record<string, unknown>;
    if (!data.id && !data._id) {
      throw new Error("Record must have id or _id field");
    }
    const id = data.id || data._id;
    const { id: _, _id: __, ...updates } = data;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const deleteRecord = mutation({
  args: {
    table: v.string(),
    id: v.id("users"), // Generic ID type
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
