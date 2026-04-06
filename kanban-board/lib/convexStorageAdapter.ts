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

type ConvexFunctionArgs = Record<string, unknown>;
type ConvexFunctionCaller = (name: string, args: ConvexFunctionArgs) => Promise<unknown>;

export function convexStorageAdapter(
  options: ConvexStorageAdapterOptions
): StorageAdapter {
  const client = new ConvexHttpClient(options.convexUrl);
  const runAction = client.action.bind(client) as unknown as ConvexFunctionCaller;
  const runQuery = client.query.bind(client) as unknown as ConvexFunctionCaller;

  return {
    async create(data) {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          try {
            await runAction("authDb:createRecord", {
              table,
              data: record,
            });
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
      const result: Record<string, unknown[]> = {};

      for (const table of Object.keys(data)) {
        try {
          const queried = await runQuery("authDb:getAllRecords", {
            table,
          });
          result[table] = Array.isArray(queried) ? queried : [];
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
            await runAction("authDb:updateRecord", {
              table,
              data: record,
            });
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
            await runAction("authDb:deleteRecord", {
              table,
              id: (record as { id?: unknown }).id,
            });
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
