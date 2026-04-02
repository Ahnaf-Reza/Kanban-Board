/**
 * Convex Storage Adapter for Better Auth (JavaScript version)
 * Persists all auth data to Convex backend using direct HTTP calls
 * Solves state/verification loss on serverless cold starts
 */

export function convexStorageAdapter(convexUrl) {
  if (!convexUrl || typeof convexUrl !== "string") {
    throw new Error("convexStorageAdapter requires a valid convexUrl");
  }

  const baseUrl = convexUrl.replace(/\/$/, "");

  async function callConvexMutation(functionName, args) {
    try {
      const url = `${baseUrl}/api/call/${functionName}`;
      console.debug(`[convexStorageAdapter] Calling: ${url}`, args);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      const text = await response.text();
      console.debug(`[convexStorageAdapter] Response [${response.status}]:`, text);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = JSON.parse(text);
      return result;
    } catch (error) {
      console.error(
        `[convexStorageAdapter] ${functionName} failed:`,
        error.message
      );
      throw error;
    }
  }

  async function callConvexQuery(functionName, args) {
    try {
      const url = `${baseUrl}/api/query/${functionName}`;
      console.debug(`[convexStorageAdapter] Query: ${url}`, args);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      const text = await response.text();
      console.debug(`[convexStorageAdapter] Response [${response.status}]:`, text);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = JSON.parse(text);
      return result;
    } catch (error) {
      console.error(
        `[convexStorageAdapter] ${functionName} failed:`,
        error.message
      );
      throw error;
    }
  }

  return {
    async create(data) {
      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.create] Skipping invalid data");
        return;
      }

      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record) continue;
          try {
            await callConvexMutation("authStorage:storageCreate", {
              table,
              data: record,
            });
          } catch (error) {
            console.warn(
              `[convexStorageAdapter] Failed to create ${table} record`
            );
          }
        }
      }
    },

    async read(data) {
      const result = {};

      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.read] Skipping invalid data");
        return result;
      }

      for (const table of Object.keys(data)) {
        try {
          const records = await callConvexQuery("authStorage:storageRead", {
            table,
          });
          result[table] = Array.isArray(records) ? records : [];
        } catch (error) {
          console.warn(
            `[convexStorageAdapter] Failed to read ${table}, returning empty`
          );
          result[table] = [];
        }
      }

      return result;
    },

    async update(data) {
      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.update] Skipping invalid data");
        return;
      }

      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record) continue;
          try {
            await callConvexMutation("authStorage:storageUpdate", {
              table,
              data: record,
            });
          } catch (error) {
            console.warn(
              `[convexStorageAdapter] Failed to update ${table} record`
            );
          }
        }
      }
    },

    async delete(data) {
      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.delete] Skipping invalid data");
        return;
      }

      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record || !record.id) continue;
          try {
            await callConvexMutation("authStorage:storageDelete", {
              table,
              id: record.id,
            });
          } catch (error) {
            console.warn(
              `[convexStorageAdapter] Failed to delete ${table} record`
            );
          }
        }
      }
    },
  };
}
