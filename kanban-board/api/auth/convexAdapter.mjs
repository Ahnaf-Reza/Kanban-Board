import { createAdapterFactory } from "better-auth/adapters";
import { api } from "../../convex/_generated/api.js";

function sanitizeValue(value) {
  if (value === null || typeof value === "undefined") return undefined;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => typeof item !== "undefined");
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      const sanitized = sanitizeValue(nested);
      if (typeof sanitized !== "undefined") {
        out[key] = sanitized;
      }
    }
    return out;
  }
  return value;
}

function sanitizeWhere(where) {
  const whereArray = Array.isArray(where)
    ? where
    : where && typeof where === "object"
      ? [where]
      : [];

  return whereArray
    .map((clause) => {
      if (!clause || typeof clause !== "object") return undefined;
      if (typeof clause.field !== "string" || clause.field.trim().length === 0) {
        return undefined;
      }
      const sanitizedValue = sanitizeValue(clause.value);
      if (typeof sanitizedValue === "undefined") return undefined;
      return {
        ...clause,
        field: clause.field.trim(),
        value: sanitizedValue,
      };
    })
    .filter((clause) => typeof clause !== "undefined");
}

function describeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function throwAdapterError(operation, model, payload, error) {
  const keys = payload && typeof payload === "object" ? Object.keys(payload).join(",") : "";
  const message = describeError(error);
  console.error(`[AUTH_ADAPTER_${operation.toUpperCase()}_ERROR]`, {
    model,
    keys,
    message,
  });
  throw new Error(`convexAdapter.${operation} failed for model ${model}: ${message}`);
}

export function convexAdapter(convexClient) {
  const adapter = createAdapterFactory({
    config: {
      adapterId: "convex",
      adapterName: "Convex Adapter",
      supportsBooleans: true,
      supportsDates: false,
      supportsJSON: true,
      supportsArrays: false,
      supportsUUIDs: true,
      transaction: false,
    },
    adapter: () => ({
      async create({ model, data, select }) {
        try {
          const row = await convexClient.mutation(api.authDb.create, {
            model,
            data: sanitizeValue(data),
          });
          if (!row) return row;
          if (!select || select.length === 0) return row;
          const projected = {};
          for (const key of select) projected[key] = row[key];
          return projected;
        } catch (error) {
          throwAdapterError("create", model, data, error);
        }
      },

      async findOne({ model, where, select, join }) {
        try {
          const row = await convexClient.query(api.authDb.findOne, {
            model,
            where: sanitizeWhere(where),
            select,
          });

          if (!row) {
            return row;
          }

          const normalizedModel = typeof model === "string" ? model.toLowerCase() : "";
          const shouldJoinAccounts = Boolean(join && typeof join === "object" && join.account);

          if ((normalizedModel === "user" || normalizedModel === "users") && shouldJoinAccounts) {
            const userId = typeof row.id === "string" ? row.id : "";
            if (!userId) {
              return {
                ...row,
                account: [],
              };
            }

            const accounts = await convexClient.query(api.authDb.findMany, {
              model: "account",
              where: sanitizeWhere([
                {
                  field: "userId",
                  value: userId,
                },
              ]),
            });

            const sortedAccounts = Array.isArray(accounts)
              ? [...accounts].sort((left, right) => {
                  const leftIsCredentialWithPassword =
                    left?.providerId === "credential" && typeof left?.password === "string" && left.password.length > 0;
                  const rightIsCredentialWithPassword =
                    right?.providerId === "credential" && typeof right?.password === "string" && right.password.length > 0;

                  if (leftIsCredentialWithPassword === rightIsCredentialWithPassword) {
                    return 0;
                  }

                  return leftIsCredentialWithPassword ? -1 : 1;
                })
              : [];

            return {
              ...row,
              account: sortedAccounts,
            };
          }

          return row;
        } catch (error) {
          throwAdapterError("findOne", model, where, error);
        }
      },

      async findMany({ model, where, limit, select, sortBy, offset }) {
        try {
          return await convexClient.query(api.authDb.findMany, {
            model,
            where: sanitizeWhere(where),
            limit,
            select,
            sortBy,
            offset,
          });
        } catch (error) {
          throwAdapterError("findMany", model, where, error);
        }
      },

      async count({ model, where }) {
        try {
          return await convexClient.query(api.authDb.count, {
            model,
            where: sanitizeWhere(where),
          });
        } catch (error) {
          throwAdapterError("count", model, where, error);
        }
      },

      async update({ model, where, update }) {
        try {
          return await convexClient.mutation(api.authDb.update, {
            model,
            where: sanitizeWhere(where),
            update: sanitizeValue(update) ?? {},
          });
        } catch (error) {
          throwAdapterError("update", model, { where, update }, error);
        }
      },

      async updateMany({ model, where, update }) {
        try {
          return await convexClient.mutation(api.authDb.updateMany, {
            model,
            where: sanitizeWhere(where),
            update: sanitizeValue(update) ?? {},
          });
        } catch (error) {
          throwAdapterError("updateMany", model, { where, update }, error);
        }
      },

      async delete({ model, where }) {
        try {
          await convexClient.mutation(api.authDb.remove, {
            model,
            where: sanitizeWhere(where),
          });
        } catch (error) {
          throwAdapterError("delete", model, where, error);
        }
      },

      async deleteMany({ model, where }) {
        try {
          return await convexClient.mutation(api.authDb.removeMany, {
            model,
            where: sanitizeWhere(where),
          });
        } catch (error) {
          throwAdapterError("deleteMany", model, where, error);
        }
      },
    }),
  });

  return adapter;
}
