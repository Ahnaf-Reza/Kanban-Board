/**
 * Convex adapter for Better Auth
 * Uses Convex as the exclusive database backend for all authentication data
 */

function getTrimmedEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

function getRequiredEnv(name) {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  throw new Error(`${name} is required in the runtime environment.`);
}

export function convexAdapter(convexUrl) {
  const baseUrl = convexUrl || getRequiredEnv("VITE_CONVEX_URL");
  if (!baseUrl) {
    throw new Error(
      "VITE_CONVEX_URL is required for Convex authentication adapter"
    );
  }

  // Helper to make Convex API calls
  async function callConvex(functionName, args) {
    const responseText = await fetch(`${baseUrl}/api/convex`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: functionName,
        args,
      }),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`Convex API error: ${res.statusText}`);
      }
      return res.text();
    });

    try {
      const data = JSON.parse(responseText);
      if (data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (e) {
      console.error("Failed to parse Convex response:", responseText);
      throw e;
    }
  }

  return {
    // User operations
    async user: {
      async findUnique(where) {
        if (where.id) {
          const user = await callConvex("auth/db:getUser", { id: where.id });
          return user;
        }
        if (where.email) {
          const user = await callConvex("auth/db:getUserByEmail", {
            email: where.email,
          });
          return user;
        }
        throw new Error("Invalid findUnique query");
      },

      async create(data) {
        const userId = await callConvex("auth/db:createUser", {
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
          tokenIdentifier: data.tokenIdentifier,
          subject: data.subject,
          issuer: data.issuer,
        });
        return { _id: userId, ...data };
      },

      async update(where, data) {
        await callConvex("auth/db:updateUser", {
          id: where.id,
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
        });
        const updated = await callConvex("auth/db:getUser", { id: where.id });
        return updated;
      },

      async delete(where) {
        const user = await callConvex("auth/db:getUser", { id: where.id });
        if (user) {
          // Cascade delete would be handled by Convex schema constraints
          // For now, just return the user
          return user;
        }
      },
    },

    // Session operations
    async session: {
      async findUnique(where) {
        if (where.token) {
          const session = await callConvex("auth/db:getSession", {
            token: where.token,
          });
          return session;
        }
        throw new Error("Invalid session query");
      },

      async create(data) {
        const sessionId = await callConvex("auth/db:createSession", {
          token: data.token,
          userId: data.userId,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });
        return { _id: sessionId, ...data };
      },

      async update(where, data) {
        await callConvex("auth/db:updateSession", {
          token: where.token,
          expiresAt: data.expiresAt,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });
        const updated = await callConvex("auth/db:getSession", {
          token: where.token,
        });
        return updated;
      },

      async delete(where) {
        await callConvex("auth/db:deleteSession", { token: where.token });
      },
    },

    // Account operations
    async account: {
      async findUnique(where) {
        const account = await callConvex("auth/db:getAccount", {
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
        });
        return account;
      },

      async findMany(where) {
        const accounts = await callConvex("auth/db:listAccounts", {
          userId: where.userId,
        });
        return accounts;
      },

      async create(data) {
        const accountId = await callConvex("auth/db:createAccount", {
          userId: data.userId,
          accountId: data.accountId,
          providerId: data.providerId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          idToken: data.idToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          refreshTokenExpiresAt: data.refreshTokenExpiresAt,
          scope: data.scope,
          password: data.password,
        });
        return { _id: accountId, ...data };
      },

      async update(where, data) {
        await callConvex("auth/db:updateAccount", {
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
        const updated = await callConvex("auth/db:getAccount", {
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
        });
        return updated;
      },

      async delete(where) {
        await callConvex("auth/db:deleteAccount", {
          userId: where.userId,
          providerId: where.providerId,
          accountId: where.accountId,
        });
      },
    },

    // Verification operations
    async verification: {
      async findUnique(where) {
        const verification = await callConvex("auth/db:getVerification", {
          identifier: where.identifier,
        });
        return verification;
      },

      async create(data) {
        const verificationId = await callConvex("auth/db:createVerification", {
          identifier: data.identifier,
          value: data.value,
          expiresAt: data.expiresAt,
        });
        return { _id: verificationId, ...data };
      },

      async delete(where) {
        await callConvex("auth/db:deleteVerification", {
          identifier: where.identifier,
        });
      },
    },
  };
}
