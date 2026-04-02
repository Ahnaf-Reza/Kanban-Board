import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "[SETUP_REQUIRED] DATABASE_URL is not set. Go to your Vercel project Settings > Environment Variables and add DATABASE_URL with your PostgreSQL connection string, then redeploy."
    );
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

const prisma = globalForPrisma.__kanbanPrismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__kanbanPrismaClient = prisma;
}

export { prisma };

