import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const storageCreate = action({
  args: {
    table: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const { table, data } = args;
    return await ctx.runMutation(api.authStorage.createRecord, { table, data });
  },
});

export const storageRead = action({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(api.authStorage.getAllRecords, { table: args.table });
  },
});

export const storageUpdate = action({
  args: {
    table: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(api.authStorage.updateRecord, {
      table: args.table,
      data: args.data,
    });
  },
});

export const storageDelete = action({
  args: {
    table: v.string(),
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.authStorage.deleteRecord, { table: args.table, id: args.id });
    return { success: true };
  },
});
