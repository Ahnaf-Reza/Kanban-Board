import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

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
    const { table, data } = args;
    return await ctx.db.insert(table as any, {
      ...data,
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
    return await ctx.db.query(args.table as any).collect();
  },
});

export const updateRecord = mutation({
  args: {
    table: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const { table, data } = args;
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
    await ctx.db.delete(args.id as any);
  },
});
