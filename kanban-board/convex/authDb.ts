import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type AuthTable = "users" | "sessions" | "accounts" | "verification" | "jwks";
type AuthRow = Record<string, unknown>;
type WhereOperator =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with";

type WhereClause = {
  field: string;
  value: unknown;
  operator?: WhereOperator;
  connector?: "AND" | "OR";
};

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

function modelToTable(model: string): AuthTable {
  const normalized = model.toLowerCase();
  if (normalized === "user" || normalized === "users") return "users";
  if (normalized === "session" || normalized === "sessions") return "sessions";
  if (normalized === "account" || normalized === "accounts") return "accounts";
  if (normalized === "verification" || normalized === "verifications") return "verification";
  if (normalized === "jwks" || normalized === "jwk") return "jwks";
  throw new Error(`Unsupported auth model: ${model}`);
}

function tableSupportsUpdatedAt(table: string): boolean {
  return table !== "jwks";
}

function isRelationalComparable(value: unknown): value is string | number | bigint {
  return typeof value === "string" || typeof value === "number" || typeof value === "bigint";
}

function getNestedString(row: AuthRow, key: string, nestedKey: string): string | undefined {
  const parent = row[key];
  if (!parent || typeof parent !== "object") return undefined;
  const nested = (parent as Record<string, unknown>)[nestedKey];
  return typeof nested === "string" ? nested : undefined;
}

function cmp(fieldValue: unknown, operator: string, value: unknown): boolean {
  if (operator === "eq") return fieldValue === value;
  if (operator === "ne") return fieldValue !== value;
  if (operator === "lt") return isRelationalComparable(fieldValue) && isRelationalComparable(value) && fieldValue < value;
  if (operator === "lte") return isRelationalComparable(fieldValue) && isRelationalComparable(value) && fieldValue <= value;
  if (operator === "gt") return isRelationalComparable(fieldValue) && isRelationalComparable(value) && fieldValue > value;
  if (operator === "gte") return isRelationalComparable(fieldValue) && isRelationalComparable(value) && fieldValue >= value;
  if (operator === "in") return Array.isArray(value) && value.includes(fieldValue);
  if (operator === "not_in") return Array.isArray(value) && !value.includes(fieldValue);
  if (operator === "contains") return typeof fieldValue === "string" && typeof value === "string" && fieldValue.includes(value);
  if (operator === "starts_with") return typeof fieldValue === "string" && typeof value === "string" && fieldValue.startsWith(value);
  if (operator === "ends_with") return typeof fieldValue === "string" && typeof value === "string" && fieldValue.endsWith(value);
  return fieldValue === value;
}

function matchesWhere(row: AuthRow, where?: WhereClause[]): boolean {
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

function project(row: AuthRow, select?: string[]): AuthRow {
  if (!select || select.length === 0) return row;
  const out: AuthRow = {};
  for (const key of select) {
    out[key] = row[key];
  }
  return out;
}

function sanitizeForConvex(value: unknown): unknown {
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
    const out: AuthRow = {};
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

function normalizeCreateData(model: string, data: AuthRow): AuthRow {
  const normalizedModel = model.toLowerCase();

  const toEpochMs = (raw: number): number => {
    // Treat 10-digit epoch values as seconds and normalize to milliseconds.
    if (raw > 0 && raw < 1_000_000_000_000) {
      return raw * 1000;
    }
    return raw;
  };

  const coerceTimestamp = (value: unknown, fallback: number): number => {
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

    const normalizedName = typeof data.name === "string" ? data.name.trim() : "";
    data.email = email;
    data.name = normalizedName || email.split("@")[0] || "User";
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
        : typeof getNestedString(data, "user", "id") === "string"
          ? (getNestedString(data, "user", "id") as string)
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
        : typeof getNestedString(data, "user", "id") === "string"
          ? (getNestedString(data, "user", "id") as string)
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

    const normalizedPublicKey = typeof data.publicKey === "string" ? data.publicKey.trim() : "";
    const normalizedPrivateKey = typeof data.privateKey === "string" ? data.privateKey.trim() : "";
    data.publicKey = normalizedPublicKey;
    data.privateKey = normalizedPrivateKey;

    if (!normalizedPublicKey) {
      throw new Error("Auth jwks publicKey is required for jwks model.");
    }
    if (!normalizedPrivateKey) {
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

function normalizeUpdateData(model: string, data: AuthRow): AuthRow {
  const normalizedModel = model.toLowerCase();

  const toEpochMs = (raw: number): number => {
    if (raw > 0 && raw < 1_000_000_000_000) {
      return raw * 1000;
    }
    return raw;
  };

  const coerceTimestamp = (value: unknown, fallback: number): number => {
    if (typeof value === "number" && Number.isFinite(value)) return toEpochMs(value);
    if (typeof value === "string") {
      const parsedNumber = Number(value);
      if (Number.isFinite(parsedNumber)) return toEpochMs(parsedNumber);
      const parsedDate = Date.parse(value);
      if (!Number.isNaN(parsedDate)) return parsedDate;
    }
    return fallback;
  };

  if (normalizedModel === "account" || normalizedModel === "accounts") {
    for (const key of ["id", "userId", "accountId", "providerId"]) {
      if (typeof data[key] === "string") {
        data[key] = data[key].trim();
      }
    }
    for (const key of ["accessToken", "refreshToken", "idToken", "scope", "password"]) {
      if (typeof data[key] !== "undefined") {
        data[key] = typeof data[key] === "string" ? data[key] : String(data[key]);
      }
    }
    if (typeof data.accessTokenExpiresAt !== "undefined") {
      data.accessTokenExpiresAt = coerceTimestamp(data.accessTokenExpiresAt, Date.now() + 60 * 60 * 1000);
    }
    if (typeof data.refreshTokenExpiresAt !== "undefined") {
      data.refreshTokenExpiresAt = coerceTimestamp(data.refreshTokenExpiresAt, Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (normalizedModel === "session" || normalizedModel === "sessions") {
    for (const key of ["id", "token", "userId"]) {
      if (typeof data[key] === "string") {
        data[key] = data[key].trim();
      }
    }
    if (typeof data.expiresAt !== "undefined") {
      data.expiresAt = coerceTimestamp(data.expiresAt, Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    if (typeof data.ipAddress !== "undefined") {
      data.ipAddress = data.ipAddress === null ? undefined : String(data.ipAddress);
    }
    if (typeof data.userAgent !== "undefined") {
      data.userAgent = data.userAgent === null ? undefined : String(data.userAgent);
    }
  }

  if (normalizedModel === "verification" || normalizedModel === "verifications") {
    if (typeof data.identifier === "string") data.identifier = data.identifier.trim();
    if (typeof data.value !== "undefined" && typeof data.value !== "string") {
      data.value = JSON.stringify(data.value ?? "");
    }
    if (typeof data.expiresAt !== "undefined") {
      data.expiresAt = coerceTimestamp(data.expiresAt, Date.now() + 10 * 60 * 1000);
    }
  }

  if (normalizedModel === "jwks" || normalizedModel === "jwk") {
    if (typeof data.id === "string") data.id = data.id.trim();
    if (typeof data.publicKey !== "undefined" && typeof data.publicKey !== "string") {
      data.publicKey = JSON.stringify(data.publicKey ?? "");
    }
    if (typeof data.privateKey !== "undefined" && typeof data.privateKey !== "string") {
      data.privateKey = JSON.stringify(data.privateKey ?? "");
    }
    if (typeof data.expiresAt !== "undefined") {
      data.expiresAt = coerceTimestamp(data.expiresAt, Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (typeof data.createdAt !== "undefined") {
    data.createdAt = coerceTimestamp(data.createdAt, Date.now());
  }
  if (typeof data.updatedAt !== "undefined") {
    data.updatedAt = coerceTimestamp(data.updatedAt, Date.now());
  }

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

function filterToSchemaFields(model: string, data: AuthRow): AuthRow {
  const table = modelToTable(model);
  const allowed = ALLOWED_FIELDS_BY_MODEL[table];
  if (!allowed) return data;

  const out: AuthRow = {};
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
    const table = modelToTable(args.model);
    const data = filterToSchemaFields(
      args.model,
      normalizeCreateData(
        args.model,
        sanitizeForConvex({ ...(args.data as AuthRow) }) as AuthRow
      )
    );

    const now = Date.now();
    if (typeof data.createdAt === "undefined") data.createdAt = now;
    if (tableSupportsUpdatedAt(table) && typeof data.updatedAt === "undefined") {
      data.updatedAt = now;
    }

    try {
      const insertedId = await ctx.db.insert(table, data as never);
      const row = await ctx.db.get(insertedId);
      return row;
    } catch (error: unknown) {
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
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[] | undefined;
    const filtered = rows.filter((row) => matchesWhere(row as AuthRow, where));

    if (args.sortBy) {
      const { field, direction } = args.sortBy;
      filtered.sort((a, b) => {
        const av = (a as AuthRow)[field];
        const bv = (b as AuthRow)[field];
        if (av === bv) return 0;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        const ord = isRelationalComparable(av) && isRelationalComparable(bv) && av < bv ? -1 : 1;
        return direction === "desc" ? -ord : ord;
      });
    }

    const offset = args.offset ?? 0;
    const limit = args.limit ?? filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return paged.map((row) => project(row as AuthRow, args.select));
  },
});

export const findOne = query({
  args: {
    model: v.string(),
    where: v.array(whereItem),
    select: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[];
    const found = rows.find((row) => matchesWhere(row as AuthRow, where));
    if (!found) return null;
    return project(found as AuthRow, args.select);
  },
});

export const count = query({
  args: {
    model: v.string(),
    where: v.optional(v.array(whereItem)),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[] | undefined;
    return rows.filter((row) => matchesWhere(row as AuthRow, where)).length;
  },
});

export const update = mutation({
  args: {
    model: v.string(),
    where: v.array(whereItem),
    update: v.any(),
  },
  handler: async (ctx, args) => {
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[];
    const found = rows.find((row) => matchesWhere(row as AuthRow, where));
    if (!found) return null;

    const normalizedPatchInput = sanitizeForConvex({ ...(args.update as AuthRow) }) as AuthRow;
    if (tableSupportsUpdatedAt(table)) {
      normalizedPatchInput.updatedAt = Date.now();
    }

    const patch = filterToSchemaFields(
      args.model,
      normalizeUpdateData(args.model, normalizedPatchInput)
    );
    try {
      await ctx.db.patch(found._id, patch);
      return await ctx.db.get(found._id);
    } catch (error: unknown) {
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
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[];
    const matches = rows.filter((row) => matchesWhere(row as AuthRow, where));
    const normalizedPatchInput = sanitizeForConvex({ ...(args.update as AuthRow) }) as AuthRow;
    if (tableSupportsUpdatedAt(table)) {
      normalizedPatchInput.updatedAt = Date.now();
    }

    const patch = filterToSchemaFields(
      args.model,
      normalizeUpdateData(args.model, normalizedPatchInput)
    );

    try {
      for (const row of matches) {
        await ctx.db.patch(row._id, patch);
      }
    } catch (error: unknown) {
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
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[];
    const found = rows.find((row) => matchesWhere(row as AuthRow, where));
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
    const table = modelToTable(args.model);
    const rows = await ctx.db.query(table).collect();
    const where = args.where as unknown as WhereClause[];
    const matches = rows.filter((row) => matchesWhere(row as AuthRow, where));

    for (const row of matches) {
      await ctx.db.delete(row._id);
    }

    return matches.length;
  },
});
