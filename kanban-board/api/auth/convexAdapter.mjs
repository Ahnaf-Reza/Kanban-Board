import crypto from "crypto";

/**
 * Better Auth adapter for Convex database
 * Uses Convex SDK to persist auth data in Convex
 */
export function convexAdapter(convexClient) {
  // Helper to generate consistent IDs
  function generateId() {
    return crypto.randomUUID();
  }

  return {
    user: {
      async create(data) {
        const id = generateId();
        // Convex insertions don't return the function call result directly
        // We need to call the mutation function
        const result = await convexClient.mutation("authDb:createUser", {
          id,
          name: data.name || "",
          email: data.email || "",
          emailVerified: data.emailVerified ?? false,
          image: data.image,
        });
        return { id, ...data, _id: id };
      },

      async findUnique(where) {
        if (where.id) {
          return await convexClient.query("authDb:getUserById", {
            userId: where.id,
          });
        }
        if (where.email) {
          return await convexClient.query("authDb:getUserByEmail", {
            email: where.email,
          });
        }
        throw new Error("Invalid user query");
      },

      async update(where, data) {
        await convexClient.mutation("authDb:updateUser", {
          userId: where.id,
          name: data.name,
          email: data.email,
          emailVerified: data.emailVerified,
          image: data.image,
        });
        return this.findUnique({ id: where.id });
      },

      async delete(where) {
        await convexClient.mutation("authDb:deleteUser", {
          userId: where.id,
        });
      },
    },

    session: {
      async create(data) {
        const id = generateId();
        await convexClient.mutation("authDb:createSession", {
          id,
          token: data.token,
          userId: data.userId,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });
        return { id, ...data, _id: id };
      },

      async findUnique(where) {
        if (where.token) {
          return await convexClient.query("authDb:getSession", {
            token: where.token,
          });
        }
        throw new Error("Invalid session query");
      },

      async update(where, data) {
        await convexClient.mutation("authDb:updateSession", {
          token: where.token,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });
        return this.findUnique({ token: where.token });
      },

      async delete(where) {
        await convexClient.mutation("authDb:deleteSession", {
          token: where.token,
        });
      },
    },

    account: {
      async create(data) {
        const id = generateId();
        await convexClient.mutation("authDb:createAccount", {
          id,
          accountId: data.accountId,
          userId: data.userId,
          providerId: data.providerId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          idToken: data.idToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          refreshTokenExpiresAt: data.refreshTokenExpiresAt,
          scope: data.scope,
          password: data.password,
        });
        return { id, ...data, _id: id };
      },

      async findUnique(where) {
        return await convexClient.query("authDb:getAccount", {
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
        });
      },

      async findMany(where) {
        return await convexClient.query("authDb:listAccounts", {
          userId: where.userId,
        });
      },

      async update(where, data) {
        await convexClient.mutation("authDb:updateAccount", {
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          idToken: data.idToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          refreshTokenExpiresAt: data.refreshTokenExpiresAt,
          scope: data.scope,
          password: data.password,
        });
        return this.findUnique({
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
        });
      },

      async delete(where) {
        await convexClient.mutation("authDb:deleteAccount", {
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
        });
      },
    },

    verification: {
      async create(data) {
        const id = generateId();
        await convexClient.mutation("authDb:createVerification", {
          id,
          identifier: data.identifier,
          value: data.value,
          expiresAt: data.expiresAt,
        });
        return { id, ...data, _id: id };
      },

      async findUnique(where) {
        return await convexClient.query("authDb:getVerification", {
          identifier: where.identifier,
        });
      },

      async delete(where) {
        await convexClient.mutation("authDb:deleteVerification", {
          identifier: where.identifier,
        });
      },
    },
  };
}
