import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "..", ".auth.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      emailVerified INTEGER DEFAULT 0,
      name TEXT,
      image TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountId TEXT,
      providerId TEXT NOT NULL,
      providerUserId TEXT NOT NULL,
      refreshToken TEXT,
      accessToken TEXT,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      password TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(providerId, providerUserId)
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(userId);
    CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(providerId, providerUserId);
    CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

initializeSchema();

function generateId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

function toUser(row) {
  if (!row) return null;
  return {
    ...row,
    emailVerified: Boolean(row.emailVerified),
  };
}

function toSession(row) {
  if (!row) return null;
  return row;
}

export function createSqliteAdapter() {
  return {
    user: {
      create(user) {
        const id = user.id || generateId();
        const now = Date.now();
        db.prepare(
          `
          INSERT INTO users (id, email, emailVerified, name, image, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(id, user.email || null, normalizeBoolean(user.emailVerified), user.name || null, user.image || null, now, now);
        return toUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(id));
      },
      update(userId, user) {
        const now = Date.now();
        db.prepare(
          `
          UPDATE users
          SET email = ?, emailVerified = ?, name = ?, image = ?, updatedAt = ?
          WHERE id = ?
        `,
        ).run(user.email || null, normalizeBoolean(user.emailVerified), user.name || null, user.image || null, now, userId);
        return toUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId));
      },
      findUnique(query) {
        if (query?.id) {
          return toUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(query.id));
        }
        if (query?.email) {
          return toUser(db.prepare(`SELECT * FROM users WHERE email = ?`).get(query.email));
        }
        return null;
      },
      findById(id) {
        return toUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(id));
      },
      delete(id) {
        db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
      },
      findMany() {
        return db.prepare(`SELECT * FROM users`).all().map(toUser);
      },
    },
    session: {
      create(session) {
        const id = session.id || generateId();
        const now = Date.now();
        db.prepare(
          `
          INSERT INTO sessions (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          id,
          session.userId,
          session.token || generateId(),
          session.expiresAt,
          session.ipAddress || null,
          session.userAgent || null,
          now,
          now,
        );
        return toSession(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id));
      },
      update(sessionId, session) {
        const now = Date.now();
        db.prepare(
          `
          UPDATE sessions
          SET token = ?, expiresAt = ?, ipAddress = ?, userAgent = ?, updatedAt = ?
          WHERE id = ?
        `,
        ).run(session.token || null, session.expiresAt, session.ipAddress || null, session.userAgent || null, now, sessionId);
        return toSession(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
      },
      findUnique(query) {
        if (query?.token) {
          return toSession(db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(query.token));
        }
        if (query?.id) {
          return toSession(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(query.id));
        }
        return null;
      },
      delete(id) {
        db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
      },
    },
    account: {
      create(account) {
        const id = account.id || generateId();
        const now = Date.now();
        db.prepare(
          `
          INSERT INTO accounts (
            id, userId, accountId, providerId, providerUserId, refreshToken, accessToken,
            accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          id,
          account.userId,
          account.accountId || null,
          account.providerId,
          account.providerUserId,
          account.refreshToken || null,
          account.accessToken || null,
          account.accessTokenExpiresAt || null,
          account.refreshTokenExpiresAt || null,
          account.scope || null,
          account.password || null,
          now,
          now,
        );
        return db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id);
      },
      findUnique(query) {
        if (query?.providerId && query?.providerUserId) {
          return db.prepare(`SELECT * FROM accounts WHERE providerId = ? AND providerUserId = ?`).get(query.providerId, query.providerUserId);
        }
        if (query?.id) {
          return db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(query.id);
        }
        return null;
      },
      delete(query) {
        if (query?.id) {
          db.prepare(`DELETE FROM accounts WHERE id = ?`).run(query.id);
        }
      },
      findMany(query) {
        if (query?.userId) {
          return db.prepare(`SELECT * FROM accounts WHERE userId = ?`).all(query.userId);
        }
        return [];
      },
    },
    verification: {
      create(verification) {
        const id = verification.id || generateId();
        const now = Date.now();
        db.prepare(
          `
          INSERT INTO verification (id, identifier, value, expiresAt, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(id, verification.identifier, verification.value, verification.expiresAt, now);
        return db.prepare(`SELECT * FROM verification WHERE id = ?`).get(id);
      },
      findUnique(query) {
        if (query?.token) {
          return db.prepare(`SELECT * FROM verification WHERE value = ?`).get(query.token);
        }
        if (query?.identifier) {
          return db.prepare(`SELECT * FROM verification WHERE identifier = ? ORDER BY createdAt DESC LIMIT 1`).get(query.identifier);
        }
        if (query?.id) {
          return db.prepare(`SELECT * FROM verification WHERE id = ?`).get(query.id);
        }
        return null;
      },
      delete(query) {
        if (query?.token) {
          db.prepare(`DELETE FROM verification WHERE value = ?`).run(query.token);
        } else if (query?.id) {
          db.prepare(`DELETE FROM verification WHERE id = ?`).run(query.id);
        }
      },
    },
  };
}
