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

function normalizeCreateData(model: string, data: Record<string, any>): Record<string, any> {
  const normalizedModel = model.toLowerCase();

  const toEpochMs = (raw: number): number => {
    // Treat 10-digit epoch values as seconds and normalize to milliseconds.
    if (raw > 0 && raw < 1_000_000_000_000) {
      return raw * 1000;
    }
    return raw;
  };

  const coerceTimestamp = (value: any, fallback: number): number => {
    if (typeof value === "number" && Number.isFinite(value)) return toEpochMs(value);
    if (typeof value === "string") {
      const parsedNumber = Number(value);
      if (Number.isFinite(parsedNumber)) return toEpochMs(parsedNumber);
      const parsedDate = Date.parse(value);
      if (!Number.isNaN(parsedDate)) return parsedDate;
    }
    return fallback;
  };

  if (
    (normalizedModel === "session" ||
      normalizedModel === "sessions" ||
      normalizedModel === "account" ||
      normalizedModel === "accounts" ||
      normalizedModel === "verification" ||
      normalizedModel === "verifications" ||
      normalizedModel === "jwks" ||
      normalizedModel === "jwk") &&
    (typeof data.id !== "string" || data.id.trim().length === 0)
  ) {
    data.id = crypto.randomUUID();
  }

  if (normalizedModel === "user" || normalizedModel === "users") {
    if (typeof data.id !== "string" || data.id.trim().length === 0) {
      data.id = crypto.randomUUID();
    } else {
      data.id = data.id.trim();
    }

    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";

    if (!email) {
      throw new Error("Auth user email is required for users model.");
    }

    const hasName = typeof data.name === "string" && data.name.trim().length > 0;
    data.email = email;
    data.name = hasName ? data.name.trim() : email.split("@")[0] || "User";
  }

  if (normalizedModel === "account" || normalizedModel === "accounts") {
    if (typeof data.id !== "string" || data.id.trim().length === 0) {
      data.id = crypto.randomUUID();
    } else {
      data.id = data.id.trim();
    }

    const userIdCandidate =
      typeof data.userId === "string"
        ? data.userId
        : typeof data.user?.id === "string"
          ? data.user.id
          : "";
    if (!userIdCandidate || userIdCandidate.trim().length === 0) {
      throw new Error("Auth account userId is required for accounts model.");
    }
    data.userId = userIdCandidate.trim();

    if (typeof data.providerId !== "string" || data.providerId.trim().length === 0) {
      data.providerId = "google";
    } else {
      data.providerId = data.providerId.trim();
    }

    if (typeof data.accountId !== "string" || data.accountId.trim().length === 0) {
      throw new Error("Auth accountId is required for accounts model.");
    }
    data.accountId = data.accountId.trim();

    const optionalStringKeys = ["accessToken", "refreshToken", "idToken", "scope", "password"];
    for (const key of optionalStringKeys) {
      if (typeof data[key] === "undefined") continue;
      data[key] = typeof data[key] === "string" ? data[key] : String(data[key]);
    }

    if (typeof data.accessTokenExpiresAt !== "undefined") {
      data.accessTokenExpiresAt = coerceTimestamp(data.accessTokenExpiresAt, Date.now() + 60 * 60 * 1000);
    }
    if (typeof data.refreshTokenExpiresAt !== "undefined") {
      data.refreshTokenExpiresAt = coerceTimestamp(data.refreshTokenExpiresAt, Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (normalizedModel === "session" || normalizedModel === "sessions") {
    if (typeof data.id !== "string" || data.id.trim().length === 0) {
      data.id = crypto.randomUUID();
    } else {
      data.id = data.id.trim();
    }

    if (typeof data.token !== "string" || data.token.trim().length === 0) {
      throw new Error("Auth session token is required for sessions model.");
    }
    data.token = data.token.trim();

    const userIdCandidate =
      typeof data.userId === "string"
        ? data.userId
        : typeof data.user?.id === "string"
          ? data.user.id
          : "";
    if (!userIdCandidate || userIdCandidate.trim().length === 0) {
      throw new Error("Auth session userId is required for sessions model.");
    }
    data.userId = userIdCandidate.trim();

    data.expiresAt = coerceTimestamp(data.expiresAt, Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (typeof data.ipAddress !== "undefined") {
      data.ipAddress = data.ipAddress === null ? undefined : String(data.ipAddress);
    }
    if (typeof data.userAgent !== "undefined") {
      data.userAgent = data.userAgent === null ? undefined : String(data.userAgent);
    }
  }

  if (normalizedModel === "jwks" || normalizedModel === "jwk") {
    if (typeof data.id !== "string" || data.id.trim().length === 0) {
      data.id = crypto.randomUUID();
    } else {
      data.id = data.id.trim();
    }

    if (typeof data.publicKey !== "string") {
      data.publicKey = JSON.stringify(data.publicKey ?? "");
    }
    if (typeof data.privateKey !== "string") {
      data.privateKey = JSON.stringify(data.privateKey ?? "");
    }

    data.publicKey = data.publicKey.trim();
    data.privateKey = data.privateKey.trim();

    if (!data.publicKey) {
      throw new Error("Auth jwks publicKey is required for jwks model.");
    }
    if (!data.privateKey) {
      throw new Error("Auth jwks privateKey is required for jwks model.");
    }

    if (typeof data.expiresAt !== "undefined") {
      data.expiresAt = coerceTimestamp(data.expiresAt, Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (normalizedModel === "verification" || normalizedModel === "verifications") {
    if (typeof data.id !== "string" || data.id.trim().length === 0) {
      data.id = crypto.randomUUID();
    } else {
      data.id = data.id.trim();
    }

    if (typeof data.identifier !== "string" || data.identifier.trim().length === 0) {
      data.identifier = "oauth_state";
    } else {
      data.identifier = data.identifier.trim();
    }

    if (typeof data.value !== "string") {
      data.value = JSON.stringify(data.value ?? "");
    }

    data.expiresAt = coerceTimestamp(data.expiresAt, Date.now() + 10 * 60 * 1000);
  }

  data.createdAt = coerceTimestamp(data.createdAt, Date.now());
  data.updatedAt = coerceTimestamp(data.updatedAt, Date.now());

  return data;
}

const ALLOWED_FIELDS_BY_MODEL: Record<string, Set<string>> = {
  users: new Set([
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "avatarUrl",
    "tokenIdentifier",
    "subject",
    "issuer",
    "createdAt",
    "updatedAt",
    "lastSeenAt",
  ]),
  sessions: new Set([
    "id",
    "token",
    "userId",
    "expiresAt",
    "ipAddress",
    "userAgent",
    "createdAt",
    "updatedAt",
  ]),
  accounts: new Set([
    "id",
    "userId",
    "accountId",
    "providerId",
    "accessToken",
    "refreshToken",
    "idToken",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "scope",
    "password",
    "createdAt",
    "updatedAt",
  ]),
  verification: new Set([
    "id",
    "identifier",
    "value",
    "expiresAt",
    "createdAt",
    "updatedAt",
  ]),
  jwks: new Set([
    "id",
    "publicKey",
    "privateKey",
    "createdAt",
    "expiresAt",
  ]),
};

function filterToSchemaFields(model: string, data: Record<string, any>): Record<string, any> {
  const table = modelToTable(model);
  const allowed = ALLOWED_FIELDS_BY_MODEL[table];
  if (!allowed) return data;

  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

export const create = mutation({
  args: {
    model: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model) as any;
    const data = filterToSchemaFields(
      args.model,
      normalizeCreateData(
        args.model,
        sanitizeForConvex({ ...(args.data as Record<string, any>) })
      )
    );

    const now = Date.now();
    if (typeof data.createdAt === "undefined") data.createdAt = now;
    if (typeof data.updatedAt === "undefined") data.updatedAt = now;

    try {
      const insertedId = await ctx.db.insert(table, data);
      const row = await ctx.db.get(insertedId as any);
      return row;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `authDb.create failed for model ${args.model}: ${message}; keys=${Object.keys(data).join(",")}`
      );
    }
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

    const patch = filterToSchemaFields(
      args.model,
      sanitizeForConvex({ ...(args.update as Record<string, any>), updatedAt: Date.now() })
    );
    try {
      await ctx.db.patch(found._id, patch);
      return await ctx.db.get(found._id);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `authDb.update failed for model ${args.model}: ${message}; keys=${Object.keys(patch).join(",")}`
      );
    }
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
    const patch = filterToSchemaFields(
      args.model,
      sanitizeForConvex({ ...(args.update as Record<string, any>), updatedAt: Date.now() })
    );

    try {
      for (const row of matches) {
        await ctx.db.patch(row._id, patch);
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `authDb.updateMany failed for model ${args.model}: ${message}; keys=${Object.keys(patch).join(",")}`
      );
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
