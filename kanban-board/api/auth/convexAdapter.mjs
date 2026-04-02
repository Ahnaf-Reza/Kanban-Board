import { createAdapterFactory } from "better-auth/adapters";
import { api } from "../../convex/_generated/api.js";

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
        const row = await convexClient.mutation(api.authDb.create, {
          model,
          data,
        });
        if (!row) return row;
        if (!select || select.length === 0) return row;
        const projected = {};
        for (const key of select) projected[key] = row[key];
        return projected;
      },

      async findOne({ model, where, select }) {
        return await convexClient.query(api.authDb.findOne, {
          model,
          where,
          select,
        });
      },

      async findMany({ model, where, limit, select, sortBy, offset }) {
        return await convexClient.query(api.authDb.findMany, {
          model,
          where,
          limit,
          select,
          sortBy,
          offset,
        });
      },

      async count({ model, where }) {
        return await convexClient.query(api.authDb.count, {
          model,
          where,
        });
      },

      async update({ model, where, update }) {
        return await convexClient.mutation(api.authDb.update, {
          model,
          where,
          update,
        });
      },

      async updateMany({ model, where, update }) {
        return await convexClient.mutation(api.authDb.updateMany, {
          model,
          where,
          update,
        });
      },

      async delete({ model, where }) {
        await convexClient.mutation(api.authDb.remove, {
          model,
          where,
        });
      },

      async deleteMany({ model, where }) {
        return await convexClient.mutation(api.authDb.removeMany, {
          model,
          where,
        });
      },
    }),
  });

  return adapter;
}
