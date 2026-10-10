import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const isProduction = process.env.NODE_ENV === "production";
const globalForDb = globalThis as typeof globalThis & {
  __atelierPlusPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__atelierPlusPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Vercel can create many short-lived function instances. Keep each one
    // to a single server-side connection when DATABASE_URL uses Neon pooling.
    max: isProduction ? 1 : 10,
    idleTimeoutMillis: isProduction ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (!isProduction) {
  globalForDb.__atelierPlusPostgresqlPool = pool;
}

export const db = drizzle(pool);
