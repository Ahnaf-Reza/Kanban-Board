import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const whereOp = v.union(
  v.literal("eq"),
  v.literal("ne"),
  v.literal("lt"),
  v.literal("lte"),
  v.literal("gt"),
  v.literal("gte"),
  v.literal("in"),
  v.literal("not_in"),
  v.literal("contains"),
  v.literal("starts_with"),
  v.literal("ends_with")
);

const whereItem = v.object({
  field: v.string(),
  value: v.any(),
  operator: v.optional(whereOp),
  connector: v.optional(v.union(v.literal("AND"), v.literal("OR"))),
});

function modelToTable(model: string): string {
  const normalized = model.toLowerCase();
  if (normalized === "user" || normalized === "users") return "users";
  if (normalized === "session" || normalized === "sessions") return "sessions";
  if (normalized === "account" || normalized === "accounts") return "accounts";
  if (normalized === "verification" || normalized === "verifications") return "verification";
  if (normalized === "jwks" || normalized === "jwk") return "jwks";
  throw new Error(`Unsupported auth model: ${model}`);
}

function cmp(fieldValue: any, operator: string, value: any): boolean {
  if (operator === "eq") return fieldValue === value;
  if (operator === "ne") return fieldValue !== value;
  if (operator === "lt") return fieldValue < value;
  if (operator === "lte") return fieldValue <= value;
  if (operator === "gt") return fieldValue > value;
  if (operator === "gte") return fieldValue >= value;
  if (operator === "in") return Array.isArray(value) && value.includes(fieldValue);
  if (operator === "not_in") return Array.isArray(value) && !value.includes(fieldValue);
  if (operator === "contains") return typeof fieldValue === "string" && typeof value === "string" && fieldValue.includes(value);
  if (operator === "starts_with") return typeof fieldValue === "string" && typeof value === "string" && fieldValue.startsWith(value);
  if (operator === "ends_with") return typeof fieldValue === "string" && typeof value === "string" && fieldValue.endsWith(value);
  return fieldValue === value;
}

function matchesWhere(row: Record<string, any>, where?: Array<Record<string, any>>): boolean {
  if (!where || where.length === 0) return true;

  let acc = true;
  for (let i = 0; i < where.length; i += 1) {
    const clause = where[i];
    const operator = clause.operator ?? "eq";
    const connector = clause.connector ?? "AND";
    const current = cmp(row[clause.field], operator, clause.value);

    if (i === 0) {
      acc = current;
    } else if (connector === "OR") {
      acc = acc || current;
    } else {
      acc = acc && current;
    }
  }

  return acc;
}

function project(row: Record<string, any>, select?: string[]): Record<string, any> {
  if (!select || select.length === 0) return row;
  const out: Record<string, any> = {};
  for (const key of select) {
    out[key] = row[key];
  }
  return out;
}

function sanitizeForConvex(value: any): any {
  if (value === null || typeof value === "undefined") {
    return undefined;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForConvex(item))
      .filter((item) => typeof item !== "undefined");
  }

  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value)) {
      const sanitized = sanitizeForConvex(nested);
      if (typeof sanitized !== "undefined") {
        out[key] = sanitized;
      }
    }
    return out;
  }

  return value;
}

export const create = mutation({
  args: {
    model: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const data = sanitizeForConvex({ ...(args.data as Record<string, any>) });

    const now = Date.now();
    if (typeof data.createdAt === "undefined") data.createdAt = now;
    if (typeof data.updatedAt === "undefined") data.updatedAt = now;

    const insertedId = await ctx.db.insert(table, data);
    const row = await ctx.db.get(insertedId as any);
    return row;
  },
});

export const findMany = query({
  args: {
    model: v.string(),
    where: v.optional(v.array(whereItem)),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.object({ field: v.string(), direction: v.union(v.literal("asc"), v.literal("desc")) })),
    select: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();

    const filtered = rows.filter((row: any) => matchesWhere(row, args.where as any));

    if (args.sortBy) {
      const { field, direction } = args.sortBy;
      filtered.sort((a: any, b: any) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        const ord = av < bv ? -1 : 1;
        return direction === "desc" ? -ord : ord;
      });
    }

    const offset = args.offset ?? 0;
    const limit = args.limit ?? filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return paged.map((row: any) => project(row, args.select));
  },
});

export const findOne = query({
  args: {
    model: v.string(),
    where: v.array(whereItem),
    select: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();
    const found = rows.find((row: any) => matchesWhere(row, args.where as any));
    if (!found) return null;
    return project(found, args.select);
  },
});

export const count = query({
  args: {
    model: v.string(),
    where: v.optional(v.array(whereItem)),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();
    return rows.filter((row: any) => matchesWhere(row, args.where as any)).length;
  },
});

export const update = mutation({
  args: {
    model: v.string(),
    where: v.array(whereItem),
    update: v.any(),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();
    const found = rows.find((row: any) => matchesWhere(row, args.where as any));
    if (!found) return null;

    const patch = sanitizeForConvex({ ...(args.update as Record<string, any>), updatedAt: Date.now() });
    await ctx.db.patch(found._id, patch);
    return await ctx.db.get(found._id);
  },
});

export const updateMany = mutation({
  args: {
    model: v.string(),
    where: v.array(whereItem),
    update: v.any(),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();
    const matches = rows.filter((row: any) => matchesWhere(row, args.where as any));
    const patch = sanitizeForConvex({ ...(args.update as Record<string, any>), updatedAt: Date.now() });

    for (const row of matches) {
      await ctx.db.patch(row._id, patch);
    }

    return matches.length;
  },
});

export const remove = mutation({
  args: {
    model: v.string(),
    where: v.array(whereItem),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();
    const found = rows.find((row: any) => matchesWhere(row, args.where as any));
    if (!found) return null;
    await ctx.db.delete(found._id);
    return null;
  },
});

export const removeMany = mutation({
  args: {
    model: v.string(),
    where: v.array(whereItem),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const rows = await ctx.db.query(table).collect();
    const matches = rows.filter((row: any) => matchesWhere(row, args.where as any));

    for (const row of matches) {
      await ctx.db.delete(row._id);
    }

    return matches.length;
  },
});
