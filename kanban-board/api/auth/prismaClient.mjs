import { PrismaClient } from "@prisma/client";

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Postgres URL is required in the runtime environment.");
  }

  return databaseUrl;
}

const globalForPrisma = globalThis;

if (!process.env.DATABASE_URL?.trim()) {
  getRequiredDatabaseUrl();
}

const prisma = globalForPrisma.__kanbanPrismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__kanbanPrismaClient = prisma;
}

export { prisma };
