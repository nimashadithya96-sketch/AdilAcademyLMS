import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false
    })
  : null;

export const database = pool ? drizzle(pool, { schema }) : null;

export function requireDatabase() {
  if (!database) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }
  return database;
}
