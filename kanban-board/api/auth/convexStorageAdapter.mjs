/**
 * Convex Storage Adapter for Better Auth (JavaScript version)
 * Persists all auth data to Convex backend using HTTP API
 * Solves state/verification loss on serverless cold starts
 */

export function convexStorageAdapter(convexUrl) {
  if (!convexUrl || typeof convexUrl !== "string") {
    throw new Error("convexStorageAdapter requires a valid convexUrl");
  }

  const baseUrl = convexUrl.replace(/\/$/, ""); // Remove trailing slash

  async function callConvex(type, functionName, args) {
    try {
      // Convex HTTP API format: /api/call/module:function
      const endpoint = `${baseUrl}/api/call/${functionName}`;
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Convex call failed [${response.status}]:`, errorText);
        throw new Error(
          `Convex ${functionName} failed: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`[convexStorageAdapter] ${functionName} error:`, error.message);
      throw error;
    }
  }

  return {
    async create(data) {
      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.create] Invalid data:", typeof data);
        return;
      }

      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record) continue;
          try {
            await callConvex("mutation", "authStorage:createRecord", {
              table,
              data: record,
            });
          } catch (error) {
            console.error(`Failed to create ${table} record:`, error.message);
            // Don't throw - allow initialization to continue
          }
        }
      }
    },

    async read(data) {
      const result = {};

      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.read] Invalid data:", typeof data);
        return result;
      }

      for (const table of Object.keys(data)) {
        try {
          const records = await callConvex("query", "authStorage:getAllRecords", {
            table,
          });
          result[table] = Array.isArray(records) ? records : [];
        } catch (error) {
          console.error(`Failed to read ${table} records:`, error.message);
          result[table] = [];
        }
      }

      return result;
    },

    async update(data) {
      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.update] Invalid data:", typeof data);
        return;
      }

      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record) continue;
          try {
            await callConvex("mutation", "authStorage:updateRecord", {
              table,
              data: record,
            });
          } catch (error) {
            console.error(
              `Failed to update ${table} record:`,
              error.message
            );
          }
        }
      }
    },

    async delete(data) {
      if (!data || typeof data !== "object") {
        console.warn("[convexStorageAdapter.delete] Invalid data:", typeof data);
        return;
      }

      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          if (!record || !record.id) continue;
          try {
            await callConvex("mutation", "authStorage:deleteRecord", {
              table,
              id: record.id,
            });
          } catch (error) {
            console.error(
              `Failed to delete ${table} record:`,
              error.message
            );
          }
        }
      }
    },
  };
