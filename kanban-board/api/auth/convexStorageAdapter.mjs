/**
 * Convex Storage Adapter for Better Auth (JavaScript version)
 * Uses synchronous in-memory storage with optional Convex persistence sync
 * Solves OAuth state loss by keeping memory between requests when possible
 */

export function convexStorageAdapter(convexUrl) {
  if (!convexUrl || typeof convexUrl !== "string") {
    // No Convex URL, return memory-only adapter
    return createMemoryOnlyAdapter();
  }

  return createMemoryAdapter(convexUrl);
}

function createMemoryOnlyAdapter() {
  const memoryDb = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
  };

  return {
    create(data) {
      if (!data || typeof data !== "object") return;
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;
        if (!memoryDb[table]) memoryDb[table] = [];
        memoryDb[table].push(...records);
      }
    },

    read(data) {
      const result = {};
      if (!data || typeof data !== "object") return result;
      for (const table of Object.keys(data)) {
        result[table] = memoryDb[table] || [];
      }
      return result;
    },

    update(data) {
      if (!data || typeof data !== "object") return;
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records) || !memoryDb[table]) continue;
        for (const record of records) {
          const idx = memoryDb[table].findIndex(
            (r) => r.id === record.id || r._id === record.id
          );
          if (idx >= 0) {
            memoryDb[table][idx] = record;
          } else {
            memoryDb[table].push(record);
          }
        }
      }
    },

    delete(data) {
      if (!data || typeof data !== "object") return;
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records) || !memoryDb[table]) continue;
        for (const record of records) {
          memoryDb[table] = memoryDb[table].filter(
            (r) => r.id !== record.id && r._id !== record.id
          );
        }
      }
    },
  };
}

function createMemoryAdapter(convexUrl) {
  const baseUrl = convexUrl.replace(/\/$/, "");
  const memoryDb = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
  };

  // Background async sync (fire and forget)
  function syncToConvex(table, record, operation) {
    const fn =
      operation === "create"
        ? "authStorage:storageCreate"
        : operation === "update"
          ? "authStorage:storageUpdate"
          : "authStorage:storageDelete";

    fetch(`${baseUrl}/api/call/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table,
        data: record,
        id: record?.id,
      }),
    }).catch(() => {
      // Silent fail - memory is primary
    });
  }

  return {
    create(data) {
      if (!data || typeof data !== "object") return;
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;
        if (!memoryDb[table]) memoryDb[table] = [];
        for (const record of records) {
          memoryDb[table].push(record);
          // Background sync
          syncToConvex(table, record, "create");
        }
      }
    },

    read(data) {
      const result = {};
      if (!data || typeof data !== "object") return result;
      for (const table of Object.keys(data)) {
        result[table] = memoryDb[table] || [];
      }
      return result;
    },

    update(data) {
      if (!data || typeof data !== "object") return;
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records) || !memoryDb[table]) continue;
        for (const record of records) {
          const idx = memoryDb[table].findIndex(
            (r) => r.id === record.id || r._id === record.id
          );
          if (idx >= 0) {
            memoryDb[table][idx] = record;
          } else {
            memoryDb[table].push(record);
          }
          // Background sync
          syncToConvex(table, record, "update");
        }
      }
    },

    delete(data) {
      if (!data || typeof data !== "object") return;
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records) || !memoryDb[table]) continue;
        for (const record of records) {
          memoryDb[table] = memoryDb[table].filter(
            (r) => r.id !== record.id && r._id !== record.id
          );
          // Background sync
          syncToConvex(table, record, "delete");
        }
      }
    },
  };
}
