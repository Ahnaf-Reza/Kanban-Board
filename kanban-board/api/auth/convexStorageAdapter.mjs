/**
 * Convex Storage Adapter for Better Auth (JavaScript version)
 * Persists all auth data to Convex backend using direct API calls
 * Solves state/verification loss on serverless cold starts
 */

export function convexStorageAdapter(convexUrl) {
  const baseUrl = convexUrl.replace(/\/$/, ""); // Remove trailing slash

  async function callConvexAction(action, args) {
    const response = await fetch(`${baseUrl}/api/call/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Convex action "${action}" failed: ${errorText}`);
    }

    return await response.json();
  }

  async function callConvexQuery(query, args) {
    const response = await fetch(`${baseUrl}/api/query/${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Convex query "${query}" failed: ${errorText}`);
    }

    return await response.json();
  }

  return {
    async create(data) {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          try {
            await callConvexAction("authDb:createRecord", {
              table,
              data: record,
            });
          } catch (error) {
            console.error(`Failed to create ${table} record:`, error.message);
          }
        }
      }
    },

    async read(data) {
      const result = {};

      for (const table of Object.keys(data)) {
        try {
          result[table] = await callConvexQuery("authDb:getAllRecords", {
            table,
          });
        } catch (error) {
          console.error(
            `Failed to read ${table} records:`,
            error.message
          );
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
            await callConvexAction("authDb:updateRecord", {
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
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;

        for (const record of records) {
          try {
            await callConvexAction("authDb:deleteRecord", {
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
}
