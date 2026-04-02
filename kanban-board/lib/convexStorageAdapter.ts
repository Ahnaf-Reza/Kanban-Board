import { StorageAdapter } from "better-auth/storage";
import { ConvexHttpClient } from "convex/browser";

/**
 * Convex Storage Adapter for Better Auth
 * Persists all auth data (users, sessions, accounts, verification, jwks) to Convex backend
 * Solves state/verification loss on serverless cold starts
 */

interface ConvexStorageAdapterOptions {
  convexUrl: string;
}

export function convexStorageAdapter(
  options: ConvexStorageAdapterOptions
): StorageAdapter {
  const client = new ConvexHttpClient(options.convexUrl);

  return {
    async create(data) {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          try {
            await client.action("authDb:createRecord", {
              table,
              data: record,
            } as any);
          } catch (error) {
            console.error(
              `Failed to create ${table} record:`,
              error
            );
          }
        }
      }
    },

    async read(data) {
      const result: Record<string, any[]> = {};

      for (const table of Object.keys(data)) {
        try {
          result[table] = await client.query("authDb:getAllRecords", {
            table,
          } as any);
        } catch (error) {
          console.error(`Failed to read ${table} records:`, error);
          result[table] = [];
        }
      }

      return result;
    },

    async update(data) {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          try {
            await client.action("authDb:updateRecord", {
              table,
              data: record,
            } as any);
          } catch (error) {
            console.error(
              `Failed to update ${table} record:`,
              error
            );
          }
        }
      }
    },

    async delete(data) {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          try {
            await client.action("authDb:deleteRecord", {
              table,
              id: record.id,
            } as any);
          } catch (error) {
            console.error(
              `Failed to delete ${table} record:`,
              error
            );
          }
        }
      }
    },
  };
}
